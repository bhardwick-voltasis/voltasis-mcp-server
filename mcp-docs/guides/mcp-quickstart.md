---
id: guide-mcp-quickstart
title: MCP Server Quick Start Guide
category: guide
tags: [mcp, quickstart, cursor, setup, aws]
related: [guide-authentication]
version: 2.0.0
last_updated: 2025-06-13
---

# MCP Server Quick Start Guide

## Overview

This guide will help you get started with the Voltasis MCP (Model Context Protocol) Server in Cursor IDE. The MCP server is hosted on AWS and provides AI-powered assistance for working with the Voltasis API.

## Prerequisites

- Cursor IDE installed
- Node.js 20.x or higher
- AWS CLI configured (for administrators only)
- Access to the voltasis-mcp-server repository

## For Users: Connect to Existing AWS Deployment

If the MCP server is already deployed to AWS, follow these steps:

### 1. Clone and Build

```bash
# Clone the repository
git clone https://github.com/voltasis/voltasis-mcp-server.git
cd voltasis-mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

### 2. Configure Cursor for AWS

```bash
# Configure for development environment
npm run aws:configure dev

# Or for other environments:
# npm run aws:configure staging
# npm run aws:configure prod
```

This command will:
- Retrieve the API key from AWS
- Configure Cursor to use the AWS-hosted MCP server
- Create a local configuration file

### 3. Restart Cursor

Close and reopen Cursor to apply the new configuration.

### 4. Verify Installation

In Cursor chat, try:
- "Search for authentication documentation"
- "Show me the user creation endpoint"
- "List all endpoints tagged with 'users'"
- "Get the TypeScript schema for TimeEntry"

## Using the MCP Server

### Available Tools

The MCP server provides four main tools:

#### 1. search_documentation
Search through all Voltasis API documentation:
- "Search for time entry endpoints"
- "Find authentication guides"
- "Look for multi-tenant documentation"

#### 2. get_endpoint_details
Get detailed information about specific endpoints:
- "Show me details for POST /api/v1/users"
- "Explain the GET /api/v1/time-entries endpoint"

#### 3. list_endpoints
List available API endpoints with filtering:
- "List all endpoints"
- "Show endpoints tagged with 'organization'"
- "List only POST endpoints"

#### 4. get_schema
Get TypeScript or JSON schemas:
- "Get the User schema in TypeScript"
- "Show me the TimeEntry model"
- "Get all schemas in JSON format"

### Best Practices

1. **Use Natural Language**: The AI understands context
   - ✅ "How do I create a new user in Voltasis?"
   - ✅ "Show me authentication examples"

2. **Be Specific When Needed**: For exact endpoints or schemas
   - ✅ "Get details for GET /api/v1/users"
   - ✅ "Show the TimeEntry TypeScript interface"

3. **Leverage Search**: Find related documentation
   - ✅ "Search for error handling documentation"
   - ✅ "Find all time tracking endpoints"

## Troubleshooting

### MCP Tools Not Appearing

1. Ensure you've run `npm run build`
2. Verify you used `aws:configure` (not the local configure)
3. Restart Cursor completely
4. Check the configuration:
   ```bash
   cat ~/.cursor/mcp.json | grep voltasis
   ```

### API Connection Issues

Test the AWS endpoint directly:
```bash
# Get your API key
cat .env.mcp-client

# Test the endpoint (replace with your values)
curl -X POST https://your-api-gateway-url/dev/mcp \
  -H "X-Api-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Documentation Not Found

The documentation is served from AWS CloudFront. If you're getting empty results:
1. Check with your administrator that docs were uploaded
2. Verify CloudFront distribution is working
3. Try searching for known terms like "authentication" or "users"

## For Administrators: Deploy to AWS

### Initial Deployment

```bash
# Deploy infrastructure (dev/staging/prod)
npm run aws:deploy:dev

# Upload documentation
npm run aws:upload-docs dev

# Configure Cursor
npm run aws:configure dev
```

### Updating Documentation

When API documentation changes:
```bash
# Update local docs in mcp-docs/
# Then upload to AWS
npm run aws:upload-docs dev
```

### Multi-Environment Support

The system supports multiple environments:
- **Development**: For testing and development
- **Staging**: For pre-production testing  
- **Production**: For production use

Each environment has isolated AWS resources.

## Architecture Overview

The MCP server uses a cloud-based architecture:

```
Cursor IDE → API Gateway → Lambda → DynamoDB/S3
                ↓
            CloudFront
```

- **API Gateway**: Handles authentication and routing
- **Lambda**: Processes MCP protocol requests
- **DynamoDB**: Stores document search indexes
- **S3**: Stores documentation files
- **CloudFront**: Provides fast global access to docs

## Getting Help

- **GitHub Issues**: Report bugs or request features
- **CloudWatch Logs**: Check Lambda logs for errors (admins)
- **API Status**: Verify the endpoint is responding

## Next Steps

1. Explore available endpoints with "list all endpoints"
2. Learn about authentication with "search for authentication guide"
3. Try creating your first API call with code examples
4. Build something awesome with the Voltasis API! 🚀 