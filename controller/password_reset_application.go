package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type passwordResetApplicationRequest struct {
	Username string `json:"username"`
	Reason   string `json:"reason"`
}

type passwordResetCapabilityRequest struct {
	ApplicationId json.RawMessage `json:"application_id"`
	Secret        string          `json:"application_secret"`
	NewPassword   string          `json:"new_password"`
}

func parsePasswordResetApplicationId(raw json.RawMessage) (int, error) {
	if len(raw) == 0 {
		return 0, errors.New("missing application id")
	}
	var value interface{}
	if err := json.Unmarshal(raw, &value); err != nil {
		return 0, err
	}
	var text string
	switch typed := value.(type) {
	case string:
		text = typed
	case float64:
		if typed != float64(int(typed)) {
			return 0, errors.New("invalid application id")
		}
		text = strconv.Itoa(int(typed))
	default:
		return 0, errors.New("invalid application id")
	}
	id, err := strconv.Atoi(strings.TrimSpace(text))
	if err != nil || id <= 0 {
		return 0, errors.New("invalid application id")
	}
	return id, nil
}

func passwordResetStatusData(application *model.PasswordResetApplication) gin.H {
	return gin.H{
		"application_id": application.Id,
		"status":         application.Status,
		"review_note":    application.ReviewNote,
		"reviewed_at":    application.ReviewedAt,
		"expires_at":     application.ExpiresAt,
		"used_at":        application.UsedAt,
		"created_at":     application.CreatedAt,
	}
}

func writePasswordResetApplicationBusinessError(c *gin.Context, code, message string) {
	c.JSON(200, gin.H{"success": false, "code": code, "message": message})
}

func writePasswordResetApplicationError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, model.ErrPasswordResetApplicationNotFound),
		errors.Is(err, model.ErrPasswordResetApplicationInvalidSecret):
		writePasswordResetApplicationBusinessError(c, "PASSWORD_RESET_APPLICATION_INVALID", "找回密码申请不存在或凭证无效")
	case errors.Is(err, model.ErrPasswordResetApplicationPending):
		writePasswordResetApplicationBusinessError(c, "PASSWORD_RESET_APPLICATION_PENDING", "已有待处理的找回密码申请")
	case errors.Is(err, model.ErrPasswordResetApplicationAlreadyReviewed):
		writePasswordResetApplicationBusinessError(c, "PASSWORD_RESET_APPLICATION_REVIEWED", "该申请已经处理")
	case errors.Is(err, model.ErrPasswordResetApplicationExpired):
		writePasswordResetApplicationBusinessError(c, "PASSWORD_RESET_APPLICATION_EXPIRED", "找回密码申请已过期，请重新提交")
	case errors.Is(err, model.ErrPasswordResetApplicationAlreadyUsed):
		writePasswordResetApplicationBusinessError(c, "PASSWORD_RESET_APPLICATION_USED", "该申请已经完成，不能重复使用")
	case errors.Is(err, model.ErrPasswordResetApplicationNotApproved):
		writePasswordResetApplicationBusinessError(c, "PASSWORD_RESET_APPLICATION_NOT_APPROVED", "申请尚未通过审核")
	default:
		common.ApiError(c, err)
	}
}

func SubmitPasswordResetApplication(c *gin.Context) {
	request := passwordResetApplicationRequest{}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		writePasswordResetApplicationBusinessError(c, "INVALID_INPUT", "请求参数无效")
		return
	}
	reason, err := normalizeApplicationReason(request.Reason)
	if err != nil || strings.TrimSpace(request.Username) == "" {
		writePasswordResetApplicationBusinessError(c, "INVALID_INPUT", "用户名和申请理由不能为空")
		return
	}
	application, secret, err := model.CreatePasswordResetApplication(request.Username, reason)
	if err != nil {
		writePasswordResetApplicationError(c, err)
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "找回密码申请已提交，请等待管理员处理",
		"data": gin.H{
			"application_id":     application.Id,
			"application_secret": secret,
			"status":             application.Status,
		},
	})
}

