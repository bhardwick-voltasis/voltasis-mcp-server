# Voltasis MCP Server - Quick Reference

## Common Commands

### OpenAPI to MCP Sync

```bash
# From voltasis-api directory
cd /path/to/voltasis-api

# Development sync (no deployment)
./scripts/openapi-build-deploy-with-mcp.sh dev none false true

# Staging with docs deployment
./scripts/openapi-build-deploy-with-mcp.sh staging patch docs-only true

# Production with version bump
./scripts/openapi-build-deploy-with-mcp.sh prod minor docs-only true
```

### MCP Server Management

```bash
# From voltasis-mcp-server directory
cd /path/to/voltasis-mcp-server

# Generate index after manual changes
npm run generate-index

# Upload docs to S3
npm run aws:upload-docs dev

# Deploy infrastructure
npm run aws:deploy:dev

# Configure Cursor
npm run aws:configure dev
```

### Webhook Setup

```bash
# Setup webhook (from MCP server directory)
npm run webhook:setup

# Get webhook URL
aws cloudformation describe-stacks \
  --stack-name VoltasisMCPServerStack-dev \
  --query "Stacks[0].Outputs[?OutputKey=='MCPWebhookUrl'].OutputValue" \
  --output text
```

## Environment Variables

```bash
# Required for OpenAPI sync
export MCP_SERVER_PATH="../voltasis-mcp-server"

# Optional for webhook
export WEBHOOK_SECRET="your-webhook-secret"
export GITHUB_TOKEN="your-github-token"
```

## File Locations

### Voltasis API Repository
- OpenAPI source: `docs/openapi.yaml` or `docs/openapi-split/`
- Build script: `scripts/openapi-build-deploy-with-mcp.sh`
- Converter: `scripts/openapi-to-mcp.js`
- GitHub workflow: `.github/workflows/openapi-mcp-sync.yml`

### MCP Server Repository
- Generated docs: `mcp-docs/api/endpoints/`, `mcp-docs/api/schemas/`
- Index file: `mcp-docs/index.json`
- Webhook handler: `infrastructure/lambda/webhook-handler/`
- Setup docs: `docs/openapi-sync-setup.md`

## Troubleshooting

### Quick Fixes

```bash
# Permission denied on scripts
chmod +x scripts/*.sh scripts/*.js

# MCP directory not found
export MCP_SERVER_PATH="/absolute/path/to/voltasis-mcp-server"

# Check generated files count
find ../voltasis-mcp-server/mcp-docs/api -name "*.md" | wc -l

# View CloudWatch logs
aws logs tail /aws/lambda/voltasis-mcp-webhook-handler-dev --follow

# Check S3 upload
aws s3 ls s3://voltasis-mcp-docs-dev/mcp-docs/api/ --recursive | head
```

## GitHub Secrets Required

For production deployment, add these to Voltasis API repo:

| Secret | Description |
|--------|-------------|
| `MCP_WEBHOOK_SECRET` | Webhook signature verification |
| `AWS_ACCESS_KEY_ID` | AWS access for S3/CloudFront |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `GITHUB_TOKEN` | (Optional) Cross-repo access |

## Workflow Status

```bash
# Check GitHub Actions status
gh run list --workflow=openapi-mcp-sync.yml

# Watch current run
gh run watch

# View logs
gh run view --log
```

---

Last Updated: June 2024 