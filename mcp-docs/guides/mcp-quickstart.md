---
id: guide-mcp-quickstart
title: MCP Server Quick Start Guide
category: guide
tags: [mcp, quickstart, cursor, setup]
related: [guide-authentication]
version: 1.0.0
last_updated: 2025-06-13
---

# MCP Server Quick Start Guide

## Overview

This guide will help you get started with the Voltasis MCP (Model Context Protocol) Server in Cursor IDE. The MCP server provides AI-powered assistance for working with the Voltasis API.

## Prerequisites

- Cursor IDE installed
- Node.js 20.x or higher
- Access to the voltasis-mcp-server repository

## Installation Steps

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

### 2. Configure Cursor

The easiest way to configure Cursor:

```bash
npm run configure-cursor
```

Or manually add to Cursor settings:
1. Open Cursor Settings (Cmd/Ctrl + ,)
2. Search for "MCP"
3. Add the Voltasis server configuration

### 3. Verify Installation

Restart Cursor and type in any chat:
- "What Voltasis API endpoints are available?"
- "Show me how to create a time entry"

## Using the MCP Server

### Available Commands

The MCP server understands natural language queries about the Voltasis API:

#### Listing Endpoints
- "List all Voltasis API endpoints"
- "Show me user-related endpoints"
- "What endpoints are available for time tracking?"

#### Getting Details
- "Explain the user creation endpoint"
- "Show me how to list users"
- "What parameters does the time entry endpoint need?"

#### Code Examples
- "Give me a TypeScript example for creating a user"
- "Show me how to authenticate with the API"
- "Write a function to fetch time entries"

### Best Practices

1. **Be Specific**: Ask for exactly what you need
   - ✅ "Show me the TypeScript interface for TimeEntry"
   - ❌ "Tell me about time"

2. **Request Examples**: Ask for code examples in your language
   - "Show me a Python example for creating time entries"
   - "Give me a cURL command to list users"

3. **Ask About Errors**: Get help with API errors
   - "What does error 403 mean for the users endpoint?"
   - "Why might I get a 422 error when creating time entries?"

## Troubleshooting

### MCP Not Responding

1. Check the logs:
```bash
tail -f /tmp/voltasis-mcp-server.log
```

2. Test the server directly:
```bash
./scripts/test-cursor-sequence.sh
```

### Outdated Documentation

Update your local documentation:
```bash
git pull
npm run generate-index
```

### Connection Issues

Verify Cursor configuration:
```bash
cat ~/.cursor-server/User/globalStorage/cursor-config.json | grep voltasis
```

## Advanced Usage

### Filtering Results

You can ask for filtered information:
- "Show me only GET endpoints"
- "List endpoints tagged with 'organization'"
- "Search for authentication documentation"

### Schema Information

Request data models and schemas:
- "Show me the User schema"
- "What fields does a TimeEntry have?"
- "Give me the TypeScript types for all models"

### Integration Examples

Ask for complete integration examples:
- "Show me how to set up a Node.js client for Voltasis"
- "Create a React hook for fetching users"
- "Write a Python script to export time entries"

## Keeping Documentation Updated

The MCP server uses local documentation that needs periodic updates:

```bash
# Check for updates
git fetch

# Pull latest changes
git pull

# Rebuild index
npm run generate-index
```

Consider setting up a weekly reminder to update documentation.

## Getting Help

- **Issues**: Report problems on GitHub
- **Questions**: Ask in Cursor chat - the AI can often help!
- **Logs**: Check `/tmp/voltasis-mcp-server.log` for debugging

## Next Steps

1. Explore the [API Overview](../api/overview.md)
2. Set up [Authentication](./authentication.md)
3. Try creating your first [Time Entry](../api/endpoints/time-entries-create.md)
4. Build something awesome! 🚀 