func GetPasswordResetApplicationStatus(c *gin.Context) {
	request := passwordResetCapabilityRequest{}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		writePasswordResetApplicationBusinessError(c, "INVALID_INPUT", "请求参数无效")
		return
	}
	applicationId, err := parsePasswordResetApplicationId(request.ApplicationId)
	if err != nil {
		writePasswordResetApplicationBusinessError(c, "INVALID_INPUT", "申请编号无效")
		return
	}
	application, err := model.GetPasswordResetApplication(applicationId, request.Secret)
	if err != nil {
		writePasswordResetApplicationError(c, err)
		return
	}
	message := "申请仍在审核中"
	if application.Status == model.PasswordResetApplicationStatusApproved {
		message = "申请已通过，请设置新密码"
	} else if application.Status == model.PasswordResetApplicationStatusRejected {
		message = "申请未通过审核"
	}
	c.JSON(200, gin.H{"success": true, "message": message, "data": passwordResetStatusData(application)})
}

func CompletePasswordResetApplication(c *gin.Context) {
	request := passwordResetCapabilityRequest{}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		writePasswordResetApplicationBusinessError(c, "INVALID_INPUT", "请求参数无效")
		return
	}
	applicationId, err := parsePasswordResetApplicationId(request.ApplicationId)
	passwordLength := utf8.RuneCountInString(request.NewPassword)
	if err != nil || passwordLength < 8 || passwordLength > 20 {
		writePasswordResetApplicationBusinessError(c, "INVALID_INPUT", "新密码长度必须为 8 至 20 个字符")
		return
	}
	_, err = model.CompletePasswordResetApplication(applicationId, request.Secret, request.NewPassword)
	if err != nil {
		writePasswordResetApplicationError(c, err)
		return
	}
	c.JSON(200, gin.H{"success": true, "message": "密码重置成功，请返回登录"})
}

func AdminListPasswordResetApplications(c *gin.Context) {
	status := model.PasswordResetApplicationStatus(strings.TrimSpace(c.Query("status")))
	if status != "" && !model.IsValidPasswordResetApplicationStatus(status) {
		writePasswordResetApplicationBusinessError(c, "INVALID_INPUT", "审核状态无效")
		return
	}
	pageInfo := common.GetPageQuery(c)
	applications, total, err := model.GetPasswordResetApplications(status, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(applications)
	common.ApiSuccess(c, pageInfo)
}

func AdminApprovePasswordResetApplication(c *gin.Context) {
	adminReviewPasswordResetApplication(c, true)
}

func AdminRejectPasswordResetApplication(c *gin.Context) {
	adminReviewPasswordResetApplication(c, false)
}

func adminReviewPasswordResetApplication(c *gin.Context, approve bool) {
	applicationId, err := strconv.Atoi(c.Param("id"))
	if err != nil || applicationId <= 0 {
		writePasswordResetApplicationBusinessError(c, "INVALID_INPUT", "申请编号无效")
		return
	}
	request := applicationDecisionRequest{}
	if c.Request.ContentLength != 0 {
		if err := common.DecodeJson(c.Request.Body, &request); err != nil {
			writePasswordResetApplicationBusinessError(c, "INVALID_INPUT", "请求参数无效")
			return
		}
	}
	reviewNote, err := normalizeReviewComment(request.ReviewComment, !approve)
	if err != nil {
		writePasswordResetApplicationBusinessError(c, "INVALID_INPUT", "拒绝时必须填写原因，审核说明最多 500 个字符")
		return
	}
	var application *model.PasswordResetApplication
	if approve {
		application, err = model.ApprovePasswordResetApplication(applicationId, c.GetInt("id"), reviewNote)
	} else {
		application, err = model.RejectPasswordResetApplication(applicationId, c.GetInt("id"), reviewNote)
	}
	if err != nil {
		writePasswordResetApplicationError(c, err)
		return
	}
	action := "approve"
	message := "找回密码申请已批准"
	if !approve {
		action = "reject"
		message = "找回密码申请已拒绝"
	}
	recordManageAuditFor(c, application.UserId, fmt.Sprintf("user.password_reset_application.%s", action), map[string]interface{}{
		"application_id": application.Id,
	})
	c.JSON(200, gin.H{"success": true, "message": message, "data": passwordResetStatusData(application)})
}
