# Voltasis MCP Server (AWS Edition)

A Model Context Protocol (MCP) server deployed on AWS that provides LLM-optimized access to Voltasis API documentation. This server enables AI coding assistants like Cursor to understand and work with the Voltasis API more effectively through a scalable, cloud-based architecture.

## Features

- ☁️ **AWS-Hosted**: Fully managed on AWS Lambda with API Gateway
- 🤖 **LLM-Optimized Documentation**: Structured markdown format designed for AI consumption
- 🔍 **Semantic Search**: Search across all API documentation via DynamoDB indexes
- 📚 **Comprehensive Tools**: List endpoints, get schemas, search documentation
- 🚀 **Global CDN**: Documentation served via CloudFront for fast access
- 🔒 **Secure**: API key authentication and encrypted storage
- 📈 **Scalable**: Auto-scales with AWS Lambda, handles unlimited concurrent users
- 🔄 **Protocol Compatible**: Supports MCP protocol version negotiation for maximum compatibility

## Quick Start

### Prerequisites

- AWS CLI configured with credentials
- Node.js 20.x or higher
- npm or yarn
- Cursor IDE (or other MCP-compatible editor)

### For Users (Connect to Existing AWS Deployment)

If the MCP server is already deployed to AWS:

1. Clone the repository:
```bash
git clone https://github.com/voltasis/voltasis-mcp-server.git
cd voltasis-mcp-server
```

2. Install dependencies and build:
```bash
npm install
npm run build
```

3. Configure Cursor for AWS:
```bash
npm run aws:configure dev  # or staging/prod
```

4. Restart Cursor to apply the configuration.

### For Administrators (Deploy to AWS)

To deploy a new MCP server to AWS:

1. Deploy the infrastructure:
```bash
npm run aws:deploy:dev  # Creates all AWS resources
```

2. Upload documentation:
```bash
npm run aws:upload-docs dev
```

3. Configure Cursor:
```bash
npm run aws:configure dev
```

## Usage

Once configured, the MCP server provides several tools in Cursor:

### Available Tools

1. **search_documentation**
   - Search through all Voltasis API documentation
   - Parameters:
     - `query` (required): Search terms
     - `category` (optional): 'api', 'guide', 'reference', or 'all'

2. **get_endpoint_details**
   - Get detailed information about a specific API endpoint
   - Parameters:
     - `endpoint` (required): The endpoint path (e.g., '/api/v1/users')
     - `method` (optional): HTTP method (GET, POST, PUT, DELETE, PATCH)

3. **list_endpoints**
   - List all available API endpoints
   - Parameters:
     - `tag` (optional): Filter by tag
     - `category` (optional): Filter by category

4. **get_schema**
   - Get TypeScript/JSON schema for a data model
   - Parameters:
     - `schemaName` (required): Name of the schema
     - `format` (optional): 'typescript' or 'json'

### Example Usage in Cursor

In Cursor, you can use these tools by asking questions like:

- "Search for authentication documentation"
- "Show me the user creation endpoint"
- "List all endpoints tagged with 'users'"
- "Get the TypeScript schema for TimeEntry"

## Project Structure

```
voltasis-mcp-server/
├── src/
│   ├── mcp-aws-client.ts   # AWS MCP client (connects to API Gateway)
│   ├── mcp/                # MCP protocol implementation
│   ├── documents/          # Document management
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
├── infrastructure/         # AWS CDK infrastructure code
│   ├── lambda/             # Lambda function handlers
│   ├── lib/                # CDK stack definitions
│   └── bin/                # CDK app entry point
├── scripts/                # Deployment and utility scripts
│   ├── deploy-mcp-aws.sh   # AWS deployment script
│   ├── upload-docs.sh      # Document upload script
│   ├── configure-cursor-aws.ts  # Cursor configuration
│   ├── generate-index.ts   # Documentation index generator
│   └── add-endpoint.sh     # Helper to add new endpoints
├── mcp-docs/              # Documentation files (uploaded to S3)
│   ├── api/               # API endpoint documentation
│   ├── guides/            # Integration guides
│   └── reference/         # Reference documentation
├── docs/                  # Project documentation
│   ├── mcp-server-architecture-decisions.md
│   ├── mcp-server-implementation-plan.md
│   └── mcp-server-benefits.md
└── tests/                 # Test files
```

## Development

### Managing Documentation

Documentation is stored in S3 and served via CloudFront. To update documentation:

1. Place markdown files in the `mcp-docs` directory following this structure:
   ```
   mcp-docs/
   ├── api/endpoints/
   ├── api/schemas/
   ├── guides/
   └── reference/
   ```

2. Each markdown file should have frontmatter:
   ```markdown
   ---
   id: unique-id
   title: Document Title
   category: api|guide|reference
   tags: [tag1, tag2]
   related: [related-doc-id]
   version: 1.0.0
   last_updated: 2024-01-01
   ---
   ```

3. Generate the index and upload to AWS:
   ```bash
   npm run generate-index
   npm run aws:upload-docs dev
   ```

### Syncing with OpenAPI Documentation

The MCP server can automatically sync with Voltasis API OpenAPI documentation:

1. **Quick Sync** (from voltasis-api directory):
   ```bash
   ./scripts/openapi-build-deploy-with-mcp.sh dev none false true
   ```

2. **Full Setup Guide**: See [OpenAPI Sync Setup Guide](docs/openapi-sync-setup.md)

3. **Integration Details**: See [OpenAPI MCP Integration](docs/openapi-mcp-integration.md)

This converts OpenAPI specs to MCP-friendly markdown, generating 197+ endpoint documents and 64+ schema documents automatically.

### Adding New Endpoints

