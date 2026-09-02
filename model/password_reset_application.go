package model

import (
	"crypto/hmac"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

type PasswordResetApplicationStatus string

const (
	PasswordResetApplicationStatusPending  PasswordResetApplicationStatus = "pending"
	PasswordResetApplicationStatusApproved PasswordResetApplicationStatus = "approved"
	PasswordResetApplicationStatusRejected PasswordResetApplicationStatus = "rejected"
	PasswordResetApplicationTTL                                           = 7 * 24 * time.Hour
)

var (
	ErrPasswordResetApplicationNotFound        = errors.New("password reset application not found")
	ErrPasswordResetApplicationPending         = errors.New("password reset application is already pending")
	ErrPasswordResetApplicationAlreadyReviewed = errors.New("password reset application has already been reviewed")
	ErrPasswordResetApplicationInvalidSecret   = errors.New("password reset application secret is invalid")
	ErrPasswordResetApplicationExpired         = errors.New("password reset application has expired")
	ErrPasswordResetApplicationAlreadyUsed     = errors.New("password reset application has already been used")
	ErrPasswordResetApplicationNotApproved     = errors.New("password reset application has not been approved")
)

// PasswordResetApplication stores the review state and only a keyed digest of
// the one-time capability returned to the desktop client.
type PasswordResetApplication struct {
	Id         int                            `json:"id" gorm:"primaryKey;comment:申请编号"`
	UserId     int                            `json:"user_id" gorm:"not null;index;comment:申请用户编号"`
	SecretHash string                         `json:"-" gorm:"type:char(64);not null;comment:一次性申请凭证哈希"`
	Reason     string                         `json:"reason" gorm:"type:text;not null;comment:申请理由"`
	Status     PasswordResetApplicationStatus `json:"status" gorm:"type:varchar(16);not null;index;comment:审核状态"`
	ReviewerId *int                           `json:"reviewer_id" gorm:"index;comment:审核管理员编号"`
	ReviewNote string                         `json:"review_note" gorm:"type:text;comment:审核说明"`
	ReviewedAt int64                          `json:"reviewed_at" gorm:"bigint;default:0;comment:审核时间"`
	UsedAt     int64                          `json:"used_at" gorm:"bigint;default:0;index;comment:完成重置时间"`
	ExpiresAt  int64                          `json:"expires_at" gorm:"bigint;not null;index;comment:申请过期时间"`
	CreatedAt  int64                          `json:"created_at" gorm:"bigint;autoCreateTime;comment:创建时间"`
	UpdatedAt  int64                          `json:"updated_at" gorm:"bigint;autoUpdateTime;comment:更新时间"`
}

func (PasswordResetApplication) TableName() string {
	return "password_reset_applications"
}

type PasswordResetApplicationListItem struct {
	PasswordResetApplication
	Username         string `json:"username"`
	DisplayName      string `json:"display_name"`
	UserStatus       int    `json:"user_status"`
	ReviewerUsername string `json:"reviewer_username"`
}

func IsValidPasswordResetApplicationStatus(status PasswordResetApplicationStatus) bool {
	switch status {
	case PasswordResetApplicationStatusPending,
		PasswordResetApplicationStatusApproved,
		PasswordResetApplicationStatusRejected:
		return true
	default:
		return false
	}
}

func passwordResetSecretHash(secret string) string {
	return common.GenerateHMACWithKey([]byte("password-reset-application-v1:"+common.SessionSecret), secret)
}

func generatePasswordResetSecret() (string, error) {
	random := make([]byte, 32)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(random), nil
}

func validatePasswordResetSecret(application *PasswordResetApplication, secret string) error {
	if application == nil || strings.TrimSpace(secret) == "" {
		return ErrPasswordResetApplicationInvalidSecret
	}
	expected := passwordResetSecretHash(secret)
	if !hmac.Equal([]byte(application.SecretHash), []byte(expected)) {
		return ErrPasswordResetApplicationInvalidSecret
	}
	return nil
}

func CreatePasswordResetApplication(username, reason string) (*PasswordResetApplication, string, error) {
	username = strings.TrimSpace(username)
	reason = strings.TrimSpace(reason)
	var user User
	if err := DB.Where("username = ? AND status = ?", username, common.UserStatusEnabled).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, "", ErrPasswordResetApplicationNotFound
		}
		return nil, "", err
	}
	secret, err := generatePasswordResetSecret()
	if err != nil {
		return nil, "", err
	}
	now := time.Now().Unix()
	application := &PasswordResetApplication{
		UserId:     user.Id,
		SecretHash: passwordResetSecretHash(secret),
		Reason:     reason,
		Status:     PasswordResetApplicationStatusPending,
		ExpiresAt:  time.Now().Add(PasswordResetApplicationTTL).Unix(),
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
		var lockedUser User
		if err := lockForUpdate(tx).Select("id").First(&lockedUser, user.Id).Error; err != nil {
			return err
		}
		var active PasswordResetApplication
		err := lockForUpdate(tx).
			Where("user_id = ? AND status IN ? AND used_at = 0 AND expires_at > ?", user.Id,
				[]PasswordResetApplicationStatus{PasswordResetApplicationStatusPending, PasswordResetApplicationStatusApproved}, now).
			First(&active).Error
		if err == nil {
			return ErrPasswordResetApplicationPending
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		return tx.Create(application).Error
	})
	if err != nil {
		return nil, "", err
	}
	return application, secret, nil
}

