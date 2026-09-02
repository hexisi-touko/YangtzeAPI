package controller

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeApplicationReasonHasNoCharacterLimit(t *testing.T) {
	longReason := strings.Repeat("长", 5001)
	reason, err := normalizeApplicationReason("  " + longReason + "  ")
	require.NoError(t, err)
	assert.Equal(t, longReason, reason)

	shortReason, err := normalizeApplicationReason("短")
	require.NoError(t, err)
	assert.Equal(t, "短", shortReason)
}

func TestNormalizeApplicationReasonStillRequiresContent(t *testing.T) {
	_, err := normalizeApplicationReason("   ")
	require.Error(t, err)
}
