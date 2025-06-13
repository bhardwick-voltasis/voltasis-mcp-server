import { S3Event } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { OpenAPIV3 } from 'openapi-types';
import { StreamingBlobPayloadInputTypes } from '@smithy/types';

const logger = new Logger();
const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const { DOCS_BUCKET, INDEX_TABLE } = process.env;

interface EndpointInfo {
  path: string;
  method: string;
  operation: OpenAPIV3.OperationObject;
}

export const handler = async (event: S3Event): Promise<void> => {
  logger.info('Document processor triggered', { records: event.Records.length });

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    if (!key.endsWith('.json') && !key.endsWith('.yaml')) {
      logger.info('Skipping non-OpenAPI file', { key });
      continue;
    }

    try {
      // Get OpenAPI spec from S3
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }));

      const content = await streamToString(response.Body as StreamingBlobPayloadInputTypes);
      const spec: OpenAPIV3.Document = JSON.parse(content);

      logger.info('Processing OpenAPI spec', { 
        title: spec.info.title,
        version: spec.info.version,
        paths: Object.keys(spec.paths || {}).length 
      });

      // Convert to markdown documents
      const documents = await convertOpenAPIToMarkdown(spec);

      // Upload markdown files and update index
      for (const doc of documents) {
        await uploadDocument(doc);
        await updateIndex(doc);
      }

      logger.info('Successfully processed OpenAPI spec', { 
        documentsCreated: documents.length 
      });

    } catch (error) {
      logger.error('Error processing document', { error, key });
      throw error;
    }
  }
};

async function convertOpenAPIToMarkdown(spec: OpenAPIV3.Document): Promise<any[]> {
  const documents: any[] = [];

  // Create overview document
  documents.push({
    id: 'api-overview',
    category: 'api',
    title: 'API Overview',
    tags: ['overview', 'getting-started', 'api'],
    content: generateOverviewMarkdown(spec),
    s3Key: 'api/overview.md',
  });

  // Process each endpoint
  if (spec.paths) {
    const endpoints = extractEndpoints(spec);
    
    for (const endpoint of endpoints) {
      const doc = {
        id: generateEndpointId(endpoint.path, endpoint.method),
        category: 'api',
        title: endpoint.operation.summary || `${endpoint.method} ${endpoint.path}`,
        tags: endpoint.operation.tags || [],
        path: endpoint.path,
        method: endpoint.method.toUpperCase(),
        content: generateEndpointMarkdown(endpoint, spec),
        s3Key: `api/endpoints/${generateEndpointId(endpoint.path, endpoint.method)}.md`,
      };
      documents.push(doc);
    }
  }

  // Process schemas
  if (spec.components?.schemas) {
    for (const [name, schema] of Object.entries(spec.components.schemas)) {
      const doc = {
        id: `schema-${name.toLowerCase()}`,
        category: 'reference',
        title: `${name} Schema`,
        tags: ['schema', name.toLowerCase()],
        content: generateSchemaMarkdown(name, schema as OpenAPIV3.SchemaObject),
        s3Key: `reference/schemas/${name.toLowerCase()}.md`,
      };
      documents.push(doc);
    }
  }

  return documents;
}

function extractEndpoints(spec: OpenAPIV3.Document): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
    
    for (const method of methods) {
      const operation = (pathItem as any)[method] as OpenAPIV3.OperationObject;
      if (operation) {
        endpoints.push({ path, method, operation });
      }
    }
  }

  return endpoints;
}

