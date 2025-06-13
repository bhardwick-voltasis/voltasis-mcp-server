# OpenAPI to MCP Synchronization Setup Guide

This guide provides step-by-step instructions for setting up automatic synchronization between Voltasis API OpenAPI documentation and the MCP server.

## Overview

The synchronization system converts OpenAPI specifications into MCP-friendly markdown documentation, ensuring AI assistants always have access to the latest API documentation.

## Prerequisites

- Both repositories cloned locally:
  ```bash
  git clone https://github.com/voltasis/voltasis-api.git
  git clone https://github.com/voltasis/voltasis-mcp-server.git
  ```
- Node.js 20.x or higher
- AWS CLI configured
- GitHub access to both repositories

## Setup Instructions

### 1. Environment Configuration

Set the MCP server path environment variable:

```bash
# Add to your shell profile (.bashrc, .zshrc, etc.)
export MCP_SERVER_PATH="../voltasis-mcp-server"
```

Or set it relative to your directory structure:
```bash
export MCP_SERVER_PATH="/path/to/voltasis-mcp-server"
```

### 2. Install Dependencies

In both repositories:

```bash
# In voltasis-api
cd voltasis-api
npm install

# In voltasis-mcp-server
cd ../voltasis-mcp-server
npm install
```

### 3. Local Development Workflow

#### Manual Synchronization

From the voltasis-api directory, run:

```bash
# Sync without deployment (development)
./scripts/openapi-build-deploy-with-mcp.sh dev none false true

# Parameters:
# - dev: Stage (dev/staging/prod)
# - none: Version bump (patch/minor/major/none)
# - false: Deploy (true/false/docs-only)
# - true: Sync MCP (true/false)
```

This will:
1. Build OpenAPI documentation from source
2. Convert to MCP markdown format
3. Generate 197+ endpoint documents
4. Create 64+ schema documents
5. Update the MCP index

#### Verify Results

Check the generated documentation:

```bash
# List generated endpoints
ls -la ../voltasis-mcp-server/mcp-docs/api/endpoints/

# View a sample endpoint
cat ../voltasis-mcp-server/mcp-docs/api/endpoints/users-get.md

# Check the index
cat ../voltasis-mcp-server/mcp-docs/index.json | jq '.documents | length'
```

### 4. Production Setup (When Ready)

#### A. GitHub Secrets Configuration

Add these secrets to the **Voltasis API repository**:

1. Go to Settings → Secrets and variables → Actions
2. Add the following repository secrets:

| Secret Name | Description | Example Value |
|------------|-------------|---------------|
| `MCP_WEBHOOK_SECRET` | Webhook secret for signature verification | Generate with: `openssl rand -hex 32` |
| `AWS_ACCESS_KEY_ID` | AWS access key with S3/CloudFront permissions | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `wJal...` |
| `GITHUB_TOKEN` | (Optional) Token with write access to MCP repo | Use default or create PAT |

#### B. Webhook Configuration

1. **Get the webhook URL**:
   ```bash
   aws cloudformation describe-stacks \
     --stack-name VoltasisMCPServerStack-prod \
     --query "Stacks[0].Outputs[?OutputKey=='MCPWebhookUrl'].OutputValue" \
     --output text
   ```

2. **Configure in GitHub**:
   - Go to Voltasis API repo → Settings → Webhooks
   - Click "Add webhook"
   - **Payload URL**: Use the URL from step 1
   - **Content type**: `application/json`
   - **Secret**: Use the same value as `MCP_WEBHOOK_SECRET`
   - **Events**: Select individual events:
     - ✅ Pushes
     - ✅ Releases
     - ✅ Workflow runs
   - **Active**: ✅ Check this box

#### C. Enable GitHub Actions

The workflow is already configured at `.github/workflows/openapi-mcp-sync.yml`. It will automatically:
- Trigger on OpenAPI file changes
- Build and convert documentation
- Commit to MCP repository
- Deploy to S3
- Invalidate CloudFront cache

### 5. Testing the Integration

#### Local Test
```bash
# Make a test change
echo "<!-- Test change -->" >> docs/openapi.yaml

# Run sync
./scripts/openapi-build-deploy-with-mcp.sh dev none false true

# Verify change
grep "Test change" ../voltasis-mcp-server/mcp-docs/api/overview.md
```

