---
id: time-entries-create
title: Create Time Entry
category: api
tags: [time-management, time-entries, multi-tenant]
related: [time-entries-list, time-entries-update, time-entries-delete]
version: 1.0.0
last_updated: 2024-01-15
---

# Create Time Entry

## Quick Reference
- **Method**: POST
- **Path**: `/api/v1/time-entries`
- **Authentication**: Required (Bearer token)
- **Organization Context**: Required (extracted from authenticated user)
- **Rate Limit**: 100 requests per minute

## Description
Creates a new time entry for the authenticated user within their organization. This endpoint automatically associates the time entry with the user's organizationId for multi-tenant data isolation.

## Request

### Headers
```json
{
  "Authorization": "Bearer {accessToken}",
  "Content-Type": "application/json"
}
```

### Body Schema
```typescript
interface CreateTimeEntryRequest {
  projectId: string;           // Must belong to user's organization
  taskId?: string;            // Optional task within the project
  description: string;         // What was worked on
  startTime: string;          // ISO 8601 datetime
  endTime: string;            // ISO 8601 datetime
  billable: boolean;          // Whether this time is billable
  tags?: string[];            // Optional categorization tags
}
```

### Validation Rules
- `projectId` must exist and belong to the user's organization
- `startTime` must be before `endTime`
- Duration cannot exceed 24 hours
- Cannot overlap with existing time entries for the same user
- `description` is required and must be 1-500 characters

## Response

### Success Response (201 Created)
```json
{
  "data": {
    "id": "te_abc123def456",
    "userId": "usr_789ghi012jkl",
    "organizationId": "org_mno345pqr678",
    "projectId": "prj_stu901vwx234",
    "taskId": "tsk_yza567bcd890",
    "description": "Implemented user authentication flow",
    "startTime": "2024-01-15T09:00:00Z",
    "endTime": "2024-01-15T11:30:00Z",
    "duration": 9000,  // seconds
    "billable": true,
    "tags": ["development", "backend"],
    "status": "draft",
    "createdAt": "2024-01-15T11:31:00Z",
    "updatedAt": "2024-01-15T11:31:00Z"
  },
  "metadata": {
    "requestId": "req_efg123hij456",
    "timestamp": "2024-01-15T11:31:00Z"
  }
}
```

### Error Responses

#### 400 Bad Request
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid time entry data",
    "details": [
      {
        "field": "startTime",
        "message": "Start time must be before end time"
      }
    ]
  }
}
```

#### 401 Unauthorized
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired access token"
  }
}
```

#### 403 Forbidden
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Project does not belong to your organization"
  }
}
```

#### 409 Conflict
```json
{
  "error": {
    "code": "TIME_OVERLAP",
    "message": "Time entry overlaps with existing entry",
    "details": {
      "conflictingEntryId": "te_xyz789abc123",
      "overlapStart": "2024-01-15T10:00:00Z",
      "overlapEnd": "2024-01-15T11:00:00Z"
    }
  }
}
```

## Implementation Examples

### TypeScript/JavaScript
```typescript
// Using Axios
import axios from 'axios';

async function createTimeEntry(accessToken: string, timeEntry: CreateTimeEntryRequest) {
  try {
    const response = await axios.post(
      'https://api.voltasis.com/v1/time-entries',
      timeEntry,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    if (error.response?.status === 409) {
      console.error('Time entry overlaps with existing entry');
    }
    throw error;
  }
}

// Example usage
const newTimeEntry = await createTimeEntry(accessToken, {
  projectId: 'prj_stu901vwx234',
  description: 'Implemented user authentication flow',
  startTime: '2024-01-15T09:00:00Z',
  endTime: '2024-01-15T11:30:00Z',
  billable: true,
  tags: ['development', 'backend']
});
```

### cURL
```bash
curl -X POST https://api.voltasis.com/v1/time-entries \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "prj_stu901vwx234",
    "description": "Implemented user authentication flow",
    "startTime": "2024-01-15T09:00:00Z",
    "endTime": "2024-01-15T11:30:00Z",
    "billable": true,
    "tags": ["development", "backend"]
  }'
```

## Multi-Tenant Security Notes

This endpoint automatically enforces multi-tenant isolation:

1. **Organization Context**: The user's organizationId is extracted from the JWT token
2. **Project Validation**: The system verifies that the specified projectId belongs to the user's organization
3. **Data Isolation**: The created time entry is automatically tagged with the user's organizationId
4. **Query Scope**: Users can only create time entries within their own organization

## Related Endpoints

- [List Time Entries](./time-entries-list.md) - GET /api/v1/time-entries
- [Update Time Entry](./time-entries-update.md) - PUT /api/v1/time-entries/{id}
- [Delete Time Entry](./time-entries-delete.md) - DELETE /api/v1/time-entries/{id}
- [Get Time Entry](./time-entries-get.md) - GET /api/v1/time-entries/{id}
- [Submit Time Entries](./time-entries-submit.md) - POST /api/v1/time-entries/submit

## Webhook Events

Creating a time entry triggers the following webhook events:

- `time_entry.created` - Sent immediately after creation
- `time_entry.draft` - Sent when entry is in draft status
- `project.hours_updated` - Sent to update project totals

## Business Logic Notes

- Time entries are created in "draft" status by default
- Draft entries can be edited until submitted for approval
- Submitted entries require manager approval to edit
- Billable time affects project budgets and client invoicing
- Non-billable time is tracked for internal reporting

## Common Integration Patterns

1. **Timer Integration**: Create time entries from timer applications
2. **Calendar Sync**: Import time from calendar events
3. **Project Management**: Auto-create entries from task completions
4. **Approval Workflow**: Submit batches for manager review 