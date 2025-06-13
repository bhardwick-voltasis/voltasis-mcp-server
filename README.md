# Voltasis MCP Server

A Model Context Protocol (MCP) server that provides LLM-optimized access to Voltasis API documentation. This server enables AI coding assistants like Cursor to understand and work with the Voltasis API more effectively.

## Features

- 🤖 **LLM-Optimized Documentation**: Structured markdown format designed for AI consumption
- 🔍 **Semantic Search**: Search across all API documentation
- 📚 **Comprehensive Tools**: List endpoints, get schemas, search documentation
- 🚀 **Fast Local Access**: Run locally for instant documentation access
- 🔒 **Secure**: Optional API key authentication for remote access

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Cursor IDE (or other MCP-compatible editor)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/voltasis/voltasis-mcp-server.git
cd voltasis-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Configure Cursor:
```bash
npm run configure-cursor
```

5. Restart Cursor to apply the configuration.

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
│   ├── mcp/                 # MCP protocol implementation
│   ├── documents/           # Document management
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
├── scripts/                # Build and deployment scripts
├── mcp-docs/              # Documentation files (generated)
│   ├── api/               # API endpoint documentation
│   ├── guides/            # Integration guides
│   └── reference/         # Reference documentation
├── infrastructure/        # AWS CDK infrastructure (future)
└── tests/                # Test files
```

## Development

### Running in Development Mode

```bash
npm run dev
```

### Adding Documentation

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

3. Generate the index:
   ```bash
   npm run generate-index
   ```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Environment
NODE_ENV=development
LOG_LEVEL=debug

# MCP Configuration
MCP_CACHE_DIR=./mcp-docs

# API Configuration (for remote server)
# MCP_ENDPOINT=https://mcp-api.voltasis.com
# VOLTASIS_MCP_API_KEY=your-api-key-here
```

### Cursor Configuration

The MCP server is automatically configured in Cursor when you run:
```bash
npm run configure-cursor
```

This creates/updates `~/.cursor/mcp.json` with the Voltasis MCP server configuration.

## Deployment (Future)

The project includes AWS CDK infrastructure for deploying a remote MCP server:

```bash
# Deploy to AWS
npm run cdk:deploy
```

This will create:
- Lambda functions for the MCP server
- API Gateway for remote access
- S3 buckets for documentation storage
- CloudFront distribution for caching

## Troubleshooting

### MCP Server Not Appearing in Cursor

1. Ensure you've run `npm run build`
2. Run `npm run configure-cursor`
3. Restart Cursor completely
4. Check logs: `tail -f ~/.cursor/logs/mcp.log`

### Documentation Not Loading

1. Verify documentation files exist in `mcp-docs/`
2. Check the index file: `mcp-docs/index.json`
3. Run `npm run generate-index` to rebuild the index

### Permission Errors

Ensure the built files have execute permissions:
```bash
chmod +x dist/local-server.js
```

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

## Roadmap

- [ ] AWS deployment with CDK
- [ ] Advanced semantic search using embeddings
- [ ] Real-time documentation updates
- [ ] Integration with Voltasis build pipeline
- [ ] Support for multiple API versions
- [ ] GraphQL schema support 