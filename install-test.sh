#!/bin/bash

# Obsidian AI Excerpt Generator Plugin - Test Installation Script
# This script helps developers build and install the plugin to a test vault for development

# Configuration
PLUGIN_NAME="ai-excerpt-generator"
TEST_VAULT_PATH="${HOME}/Library/Mobile Documents/iCloud~md~obsidian/Documents/test"
PLUGIN_DIR="${TEST_VAULT_PATH}/.obsidian/plugins/${PLUGIN_NAME}"

# Build the plugin using esbuild
echo "🔨 Building the plugin..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Aborting."
    exit 1
fi

# Create the plugin directory in the test vault if it doesn't exist
echo "📁 Setting up plugin directory in test vault..."
mkdir -p "${PLUGIN_DIR}"

# Copy the compiled plugin files to the test vault
echo "📋 Copying plugin files to test vault..."
cp -R ./dist/* "${PLUGIN_DIR}/"

# Create the prompts directory in the test vault if it doesn't exist
echo "📁 Setting up prompts directory in test vault..."
mkdir -p "${TEST_VAULT_PATH}/prompts"

# Copy prompt templates to the test vault
echo "📋 Copying prompt templates to test vault..."
cp -R ./src/prompts/*.md "${TEST_VAULT_PATH}/prompts/"

echo "✅ Installation complete."
echo "🔍 Plugin installed to: ${PLUGIN_DIR}"
echo "🔍 Prompt templates installed to: ${TEST_VAULT_PATH}/prompts/"

echo "🚀 Remember to restart Obsidian or reload plugins for changes to take effect."

exit 0
