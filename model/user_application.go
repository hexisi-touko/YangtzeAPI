package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

type UserApplicationStatus string

const (
	UserApplicationStatusPending  UserApplicationStatus = "pending"
	UserApplicationStatusApproved UserApplicationStatus = "approved"
	UserApplicationStatusRejected UserApplicationStatus = "rejected"
)

var (
	ErrUserApplicationNotFound        = errors.New("user application not found")
	ErrUserApplicationAlreadyReviewed = errors.New("user application has already been reviewed")
)

type UserApplication struct {
	Id            int                   `json:"id"`
	UserId        int                   `json:"user_id" gorm:"not null;index"`
	Reason        string                `json:"reason" gorm:"type:text;not null"`
	Status        UserApplicationStatus `json:"status" gorm:"type:varchar(16);not null;index"`
	ReviewerId    *int                  `json:"reviewer_id" gorm:"index"`
	ReviewComment string                `json:"review_comment" gorm:"type:text"`
	ReviewedAt    int64                 `json:"reviewed_at" gorm:"bigint;default:0"`
	IssuedTokenId *int                  `json:"issued_token_id" gorm:"index"`
	CreatedAt     int64                 `json:"created_at" gorm:"bigint;autoCreateTime"`
	UpdatedAt     int64                 `json:"updated_at" gorm:"bigint;autoUpdateTime"`
}

type UserApplicationListItem struct {
	UserApplication
	Username         string `json:"username"`
	DisplayName      string `json:"display_name"`
	Email            string `json:"email"`
	UserStatus       int    `json:"user_status"`
	ReviewerUsername string `json:"reviewer_username"`
}

func IsValidUserApplicationStatus(status UserApplicationStatus) bool {
	switch status {
	case UserApplicationStatusPending, UserApplicationStatusApproved, UserApplicationStatusRejected:
		return true
	default:
		return false
	}
}

// CreateUserApplication creates the disabled account and its application in
// one transaction so neither record can exist without the other.
func CreateUserApplication(user *User, inviterId int, reason string) (*UserApplication, error) {
	application := &UserApplication{
		Reason: strings.TrimSpace(reason),
		Status: UserApplicationStatusPending,
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := user.InsertWithTx(tx, inviterId); err != nil {
			return err
		}
		application.UserId = user.Id
		return tx.Create(application).Error
	})
	if err != nil {
		return nil, err
	}

	return application, nil
}

func GetLatestUserApplication(userId int) (*UserApplication, error) {
	application := &UserApplication{}
	if err := DB.Where("user_id = ?", userId).Order("id desc").First(application).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserApplicationNotFound
		}
		return nil, err
	}
	return application, nil
}

func GetUserApplications(status UserApplicationStatus, offset int, limit int) ([]UserApplicationListItem, int64, error) {
	query := DB.Table("user_applications")
	if status != "" {
		query = query.Where("user_applications.status = ?", status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	applications := make([]UserApplicationListItem, 0)
	err := query.
		Select(`user_applications.*,
			applicants.username AS username,
			applicants.display_name AS display_name,
			applicants.email AS email,
			applicants.status AS user_status,
			COALESCE(reviewers.username, '') AS reviewer_username`).
		Joins("JOIN users AS applicants ON applicants.id = user_applications.user_id").
		Joins("LEFT JOIN users AS reviewers ON reviewers.id = user_applications.reviewer_id").
		Order("user_applications.id desc").
		Offset(offset).
		Limit(limit).
		Scan(&applications).Error
	return applications, total, err
}

func ApproveUserApplication(applicationId int, reviewerId int, reviewComment string, token *Token) (*UserApplication, error) {
	application := &UserApplication{}
	approvedUser := &User{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).First(application, applicationId).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrUserApplicationNotFound
			}
			return err
		}
		if application.Status != UserApplicationStatusPending {
			return ErrUserApplicationAlreadyReviewed
		}

		if err := lockForUpdate(tx).First(approvedUser, application.UserId).Error; err != nil {
			return err
		}
		approvedUser.Status = common.UserStatusEnabled
		if err := approvedUser.UpdateWithTx(tx, false); err != nil {
			return err
		}

		token.UserId = approvedUser.Id
		if token.Name == "" {
			token.Name = approvedUser.Username + " approved access key"
		}
		if token.Group == "" {
			token.Group = approvedUser.Group
		}
		if err := tx.Create(token).Error; err != nil {
			return err
		}

		now := common.GetTimestamp()
		reviewer := reviewerId
		tokenId := token.Id
		application.Status = UserApplicationStatusApproved
		application.ReviewerId = &reviewer
		application.ReviewComment = strings.TrimSpace(reviewComment)
		application.ReviewedAt = now
		application.UpdatedAt = now
		application.IssuedTokenId = &tokenId
		return tx.Model(application).Select(
			"status", "reviewer_id", "review_comment", "reviewed_at", "issued_token_id", "updated_at",
		).Updates(application).Error
	})
	if err != nil {
		return nil, err
	}

	approvedUser.FinishInsert(approvedUser.InviterId)
	if err := PublishUserAuthCache(application.UserId); err != nil {
		common.SysLog("failed to publish approved user cache: " + err.Error())
	}
	if err := InvalidateUserTokensCache(application.UserId); err != nil {
		common.SysLog("failed to invalidate approved user token cache: " + err.Error())
	}
	return application, nil
}

func RejectUserApplication(applicationId int, reviewerId int, reviewComment string) (*UserApplication, error) {
	application := &UserApplication{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).First(application, applicationId).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrUserApplicationNotFound
			}
			return err
		}
		if application.Status != UserApplicationStatusPending {
			return ErrUserApplicationAlreadyReviewed
		}

		reviewer := reviewerId
		application.Status = UserApplicationStatusRejected
		application.ReviewerId = &reviewer
		application.ReviewComment = strings.TrimSpace(reviewComment)
		application.ReviewedAt = common.GetTimestamp()
		application.UpdatedAt = application.ReviewedAt
		return tx.Model(application).Select(
			"status", "reviewer_id", "review_comment", "reviewed_at", "updated_at",
		).Updates(application).Error
	})
	if err != nil {
		return nil, err
	}
	return application, nil
}
