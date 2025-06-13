---
id: guide-authentication
title: Authentication Guide
category: guide
tags: [authentication, security, bearer-token, api-key]
related: [api-overview, multi-tenant-security]
version: 1.0.0
last_updated: 2024-06-13
---

# Authentication Guide

## Overview

The Voltasis API uses Bearer token authentication to secure all endpoints. This guide explains how to authenticate your API requests and manage authentication tokens.

## Authentication Methods

### 1. API Key Authentication (Recommended)

API keys are the recommended method for server-to-server communication.

#### Obtaining an API Key

1. Log into your Voltasis account
2. Navigate to **Settings > API Keys**
3. Click **Create New API Key**
4. Give your key a descriptive name
5. Copy the key immediately (it won't be shown again)

#### Using Your API Key

Include the API key in the Authorization header:

```bash
curl -X GET https://api.voltasis.com/v1/users \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 2. OAuth 2.0 (Coming Soon)

OAuth 2.0 support for third-party integrations is planned for Q2 2024.

## Request Headers

All authenticated requests must include:

```http
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```

## Example Implementations

### TypeScript/JavaScript

```typescript
import axios from 'axios';

const client = axios.create({
  baseURL: 'https://api.voltasis.com/v1',
  headers: {
    'Authorization': `Bearer ${process.env.VOLTASIS_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// Make authenticated requests
const users = await client.get('/users');
```

### Python

```python
import requests
import os

headers = {
    'Authorization': f'Bearer {os.getenv("VOLTASIS_API_KEY")}',
    'Content-Type': 'application/json'
}

response = requests.get(
    'https://api.voltasis.com/v1/users',
    headers=headers
)
```

### cURL

```bash
# Set your API key as an environment variable
export VOLTASIS_API_KEY="your_api_key_here"

# Make authenticated request
curl -X GET https://api.voltasis.com/v1/users \
  -H "Authorization: Bearer $VOLTASIS_API_KEY" \
  -H "Content-Type: application/json"
```

## Multi-Tenant Context

Voltasis is a multi-tenant system. Your authentication token automatically scopes requests to your organization. 

### Organization Override

In special cases (e.g., admin tools), you can override the organization context:

```http
X-Organization-ID: org_123456789
```

**Note**: This requires special permissions.

## Token Expiration

- **API Keys**: No expiration (revoke manually)
- **User Tokens**: Expire after 24 hours
- **Refresh Tokens**: Expire after 30 days

## Error Responses

### 401 Unauthorized

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing authentication token"
  }
}
```

**Common Causes**:
- Missing Authorization header
- Malformed token
- Expired token
- Revoked API key

### 403 Forbidden

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions for this resource"
  }
}
```

**Common Causes**:
- Token lacks required scopes
- Resource belongs to different organization
- Feature not available in your plan

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for key storage
3. **Rotate keys regularly** (every 90 days recommended)
4. **Use minimal scopes** for API keys
5. **Monitor key usage** in the dashboard

## API Key Management

### Creating Keys with Specific Scopes

```bash
POST /api/v1/api-keys
{
  "name": "CI/CD Pipeline Key",
  "scopes": ["read:users", "write:time-entries"],
  "expires_at": "2024-12-31T23:59:59Z"
}
```

### Revoking Keys

```bash
DELETE /api/v1/api-keys/:key_id
```

### Listing Active Keys

```bash
GET /api/v1/api-keys
```

## Testing Authentication

Test your authentication setup:

```bash
# Test endpoint that returns your user info
curl -X GET https://api.voltasis.com/v1/auth/me \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Expected response:
```json
{
  "data": {
    "id": "usr_123456789",
    "email": "your.email@example.com",
    "organization": {
      "id": "org_123456789",
      "name": "Your Organization"
    }
  }
}
```

## Troubleshooting

### Token Not Working?

1. Check for typos (common: extra spaces, missing "Bearer" prefix)
2. Verify the token hasn't been revoked
3. Ensure you're using the correct environment (dev/prod)
4. Check API status page for outages

### Rate Limiting

Authenticated requests have higher rate limits:
- **Without auth**: 100 requests/minute
- **With auth**: 1000 requests/minute

## Related Resources

- [API Overview](../api/overview.md)
- [Error Codes Reference](../reference/error-codes.md)
- [Rate Limits](../reference/rate-limits.md) 