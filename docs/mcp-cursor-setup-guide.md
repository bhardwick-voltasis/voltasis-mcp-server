# Voltasis MCP Server - Cursor Setup Guide

## Quick Start (5 minutes)

### Step 1: Get Your API Key
Contact your team lead or check the team vault for your personal MCP API key.

```
Example: mcp_key_abc123def456ghi789jkl012mno345
```

### Step 2: Set Environment Variable

#### macOS/Linux:
```bash
# Add to ~/.zshrc or ~/.bashrc
echo 'export VOLTASIS_MCP_API_KEY="your-key-here"' >> ~/.zshrc
source ~/.zshrc
```

#### Windows:
```powershell
# Run as Administrator
[System.Environment]::SetEnvironmentVariable("VOLTASIS_MCP_API_KEY", "your-key-here", "User")
```

### Step 3: Configure Cursor

1. Open Cursor Settings (`Cmd/Ctrl + ,`)
2. Search for "MCP" 
3. Click "Edit in settings.json"
4. Add this configuration:

```json
{
  "mcpServers": {
    "voltasis-api": {
      "command": "npx",
      "args": [
        "-y",
        "@voltasis/mcp-client@latest",
        "--endpoint=https://mcp-api.voltasis.com"
      ],
      "env": {
        "VOLTASIS_MCP_API_KEY": "${VOLTASIS_MCP_API_KEY}"
      }
    }
  }
}
```

### Step 4: Restart Cursor
Close and reopen Cursor to load the new configuration.

### Step 5: Test It Works

In Cursor chat, try:
```
@voltasis-api How do I create a time entry?
```

You should get a detailed response with code examples!

## Troubleshooting

### "Authentication failed" error
- Check your API key is set correctly: `echo $VOLTASIS_MCP_API_KEY`
- Ensure you restarted Cursor after setting the environment variable
- Verify your API key hasn't expired

### "MCP server not found" error
- Make sure you saved the settings.json file
- Check for typos in the configuration
- Try updating the MCP client: `npx @voltasis/mcp-client@latest --version`

### Rate limit exceeded
- You're limited to 100 requests per minute
- Wait a minute and try again
- Contact admin if you need higher limits

## Security Best Practices

### DO:
- ✅ Store API key in environment variables
- ✅ Use your personal API key (not shared)
- ✅ Keep your API key secret
- ✅ Report if your key is compromised

### DON'T:
- ❌ Hardcode API key in settings.json
- ❌ Share your API key with others
- ❌ Commit API key to git
- ❌ Use production keys in development

## Alternative: Local Cache Mode

If you're working offline or want faster responses:

```json
{
  "mcpServers": {
    "voltasis-api-local": {
      "command": "npx",
      "args": [
        "-y", 
        "@voltasis/mcp-client@latest",
        "--mode=local",
        "--cache-dir=~/.voltasis/mcp-cache"
      ]
    }
  }
}
```

This downloads documentation locally (requires initial connection).

## For Windows Users

If environment variables aren't working, you can use a wrapper script:

1. Create `C:\voltasis\mcp-wrapper.bat`:
```batch
@echo off
set VOLTASIS_MCP_API_KEY=your-key-here
npx -y @voltasis/mcp-client@latest --endpoint=https://mcp-api.voltasis.com %*
```

2. Update Cursor settings:
```json
{
  "mcpServers": {
    "voltasis-api": {
      "command": "C:\\voltasis\\mcp-wrapper.bat"
    }
  }
}
```

## Available Commands

Once configured, you can ask the AI assistant about:

- **API Endpoints**: `@voltasis-api show me the user endpoints`
- **Code Examples**: `@voltasis-api how to authenticate a user`
- **Schemas**: `@voltasis-api what fields does a TimeEntry have?`
- **Best Practices**: `@voltasis-api how to handle multi-tenant security`

## Need Help?

- **Slack**: #voltasis-mcp-support
- **Docs**: https://mcp-docs.voltasis.com
- **Admin**: devops@voltasis.com 