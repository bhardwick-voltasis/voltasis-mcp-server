# MCP Server Architecture Decisions

## Repository Structure Decision

### Recommendation: **Separate Repository**

After careful consideration, I recommend hosting the MCP server in a **separate repository** from the Voltasis backend code for the following reasons:

### Advantages of Separate Repository

1. **Independent Deployment Cycles**
   - Deploy documentation updates without touching production API
   - Faster iteration on documentation improvements
   - No risk of breaking API during doc updates

2. **Clean Separation of Concerns**
   - Documentation infrastructure != API infrastructure
   - Different testing requirements
   - Separate CI/CD pipelines

3. **Access Control**
   - Grant documentation access without API code access
   - Allow technical writers to contribute without backend access
   - Potential for open-sourcing documentation later

4. **Performance Optimization**
   - Smaller codebase = faster builds
   - Documentation-specific caching strategies
   - Independent scaling decisions

5. **Technology Freedom**
   - Use different tools/languages optimized for documentation
   - Experiment with new MCP features without affecting API
   - Easier to migrate or replace

### Proposed Repository Structure

```
voltasis-mcp-server/
├── infrastructure/          # CDK stack for MCP server
│   ├── lib/
│   │   ├── mcp-server-stack.ts
│   │   ├── mcp-lambda-stack.ts
│   │   └── mcp-storage-stack.ts
│   └── lambda/
│       ├── mcp-handler/
│       ├── search-handler/
│       └── shared/
├── scripts/
│   ├── fetch-openapi.sh    # Fetch latest OpenAPI from main repo
│   ├── convert-to-markdown.js
│   ├── generate-index.js
│   └── deploy.sh
├── docs/
│   ├── templates/          # Markdown templates
│   └── guides/            # Static guides
├── tests/
├── .github/
│   └── workflows/
│       ├── update-docs.yml # Triggered by main repo
│       └── deploy.yml
└── package.json
```

### Integration with Main Repository

```yaml
# In voltasis_api repo: .github/workflows/trigger-docs-update.yml
name: Trigger MCP Docs Update
on:
  push:
    paths:
      - 'openapi/**'
      - 'infrastructure/lambda/**/*.ts'
    branches: [main, develop]

jobs:
  trigger-mcp-update:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger MCP Repository
        uses: actions/github-script@v6
        with:
          github-token: ${{ secrets.MCP_REPO_TOKEN }}
          script: |
            await github.rest.actions.createWorkflowDispatch({
              owner: 'voltasis',
              repo: 'voltasis-mcp-server',
              workflow_id: 'update-docs.yml',
              ref: 'main',
              inputs: {
                source_ref: '${{ github.sha }}',
                environment: '${{ github.ref_name }}'
              }
            })
```

## Authentication Strategy

### Cursor MCP Authentication Support

You're right to be cautious! Cursor **does support authentication** for MCP servers, but with some limitations:

### 1. Environment Variable Authentication (Recommended)

```json
// ~/.cursor/mcp.json
{
  "mcpServers": {
    "voltasis-api": {
      "command": "node",
      "args": ["~/.cursor/mcp-clients/voltasis-mcp-client.js"],
      "env": {
        "MCP_ENDPOINT": "https://mcp-api.voltasis.com",
        "VOLTASIS_MCP_API_KEY": "${VOLTASIS_MCP_API_KEY}"  // Read from system env
      }
    }
  }
}
```

**Setup Instructions for Developers:**
```bash
# Add to ~/.zshrc or ~/.bashrc
export VOLTASIS_MCP_API_KEY="mcp_key_xxxxxxxxxxxxx"

# Or use a secure credential manager
export VOLTASIS_MCP_API_KEY=$(security find-generic-password -s "voltasis-mcp" -w)
```

### 2. API Key Management Strategy

