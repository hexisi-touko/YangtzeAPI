package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

const (
	applicationReasonMinLength = 10
	applicationReasonMaxLength = 500
	reviewCommentMaxLength     = 500
)

type applicationDecisionRequest struct {
	ReviewComment string `json:"review_comment"`
}

func normalizeApplicationReason(reason string) (string, error) {
	reason = strings.TrimSpace(reason)
	length := utf8.RuneCountInString(reason)
	if length < applicationReasonMinLength || length > applicationReasonMaxLength {
		return "", errors.New("application reason must contain 10 to 500 characters")
	}
	return reason, nil
}

func normalizeReviewComment(comment string, required bool) (string, error) {
	comment = strings.TrimSpace(comment)
	length := utf8.RuneCountInString(comment)
	if (required && length == 0) || length > reviewCommentMaxLength {
		return "", errors.New("invalid review comment")
	}
	return comment, nil
}

func applicationStatusData(application *model.UserApplication) gin.H {
	return gin.H{
		"application_id":     application.Id,
		"application_status": application.Status,
		"reason":             application.Reason,
		"review_comment":     application.ReviewComment,
		"reviewed_at":        application.ReviewedAt,
		"created_at":         application.CreatedAt,
	}
}

func writeApplicationLoginError(c *gin.Context, user *model.User) {
	application, err := model.GetLatestUserApplication(user.Id)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserDisabled)
		return
	}

	messageKey := i18n.MsgUserApplicationPending
	code := "APPLICATION_PENDING"
	if application.Status == model.UserApplicationStatusRejected {
		messageKey = i18n.MsgUserApplicationRejected
		code = "APPLICATION_REJECTED"
	} else if application.Status != model.UserApplicationStatusPending {
		common.ApiErrorI18n(c, i18n.MsgUserDisabled)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"code":    code,
		"message": i18n.T(c, messageKey),
		"data":    applicationStatusData(application),
	})
}

// GetOwnApplicationStatus lets a pending applicant query only their own
// review result by proving knowledge of the account password.
func GetOwnApplicationStatus(c *gin.Context) {
	request := LoginRequest{}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	user := model.User{Username: request.Username, Password: request.Password}
	if err := user.ValidateCredentialsAndFill(); err != nil {
		if errors.Is(err, model.ErrDatabase) {
			common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		} else {
			common.ApiErrorI18n(c, i18n.MsgUserUsernameOrPasswordError)
		}
		return
	}
	application, err := model.GetLatestUserApplication(user.Id)
	if err != nil {
		if errors.Is(err, model.ErrUserApplicationNotFound) {
			common.ApiErrorI18n(c, i18n.MsgUserApplicationNotFound)
		} else {
			common.ApiError(c, err)
		}
		return
	}
	common.ApiSuccess(c, applicationStatusData(application))
}

func AdminListUserApplications(c *gin.Context) {
	status := model.UserApplicationStatus(strings.TrimSpace(c.Query("status")))
	if status != "" && !model.IsValidUserApplicationStatus(status) {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	pageInfo := common.GetPageQuery(c)
	applications, total, err := model.GetUserApplications(status, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(applications)
	common.ApiSuccess(c, pageInfo)
}

func AdminApproveUserApplication(c *gin.Context) {
	applicationId, err := strconv.Atoi(c.Param("id"))
	if err != nil || applicationId <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	request := applicationDecisionRequest{}
	if c.Request.ContentLength != 0 {
		if err := common.DecodeJson(c.Request.Body, &request); err != nil {
			common.ApiErrorI18n(c, i18n.MsgInvalidParams)
			return
		}
	}
	reviewComment, err := normalizeReviewComment(request.ReviewComment, false)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserApplicationReviewCommentInvalid)
		return
	}
	key, err := common.GenerateKey()
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgTokenGenerateFailed)
		return
	}
	group := ""
	if setting.DefaultUseAutoGroup {
		group = "auto"
	}
	now := common.GetTimestamp()
	token := &model.Token{
		Key:            key,
		Status:         common.TokenStatusEnabled,
		CreatedTime:    now,
		AccessedTime:   now,
		ExpiredTime:    -1,
		UnlimitedQuota: true,
		Group:          group,
	}
	application, err := model.ApproveUserApplication(applicationId, c.GetInt("id"), reviewComment, token)
	if err != nil {
		writeUserApplicationDecisionError(c, err)
		return
	}
	recordManageAuditFor(c, application.UserId, "user.application.approve", map[string]interface{}{
		"application_id":  application.Id,
		"issued_token_id": token.Id,
	})
	common.ApiSuccessI18n(c, i18n.MsgUserApplicationApproved, applicationStatusData(application))
}

func AdminRejectUserApplication(c *gin.Context) {
	applicationId, err := strconv.Atoi(c.Param("id"))
	if err != nil || applicationId <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	request := applicationDecisionRequest{}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	reviewComment, err := normalizeReviewComment(request.ReviewComment, true)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserApplicationReviewCommentInvalid)
		return
	}
	application, err := model.RejectUserApplication(applicationId, c.GetInt("id"), reviewComment)
	if err != nil {
		writeUserApplicationDecisionError(c, err)
		return
	}
	recordManageAuditFor(c, application.UserId, "user.application.reject", map[string]interface{}{
		"application_id": application.Id,
	})
	common.ApiSuccessI18n(c, i18n.MsgUserApplicationRejectedByAdmin, applicationStatusData(application))
}

func writeUserApplicationDecisionError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, model.ErrUserApplicationNotFound):
		common.ApiErrorI18n(c, i18n.MsgUserApplicationNotFound)
	case errors.Is(err, model.ErrUserApplicationAlreadyReviewed):
		common.ApiErrorI18n(c, i18n.MsgUserApplicationAlreadyReviewed)
	default:
		common.ApiError(c, err)
	}
}