function generateEndpointId(path: string, method: string): string {
  const cleanPath = path.replace(/[{}]/g, '').replace(/\//g, '-');
  return `api${cleanPath}-${method.toLowerCase()}`;
}

function generateOverviewMarkdown(spec: OpenAPIV3.Document): string {
  return `---
id: api-overview
title: ${spec.info.title}
category: api
tags: [overview, getting-started, api]
version: ${spec.info.version}
last_updated: ${new Date().toISOString().split('T')[0]}
---

# ${spec.info.title}

## Overview

${spec.info.description || 'API documentation for Voltasis Time Reporting System.'}

## Version

${spec.info.version}

## Base URL

${spec.servers?.[0]?.url || 'https://api.voltasis.com/v1'}

## Authentication

All API requests require authentication using Bearer tokens. Include your API token in the Authorization header:

\`\`\`
Authorization: Bearer YOUR_API_TOKEN
\`\`\`

## Response Format

All responses are returned in JSON format with the following structure:

\`\`\`json
{
  "data": {
    // Response data
  },
  "metadata": {
    "timestamp": "2024-01-01T00:00:00Z",
    "request_id": "req_123456"
  }
}
\`\`\`

## Error Handling

Errors are returned with appropriate HTTP status codes and a consistent error format:

\`\`\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error details
    }
  }
}
\`\`\`

## Rate Limiting

API requests are subject to rate limiting. Current limits:
- Authenticated requests: 1000 requests per minute
- Per-endpoint limits may apply

## Support

For API support, please contact support@voltasis.com.
`;
}

function generateEndpointMarkdown(endpoint: EndpointInfo, spec: OpenAPIV3.Document): string {
  const { path, method, operation } = endpoint;
  const parameters = operation.parameters as OpenAPIV3.ParameterObject[] || [];
  const requestBody = operation.requestBody as OpenAPIV3.RequestBodyObject;
  const responses = operation.responses || {};

  let markdown = `---
id: ${generateEndpointId(path, method)}
title: ${operation.summary || `${method.toUpperCase()} ${path}`}
category: api
tags: ${JSON.stringify(operation.tags || [])}
version: ${spec.info.version}
last_updated: ${new Date().toISOString().split('T')[0]}
method: ${method.toUpperCase()}
path: ${path}
authentication: true
organizationContext: true
---

# ${operation.summary || `${method.toUpperCase()} ${path}`}

## Quick Reference
- **Method**: ${method.toUpperCase()}
- **Path**: ${path}
- **Authentication**: Required
- **Organization Context**: Required

## Description

${operation.description || 'No description available.'}

## Request

### Headers
\`\`\`json
{
  "Authorization": "Bearer {token}",
  "Content-Type": "application/json"
}
\`\`\`
`;

  // Add parameters section
  if (parameters.length > 0) {
    markdown += '\n### Parameters\n';
    markdown += '| Name | Type | Required | Description |\n';
    markdown += '|------|------|----------|-------------|\n';
    
    for (const param of parameters) {
      const schema = param.schema as OpenAPIV3.SchemaObject;
      markdown += `| ${param.name} | ${schema?.type || 'string'} | ${param.required ? 'Yes' : 'No'} | ${param.description || ''} |\n`;
    }
  }

  // Add request body section
  if (requestBody && requestBody.content?.['application/json']) {
    const schema = requestBody.content['application/json'].schema;
    markdown += '\n### Request Body\n';
    markdown += '```json\n';
    markdown += JSON.stringify(generateExampleFromSchema(schema as OpenAPIV3.SchemaObject), null, 2);
    markdown += '\n```\n';
  }

  // Add responses section
  markdown += '\n## Response\n';
  for (const [statusCode, response] of Object.entries(responses)) {
    const resp = response as OpenAPIV3.ResponseObject;
    markdown += `\n### ${statusCode === '200' ? 'Success' : 'Error'} (${statusCode})\n`;
    
    if (resp.content?.['application/json']) {
      const schema = resp.content['application/json'].schema;
      markdown += '```json\n';
      markdown += JSON.stringify(generateExampleFromSchema(schema as OpenAPIV3.SchemaObject), null, 2);
      markdown += '\n```\n';
    }
    
    if (resp.description) {
      markdown += `\n${resp.description}\n`;
    }
  }

  // Add examples section
  markdown += '\n## Examples\n\n### TypeScript\n```typescript\n// Add TypeScript example here\n```\n\n### cURL\n```bash\n# Add cURL example here\n```\n';

  return markdown;
}

function generateSchemaMarkdown(name: string, schema: OpenAPIV3.SchemaObject): string {
  return `---
id: schema-${name.toLowerCase()}
title: ${name} Schema
category: reference
tags: [schema, ${name.toLowerCase()}]
last_updated: ${new Date().toISOString().split('T')[0]}
---

# ${name} Schema

## Description

${schema.description || `Schema definition for ${name}.`}

## TypeScript Interface

\`\`\`typescript
${generateTypeScriptInterface(name, schema)}
\`\`\`

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
${generatePropertiesTable(schema)}

## Example

\`\`\`json
${JSON.stringify(generateExampleFromSchema(schema), null, 2)}
\`\`\`
`;
}

function generateTypeScriptInterface(name: string, schema: OpenAPIV3.SchemaObject): string {
  const required = schema.required || [];
  let typescript = `interface ${name} {\n`;
  
  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const prop = propSchema as OpenAPIV3.SchemaObject;
      const isRequired = required.includes(propName);
      const optional = isRequired ? '' : '?';
      const type = mapOpenAPITypeToTypeScript(prop);
      typescript += `  ${propName}${optional}: ${type};\n`;
    }
  }
  
  typescript += '}';
  return typescript;
}

