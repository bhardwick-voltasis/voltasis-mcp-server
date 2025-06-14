# MCP Documentation Update Guide

## Overview

This guide explains how to update MCP documentation after making changes to the Voltasis API. The process involves converting OpenAPI specifications to MCP-friendly markdown format and uploading them to AWS.

## Prerequisites

- Both repositories cloned side by side:
  ```
  voltasis/
  ├── voltasis_api/
  └── voltasis-mcp-server/
  ```
- Node.js 20.x or higher
- AWS CLI configured
- Access to both repositories

## Quick Update Process

### Option 1: Full Build and Deploy with MCP Sync (Recommended)

From the `voltasis_api` directory:

```bash
# Build OpenAPI docs and sync with MCP, then upload to AWS
npm run aws:upload-docs dev

# For other environments:
./scripts/openapi-build-deploy-with-mcp.sh staging none true
./scripts/openapi-build-deploy-with-mcp.sh prod none true
```

### Option 2: MCP Documentation Only

If you only want to update MCP docs without deploying the API:

```bash
# From voltasis_api directory
./scripts/openapi-build-deploy-with-mcp.sh dev none mcp-only
```

### Option 3: Manual Step-by-Step Process

1. **Build OpenAPI Documentation** (in voltasis_api):
   ```bash
   npm run openapi:build
   ```

2. **Convert to MCP Format**:
   ```bash
   node scripts/openapi-to-mcp.js
   ```
   This creates markdown files in `../voltasis-mcp-server/mcp-docs/api/`

3. **Switch to MCP Server** (in voltasis-mcp-server):
   ```bash
   cd ../voltasis-mcp-server
   ```

4. **Generate Index**:
   ```bash
   npm run generate-index
   ```

5. **Upload to AWS**:
   ```bash
   npm run aws:upload-docs dev
   # or
   ./scripts/upload-docs.sh dev
   ```

## NPM Scripts Reference

### In voltasis_api:

```bash
# OpenAPI Documentation
npm run openapi:build              # Build for dev
npm run openapi:build:staging      # Build for staging
npm run openapi:build:prod         # Build for production

# Version Management
npm run openapi:version:patch      # Bump patch version
npm run openapi:version:minor      # Bump minor version
npm run openapi:version:major      # Bump major version

# Deploy Documentation Only
npm run openapi:deploy:docs        # Deploy to dev
npm run openapi:deploy:docs:staging # Deploy to staging
npm run openapi:deploy:docs:prod   # Deploy to production
```

### In voltasis-mcp-server:

```bash
# Build and Index
npm run build                      # Build TypeScript
npm run generate-index             # Generate document index

# AWS Deployment
npm run aws:deploy:dev             # Deploy infrastructure to dev
npm run aws:upload-docs dev        # Upload docs to dev S3
npm run aws:configure dev          # Configure Cursor for dev

# For other environments
npm run aws:deploy:staging
npm run aws:deploy:prod
```

## What Happens During the Process

1. **OpenAPI Build**: Scans all Lambda functions and generates `openapi.json`
2. **MCP Conversion**: Transforms OpenAPI to markdown with:
   - Individual endpoint files
   - Schema documentation
   - Code examples
   - TypeScript interfaces
3. **Index Generation**: Creates searchable index of all documents
4. **S3 Upload**: Syncs markdown files to S3 bucket
5. **Lambda Processing**: Index builder processes documents into DynamoDB
6. **CloudFront Invalidation**: Clears CDN cache for immediate updates

## File Locations

- **OpenAPI Spec**: `voltasis_api/docs/swagger-ui/openapi.json`
- **MCP Markdown**: `voltasis-mcp-server/mcp-docs/api/`
  - Endpoints: `endpoints/*.md`
  - Schemas: `schemas/*.md`
  - Overview: `overview.md`
- **Index File**: `voltasis-mcp-server/mcp-docs/index.json`

## Verification

After updating, verify the documentation:

1. **Check MCP Tools in Cursor**:
   - "list all endpoints" - Should show new endpoints
   - "get schema for [YourNewModel]" - Should return schema
   - "search for [your new feature]" - Should find docs

2. **Direct API Test**:
   ```bash
   curl -X POST https://u77ssoo8lc.execute-api.us-east-1.amazonaws.com/dev/mcp \
     -H "X-Api-Key: YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
   ```

3. **Check AWS Resources**:
   - S3 bucket should have new markdown files
   - DynamoDB should have updated indexes
   - CloudFront should serve fresh content

## Troubleshooting

### MCP Server Path Not Found
```bash
# Set the path explicitly
export MCP_SERVER_PATH="../voltasis-mcp-server"
./scripts/openapi-build-deploy-with-mcp.sh dev none mcp-only
```

### Permission Errors
- Ensure AWS credentials are configured
- Check you have access to the S3 bucket and DynamoDB table

### Documentation Not Updating
1. Check CloudFront invalidation completed
2. Verify index builder Lambda ran successfully
3. Look for errors in CloudWatch logs

### Empty Search Results
- Ensure documents were uploaded to S3
- Check index builder processed the documents
- Verify DynamoDB has document entries

## Automation Options

### GitHub Actions
Configure webhook in voltasis_api to automatically update MCP docs on push:
```yaml
- name: Update MCP Documentation
  run: |
    ./scripts/openapi-build-deploy-with-mcp.sh ${{ env.STAGE }} none mcp-only
```

### Webhook Integration
The MCP server supports webhooks for automatic updates when API documentation changes.

## Best Practices

1. **Always Build OpenAPI First**: Ensure OpenAPI spec is current before converting
2. **Version Appropriately**: Use semantic versioning for API changes
3. **Test Locally**: Verify markdown generation before uploading
4. **Monitor Logs**: Check CloudWatch for any processing errors
5. **Cache Considerations**: Allow time for CloudFront invalidation

## Security Notes

- API keys are for documentation access only
- Keep webhook secrets secure
- Don't commit `.env` files with credentials
- Use IAM roles for AWS access when possible 