#!/bin/bash

# Upload documentation to MCP S3 bucket
# Usage: ./scripts/upload-docs.sh [dev|staging|prod]

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

# Load environment configuration
if [ ! -f ".env.$STAGE" ]; then
    echo -e "${RED}Error: Configuration file .env.$STAGE not found. Run deploy script first.${NC}"
    exit 1
fi

source .env.$STAGE

echo -e "${GREEN}Uploading documentation to $STAGE environment${NC}"
echo "S3 Bucket: $MCP_DOCS_BUCKET"
echo "CloudFront: $MCP_CLOUDFRONT_URL"

# Check if mcp-docs directory exists
if [ ! -d "mcp-docs" ]; then
    echo -e "${RED}Error: mcp-docs directory not found${NC}"
    exit 1
fi

# Count documents
TOTAL_DOCS=$(find mcp-docs -name "*.md" | wc -l)
echo "Found $TOTAL_DOCS markdown documents"

# Upload documents to S3
echo -e "${YELLOW}Uploading documents to S3...${NC}"
aws s3 sync mcp-docs/ s3://$MCP_DOCS_BUCKET/ \
    --delete \
    --exclude "*.json" \
    --exclude ".DS_Store" \
    --content-type "text/markdown" \
    --metadata-directive REPLACE

# Upload index file if it exists
if [ -f "mcp-docs/index.json" ]; then
    echo -e "${YELLOW}Uploading index file...${NC}"
    aws s3 cp mcp-docs/index.json s3://$MCP_DOCS_BUCKET/index.json \
        --content-type "application/json"
fi

# Trigger index builder Lambda (optional - it can also run on schedule)
echo -e "${YELLOW}Triggering index builder...${NC}"
aws lambda invoke \
    --function-name voltasis-mcp-index-builder-$STAGE \
    --invocation-type Event \
    --payload '{"source": "manual-upload"}' \
    --cli-binary-format raw-in-base64-out \
    /tmp/lambda-response.json

# Invalidate CloudFront cache
echo -e "${YELLOW}Invalidating CloudFront cache...${NC}"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id $MCP_CLOUDFRONT_DIST_ID \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

echo "CloudFront invalidation created: $INVALIDATION_ID"

# Summary
echo -e "${GREEN}Upload complete!${NC}"
echo ""
echo "Documents uploaded: $TOTAL_DOCS"
echo "CloudFront URL: $MCP_CLOUDFRONT_URL"
echo ""
echo "The MCP server will now serve the updated documentation."
echo ""
echo "To test the MCP server:"
echo "  curl -X POST $MCP_ENDPOINT/mcp \\"
echo "    -H 'X-Api-Key: YOUR_API_KEY' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{}}'" 