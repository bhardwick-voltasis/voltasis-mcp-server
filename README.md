# Voltasis MCP Server

A Model Context Protocol (MCP) server that provides access to Voltasis API documentation through AI assistants like Claude.

## Features

- 🔍 **Search Documentation** - Search through API docs, guides, and references
- 📚 **Browse Endpoints** - List and explore all API endpoints with pagination
- 📖 **View Schemas** - Access TypeScript/JSON schemas for data models
- 📝 **Read Guides** - Access authentication and quickstart guides
- 🔗 **Resource Management** - List and filter all documentation resources
- 🚀 **Real-time Updates** - Webhook support for automatic documentation updates

## Installation

### Prerequisites

- Node.js 18+ 
- AWS CLI configured with appropriate credentials
- Access to Voltasis AWS CodeArtifact repository

### For Developers

1. **Configure AWS CodeArtifact**:
   ```bash
   aws codeartifact login --tool npm --domain voltasis --repository npm-packages --region us-east-1
   ```

2. **Add to your project**:
   ```json
   {
     "devDependencies": {
       "@voltasis/mcp-client": "^1.0.0"
     }
   }
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Configure Cursor**:
   Add to `~/.cursor/mcp.json`:
   ```json
   {
     "mcpServers": {
       "voltasis-api": {
         "command": "npx",
         "args": ["@voltasis/mcp-client"],
         "env": {
           "MCP_ENDPOINT": "https://u77ssoo8lc.execute-api.us-east-1.amazonaws.com/dev",
           "VOLTASIS_MCP_API_KEY": "YOUR_API_KEY_HERE",
           "NODE_ENV": "production"
         }
       }
     }
   }
   ```

5. **Restart Cursor** to activate the MCP tools.

## Available Tools

### 🔍 search_documentation
Search through Voltasis API documentation for relevant information.

**Parameters:**
- `query` (required): Search query to find relevant documentation
- `category` (optional): Filter by category - `api`, `guide`, `reference`, or `all` (default)

### 📋 list_endpoints
List all available API endpoints with pagination support.

**Parameters:**
- `tag` (optional): Filter endpoints by tag
- `category` (optional): Filter by category
- `page` (optional): Page number (0-based, default: 0)
- `pageSize` (optional): Items per page (default: 50, max: 100)

### 🔎 get_endpoint_details
Get detailed information about a specific API endpoint.

**Parameters:**
- `endpoint` (required): The endpoint path (e.g., `/api/v1/users`)
- `method` (optional): HTTP method (GET, POST, PUT, DELETE, PATCH)

### 📊 list_schemas
List all available API schemas with pagination.

**Parameters:**
- `page` (optional): Page number (0-based, default: 0)
- `pageSize` (optional): Items per page (default: 50, max: 100)

### 📐 get_schema
Get TypeScript/JSON schema for a specific model.

**Parameters:**
- `schemaName` (required): Name of the schema (e.g., User, TimeEntry)
- `format` (optional): Output format - `typescript` (default) or `json`

### 📄 get_document
Get any document by its ID (works for guides, endpoints, schemas).

**Parameters:**
- `documentId` (required): Document ID or path

### 📚 list_guides
List all available guides.

**Parameters:**
- `page` (optional): Page number (0-based, default: 0)
- `pageSize` (optional): Items per page (default: 50, max: 100)

### 🗂️ list_resources
List all available resources by category.

**Parameters:**
- `category` (optional): Filter by category - `api`, `guide`, `reference`, or `all` (default)
- `page` (optional): Page number (0-based, default: 0)
- `pageSize` (optional): Items per page (default: 50, max: 100)

## Architecture

The system consists of:

- **MCP Client**: Lightweight Node.js proxy that runs locally
- **API Gateway**: HTTPS endpoint with API key authentication
- **Lambda Functions**: Serverless handlers for MCP protocol
- **DynamoDB**: Stores document metadata and search indexes
- **S3**: Stores actual documentation content
- **CloudFront**: CDN for fast global access

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/voltasis/voltasis-mcp-server.git
cd voltasis-mcp-server

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### Publishing Updates

1. Update version in `package.json`
2. Build the project: `npm run build`
3. Login to CodeArtifact: `aws codeartifact login --tool npm --domain voltasis --repository npm-packages`
4. Publish: `npm publish`

### Infrastructure Deployment

```bash
# Deploy AWS infrastructure
cd infrastructure
npm run deploy

# Upload documentation to S3
npm run aws:upload-docs
```

## Troubleshooting

### MCP tools not appearing in Cursor?

1. Verify installation:
   ```bash
   npx @voltasis/mcp-client --version
   ```

2. Check Cursor logs:
   - View → Output → MCP

3. Test the API directly:
   ```bash
   curl -X POST https://u77ssoo8lc.execute-api.us-east-1.amazonaws.com/dev/mcp \
     -H "x-api-key: YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```

4. Ensure AWS CodeArtifact login is active (expires after 12 hours)

### Authentication Issues?

- Verify your API key is correct in `~/.cursor/mcp.json`
- Check AWS credentials: `aws sts get-caller-identity`
- Re-login to CodeArtifact: `aws codeartifact login --tool npm --domain voltasis --repository npm-packages`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
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