package common

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// NormalizeKimiToolSchemas adapts modern $ref siblings for Moonshot's validator.
// A conjunction preserves constraints without expanding recursive references.
// Only schema-valued keywords are visited; examples/defaults remain literal data.
func NormalizeKimiToolSchemas(body []byte, upstreamModel string) ([]byte, error) {
	model := strings.ToLower(upstreamModel)
	if !strings.HasPrefix(model, "kimi-") && !strings.HasPrefix(model, "moonshot-") {
		return body, nil
	}
	var request map[string]json.RawMessage
	if err := common.Unmarshal(body, &request); err != nil {
		return nil, err
	}
	tools, changed, err := normalizeKimiTools(request["tools"])
	if err != nil {
		return nil, err
	}
	if !changed {
		return body, nil
	}
	request["tools"] = tools
	return common.Marshal(request)
}

func normalizeKimiTools(raw json.RawMessage) (json.RawMessage, bool, error) {
	if common.GetJsonType(raw) != "array" {
		return raw, false, nil
	}
	var tools []map[string]json.RawMessage
	if err := common.Unmarshal(raw, &tools); err != nil {
		return nil, false, err
	}
	changed := false
	for _, tool := range tools {
		var kind string
		_ = common.Unmarshal(tool["type"], &kind)
		if kind == "namespace" {
			value, updated, err := normalizeKimiTools(tool["tools"])
			if err != nil {
				return nil, false, err
			}
			if updated {
				tool["tools"] = value
				changed = true
			}
		}
		if kind != "function" {
			continue
		}
		parameters := tool
		nested := common.GetJsonType(tool["function"]) == "object"
		if nested {
			parameters = nil
			if err := common.Unmarshal(tool["function"], &parameters); err != nil {
				return nil, false, err
			}
		}
		value, updated, err := normalizeKimiSchema(parameters["parameters"])
		if err != nil {
			return nil, false, err
		}
		if updated {
			parameters["parameters"] = value
			if nested {
				tool["function"], err = common.Marshal(parameters)
				if err != nil {
					return nil, false, err
				}
			}
			changed = true
		}
	}
	if !changed {
		return raw, false, nil
	}
	value, err := common.Marshal(tools)
	return value, true, err
}

func normalizeKimiSchema(raw json.RawMessage) (json.RawMessage, bool, error) {
	if common.GetJsonType(raw) != "object" {
		return raw, false, nil
	}
	var schema map[string]json.RawMessage
	if err := common.Unmarshal(raw, &schema); err != nil {
		return nil, false, err
	}
	changed := false
	for key, child := range schema {
		switch key {
		case "properties", "patternProperties", "$defs", "definitions", "dependentSchemas", "dependencies":
			if common.GetJsonType(child) != "object" {
				continue
			}
			var entries map[string]json.RawMessage
			if err := common.Unmarshal(child, &entries); err != nil {
				return nil, false, err
			}
			updated := false
			for name, entry := range entries {
				value, rewritten, err := normalizeKimiSchema(entry)
				if err != nil {
					return nil, false, err
				}
				if rewritten {
					entries[name] = value
					updated = true
				}
			}
			if updated {
				value, err := common.Marshal(entries)
				if err != nil {
					return nil, false, err
				}
				schema[key] = value
				changed = true
			}
		case "allOf", "anyOf", "oneOf", "prefixItems", "items", "additionalItems", "unevaluatedItems", "contains", "additionalProperties", "unevaluatedProperties", "propertyNames", "not", "if", "then", "else", "contentSchema":
			if common.GetJsonType(child) == "array" {
				var entries []json.RawMessage
				if err := common.Unmarshal(child, &entries); err != nil {
					return nil, false, err
				}
				updated := false
				for i, entry := range entries {
					value, rewritten, err := normalizeKimiSchema(entry)
					if err != nil {
						return nil, false, err
					}
					if rewritten {
						entries[i] = value
						updated = true
					}
				}
				if updated {
					value, err := common.Marshal(entries)
					if err != nil {
						return nil, false, err
					}
					schema[key] = value
					changed = true
				}
			} else {
				value, updated, err := normalizeKimiSchema(child)
				if err != nil {
					return nil, false, err
				}
				if updated {
					schema[key] = value
					changed = true
				}
			}
		}
	}
	if len(schema) > 1 && common.GetJsonType(schema["$ref"]) == "string" {
		var branches []json.RawMessage
		if existing, ok := schema["allOf"]; ok {
			if err := common.Unmarshal(existing, &branches); err != nil {
				return nil, false, err
			}
		}
		branch, err := common.Marshal(map[string]json.RawMessage{"$ref": schema["$ref"]})
		if err != nil {
			return nil, false, err
		}
		branches = append(branches, branch)
		schema["allOf"], err = common.Marshal(branches)
		if err != nil {
			return nil, false, err
		}
		delete(schema, "$ref")
		changed = true
	}
	if !changed {
		return raw, false, nil
	}
	value, err := common.Marshal(schema)
	return value, true, err
}