```typescript
// infrastructure/lambda/mcp-handler/auth.ts
export async function validateMCPApiKey(apiKey: string): Promise<boolean> {
  // Option 1: Simple API key validation
  const validKeys = await getParameter('/mcp/api-keys');
  return validKeys.includes(apiKey);
  
  // Option 2: JWT-based API keys with expiration
  try {
    const decoded = jwt.verify(apiKey, process.env.MCP_SECRET);
    return decoded.type === 'mcp-access';
  } catch {
    return false;
  }
}

// Rate limiting per API key
export async function checkRateLimit(apiKey: string): Promise<boolean> {
  const key = `rate-limit:${apiKey}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, 60); // 1 minute window
  }
  
  return count <= 100; // 100 requests per minute
}
```

### 3. Security Levels

```typescript
// Different access levels for different use cases
enum MCPAccessLevel {
  PUBLIC = 'public',        // Read public endpoints only
  DEVELOPER = 'developer',  // Read all endpoints
  ADMIN = 'admin'          // Read + write operations
}

interface MCPApiKey {
  key: string;
  level: MCPAccessLevel;
  organizationId?: string;  // Optional org-specific access
  expiresAt?: Date;
}
```

### 4. Alternative Authentication Methods

#### A. Local MCP Server (No Auth Required)
```json
{
  "mcpServers": {
    "voltasis-api-local": {
      "command": "npx",
      "args": ["-y", "@voltasis/mcp-local", "--cache-dir=~/.voltasis/mcp-cache"]
    }
  }
}
```

#### B. OAuth Flow (Future Enhancement)
```typescript
// Future: OAuth support when Cursor adds it
interface OAuthConfig {
  clientId: string;
  authorizationUrl: 'https://auth.voltasis.com/oauth/authorize';
  tokenUrl: 'https://auth.voltasis.com/oauth/token';
  scope: 'mcp:read';
}
```

## Recommended Implementation Path

### Phase 1: Public Documentation (No Auth)
- Start with public, read-only documentation
- No sensitive information in docs
- Monitor usage patterns

### Phase 2: API Key Authentication
- Implement simple API key validation
- Distribute keys to development team
- Add rate limiting

### Phase 3: Advanced Security (If Needed)
- JWT-based API keys with expiration
- Organization-specific access
- Audit logging

## Development Workflow

### For Backend Developers:
```bash
# One-time setup
git clone https://github.com/voltasis/voltasis-mcp-server
cd voltasis-mcp-server
npm install

# Get API key from team lead
export VOLTASIS_MCP_API_KEY="your-key-here"

# Configure Cursor (automatic)
npm run configure-cursor
```

### For MCP Server Maintainers:
```bash
# Update documentation
npm run fetch-openapi     # Get latest from main repo
npm run convert           # Convert to markdown
npm run test             # Test the conversion
npm run deploy:dev       # Deploy to dev environment
```

## Cost Considerations

### Separate Repository Costs:
- Additional GitHub Actions minutes (~$10/month)
- Separate AWS resources (included in serverless costs)
- No significant increase in overall costs

### Shared Repository Would Require:
- More complex CI/CD logic
- Larger Lambda deployment packages
- More careful access control

## Decision Matrix

| Factor | Same Repo | Separate Repo | Winner |
|--------|-----------|---------------|---------|
| Deployment Speed | ⭐⭐ | ⭐⭐⭐⭐⭐ | Separate |
| Code Organization | ⭐⭐ | ⭐⭐⭐⭐⭐ | Separate |
| Access Control | ⭐⭐ | ⭐⭐⭐⭐⭐ | Separate |
| Maintenance | ⭐⭐⭐ | ⭐⭐⭐⭐ | Separate |
| Initial Setup | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Same |
| Long-term Flexibility | ⭐⭐ | ⭐⭐⭐⭐⭐ | Separate |

## Conclusion

**Recommendation**: Create a separate `voltasis-mcp-server` repository with:

1. **Simple API key authentication** to start
2. **GitHub Actions integration** with main repo
3. **Independent deployment pipeline**
4. **Clear separation of concerns**

This approach provides maximum flexibility while keeping complexity manageable. The authentication concern is addressed through environment variables, which Cursor fully supports. 