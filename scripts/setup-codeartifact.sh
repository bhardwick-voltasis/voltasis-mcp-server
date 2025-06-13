#!/bin/bash

# Setup AWS CodeArtifact for Voltasis MCP Client

DOMAIN="voltasis"
REPOSITORY="npm-packages"
REGION="us-east-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "Setting up AWS CodeArtifact..."

# Create domain (if it doesn't exist)
aws codeartifact create-domain \
  --domain $DOMAIN \
  --region $REGION 2>/dev/null || echo "Domain already exists"

# Create repository (if it doesn't exist)
aws codeartifact create-repository \
  --domain $DOMAIN \
  --repository $REPOSITORY \
  --description "Private npm packages for Voltasis" \
  --region $REGION 2>/dev/null || echo "Repository already exists"

# Associate with npm public registry for dependencies
aws codeartifact associate-external-connection \
  --domain $DOMAIN \
  --repository $REPOSITORY \
  --external-connection public:npmjs \
  --region $REGION 2>/dev/null || echo "External connection already exists"

# Get repository endpoint
REPOSITORY_ENDPOINT=$(aws codeartifact get-repository-endpoint \
  --domain $DOMAIN \
  --repository $REPOSITORY \
  --format npm \
  --region $REGION \
  --query repositoryEndpoint \
  --output text)

echo "Repository endpoint: $REPOSITORY_ENDPOINT"

# Configure npm to use CodeArtifact
aws codeartifact login \
  --tool npm \
  --domain $DOMAIN \
  --repository $REPOSITORY \
  --region $REGION

# Update package.json publishConfig
echo "Updating package.json with CodeArtifact registry..."
npm config set registry $REPOSITORY_ENDPOINT
npm config set @voltasis:registry $REPOSITORY_ENDPOINT

echo "Setup complete! You can now publish with: npm publish"
echo ""
echo "For developers to install:"
echo "1. Run: aws codeartifact login --tool npm --domain $DOMAIN --repository $REPOSITORY"
echo "2. Add to package.json: \"@voltasis/mcp-client\": \"^1.0.0\""
echo "3. Run: npm install" 