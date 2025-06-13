---
id: api-users-list
title: List Users
category: api
tags: [users, organization, multi-tenant]
related: [api-users-create, api-users-get]
version: 1.0.0
last_updated: 2024-01-01
method: GET
path: /api/v1/users
authentication: true
organizationContext: true
---

# List Users

## Quick Reference
- **Method**: GET
- **Path**: /api/v1/users
- **Authentication**: Required
- **Organization Context**: Required

## Description

Retrieve a paginated list of users within the authenticated user's organization. This endpoint supports filtering, sorting, and pagination to efficiently manage large user lists.

## Request

### Headers
```json
{
  "Authorization": "Bearer {token}",
  "Content-Type": "application/json"
}
```

### Query Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| page | integer | No | Page number (default: 1) |
| limit | integer | No | Items per page (default: 20, max: 100) |
| sort | string | No | Sort field (name, email, created_at) |
| order | string | No | Sort order (asc, desc) |
| search | string | No | Search users by name or email |
| role | string | No | Filter by role (admin, user, viewer) |
| active | boolean | No | Filter by active status |

## Response

### Success (200)
```json
{
  "data": {
    "users": [
      {
        "id": "usr_123456789",
        "email": "john.doe@example.com",
        "name": "John Doe",
        "role": "user",
        "active": true,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  },
  "metadata": {
    "timestamp": "2024-01-01T00:00:00Z",
    "request_id": "req_123456"
  }
}
```

### Error Responses
- **401 Unauthorized**: Invalid or missing authentication token
- **403 Forbidden**: Insufficient permissions to list users
- **429 Too Many Requests**: Rate limit exceeded

## Examples

### TypeScript
```typescript
import { VoltasisClient } from '@voltasis/sdk';

const client = new VoltasisClient({ apiKey: 'YOUR_API_KEY' });

// List all active users
const users = await client.users.list({
  active: true,
  limit: 50
});

// Search for users by email
const searchResults = await client.users.list({
  search: 'john@example.com'
});

// Get admin users sorted by name
const admins = await client.users.list({
  role: 'admin',
  sort: 'name',
  order: 'asc'
});
```

### cURL
```bash
# List first page of users
curl -X GET https://api.voltasis.com/v1/users \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Search for users with pagination
curl -X GET "https://api.voltasis.com/v1/users?search=john&page=2&limit=10" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

## Notes

- Users can only see other users within their organization
- The response includes only active users by default unless specified otherwise
- Email addresses are unique within an organization
- Role-based access control applies - viewers may have limited user information

## Related Endpoints
- [Create User](./user-create.md)
- [Get User](./user-get.md)
- [Update User](./user-update.md)
- [Delete User](./user-delete.md) 