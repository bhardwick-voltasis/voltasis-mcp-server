---
id: api-time-entries-create
title: Create Time Entry
category: api
tags: [time-tracking, time-entries, organization]
related: [api-time-entries-list, api-time-entries-get, api-time-entries-update]
version: 1.0.0
last_updated: 2025-06-13
method: POST
path: /api/v1/time-entries
authentication: true
organizationContext: true
---

# Create Time Entry

## Quick Reference
- **Method**: POST
- **Path**: /api/v1/time-entries
- **Authentication**: Required
- **Organization Context**: Required

## Description

Create a new time entry for tracking work performed. Time entries are associated with a user and can optionally be linked to projects, tasks, or clients.

## Request

### Headers
```json
{
  "Authorization": "Bearer {token}",
  "Content-Type": "application/json"
}
```

### Body Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| description | string | Yes | Description of work performed |
| duration_minutes | integer | Yes | Duration in minutes |
| start_time | string | Yes | ISO 8601 timestamp when work started |
| end_time | string | No | ISO 8601 timestamp when work ended |
| project_id | string | No | Associated project ID |
| task_id | string | No | Associated task ID |
| client_id | string | No | Associated client ID |
| tags | array | No | Array of tag strings |
| billable | boolean | No | Whether this time is billable (default: true) |

## Response

### Success (201)
```json
{
  "data": {
    "id": "te_123456789",
    "user_id": "usr_987654321",
    "description": "API development and testing",
    "duration_minutes": 120,
    "start_time": "2024-01-15T09:00:00Z",
    "end_time": "2024-01-15T11:00:00Z",
    "project_id": "proj_456789",
    "task_id": null,
    "client_id": "cli_789456",
    "tags": ["development", "api"],
    "billable": true,
    "created_at": "2024-01-15T11:05:00Z",
    "updated_at": "2024-01-15T11:05:00Z"
  },
  "metadata": {
    "timestamp": "2024-01-15T11:05:00Z",
    "request_id": "req_789456"
  }
}
```

### Error Responses
- **400 Bad Request**: Invalid input data or missing required fields
- **401 Unauthorized**: Invalid or missing authentication token
- **403 Forbidden**: User doesn't have permission to create time entries
- **422 Unprocessable Entity**: Business logic validation failed (e.g., end_time before start_time)

## Examples

### TypeScript
```typescript
import { VoltasisClient } from '@voltasis/sdk';

const client = new VoltasisClient({ apiKey: 'YOUR_API_KEY' });

// Create a simple time entry
const timeEntry = await client.timeEntries.create({
  description: 'Weekly team meeting',
  duration_minutes: 60,
  start_time: new Date('2024-01-15T10:00:00').toISOString(),
  billable: false
});

// Create a detailed time entry with project and tags
const detailedEntry = await client.timeEntries.create({
  description: 'Implement user authentication',
  duration_minutes: 180,
  start_time: new Date('2024-01-15T09:00:00').toISOString(),
  end_time: new Date('2024-01-15T12:00:00').toISOString(),
  project_id: 'proj_123',
  task_id: 'task_456',
  tags: ['backend', 'authentication', 'security'],
  billable: true
});
```

### cURL
```bash
# Create a basic time entry
curl -X POST https://api.voltasis.com/v1/time-entries \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Client meeting",
    "duration_minutes": 45,
    "start_time": "2024-01-15T14:00:00Z",
    "client_id": "cli_789",
    "billable": true
  }'
```

## Notes

- Time entries are immutable once created (use update endpoint to modify)
- Duration is automatically calculated if both start_time and end_time are provided
- Tags are useful for categorizing and reporting on time entries
- Billable flag affects invoicing and financial reports
- Users can only create time entries for themselves

## Related Endpoints
- [List Time Entries](./time-entries-list.md)
- [Get Time Entry](./time-entries-get.md)
- [Update Time Entry](./time-entries-update.md)
- [Delete Time Entry](./time-entries-delete.md)
