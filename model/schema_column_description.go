package model

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
)

type SchemaColumnDescription struct {
	DatabaseTableName string `json:"table_name" gorm:"column:table_name;type:varchar(64);primaryKey;comment:数据库表名"`
	ColumnName        string `json:"column_name" gorm:"column:column_name;type:varchar(64);primaryKey;comment:数据库字段名"`
	TableDescription  string `json:"table_description" gorm:"column:table_description;type:varchar(255);not null;comment:表中文说明"`
	ColumnDescription string `json:"column_description" gorm:"column:column_description;type:varchar(255);not null;comment:字段中文说明"`
}

func (SchemaColumnDescription) TableName() string {
	return "schema_column_descriptions"
}

var applicationSchemaDescriptions = []SchemaColumnDescription{
	{DatabaseTableName: "user_applications", ColumnName: "id", TableDescription: "用户注册申请表", ColumnDescription: "申请编号"},
	{DatabaseTableName: "user_applications", ColumnName: "user_id", TableDescription: "用户注册申请表", ColumnDescription: "申请用户编号，关联 users.id"},
	{DatabaseTableName: "user_applications", ColumnName: "reason", TableDescription: "用户注册申请表", ColumnDescription: "注册申请理由"},
	{DatabaseTableName: "user_applications", ColumnName: "status", TableDescription: "用户注册申请表", ColumnDescription: "审核状态：pending、approved 或 rejected"},
	{DatabaseTableName: "user_applications", ColumnName: "reviewer_id", TableDescription: "用户注册申请表", ColumnDescription: "审核管理员编号，关联 users.id"},
	{DatabaseTableName: "user_applications", ColumnName: "review_comment", TableDescription: "用户注册申请表", ColumnDescription: "管理员审核意见"},
	{DatabaseTableName: "user_applications", ColumnName: "reviewed_at", TableDescription: "用户注册申请表", ColumnDescription: "审核完成时间，Unix 时间戳"},
	{DatabaseTableName: "user_applications", ColumnName: "issued_token_id", TableDescription: "用户注册申请表", ColumnDescription: "审核通过后签发的令牌编号"},
	{DatabaseTableName: "user_applications", ColumnName: "created_at", TableDescription: "用户注册申请表", ColumnDescription: "申请创建时间，Unix 时间戳"},
	{DatabaseTableName: "user_applications", ColumnName: "updated_at", TableDescription: "用户注册申请表", ColumnDescription: "最后更新时间，Unix 时间戳"},
	{DatabaseTableName: "password_reset_applications", ColumnName: "id", TableDescription: "密码重置申请表", ColumnDescription: "申请编号"},
	{DatabaseTableName: "password_reset_applications", ColumnName: "user_id", TableDescription: "密码重置申请表", ColumnDescription: "申请用户编号，关联 users.id"},
	{DatabaseTableName: "password_reset_applications", ColumnName: "secret_hash", TableDescription: "密码重置申请表", ColumnDescription: "一次性申请凭证的哈希值，不存储明文凭证"},
	{DatabaseTableName: "password_reset_applications", ColumnName: "reason", TableDescription: "密码重置申请表", ColumnDescription: "找回密码申请理由"},
	{DatabaseTableName: "password_reset_applications", ColumnName: "status", TableDescription: "密码重置申请表", ColumnDescription: "审核状态：pending、approved 或 rejected"},
	{DatabaseTableName: "password_reset_applications", ColumnName: "reviewer_id", TableDescription: "密码重置申请表", ColumnDescription: "审核管理员编号，关联 users.id"},
	{DatabaseTableName: "password_reset_applications", ColumnName: "review_note", TableDescription: "密码重置申请表", ColumnDescription: "管理员审核说明"},
	{DatabaseTableName: "password_reset_applications", ColumnName: "reviewed_at", TableDescription: "密码重置申请表", ColumnDescription: "审核完成时间，Unix 时间戳"},
	{DatabaseTableName: "password_reset_applications", ColumnName: "used_at", TableDescription: "密码重置申请表", ColumnDescription: "密码重置完成时间，Unix 时间戳"},
	{DatabaseTableName: "password_reset_applications", ColumnName: "expires_at", TableDescription: "密码重置申请表", ColumnDescription: "申请过期时间，Unix 时间戳"},
	{DatabaseTableName: "password_reset_applications", ColumnName: "created_at", TableDescription: "密码重置申请表", ColumnDescription: "申请创建时间，Unix 时间戳"},
	{DatabaseTableName: "password_reset_applications", ColumnName: "updated_at", TableDescription: "密码重置申请表", ColumnDescription: "最后更新时间，Unix 时间戳"},
}

func InitializeApplicationSchemaDescriptions() error {
	if !common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		return nil
	}
	for _, description := range applicationSchemaDescriptions {
		if err := DB.Save(&description).Error; err != nil {
			return fmt.Errorf("save schema description for %s.%s: %w", description.DatabaseTableName, description.ColumnName, err)
		}
	}
	return DB.Exec(`CREATE VIEW IF NOT EXISTS "数据库字段中文注释" AS
		SELECT table_name AS "表名",
		       column_name AS "字段名",
		       table_description AS "表说明",
		       column_description AS "字段说明"
		FROM schema_column_descriptions
		ORDER BY table_name, column_name`).Error
}
