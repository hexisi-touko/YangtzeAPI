package common

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeKimiToolSchemas(t *testing.T) {
	input := []byte(`{"model":"kimi-k3","input":"hello","tools":[{"type":"function","name":"automation_update","parameters":{"type":"object","properties":{"prompt":{"$ref":"#/$defs/__schema20","description":"prompt"},"$ref":{"type":"string"}},"$defs":{"__schema20":{"$ref":"#/$defs/text","type":"string","minLength":1,"allOf":[{"maxLength":100}]},"text":{"type":"string"}},"default":{"$ref":"literal","type":"data"},"examples":[{"$ref":"literal","type":"data"}]}}]}`)
	output, err := NormalizeKimiToolSchemas(input, "kimi-k3")
	require.NoError(t, err)
	assert.JSONEq(t, `{"model":"kimi-k3","input":"hello","tools":[{"type":"function","name":"automation_update","parameters":{"type":"object","properties":{"prompt":{"allOf":[{"$ref":"#/$defs/__schema20"}],"description":"prompt"},"$ref":{"type":"string"}},"$defs":{"__schema20":{"type":"string","minLength":1,"allOf":[{"maxLength":100},{"$ref":"#/$defs/text"}]},"text":{"type":"string"}},"default":{"$ref":"literal","type":"data"},"examples":[{"$ref":"literal","type":"data"}]}}]}`, string(output))
	again, err := NormalizeKimiToolSchemas(output, "kimi-k3")
	require.NoError(t, err)
	assert.Equal(t, output, again)
	for _, model := range []string{"gpt-5.6-terra", "not-kimi-k3"} {
		unchanged, err := NormalizeKimiToolSchemas(input, model)
		require.NoError(t, err)
		assert.Equal(t, input, unchanged)
	}
}

func TestNormalizeKimiToolSchemasNestedToolsAndExactNumbers(t *testing.T) {
	input := []byte(`{"tools":[{"type":"namespace","name":"functions","tools":[{"type":"function","name":"task","parameters":{"type":"object","$ref":"#/$defs/root","$defs":{"root":{"type":"object"}},"properties":{"items":{"items":[{"$ref":"#/$defs/root","description":"item"}]},"count":{"const":9007199254740993}},"additionalProperties":false}}]},{"type":"function","function":{"name":"chat_tool","parameters":{"type":"object","properties":{"id":{"$ref":"#/$defs/id","type":"integer"}},"$defs":{"id":{"type":"integer"}}}}}],"input":[{"text":"leave unchanged"}]}`)
	output, err := NormalizeKimiToolSchemas(input, "kimi-k3")
	require.NoError(t, err)
	assert.Contains(t, string(output), "9007199254740993")
	var payload map[string]any
	require.NoError(t, common.Unmarshal(output, &payload))
	tools := payload["tools"].([]any)
	nested := tools[0].(map[string]any)["tools"].([]any)[0].(map[string]any)["parameters"].(map[string]any)
	assert.NotContains(t, nested, "$ref")
	assert.Equal(t, "object", nested["type"])
	assert.Equal(t, false, nested["additionalProperties"])
	chat := tools[1].(map[string]any)["function"].(map[string]any)["parameters"].(map[string]any)
	assert.NotContains(t, chat["properties"].(map[string]any)["id"], "$ref")
	assert.Len(t, tools[1].(map[string]any)["function"], 2)
}
