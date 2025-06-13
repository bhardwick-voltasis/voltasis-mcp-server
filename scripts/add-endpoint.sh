#!/bin/bash

# Helper script to add new endpoint documentation

if [ $# -lt 4 ]; then
  echo "Usage: $0 <endpoint-id> <title> <method> <path>"
  echo "Example: $0 users-create 'Create User' POST /api/v1/users"
  exit 1
fi

ENDPOINT_ID=$1
TITLE=$2
METHOD=$3
PATH=$4
DATE=$(/bin/date +%Y-%m-%d)

# Create the markdown file
/bin/cat > "mcp-docs/api/endpoints/${ENDPOINT_ID}.md" << EOF
---
id: api-${ENDPOINT_ID}
title: ${TITLE}
category: api
tags: []
related: []
version: 1.0.0
last_updated: ${DATE}
method: ${METHOD}
path: ${PATH}
authentication: true
organizationContext: true
---

# ${TITLE}

## Quick Reference
- **Method**: ${METHOD}
- **Path**: ${PATH}
- **Authentication**: Required
- **Organization Context**: Required

## Description

[Add description here]

## Request

### Headers
\`\`\`json
{
  "Authorization": "Bearer {token}",
  "Content-Type": "application/json"
}
\`\`\`

### Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| | | | |

## Response

### Success (200)
\`\`\`json
{
  "data": {},
  "metadata": {}
}
\`\`\`

### Error Responses
- **400 Bad Request**: 
- **401 Unauthorized**: 
- **403 Forbidden**: 

## Examples

### TypeScript
\`\`\`typescript
// Add example here
\`\`\`

## Related Endpoints
- [Link to related endpoint](./related.md)
EOF

echo "✅ Created: mcp-docs/api/endpoints/${ENDPOINT_ID}.md"
echo "📝 Next: Edit the file to add details, then run: npm run generate-index" 