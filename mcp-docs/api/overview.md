---
id: api-overview
title: Voltasis API Overview
category: api
tags: [overview, getting-started, api]
related: [authentication, rate-limits]
version: 1.0.0
last_updated: 2024-01-01
---

# Voltasis API Overview

## Introduction

The Voltasis API provides programmatic access to time tracking and project management functionality. This RESTful API enables you to integrate Voltasis with your own applications and automate workflows.

## Base URL

All API requests should be made to:

```
https://api.voltasis.com/v1
```

## Authentication

All API requests require authentication using Bearer tokens. Include your API token in the Authorization header:

```
Authorization: Bearer YOUR_API_TOKEN
```

## Multi-Tenancy

Voltasis is a multi-tenant system. Most API endpoints require an organization context, which is automatically determined from your authentication token.

## Response Format

All responses are returned in JSON format with the following structure:

```json
{
  "data": {
    // Response data
  },
  "metadata": {
    "timestamp": "2024-01-01T00:00:00Z",
    "request_id": "req_123456"
  }
}
```

## Error Handling

Errors are returned with appropriate HTTP status codes and a consistent error format:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The request was invalid",
    "details": {
      // Additional error details
    }
  }
}
```

## Rate Limiting

API requests are rate limited to ensure fair usage:
- **Default**: 100 requests per minute
- **Authenticated**: 1000 requests per minute

## Common Headers

| Header | Description | Required |
|--------|-------------|----------|
| Authorization | Bearer token for authentication | Yes |
| Content-Type | Request content type (usually application/json) | Yes for POST/PUT |
| X-Organization-ID | Override organization context | No |

## Quick Start

1. Obtain an API token from your account settings
2. Make a test request to verify authentication
3. Explore the available endpoints
4. Integrate with your application

## Support

For API support, please contact support@voltasis.com or visit our developer portal. 