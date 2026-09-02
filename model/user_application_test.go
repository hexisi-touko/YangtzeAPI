package model

import (
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupUserApplicationTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB, previousLogDB := DB, LOG_DB
	previousRedisEnabled := common.RedisEnabled
	previousDatabaseType, previousLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()
	common.RedisEnabled = false
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	DB, LOG_DB = db, db
	require.NoError(t, db.AutoMigrate(&User{}, &UserApplication{}, &Token{}, &Log{}, &UserSession{}))

	t.Cleanup(func() {
		DB, LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedisEnabled
		common.SetDatabaseTypes(previousDatabaseType, previousLogDatabaseType)
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func TestCreateUserApplicationCreatesDisabledAccountWithoutToken(t *testing.T) {
	db := setupUserApplicationTestDB(t)
	user := &User{
		Username:    "pending-member",
		Password:    "password123",
		DisplayName: "Pending Member",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusDisabled,
	}

	application, err := CreateUserApplication(user, 0, "  I need API access for project development.  ")
	require.NoError(t, err)
	assert.Equal(t, UserApplicationStatusPending, application.Status)
	assert.Equal(t, "I need API access for project development.", application.Reason)
	assert.Equal(t, user.Id, application.UserId)

	var storedUser User
	require.NoError(t, db.First(&storedUser, user.Id).Error)
	assert.Equal(t, common.UserStatusDisabled, storedUser.Status)
	assert.NotEqual(t, "password123", storedUser.Password)

	var tokenCount int64
	require.NoError(t, db.Model(&Token{}).Where("user_id = ?", user.Id).Count(&tokenCount).Error)
	assert.Zero(t, tokenCount)
}

func TestApproveUserApplicationEnablesAccountAndIssuesOneToken(t *testing.T) {
	db := setupUserApplicationTestDB(t)
	user := User{
		Username: "approved-member", Password: "password-hash", Role: common.RoleCommonUser,
		Status: common.UserStatusDisabled, Group: "default", AuthVersion: 1, AffCode: "approved-aff",
	}
	require.NoError(t, db.Create(&user).Error)
	application := UserApplication{
		UserId: user.Id, Reason: "Project API integration and testing.", Status: UserApplicationStatusPending,
	}
	require.NoError(t, db.Create(&application).Error)
	reviewer := User{
		Username: "reviewer", Password: "password-hash", Role: common.RoleRootUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "reviewer-aff",
	}
	require.NoError(t, db.Create(&reviewer).Error)
	token := &Token{
		Key: "approved-key", Status: common.TokenStatusEnabled, CreatedTime: 100,
		AccessedTime: 100, ExpiredTime: -1, UnlimitedQuota: true,
	}

	approved, err := ApproveUserApplication(application.Id, reviewer.Id, "Approved for project work", token)
	require.NoError(t, err)
	assert.Equal(t, UserApplicationStatusApproved, approved.Status)
	require.NotNil(t, approved.IssuedTokenId)
	assert.Equal(t, token.Id, *approved.IssuedTokenId)

	var storedUser User
	require.NoError(t, db.First(&storedUser, user.Id).Error)
	assert.Equal(t, common.UserStatusEnabled, storedUser.Status)
	assert.EqualValues(t, 2, storedUser.AuthVersion)

	var storedToken Token
	require.NoError(t, db.First(&storedToken, token.Id).Error)
	assert.Equal(t, user.Id, storedToken.UserId)
	assert.Equal(t, "default", storedToken.Group)

	duplicateToken := &Token{Key: "duplicate-key", Status: common.TokenStatusEnabled}
	_, err = ApproveUserApplication(application.Id, reviewer.Id, "second click", duplicateToken)
	require.ErrorIs(t, err, ErrUserApplicationAlreadyReviewed)
	var tokenCount int64
	require.NoError(t, db.Model(&Token{}).Where("user_id = ?", user.Id).Count(&tokenCount).Error)
	assert.EqualValues(t, 1, tokenCount)
}

func TestRejectUserApplicationKeepsAccountDisabledAndRequiresNewDecision(t *testing.T) {
	db := setupUserApplicationTestDB(t)
	user := User{
		Username: "rejected-member", Password: "password-hash", Role: common.RoleCommonUser,
		Status: common.UserStatusDisabled, Group: "default", AuthVersion: 1, AffCode: "rejected-aff",
	}
	require.NoError(t, db.Create(&user).Error)
	application := UserApplication{
		UserId: user.Id, Reason: "Need access for an unspecified task.", Status: UserApplicationStatusPending,
	}
	require.NoError(t, db.Create(&application).Error)
	reviewer := User{
		Username: "reject-reviewer", Password: "password-hash", Role: common.RoleRootUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "reject-reviewer-aff",
	}
	require.NoError(t, db.Create(&reviewer).Error)

	rejected, err := RejectUserApplication(application.Id, reviewer.Id, "Please provide a concrete project use case")
	require.NoError(t, err)
	assert.Equal(t, UserApplicationStatusRejected, rejected.Status)
	assert.Equal(t, "Please provide a concrete project use case", rejected.ReviewComment)

	var storedUser User
	require.NoError(t, db.First(&storedUser, user.Id).Error)
	assert.Equal(t, common.UserStatusDisabled, storedUser.Status)
	var tokenCount int64
	require.NoError(t, db.Model(&Token{}).Where("user_id = ?", user.Id).Count(&tokenCount).Error)
	assert.Zero(t, tokenCount)
}
