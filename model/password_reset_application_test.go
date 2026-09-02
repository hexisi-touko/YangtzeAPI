package model

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedPasswordResetUser(t *testing.T, username, password string) User {
	t.Helper()
	hashedPassword, err := common.Password2Hash(password)
	require.NoError(t, err)
	user := User{
		Username: username, Password: hashedPassword, Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: username + "-aff",
	}
	require.NoError(t, DB.Create(&user).Error)
	return user
}

func TestPasswordResetApplicationStoresOnlySecretHashAndCompletesOnce(t *testing.T) {
	db := setupUserApplicationTestDB(t)
	user := seedPasswordResetUser(t, "reset-member", "old-password")
	reviewer := seedPasswordResetUser(t, "reset-reviewer", "review-password")
	registrationToken := Token{
		UserId: user.Id,
		Key:    "registration-issued-key",
		Name:   "注册审核分发的 Key",
		Status: common.TokenStatusEnabled,
	}
	require.NoError(t, DB.Create(&registrationToken).Error)

	application, secret, err := CreatePasswordResetApplication(user.Username, "I lost my password and need project access restored.")
	require.NoError(t, err)
	assert.NotEmpty(t, secret)
	assert.NotEqual(t, secret, application.SecretHash)
	serialized, err := json.Marshal(application)
	require.NoError(t, err)
	assert.NotContains(t, string(serialized), secret)
	assert.NotContains(t, string(serialized), application.SecretHash)

	_, err = GetPasswordResetApplication(application.Id, "wrong-secret")
	require.ErrorIs(t, err, ErrPasswordResetApplicationInvalidSecret)

	approved, err := ApprovePasswordResetApplication(application.Id, reviewer.Id, "Identity verified")
	require.NoError(t, err)
	assert.Equal(t, PasswordResetApplicationStatusApproved, approved.Status)

	completed, err := CompletePasswordResetApplication(application.Id, secret, "new-password")
	require.NoError(t, err)
	assert.NotZero(t, completed.UsedAt)

	var storedUser User
	require.NoError(t, db.First(&storedUser, user.Id).Error)
	assert.True(t, common.ValidatePasswordAndHash("new-password", storedUser.Password))
	assert.False(t, common.ValidatePasswordAndHash("old-password", storedUser.Password))
	assert.EqualValues(t, 2, storedUser.AuthVersion)

	var storedTokens []Token
	require.NoError(t, db.Where("user_id = ?", user.Id).Find(&storedTokens).Error)
	require.Len(t, storedTokens, 1)
	assert.Equal(t, registrationToken.Id, storedTokens[0].Id)
	assert.Equal(t, "registration-issued-key", storedTokens[0].Key)

	_, err = CompletePasswordResetApplication(application.Id, secret, "another-password")
	require.ErrorIs(t, err, ErrPasswordResetApplicationAlreadyUsed)
}

func TestPasswordResetApplicationRejectsDuplicateActiveRequest(t *testing.T) {
	setupUserApplicationTestDB(t)
	user := seedPasswordResetUser(t, "duplicate-reset-member", "old-password")
	_, _, err := CreatePasswordResetApplication(user.Username, "First password reset request for project access.")
	require.NoError(t, err)
	_, _, err = CreatePasswordResetApplication(user.Username, "Second password reset request for project access.")
	require.ErrorIs(t, err, ErrPasswordResetApplicationPending)
}

func TestRejectedPasswordResetApplicationCannotComplete(t *testing.T) {
	setupUserApplicationTestDB(t)
	user := seedPasswordResetUser(t, "rejected-reset-member", "old-password")
	reviewer := seedPasswordResetUser(t, "reject-reset-reviewer", "review-password")
	application, secret, err := CreatePasswordResetApplication(user.Username, "Password reset request requiring administrator review.")
	require.NoError(t, err)
	_, err = RejectPasswordResetApplication(application.Id, reviewer.Id, "Identity could not be verified")
	require.NoError(t, err)
	_, err = CompletePasswordResetApplication(application.Id, secret, "new-password")
	require.ErrorIs(t, err, ErrPasswordResetApplicationNotApproved)
}