function generatePropertiesTable(schema: OpenAPIV3.SchemaObject): string {
  const required = schema.required || [];
  let table = '';
  
  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const prop = propSchema as OpenAPIV3.SchemaObject;
      const isRequired = required.includes(propName);
      table += `| ${propName} | ${prop.type || 'any'} | ${isRequired ? 'Yes' : 'No'} | ${prop.description || ''} |\n`;
    }
  }
  
  return table;
}

function mapOpenAPITypeToTypeScript(schema: OpenAPIV3.SchemaObject): string {
  switch (schema.type) {
    case 'string':
      return schema.enum ? schema.enum.map(e => `'${e}'`).join(' | ') : 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return `${mapOpenAPITypeToTypeScript(schema.items as OpenAPIV3.SchemaObject)}[]`;
    case 'object':
      return 'Record<string, any>';
    default:
      return 'any';
  }
}

function generateExampleFromSchema(schema: OpenAPIV3.SchemaObject): any {
  if (schema.example) {
    return schema.example;
  }

  switch (schema.type) {
    case 'string':
      return schema.enum ? schema.enum[0] : 'string';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return true;
    case 'array':
      return [generateExampleFromSchema(schema.items as OpenAPIV3.SchemaObject)];
    case 'object':
      const obj: any = {};
      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          obj[propName] = generateExampleFromSchema(propSchema as OpenAPIV3.SchemaObject);
        }
      }
      return obj;
    default:
      return null;
  }
}

async function uploadDocument(doc: any): Promise<void> {
  await s3Client.send(new PutObjectCommand({
    Bucket: DOCS_BUCKET!,
    Key: doc.s3Key,
    Body: doc.content,
    ContentType: 'text/markdown',
    Metadata: {
      id: doc.id,
      category: doc.category,
      title: doc.title,
      tags: JSON.stringify(doc.tags),
    },
  }));

  logger.info('Uploaded document to S3', { 
    id: doc.id, 
    key: doc.s3Key 
  });
}

async function updateIndex(doc: any): Promise<void> {
  const item = {
    PK: 'DOCUMENT',
    SK: doc.id,
    id: doc.id,
    category: doc.category,
    title: doc.title,
    tags: doc.tags,
    path: doc.path,
    method: doc.method,
    s3Key: doc.s3Key,
    lastUpdated: new Date().toISOString(),
    version: '1.0.0',
  };

  await docClient.send(new PutCommand({
    TableName: INDEX_TABLE!,
    Item: item,
  }));

  // Also create entries for tag-based search
  for (const tag of doc.tags || []) {
    await docClient.send(new PutCommand({
      TableName: INDEX_TABLE!,
      Item: {
        PK: 'TAG',
        SK: `${tag}#${doc.id}`,
        tag,
        documentId: doc.id,
        relevance: 1.0,
      },
    }));
  }

  logger.info('Updated document index', { id: doc.id });
}

async function streamToString(stream: StreamingBlobPayloadInputTypes): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as any) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
} 