func GetPasswordResetApplication(applicationId int, secret string) (*PasswordResetApplication, error) {
	application := &PasswordResetApplication{}
	if err := DB.First(application, applicationId).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPasswordResetApplicationNotFound
		}
		return nil, err
	}
	if err := validatePasswordResetSecret(application, secret); err != nil {
		return nil, err
	}
	if application.UsedAt != 0 {
		return nil, ErrPasswordResetApplicationAlreadyUsed
	}
	if application.ExpiresAt <= time.Now().Unix() {
		return nil, ErrPasswordResetApplicationExpired
	}
	return application, nil
}

func GetPasswordResetApplications(status PasswordResetApplicationStatus, offset, limit int) ([]PasswordResetApplicationListItem, int64, error) {
	query := DB.Table("password_reset_applications")
	if status != "" {
		query = query.Where("password_reset_applications.status = ?", status)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	items := make([]PasswordResetApplicationListItem, 0)
	err := query.
		Select(`password_reset_applications.*,
			applicants.username AS username,
			applicants.display_name AS display_name,
			applicants.status AS user_status,
			COALESCE(reviewers.username, '') AS reviewer_username`).
		Joins("JOIN users AS applicants ON applicants.id = password_reset_applications.user_id").
		Joins("LEFT JOIN users AS reviewers ON reviewers.id = password_reset_applications.reviewer_id").
		Order("password_reset_applications.id desc").
		Offset(offset).
		Limit(limit).
		Scan(&items).Error
	return items, total, err
}

func ApprovePasswordResetApplication(applicationId, reviewerId int, reviewNote string) (*PasswordResetApplication, error) {
	application := &PasswordResetApplication{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).First(application, applicationId).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrPasswordResetApplicationNotFound
			}
			return err
		}
		if application.UsedAt != 0 {
			return ErrPasswordResetApplicationAlreadyUsed
		}
		if application.ExpiresAt <= time.Now().Unix() {
			return ErrPasswordResetApplicationExpired
		}
		if application.Status != PasswordResetApplicationStatusPending {
			return ErrPasswordResetApplicationAlreadyReviewed
		}
		now := time.Now().Unix()
		application.Status = PasswordResetApplicationStatusApproved
		application.ReviewerId = &reviewerId
		application.ReviewNote = strings.TrimSpace(reviewNote)
		application.ReviewedAt = now
		application.UpdatedAt = now
		return tx.Model(application).Select("status", "reviewer_id", "review_note", "reviewed_at", "updated_at").Updates(application).Error
	})
	return application, err
}

func RejectPasswordResetApplication(applicationId, reviewerId int, reviewNote string) (*PasswordResetApplication, error) {
	application := &PasswordResetApplication{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).First(application, applicationId).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrPasswordResetApplicationNotFound
			}
			return err
		}
		if application.Status != PasswordResetApplicationStatusPending {
			return ErrPasswordResetApplicationAlreadyReviewed
		}
		now := time.Now().Unix()
		application.Status = PasswordResetApplicationStatusRejected
		application.ReviewerId = &reviewerId
		application.ReviewNote = strings.TrimSpace(reviewNote)
		application.ReviewedAt = now
		application.UpdatedAt = now
		return tx.Model(application).Select("status", "reviewer_id", "review_note", "reviewed_at", "updated_at").Updates(application).Error
	})
	return application, err
}

func CompletePasswordResetApplication(applicationId int, secret, newPassword string) (*PasswordResetApplication, error) {
	hashedPassword, err := common.Password2Hash(newPassword)
	if err != nil {
		return nil, err
	}
	application := &PasswordResetApplication{}
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).First(application, applicationId).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrPasswordResetApplicationNotFound
			}
			return err
		}
		if err := validatePasswordResetSecret(application, secret); err != nil {
			return err
		}
		if application.UsedAt != 0 {
			return ErrPasswordResetApplicationAlreadyUsed
		}
		if application.ExpiresAt <= time.Now().Unix() {
			return ErrPasswordResetApplicationExpired
		}
		if application.Status != PasswordResetApplicationStatusApproved {
			return ErrPasswordResetApplicationNotApproved
		}
		if _, err := IncrementUserAuthVersionWithTx(tx, application.UserId); err != nil {
			return err
		}
		if err := tx.Model(&User{}).Where("id = ?", application.UserId).Update("password", hashedPassword).Error; err != nil {
			return err
		}
		now := time.Now().Unix()
		result := tx.Model(&PasswordResetApplication{}).
			Where("id = ? AND status = ? AND used_at = 0", application.Id, PasswordResetApplicationStatusApproved).
			Updates(map[string]interface{}{"used_at": now, "updated_at": now})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrPasswordResetApplicationAlreadyUsed
		}
		application.UsedAt = now
		application.UpdatedAt = now
		return nil
	})
	if err != nil {
		return nil, err
	}
	if err := PublishUserAuthCache(application.UserId); err != nil {
		return nil, err
	}
	if _, err := RevokeAllUserSessions(application.UserId, "password_reset_application"); err != nil {
		return nil, err
	}
	return application, nil
}
