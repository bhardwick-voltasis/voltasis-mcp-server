# Voltasis MCP Client Setup for Developers

## Installation Methods

### Method 1: Project Dependency (Recommended)

Add to your project's `package.json`:

```json
{
  "devDependencies": {
    "@voltasis/mcp-client": "^1.0.0"
  }
}
```

Then run:
```bash
npm install
```

### Method 2: Global Installation

```bash
npm install -g @voltasis/mcp-client
```

## Cursor Configuration

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

## Benefits of NPM Package Approach

1. **Version Control**: Lock specific versions in package.json
2. **Easy Updates**: `npm update @voltasis/mcp-client`
3. **CI/CD Friendly**: Installs automatically in pipelines
4. **No Manual Setup**: Works immediately after `npm install`
5. **Team Consistency**: Everyone uses the same version

## For Repository Maintainers

### Publishing Updates

1. Update version in package.json
2. Build the project: `npm run build`
3. Publish to registry: `npm publish`

### Using GitHub Packages

```bash
# Authenticate with GitHub
npm login --registry=https://npm.pkg.github.com

# Publish
npm publish
```

### Using AWS CodeArtifact

```bash
# Login to CodeArtifact
aws codeartifact login --tool npm --domain voltasis --repository npm-private

# Publish
npm publish
```

## Troubleshooting

### If MCP tools aren't working:

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

4. Restart Cursor after configuration changes 