#### Production Test (When Deployed)
```bash
# Push to trigger workflow
git add docs/openapi.yaml
git commit -m "test: Update OpenAPI documentation"
git push origin develop

# Monitor workflow
gh run list --workflow=openapi-mcp-sync.yml
gh run watch
```

### 6. Deployment Commands

#### Development
```bash
# Build and sync only (no deployment)
./scripts/openapi-build-deploy-with-mcp.sh dev none false true
```

#### Staging
```bash
# Build, sync, and deploy documentation only
./scripts/openapi-build-deploy-with-mcp.sh staging patch docs-only true
```

#### Production
```bash
# Full production deployment with version bump
./scripts/openapi-build-deploy-with-mcp.sh prod minor docs-only true
```

## Troubleshooting

### Common Issues

1. **"MCP Server directory not found"**
   ```bash
   # Set the correct path
   export MCP_SERVER_PATH="/absolute/path/to/voltasis-mcp-server"
   ```

2. **"path.join is not a function"**
   - This has been fixed in the latest version
   - Pull the latest changes from voltasis-api

3. **"Permission denied" on scripts**
   ```bash
   chmod +x scripts/openapi-build-deploy-with-mcp.sh
   chmod +x scripts/openapi-to-mcp.js
   ```

4. **GitHub Actions fails with "Permission denied"**
   - Ensure `GITHUB_TOKEN` has write access to MCP repo
   - Or use a Personal Access Token with repo scope

### Monitoring

#### Check Sync Status
```bash
# View generated files count
find ../voltasis-mcp-server/mcp-docs/api -name "*.md" | wc -l

# Check last sync time
stat ../voltasis-mcp-server/mcp-docs/api/overview.md

# View CloudWatch logs (when deployed)
aws logs tail /aws/lambda/voltasis-mcp-webhook-handler-prod --follow
```

#### Verify S3 Upload
```bash
# List uploaded files
aws s3 ls s3://voltasis-mcp-docs-prod/mcp-docs/api/endpoints/ --recursive | head -20

# Check CloudFront distribution
aws cloudfront get-distribution --id YOUR_DISTRIBUTION_ID
```

## Architecture Details

### File Flow
```
voltasis-api/docs/openapi.yaml
    ↓ (build-openapi.js)
voltasis-api/docs/swagger-ui/openapi.json
    ↓ (openapi-to-mcp.js)
voltasis-mcp-server/mcp-docs/api/endpoints/*.md
    ↓ (generate-index.ts)
voltasis-mcp-server/mcp-docs/index.json
    ↓ (upload-docs.sh)
S3 Bucket → CloudFront → MCP Lambda → Cursor IDE
```

### Generated Structure
```
mcp-docs/
├── api/
│   ├── endpoints/
│   │   ├── users-get.md
│   │   ├── users-post.md
│   │   └── ... (197+ files)
│   ├── schemas/
│   │   ├── user.md
│   │   ├── timeentry.md
│   │   └── ... (64+ files)
│   └── overview.md
└── index.json
```

## Best Practices

1. **Version Management**
   - Always bump version when making API changes
   - Use semantic versioning (major.minor.patch)
   - Tag releases for major versions

2. **Documentation Quality**
   - Include descriptions for all endpoints in OpenAPI
   - Provide request/response examples
   - Use consistent naming conventions

3. **Performance**
   - Run sync during off-peak hours for large changes
   - Monitor CloudFront cache hit rates
   - Use `docs-only` deployment when possible

4. **Security**
   - Rotate webhook secrets quarterly
   - Use least-privilege IAM roles
   - Audit cross-repository access

## Future Enhancements

When you're ready to implement these:

1. **Automated Testing**
   - Add validation for generated markdown
   - Test MCP server responses
   - Verify CloudFront invalidation

2. **Incremental Updates**
   - Only process changed files
   - Diff-based updates
   - Faster sync times

3. **Multi-Environment Support**
   - Separate documentation versions per environment
   - Environment-specific examples
   - Stage-based access control

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review CloudWatch logs
3. Check GitHub Actions workflow runs
4. Contact the development team

---

Last Updated: June 2024
Version: 1.0.0 