# Migration Guide: Local to AWS MCP Server

## Overview

This guide walks you through migrating from the local MCP server to the AWS-hosted solution. The AWS solution provides centralized documentation management, automatic updates, and better scalability.

## Architecture Comparison

### Local MCP Server
```
Cursor ←→ Local Node.js Process ←→ Local Files (mcp-docs/)
```

### AWS MCP Server
```
Cursor ←→ MCP Client ←→ API Gateway ←→ Lambda ←→ S3/DynamoDB
                            ↓
                        CloudFront CDN
```

## Benefits of AWS Solution

1. **Centralized Updates**: Documentation updates are immediately available to all developers
2. **No Local Setup**: New developers just need an API key
3. **Better Performance**: CloudFront CDN provides global edge caching
4. **Scalability**: Handles unlimited concurrent users
5. **Version Control**: S3 versioning tracks all documentation changes
6. **Search Capabilities**: DynamoDB indexes enable fast searching

## Migration Steps

### 1. Deploy AWS Infrastructure

```bash
# Install AWS CDK if not already installed
npm install -g aws-cdk

# Configure AWS credentials
aws configure

# Deploy to development environment
./scripts/deploy-mcp-aws.sh dev
```

### 2. Upload Existing Documentation

```bash
# Upload your current mcp-docs to AWS
./scripts/upload-docs.sh dev
```

### 3. Configure Cursor for AWS

```bash
# This will configure Cursor to use the AWS MCP server
tsx scripts/configure-cursor-aws.ts dev
```

### 4. Test the AWS Server

In Cursor, test that the AWS server is working:
- Ask: "List all Voltasis API endpoints"
- Ask: "Show me the user creation endpoint"

### 5. Remove Local Configuration (Optional)

Once confirmed working, you can remove the local server configuration:
```bash
# Backup existing configuration
cp ~/.cursor-server/User/globalStorage/cursor-mcp-config.json ~/.cursor-mcp-config.backup.json

# The AWS configuration script already updated the config
# Just restart Cursor to ensure it's using the AWS server
```

## Documentation Update Workflow

### Before (Local)
1. Edit files in `mcp-docs/`
2. Run `npm run generate-index`
3. Each developer must pull changes

### After (AWS)
1. Edit files in `mcp-docs/`
2. Run `./scripts/upload-docs.sh dev`
3. All developers instantly have updated docs

## CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
name: Deploy MCP Documentation

on:
  push:
    branches: [main]
    paths:
      - 'mcp-docs/**'
      - 'infrastructure/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Upload documentation
        run: |
          ./scripts/upload-docs.sh prod
```

## Managing API Keys

### Create Additional API Keys
```bash
# For a new developer
aws apigateway create-api-key \
  --name "developer-name-mcp-key" \
  --enabled \
  --stage-keys restApiId=YOUR_API_ID,stageName=dev
```

### Rotate API Keys
```bash
# Disable old key
aws apigateway update-api-key \
  --api-key OLD_KEY_ID \
  --patch-operations op=replace,path=/enabled,value=false

# Create new key and update configurations
```

## Monitoring & Debugging

### View Lambda Logs
```bash
# Recent MCP server logs
aws logs tail /aws/lambda/voltasis-mcp-server-dev --follow
```

### Check CloudWatch Metrics
```bash
# API Gateway metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=voltasis-mcp-api-dev \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

### Test API Directly
```bash
# Get your API key
API_KEY=$(aws apigateway get-api-key \
  --api-key YOUR_KEY_ID \
  --include-value \
  --query value \
  --output text)

# Test the MCP server
curl -X POST https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/mcp \
  -H "X-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## Rollback Plan

If you need to switch back to local:

1. Restore local configuration:
```bash
cp ~/.cursor-mcp-config.backup.json ~/.cursor-server/User/globalStorage/cursor-mcp-config.json
```

2. Or reconfigure for local:
```bash
npm run configure-cursor
```

3. Restart Cursor

## Cost Optimization

The AWS solution is designed to be cost-effective:
- **Lambda**: Pay only for invocations (~$0.20 per million requests)
- **API Gateway**: $1.00 per million API calls
- **S3**: Minimal storage costs for markdown files
- **CloudFront**: $0.085 per GB transferred
- **DynamoDB**: On-demand pricing, minimal for index storage

Estimated monthly cost for a 10-developer team: **< $5**

## Troubleshooting

### "API Key Invalid" Error
- Ensure the API key is correctly configured in Cursor
- Check that the API key is enabled in API Gateway
- Verify the usage plan includes your API

### "No Documentation Found"
- Run `./scripts/upload-docs.sh dev` to upload documents
- Check S3 bucket has markdown files
- Verify Lambda has permissions to read S3

### "Slow Response Times"
- Check Lambda cold start metrics
- Consider increasing reserved concurrency
- Verify CloudFront is caching properly

## Next Steps

1. Set up monitoring alerts in CloudWatch
2. Configure automated backups of DynamoDB
3. Implement documentation versioning strategy
4. Add authentication for sensitive documentation

## Support

For issues with the AWS MCP server:
1. Check CloudWatch logs
2. Review this migration guide
3. Contact the platform team

---

*Migration typically takes < 30 minutes and provides immediate benefits for the entire team.*