Use the helper script to quickly add new endpoint documentation:
```bash
./scripts/add-endpoint.sh users-create "Create User" POST /api/v1/users
```

Then edit the generated file and upload to AWS.

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Configuration

### AWS Environment Variables

The deployment scripts create environment-specific configuration files:
- `.env.dev` - Development environment
- `.env.staging` - Staging environment  
- `.env.prod` - Production environment

These files contain:
- API Gateway endpoint URLs
- CloudFront distribution URLs
- API key IDs
- Stack names

### Cursor Configuration

The MCP server is configured in Cursor to connect to AWS:
```bash
npm run aws:configure dev  # or staging/prod
```

This updates `~/.cursor/mcp.json` with the AWS endpoint and authentication details.

### Automatic Connection

The MCP server connects automatically when:
1. You open Cursor IDE
2. You interact with the Voltasis API context in a conversation

All requests are routed through API Gateway to Lambda functions in AWS.

## AWS Deployment

The project includes AWS CDK infrastructure for deploying a production-ready MCP server:

### Prerequisites

- AWS CLI configured with credentials
- Node.js 20.x or higher
- CDK CLI: `npm install -g aws-cdk`

### Deployment Steps

1. **Deploy the infrastructure**:
```bash
./scripts/deploy-mcp-aws.sh dev  # or staging/prod
```

This creates:
- Lambda functions for MCP protocol handling
- API Gateway with API key authentication
- S3 buckets for documentation storage
- CloudFront CDN for global distribution
- DynamoDB tables for search indexes

2. **Upload documentation**:
```bash
./scripts/upload-docs.sh dev
```

3. **Configure Cursor for AWS**:
```bash
tsx scripts/configure-cursor-aws.ts dev
```

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Cursor IDE     │────▶│  API Gateway    │────▶│ Lambda Function │
│  (MCP Client)   │     │  (API Key Auth) │     │  (MCP Handler)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
                                ┌─────────────────────────┴─────────┐
                                │                                   │
                        ┌───────▼────────┐              ┌──────────▼────────┐
                        │   DynamoDB     │              │    S3 Bucket      │
                        │ (Search Index) │              │ (Documentation)   │
                        └────────────────┘              └───────────────────┘
                                                                │
                                                        ┌───────▼────────┐
                                                        │   CloudFront   │
                                                        │     (CDN)      │
                                                        └────────────────┘
```

### Multi-Stage Support

Deploy to different environments:
- **Development**: `./scripts/deploy-mcp-aws.sh dev`
- **Staging**: `./scripts/deploy-mcp-aws.sh staging`
- **Production**: `./scripts/deploy-mcp-aws.sh prod`

Each environment is completely isolated with its own resources.

## Troubleshooting

### MCP Server Not Appearing in Cursor

1. Ensure you've run `npm run build`
2. Run `npm run aws:configure dev` (not the local configure)
3. Restart Cursor completely
4. Check the MCP configuration: `cat ~/.cursor/mcp.json`
5. Verify the AWS endpoint is responding:
```bash
curl -X POST https://your-api-gateway-url/dev/mcp \
  -H "X-Api-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}'
```

### Protocol Version Issues

The MCP server supports protocol version negotiation. If you encounter compatibility issues:
1. Check Cursor's protocol version in debug logs
2. The server automatically adapts to the client's protocol version
3. Currently supports both `2024-11-05` and `2025-03-26` protocol versions

### Documentation Not Loading

1. Check CloudWatch logs for Lambda errors
2. Verify documentation is uploaded to S3
3. Check DynamoDB for index entries
4. Re-upload documentation: `npm run aws:upload-docs dev`

### API Key Issues

1. Verify API key is correctly configured in environment
2. Check API Gateway for key validation errors
3. Regenerate API key if needed through AWS Console

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

ISC License - see LICENSE file for details

## Support

For issues and questions:
- Create an issue in the GitHub repository
- Contact the Voltasis development team

## Recent Updates

### OpenAPI to MCP Synchronization (June 2024)
- Automatic conversion of OpenAPI specifications to MCP documentation
- Generates 197+ endpoint documents and 64+ schema documents
- Three integration methods: script-based, GitHub Actions, and webhooks
- See [OpenAPI Sync Setup Guide](docs/openapi-sync-setup.md) for detailed instructions
- Run `./scripts/openapi-build-deploy-with-mcp.sh` from voltasis-api directory

### Real-Time Documentation Updates (December 2024)
- Implemented webhook integration for automatic documentation updates
- Added GitHub Actions workflow for CI/CD pipeline integration
- Documentation changes are now deployed automatically on push
- CloudFront cache invalidation ensures immediate availability
- See [Webhook Integration Documentation](docs/webhook-integration.md) for setup details

### Protocol Version Compatibility (June 2025)
- Fixed protocol version mismatch issues with Cursor IDE
- Added automatic protocol version negotiation
- Server now supports both MCP protocol versions `2024-11-05` and `2025-03-26`
- Enhanced capability declarations for better tool discovery

### Enhanced MCP Features
- Added prompts support with pre-built templates
- Implemented sampling/createMessage handler
- Improved error handling and logging
- Better support for resource subscriptions

## Roadmap

- [x] AWS deployment with CDK ✅
- [x] API Gateway with authentication ✅
- [x] CloudFront CDN distribution ✅
- [x] DynamoDB search indexes ✅
- [x] Protocol version negotiation ✅
- [x] Prompts support ✅
- [x] Real-time documentation updates via webhooks ✅
- [x] Integration with Voltasis CI/CD pipeline ✅
- [ ] Advanced semantic search using embeddings
- [ ] Support for multiple API versions
- [ ] GraphQL schema support
- [ ] Monitoring dashboard with CloudWatch 