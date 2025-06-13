# Global MCP Client Setup

## Overview
The Voltasis MCP client is now globally installed and accessible from any repository on your system.

## Installation Details

### Global Command
- **Command**: `voltasis-mcp-client`
- **Location**: `/opt/homebrew/bin/voltasis-mcp-client`
- **Type**: Symlink to `/opt/homebrew/lib/node_modules/voltasis-mcp-server/dist/mcp-aws-client.js`

### How It Was Set Up
1. Added `bin` configuration to package.json:
   ```json
   "bin": {
     "voltasis-mcp-client": "./dist/mcp-aws-client.js"
   }
   ```

2. Created global link using npm:
   ```bash
   npm link
   ```

### Cursor Configuration
The MCP client is configured in `~/.cursor/mcp.json`:
```json
{
  "voltasis-api": {
    "command": "voltasis-mcp-client",
    "args": [],
    "env": {
      "MCP_ENDPOINT": "https://u77ssoo8lc.execute-api.us-east-1.amazonaws.com/dev",
      "VOLTASIS_MCP_API_KEY": "Rd4wQp4iPH1RF44TVPImf4Q30IxMK6Xp3GzfzKek",
      "NODE_ENV": "production",
      "MCP_DEBUG": "true"
    }
  }
}
```

## Usage

### From Any Repository
The MCP client will work from any repository on your system. Cursor will automatically use the global command when you use Voltasis API tools.

### Available Tools
- `search_documentation` - Search through API documentation
- `get_endpoint_details` - Get details about specific endpoints
- `list_endpoints` - List all API endpoints
- `get_schema` - Get TypeScript/JSON schemas
- `list_schemas` - List all available schemas
- `get_document` - Get any document by ID
- `list_guides` - List all available guides
- `list_resources` - List all resources by category

### Updating the Client
To update the global client after making changes:
1. Make changes in the voltasis-mcp-server repository
2. Run `npm run build`
3. The global command will automatically use the updated version

### Troubleshooting
If the command stops working:
1. Check if the symlink exists: `ls -la /opt/homebrew/bin/voltasis-mcp-client`
2. Re-run `npm link` in the voltasis-mcp-server directory
3. Restart Cursor to pick up any changes

## Benefits
- Works from any repository without needing to install dependencies
- No need for absolute paths in configuration
- Easy to update - just rebuild in the source repository
- Consistent behavior across all projects 