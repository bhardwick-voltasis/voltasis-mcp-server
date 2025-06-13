#!/bin/bash

# Deploy Voltasis MCP Server to AWS
# Usage: ./scripts/deploy-mcp-aws.sh [dev|staging|prod]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get stage from argument or default to dev
STAGE="${1:-dev}"

# Validate stage
if [[ ! "$STAGE" =~ ^(dev|staging|prod)$ ]]; then
    echo -e "${RED}Error: Invalid stage '$STAGE'. Must be one of: dev, staging, prod${NC}"
    exit 1
fi

echo -e "${GREEN}Deploying MCP Server to AWS - Stage: $STAGE${NC}"

# Check AWS credentials
if ! aws sts get-caller-identity &>/dev/null; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    exit 1
fi

# Get AWS account ID and region
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION="${AWS_DEFAULT_REGION:-us-east-1}"

echo "AWS Account: $AWS_ACCOUNT_ID"
echo "AWS Region: $AWS_REGION"

# Build the main project first
echo -e "${YELLOW}Building main project...${NC}"
npm run build

# Build infrastructure
echo -e "${YELLOW}Building CDK infrastructure...${NC}"
cd infrastructure
npm install
npm run build

# Bootstrap CDK if needed
echo -e "${YELLOW}Checking CDK bootstrap...${NC}"
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region $AWS_REGION &>/dev/null; then
    echo "Bootstrapping CDK..."
    npx cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION
fi

# Synthesize CloudFormation template
echo -e "${YELLOW}Synthesizing CloudFormation template...${NC}"
STAGE=$STAGE npx cdk synth

# Deploy the stack
echo -e "${YELLOW}Deploying MCP Server stack...${NC}"
STAGE=$STAGE npx cdk deploy VoltasisMCPServerStack-$STAGE \
    --require-approval never \
    --outputs-file outputs-$STAGE.json

# Extract outputs
echo -e "${YELLOW}Extracting deployment outputs...${NC}"
API_URL=$(jq -r ".\"VoltasisMCPServerStack-$STAGE\".MCPApiUrl" outputs-$STAGE.json)
API_KEY_ID=$(jq -r ".\"VoltasisMCPServerStack-$STAGE\".MCPApiKeyId" outputs-$STAGE.json)
DOCS_BUCKET=$(jq -r ".\"VoltasisMCPServerStack-$STAGE\".MCPDocsBucketName" outputs-$STAGE.json)
CLOUDFRONT_URL=$(jq -r ".\"VoltasisMCPServerStack-$STAGE\".MCPCloudFrontUrl" outputs-$STAGE.json)
CLOUDFRONT_DIST_ID=$(jq -r ".\"VoltasisMCPServerStack-$STAGE\".MCPCloudFrontDistributionId" outputs-$STAGE.json)

# Save configuration
cd ..
cat > .env.$STAGE <<EOF
# MCP Server Configuration for $STAGE
MCP_ENDPOINT=$API_URL
MCP_API_KEY_ID=$API_KEY_ID
MCP_DOCS_BUCKET=$DOCS_BUCKET
MCP_CLOUDFRONT_URL=$CLOUDFRONT_URL
MCP_CLOUDFRONT_DIST_ID=$CLOUDFRONT_DIST_ID
AWS_REGION=$AWS_REGION
STAGE=$STAGE
EOF

echo -e "${GREEN}Deployment complete!${NC}"
echo ""
echo "Configuration saved to .env.$STAGE"
echo ""
echo "API Endpoint: $API_URL"
echo "API Key ID: $API_KEY_ID"
echo "Documentation URL: $CLOUDFRONT_URL"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Retrieve the API key value:"
echo "   aws apigateway get-api-key --api-key $API_KEY_ID --include-value --query value --output text"
echo ""
echo "2. Upload documentation:"
echo "   ./scripts/upload-docs.sh $STAGE"
echo ""
echo "3. Configure Cursor with the API key" 