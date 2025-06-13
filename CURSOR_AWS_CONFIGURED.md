# Cursor MCP Configuration Updated to AWS

## Configuration Changes Made

The Cursor MCP configuration has been successfully updated to use the AWS-hosted MCP server instead of the local server.

### Previous Configuration (Local)
- **Command**: `node dist/local-server.js`
- **Mode**: Local file system access
- **Cache**: Local mcp-docs directory

### New Configuration (AWS)
- **Command**: `node dist/mcp-aws-client.js`
- **Endpoint**: `https://u77ssoo8lc.execute-api.us-east-1.amazonaws.com/dev`
- **Authentication**: API Key (stored in environment)
- **Mode**: HTTPS connection to AWS Lambda

## What This Means

1. **Remote Access**: The MCP server now runs on AWS Lambda, providing scalable access
2. **API Key Security**: Requests are authenticated using an API key
3. **CloudFront CDN**: Documentation is served from AWS CloudFront for fast access
4. **No Local Files**: No need to maintain local documentation files

## Testing the Configuration

1. **Restart Cursor** to apply the new configuration
2. **Test MCP Tools** - Try these queries:
   - "What API endpoints are available in Voltasis?"
   - "Show me the time entries endpoint documentation"
   - "Search for user management in the API"

## Configuration Details

```json
{
  "voltasis-api": {
    "command": "node",
    "args": [
      "/Users/bradhardwick/Documents/GitHub/voltasis/voltasis-mcp-server/dist/mcp-aws-client.js"
    ],
    "env": {
      "MCP_ENDPOINT": "https://u77ssoo8lc.execute-api.us-east-1.amazonaws.com/dev",
      "VOLTASIS_MCP_API_KEY": "[API_KEY_CONFIGURED]",
      "NODE_ENV": "production"
    }
  }
}
```

## Benefits of AWS Configuration

- ✅ **Always Up-to-Date**: Documentation is centrally managed
- ✅ **No Local Sync**: No need to pull updates locally
- ✅ **Team Sharing**: All team members access the same documentation
- ✅ **Scalable**: Handles multiple concurrent users
- ✅ **Secure**: API key authentication protects access

## Troubleshooting

If the MCP tools don't work after restarting Cursor:

1. Check that the mcp-aws-client.js file exists: `ls dist/mcp-aws-client.js`
2. Test the API endpoint directly:
   ```bash
   curl -X POST https://u77ssoo8lc.execute-api.us-east-1.amazonaws.com/dev/mcp \
     -H "X-Api-Key: [YOUR_API_KEY]" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}'
   ```
3. Check Cursor's developer console for any errors

## Next Steps

1. Close Cursor completely
2. Reopen Cursor
3. The Voltasis API MCP tools should now be connected to AWS
4. Documentation updates are now managed centrally on AWS 