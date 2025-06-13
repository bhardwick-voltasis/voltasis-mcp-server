# Voltasis API MCP Server Implementation Plan

## Executive Summary

This document outlines the implementation plan for an AWS-hosted Model Context Protocol (MCP) server that will serve Voltasis API documentation in an LLM-optimized format. The server will provide structured markdown documents for AI coding assistants while maintaining existing HTML documentation for human use.

## Goals & Objectives

1. **LLM-Optimized Documentation**: Serve API documentation in structured markdown format optimized for LLM consumption
2. **AWS-Hosted Solution**: Deploy a scalable, serverless MCP server on AWS infrastructure
3. **Semantic Search Support**: Enable efficient document discovery through structured organization
4. **Integration with Development Tools**: Configure seamless access via Cursor and other AI-powered IDEs
5. **Automated Updates**: Enhance build pipeline to automatically update MCP server content

## Architecture Overview

### High-Level Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Build Pipeline │────▶│   S3 Buckets    │────▶│  CloudFront CDN │
│  (GitHub Actions)│     │  (.md files)    │     │  (Distribution) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                          │
                               ▼                          ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │ Lambda Function │     │   API Gateway   │
                        │  (MCP Server)   │◀────│  (MCP Endpoint) │
                        └─────────────────┘     └─────────────────┘
                               │                          ▲
                               ▼                          │
                        ┌─────────────────┐     ┌─────────────────┐
                        │ DynamoDB Table  │     │ Cursor/AI IDEs  │
                        │ (Index/Metadata)│     │   (Clients)     │
                        └─────────────────┘     └─────────────────┘
```

### Components

1. **S3 Buckets**
   - `voltasis-mcp-docs-{stage}`: Store structured markdown files
   - `voltasis-mcp-index-{stage}`: Store search indexes and metadata

2. **Lambda Functions**
   - MCP Server Handler: Implements MCP protocol
   - Document Processor: Converts OpenAPI to structured markdown
   - Index Builder: Creates semantic search indexes

3. **API Gateway**
   - REST API endpoint for MCP protocol
   - WebSocket support for streaming responses

4. **CloudFront CDN**
   - Cache and distribute static markdown files
   - Reduce latency for global access

5. **DynamoDB**
   - Store document metadata and search indexes
   - Track document versions and relationships

## Document Structure

### Directory Organization

```
/mcp-docs/
├── /api/
│   ├── overview.md
│   ├── authentication.md
│   ├── /endpoints/
│   │   ├── users.md
│   │   ├── time-entries.md
│   │   ├── projects.md
│   │   └── ...
│   └── /schemas/
│       ├── user.md
│       ├── time-entry.md
│       └── ...
├── /guides/
│   ├── getting-started.md
│   ├── authentication-flow.md
│   └── multi-tenant-security.md
├── /reference/
│   ├── error-codes.md
│   ├── rate-limits.md
│   └── webhooks.md
└── index.json
```

### Markdown File Structure

Each markdown file will follow this optimized structure:

```markdown
---
id: unique-endpoint-id
title: Endpoint Title
category: api|guide|reference
tags: [authentication, users, multi-tenant]
related: [user-create, user-update]
version: 1.0.0
last_updated: 2024-01-01
---

# Endpoint Title

## Quick Reference
- **Method**: GET|POST|PUT|DELETE
- **Path**: /api/v1/resource
- **Authentication**: Required
- **Organization Context**: Required

## Description
Brief description optimized for LLM understanding.

## Request
### Headers
```json
{
  "Authorization": "Bearer {token}",
  "Content-Type": "application/json"
}
```

### Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| param1 | string | Yes | Description |

### Body Schema
```typescript
interface RequestBody {
  field1: string;
  field2?: number;
}
```

## Response
### Success (200)
```json
{
  "data": {},
  "metadata": {}
}
```

### Error Responses
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden

## Examples
### TypeScript
```typescript
// Example implementation
```

## Related Endpoints
- [Create User](./user-create.md)
- [Update User](./user-update.md)
```

## MCP Server Implementation

### MCP Protocol Handler

```typescript
// infrastructure/lambda/mcp-server/handler.ts
export const handler = async (event: APIGatewayProxyEvent) => {
  const request = JSON.parse(event.body || '{}');
  
  switch (request.method) {
    case 'initialize':
      return handleInitialize();
    
    case 'tools/list':
      return handleToolsList();
    
    case 'resources/list':
      return handleResourcesList();
    
    case 'resources/read':
      return handleResourceRead(request.params);
    
    case 'tools/call':
      return handleToolCall(request.params);
    
    default:
      return createErrorResponse(400, 'Unknown method');
  }
};
```

### Available Tools

1. **search_documentation**
   - Semantic search across all documentation
   - Returns relevant document sections

2. **get_endpoint_details**
   - Retrieve specific endpoint documentation
   - Include request/response schemas

3. **list_endpoints**
   - List all available API endpoints
   - Filter by category or tags

4. **get_schema**
   - Retrieve TypeScript/JSON schemas
   - Support for nested schemas

## Build & Deployment Pipeline

### Enhanced Build Script

```bash
#!/bin/bash
# scripts/mcp-docs-build-deploy.sh

# 1. Generate OpenAPI documentation
npm run openapi:build

# 2. Convert OpenAPI to structured markdown
node scripts/openapi-to-markdown.js

# 3. Process and optimize markdown files
node scripts/optimize-markdown-for-llm.js

# 4. Generate search indexes
node scripts/generate-search-index.js

# 5. Deploy to S3
aws s3 sync ./dist/mcp-docs s3://voltasis-mcp-docs-${STAGE}/

