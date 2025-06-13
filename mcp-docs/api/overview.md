---
id: api-overview
title: Voltasis Time Management API
category: api
tags: [overview, api]
version: 2.0.4
last_updated: 2025-06-13T19:34:08.981Z
---

# Voltasis Time Management API

**Last Updated:** June 13, 2025 at 3:34 PM EDT

Comprehensive time tracking and project management API for Voltasis.

## Authentication ✅ **COGNITO V2**
This API uses **AWS Cognito V2** with **database-driven authentication** for enhanced security and performance. All endpoints (except public invitation endpoints) require JWT authentication with **database synchronization**.

### Cognito V2 Authentication Flow
1. **Sign Up/Login**: Use AWS Cognito SDK to authenticate users
2. **Get Access Token**: Extract the **Access Token** from Cognito session (NOT IdToken)
3. **API Requests**: Include Access Token in Authorization header: `Bearer {accessToken}`
4. **Database Sync**: User data is automatically synchronized between Cognito and database
5. **5-Minute Cache**: User data is cached for 5 minutes for optimal performance

### Cognito V2 Configuration ✅ **UPDATED**
- **User Pool ID**: `us-east-1_BjJWdfIj9` (V2 User Pool with organizationId support)
- **App Client ID**: `2b5jaklnmeks2ieccjs01q117f` (V2 Client ID)
- **Region**: `us-east-1`
- **Authentication Type**: Database-driven with Cognito synchronization
- **Multi-Tenant**: Full organizationId support for data isolation

### Authentication Features ✅ **V2 ENHANCED**
- **Database-Driven User Management**: User profiles stored in DynamoDB with Cognito sync
- **Cross-Organization Access**: System administrators can access all organizations
- **Role-Based Access Control**: System Admin, Admin, Manager, Employee roles
- **5-Minute User Cache**: Optimized performance with intelligent caching
- **Automatic Sync Repair**: Built-in tools for Cognito-Database synchronization

### Authentication Endpoints
While authentication is handled by AWS Cognito V2, this API provides session management endpoints:
- `POST /users/{id}/sessions` - Create session record after Cognito login
- `GET /users/{id}/sessions` - List active sessions
- `DELETE /users/{id}/sessions/{sessionId}` - Terminate session (deletes from database)
- `POST /users/{id}/logout` - Complete logout with session cleanup
- `PUT /users/{id}/security/change-password` - Change password (requires current password)

### Development Testing ⚠️ **IMPORTANT**
- **Use cache-busting headers** for development testing
- **Use `./scripts/dev-curl.sh`** instead of standard curl
- **CloudFront caches responses** - bypass cache for immediate results

## Base URL
- Development: `https://api-dev.voltasis.com/` ✅ **LIVE (Cognito V2)**
- Staging: `https://api-staging.voltasis.com/` 📋 **READY**
- Production: `https://api.voltasis.com/` 📋 **READY**


## 🏢 Multi-Tenant Architecture

The Voltasis API implements a comprehensive multi-tenant architecture:

- **Automatic Organization Filtering**: All endpoints automatically filter data based on the authenticated user's organization
- **System Admin Support**: System administrators with `organizationId: 'SYSTEM'` can access data across all organizations
- **Cross-Organization Queries**: System admins can use the `organizationId` query parameter on list endpoints to filter by specific organizations
- **Data Isolation**: Regular users can only access data within their own organization
- **Security**: All repository methods enforce organizationId validation at the data layer

**Version**: 2.0.4  
**Base URL**: https://api-dev.voltasis.com

## Available Endpoints

Total endpoints: 197

## Schemas

Total schemas: 64

## Authentication

### CognitoV2Auth

- **Type**: http
- **Scheme**: bearer
- **Bearer Format**: JWT

