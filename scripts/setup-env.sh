#!/bin/bash

# Script to create .env file from CloudFormation outputs

set -e

STAGE=${STAGE:-dev}
STACK_NAME="VoltasisMCPServerStack-${STAGE}"

echo "📋 Creating .env.${STAGE} from CloudFormation outputs..."

# Check if stack exists and is complete
STACK_STATUS=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "❌ Error: Stack ${STACK_NAME} not found"
    exit 1
fi

if [[ "$STACK_STATUS" != "CREATE_COMPLETE" && "$STACK_STATUS" != "UPDATE_COMPLETE" ]]; then
    echo "❌ Error: Stack is in status ${STACK_STATUS}. Wait for deployment to complete."
    exit 1
fi

# Get outputs from CloudFormation
echo "🔍 Retrieving stack outputs..."

MCP_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`MCPApiUrl`].OutputValue' \
    --output text)

MCP_API_KEY_ID=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`MCPApiKeyId`].OutputValue' \
    --output text)

MCP_DOCS_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`MCPDocsBucketName`].OutputValue' \
    --output text)

MCP_CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`MCPCloudFrontUrl`].OutputValue' \
    --output text)

MCP_CLOUDFRONT_DIST_ID=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`MCPCloudFrontDistributionId`].OutputValue' \
    --output text)

# Create .env file
cat > .env.${STAGE} << EOF
# AWS MCP Server Configuration - ${STAGE}
# Generated on $(date)

# API Gateway endpoint for MCP protocol
MCP_ENDPOINT=${MCP_ENDPOINT}mcp

# API Key ID (use to retrieve actual key value)
MCP_API_KEY_ID=${MCP_API_KEY_ID}

# S3 bucket for documentation storage
MCP_DOCS_BUCKET=${MCP_DOCS_BUCKET}

# CloudFront URL for documentation access
MCP_CLOUDFRONT_URL=${MCP_CLOUDFRONT_URL}

# CloudFront distribution ID for cache invalidation
MCP_CLOUDFRONT_DIST_ID=${MCP_CLOUDFRONT_DIST_ID}

# DynamoDB table for document indexes
MCP_INDEX_TABLE=voltasis-mcp-index-${STAGE}
EOF

echo "✅ Created .env.${STAGE}"
echo ""
echo "📝 Configuration saved:"
echo "   API Endpoint: ${MCP_ENDPOINT}mcp"
echo "   Docs Bucket: ${MCP_DOCS_BUCKET}"
echo "   CloudFront: ${MCP_CLOUDFRONT_URL}"
echo ""
echo "🔑 To get your API key value:"
echo "   aws apigateway get-api-key --api-key ${MCP_API_KEY_ID} --include-value --query 'value' --output text" 