# 6. Update DynamoDB indexes
node scripts/update-dynamodb-index.js

# 7. Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id ${DISTRIBUTION_ID}
```

### OpenAPI to Markdown Converter

```typescript
// scripts/openapi-to-markdown.js
import { OpenAPIV3 } from 'openapi-types';

function convertOpenAPIToMarkdown(spec: OpenAPIV3.Document) {
  const endpoints = [];
  
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      const endpoint = {
        id: generateEndpointId(path, method),
        title: operation.summary,
        path,
        method: method.toUpperCase(),
        description: operation.description,
        parameters: operation.parameters,
        requestBody: operation.requestBody,
        responses: operation.responses,
        tags: operation.tags,
      };
      
      endpoints.push(generateMarkdownFile(endpoint));
    }
  }
  
  return endpoints;
}
```

## CDK Infrastructure Stack

```typescript
// infrastructure/lib/mcp-server-stack.ts
export class VoltasisMCPServerStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);
    
    // S3 Buckets
    const docsBucket = new s3.Bucket(this, 'MCPDocsBucket', {
      bucketName: `voltasis-mcp-docs-${props.stage}`,
      publicReadAccess: false,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }],
    });
    
    // DynamoDB Table for indexes
    const indexTable = new dynamodb.Table(this, 'MCPIndexTable', {
      tableName: `voltasis-mcp-index-${props.stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });
    
    // Lambda Function
    const mcpServerFunction = new lambda.Function(this, 'MCPServerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('lambda/mcp-server'),
      environment: {
        DOCS_BUCKET: docsBucket.bucketName,
        INDEX_TABLE: indexTable.tableName,
        STAGE: props.stage,
      },
    });
    
    // API Gateway
    const api = new apigateway.RestApi(this, 'MCPAPI', {
      restApiName: `voltasis-mcp-api-${props.stage}`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });
    
    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'MCPDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(docsBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      },
    });
  }
}
```

## Cursor Configuration

### MCP Configuration for Cursor

```json
{
  "mcpServers": {
    "voltasis-api": {
      "command": "node",
      "args": ["~/.cursor/mcp-clients/voltasis-mcp-client.js"],
      "env": {
        "MCP_ENDPOINT": "https://mcp-api.voltasis.com",
        "API_KEY": "${VOLTASIS_MCP_API_KEY}"
      }
    }
  }
}
```

### MCP Client Implementation

```javascript
// voltasis-mcp-client.js
const { MCPClient } = require('@modelcontextprotocol/sdk');

class VoltasisMCPClient extends MCPClient {
  constructor() {
    super({
      name: 'voltasis-api',
      version: '1.0.0',
      endpoint: process.env.MCP_ENDPOINT,
    });
  }
  
  async initialize() {
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: {},
      },
      serverInfo: {
        name: 'Voltasis API Documentation Server',
        version: '1.0.0',
      },
    };
  }
}
```

## Implementation Timeline

### Phase 1: Infrastructure Setup (Week 1-2)
- [ ] Create CDK stack for MCP server infrastructure
- [ ] Set up S3 buckets and DynamoDB tables
- [ ] Deploy Lambda functions and API Gateway
- [ ] Configure CloudFront distribution

### Phase 2: Document Processing (Week 3-4)
- [ ] Implement OpenAPI to Markdown converter
- [ ] Create markdown optimization scripts
- [ ] Build search index generator
- [ ] Test document structure with LLMs

### Phase 3: MCP Server Implementation (Week 5-6)
- [ ] Implement MCP protocol handler
- [ ] Create document search functionality
- [ ] Build caching layer for performance
- [ ] Add authentication and rate limiting

### Phase 4: Integration & Testing (Week 7-8)
- [ ] Integrate with build pipeline
- [ ] Configure Cursor settings
- [ ] Test with frontend and backend teams
- [ ] Performance optimization

### Phase 5: Documentation & Rollout (Week 9)
- [ ] Create usage documentation
- [ ] Train development teams
- [ ] Monitor usage and gather feedback
- [ ] Plan iterative improvements

## Security Considerations

1. **Authentication**
   - API key-based authentication for MCP access
   - Rotate keys regularly
   - Log all access for audit

2. **Rate Limiting**
   - Implement per-client rate limits
   - Monitor for abuse patterns
   - Use AWS WAF for additional protection

3. **Data Privacy**
   - No sensitive data in documentation
   - Encrypt data in transit and at rest
   - Regular security audits

## Monitoring & Metrics

1. **Usage Metrics**
   - Number of requests per endpoint
   - Most frequently accessed documents
   - Search query patterns

2. **Performance Metrics**
   - Response time percentiles
   - Cache hit rates
   - Lambda cold start frequency

3. **Error Tracking**
   - Failed requests by type
   - Document not found errors
   - Search failures

## Success Criteria

1. **Performance**
   - < 100ms response time for cached documents
   - < 500ms for search queries
   - 99.9% uptime

2. **Adoption**
   - 80% of development team using MCP server
   - Reduced time to find documentation by 50%
   - Improved code quality from better examples

3. **Maintenance**
   - Automated deployment with zero downtime
   - < 1 hour to update documentation
   - Self-healing infrastructure

## Next Steps

1. Review and approve implementation plan
2. Allocate resources and assign team members
3. Set up development environment
4. Begin Phase 1 implementation
5. Schedule weekly progress reviews

## Appendix: References

- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [Stripe LLM Documentation](https://docs.stripe.com/building-with-llms)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [OpenAPI Specification](https://swagger.io/specification/) 