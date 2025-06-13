# AWS MCP Server Deployment Guide

## Overview

You've successfully initiated the deployment of the Voltasis MCP Server to AWS. This guide covers the deployment process and next steps.

## Architecture Deployed

The AWS infrastructure includes:

- **API Gateway**: REST API with API key authentication for MCP protocol
- **Lambda Functions**: 
  - MCP Server: Handles MCP protocol requests
  - Document Processor: Converts OpenAPI specs to LLM-optimized markdown
  - Index Builder: Creates searchable indexes
- **S3 Bucket**: Stores documentation files
- **CloudFront**: CDN for fast document delivery
- **DynamoDB**: Document metadata and search indexes

## Deployment Status

To check deployment progress:
```bash
./scripts/check-deployment.sh
```

The deployment typically takes 5-10 minutes to complete.

## Post-Deployment Steps

### 1. Wait for Deployment Completion

Keep checking the status until you see:
```
✅ Deployment successful!
```

### 2. Create Environment Configuration

Once deployed, the check-deployment script will show the stack outputs. Save these to a `.env.dev` file:

```bash
# Get the values from the deployment
STACK_NAME="VoltasisMCPServerStack-dev"

# API URL
MCP_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`MCPApiUrl`].OutputValue' \
    --output text)

# API Key ID
MCP_API_KEY_ID=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`MCPApiKeyId`].OutputValue' \
    --output text)

# S3 Bucket
MCP_DOCS_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`MCPDocsBucketName`].OutputValue' \
    --output text)

# CloudFront
MCP_CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`MCPCloudFrontUrl`].OutputValue' \
    --output text)

MCP_CLOUDFRONT_DIST_ID=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`MCPCloudFrontDistributionId`].OutputValue' \
    --output text)

# Create .env.dev file
cat > .env.dev << EOF
# AWS MCP Server Configuration - dev
MCP_ENDPOINT=${MCP_ENDPOINT}mcp
MCP_API_KEY_ID=${MCP_API_KEY_ID}
MCP_DOCS_BUCKET=${MCP_DOCS_BUCKET}
MCP_CLOUDFRONT_URL=${MCP_CLOUDFRONT_URL}
MCP_CLOUDFRONT_DIST_ID=${MCP_CLOUDFRONT_DIST_ID}
EOF

echo "Created .env.dev file"
```

### 3. Upload Documentation

Upload your documentation to the S3 bucket:
```bash
./scripts/upload-docs.sh dev
```

This will:
- Upload all markdown files to S3
- Trigger the document processor Lambda
- Invalidate the CloudFront cache

### 4. Build the MCP Client

The MCP client needs to be built before configuring Cursor:
```bash
npm run build
```

### 5. Configure Cursor

Configure Cursor to use the AWS-hosted MCP server:
```bash
npx tsx scripts/configure-cursor-aws.ts dev
```

This will:
- Retrieve the API key from AWS
- Update Cursor's configuration
- Create a local `.env.mcp-client` file

### 6. Restart Cursor

After configuration, restart Cursor for the changes to take effect.

## Testing the Integration

### Test the API Directly

Get your API key value:
```bash
aws apigateway get-api-key --api-key $MCP_API_KEY_ID --include-value --query 'value' --output text
```

Test the MCP endpoint:
```bash
curl -X POST $MCP_ENDPOINT \
  -H "X-Api-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

### Test in Cursor

After restarting Cursor, you can test the MCP tools:

1. Ask: "What API endpoints are available?"
2. Ask: "Show me the documentation for the GET /users endpoint"
3. Ask: "Search for time entry endpoints"

## Troubleshooting

### Deployment Failed

If deployment fails:
```bash
# Check CloudFormation events
aws cloudformation describe-stack-events \
  --stack-name VoltasisMCPServerStack-dev \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'
```

### MCP Tools Not Available in Cursor

1. Check Cursor configuration:
   ```bash
   cat ~/.cursor-server/User/globalStorage/cursor-mcp-config.json
   ```

2. Check MCP client logs in Cursor's developer console

3. Verify API key is correct:
   ```bash
   cat .env.mcp-client
   ```

### API Returns 403 Forbidden

This means the API key is missing or incorrect. Verify:
- API key is included in the request header
- API key value matches what's in API Gateway

## Architecture Benefits

### Scalability
- Lambda auto-scales based on demand
- CloudFront provides global edge caching
- DynamoDB handles any query volume

### Security
- API key authentication
- All data encrypted in transit and at rest
- IAM roles with least privilege

### Cost Efficiency
- Pay-per-use pricing model
- No idle server costs
- CloudFront reduces Lambda invocations

### Maintenance
- Fully managed services
- Automatic updates and patches
- CloudWatch monitoring included

## Next Steps

1. Monitor usage in CloudWatch
2. Set up alerts for errors
3. Consider custom domain name
4. Add more documentation
5. Implement additional MCP tools

## Updating Documentation

To update documentation after initial deployment:
```bash
# Edit your markdown files in mcp-docs/
# Then upload changes:
./scripts/upload-docs.sh dev
```

The changes will be available immediately through the MCP server. 