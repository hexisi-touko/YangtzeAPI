package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInitializeApplicationSchemaDescriptionsCreatesChineseDictionary(t *testing.T) {
	db := setupUserApplicationTestDB(t)
	require.NoError(t, InitializeApplicationSchemaDescriptions())

	var count int64
	require.NoError(t, db.Model(&SchemaColumnDescription{}).Count(&count).Error)
	assert.EqualValues(t, len(applicationSchemaDescriptions), count)

	var description SchemaColumnDescription
	require.NoError(t, db.First(&description, "table_name = ? AND column_name = ?", "user_applications", "reason").Error)
	assert.Equal(t, "用户注册申请表", description.TableDescription)
	assert.Equal(t, "注册申请理由", description.ColumnDescription)

	var viewRow struct {
		TableName         string `gorm:"column:表名"`
		ColumnName        string `gorm:"column:字段名"`
		ColumnDescription string `gorm:"column:字段说明"`
	}
	require.NoError(t, db.Table("数据库字段中文注释").Where("字段名 = ?", "secret_hash").Take(&viewRow).Error)
	assert.Equal(t, "password_reset_applications", viewRow.TableName)
	assert.Equal(t, "secret_hash", viewRow.ColumnName)
	assert.Equal(t, "一次性申请凭证的哈希值，不存储明文凭证", viewRow.ColumnDescription)
}
