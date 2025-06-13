import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { StreamingBlobPayloadInputTypes } from '@smithy/types';
import middy from '@middy/core';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';

const logger = new Logger();
const tracer = new Tracer();
const metrics = new Metrics();

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const { DOCS_BUCKET, INDEX_TABLE, STAGE } = process.env;

interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

const lambdaHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  logger.debug('MCP Server request', { 
    method: event.httpMethod,
    path: event.path,
    headers: event.headers 
  });
  
  try {
    // Parse request body
    const request: MCPRequest = JSON.parse(event.body || '{}');
    
    // Log the method being called
    logger.info('MCP method called', { method: request.method });
    metrics.addMetric('MCPMethodCall', MetricUnit.Count, 1);
    metrics.addMetadata('method', request.method);

    // Route to appropriate handler
    let response: MCPResponse;
    
    switch (request.method) {
      case 'initialize':
        response = await handleInitialize(request);
        break;
        
      case 'tools/list':
        response = await handleToolsList(request);
        break;
        
      case 'resources/list':
        response = await handleResourcesList(request);
        break;
        
      case 'resources/read':
        response = await handleResourceRead(request);
        break;
        
      case 'tools/call':
        response = await handleToolCall(request);
        break;
        
      default:
        response = createErrorResponse(
          request.id,
          -32601,
          `Method not found: ${request.method}`
        );
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify(response),
    };
    
  } catch (error) {
    logger.error('Error processing MCP request', { error });
    metrics.addMetric('MCPError', MetricUnit.Count, 1);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: 'Internal error',
          data: { message: error instanceof Error ? error.message : String(error) },
        },
      }),
    };
  } finally {
    metrics.publishStoredMetrics();
  }
};

async function handleInitialize(request: MCPRequest): Promise<MCPResponse> {
  return {
    jsonrpc: '2.0',
    id: request.id,
    result: {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: {},
      },
      serverInfo: {
        name: 'Voltasis API Documentation Server',
        version: '1.0.0',
        environment: STAGE,
      },
    },
  };
}

async function handleToolsList(request: MCPRequest): Promise<MCPResponse> {
  const tools = [
    {
      name: 'search_documentation',
      description: 'Search through Voltasis API documentation for relevant information',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query to find relevant documentation',
          },
          category: {
            type: 'string',
            enum: ['api', 'guide', 'reference', 'all'],
            description: 'Category to search within',
            default: 'all',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_endpoint_details',
      description: 'Get detailed information about a specific API endpoint',
      inputSchema: {
        type: 'object',
        properties: {
          endpoint: {
            type: 'string',
            description: 'The endpoint path (e.g., /api/v1/users)',
          },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            description: 'HTTP method',
          },
        },
        required: ['endpoint'],
      },
    },
    {
      name: 'list_endpoints',
      description: 'List all available API endpoints',
      inputSchema: {
        type: 'object',
        properties: {
          tag: {
            type: 'string',
            description: 'Filter endpoints by tag',
          },
          category: {
            type: 'string',
            description: 'Filter by category',
          },
        },
      },
    },
    {
      name: 'get_schema',
      description: 'Get TypeScript/JSON schema for a specific model',
      inputSchema: {
        type: 'object',
        properties: {
          schemaName: {
            type: 'string',
            description: 'Name of the schema (e.g., User, TimeEntry)',
          },
          format: {
            type: 'string',
            enum: ['typescript', 'json'],
            description: 'Output format for the schema',
            default: 'typescript',
          },
        },
        required: ['schemaName'],
      },
    },
  ];

  return {
    jsonrpc: '2.0',
    id: request.id,
    result: { tools },
  };
}

async function handleResourcesList(request: MCPRequest): Promise<MCPResponse> {
  try {
    // Query all documents from DynamoDB
    const response = await docClient.send(new QueryCommand({
      TableName: INDEX_TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'DOCUMENT',
      },
    }));

    const resources = response.Items?.map(item => ({
      uri: `voltasis://${item.id}`,
      name: item.title,
      description: item.description || item.tags?.join(', ') || '',
      mimeType: 'text/markdown',
    })) || [];

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: { resources },
    };
  } catch (error) {
    logger.error('Error listing resources', { error });
    return createErrorResponse(request.id, -32603, 'Failed to list resources');
  }
}

async function handleResourceRead(request: MCPRequest): Promise<MCPResponse> {
  const { uri } = request.params || {};
  
  if (!uri) {
    return createErrorResponse(request.id, -32602, 'Missing required parameter: uri');
  }

  try {
    // Extract document ID from URI
    const documentId = uri.replace('voltasis://', '');
    
    // Get document metadata from DynamoDB
    const metadataResponse = await docClient.send(new GetCommand({
      TableName: INDEX_TABLE,
      Key: {
        PK: 'DOCUMENT',
        SK: documentId,
      },
    }));

    if (!metadataResponse.Item) {
      return createErrorResponse(request.id, -32602, `Resource not found: ${uri}`);
    }

    // Get document content from S3
    const s3Response = await s3Client.send(new GetObjectCommand({
      Bucket: DOCS_BUCKET,
      Key: metadataResponse.Item.s3Key || `${documentId}.md`,
    }));

    const content = await streamToString(s3Response.Body as StreamingBlobPayloadInputTypes);

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: content,
          },
        ],
      },
    };
  } catch (error) {
    logger.error('Error reading resource', { error, uri });
    return createErrorResponse(request.id, -32603, 'Failed to read resource');
  }
}

async function handleToolCall(request: MCPRequest): Promise<MCPResponse> {
  const { name, arguments: args } = request.params || {};
  
  if (!name) {
    return createErrorResponse(request.id, -32602, 'Missing required parameter: name');
  }

  logger.info('Tool call', { tool: name, arguments: args });

  try {
    switch (name) {
      case 'search_documentation':
        return await searchDocumentation(request.id, args);
        
      case 'get_endpoint_details':
        return await getEndpointDetails(request.id, args);
        
      case 'list_endpoints':
        return await listEndpoints(request.id, args);
        
      case 'get_schema':
        return await getSchema(request.id, args);
        
      default:
        return createErrorResponse(request.id, -32602, `Unknown tool: ${name}`);
    }
  } catch (error) {
    logger.error('Error executing tool', { error, tool: name });
    return createErrorResponse(request.id, -32603, 'Tool execution failed');
  }
}

async function searchDocumentation(id: string | number, args: any): Promise<MCPResponse> {
  const { query, category = 'all' } = args || {};
  
  if (!query) {
    return createErrorResponse(id, -32602, 'Missing required parameter: query');
  }

  // Query documents with search terms
  // In a production system, this would use a proper search service
  const response = await docClient.send(new QueryCommand({
    TableName: INDEX_TABLE,
    KeyConditionExpression: 'PK = :pk',
    FilterExpression: category !== 'all' ? 'category = :category' : undefined,
    ExpressionAttributeValues: {
      ':pk': 'DOCUMENT',
      ...(category !== 'all' && { ':category': category }),
    },
  }));

  // Simple text matching (in production, use ElasticSearch or similar)
  const results = response.Items?.filter(item => {
    const searchableText = `${item.title} ${item.description} ${item.tags?.join(' ')}`.toLowerCase();
    return searchableText.includes(query.toLowerCase());
  }).map(item => ({
    id: item.id,
    title: item.title,
    uri: `voltasis://${item.id}`,
    tags: item.tags || [],
    relevance: 1.0, // Simple relevance scoring
  })) || [];

  return {
    jsonrpc: '2.0',
    id,
    result: { results },
  };
}

async function getEndpointDetails(id: string | number, args: any): Promise<MCPResponse> {
  const { endpoint, method } = args || {};
  
  if (!endpoint) {
    return createErrorResponse(id, -32602, 'Missing required parameter: endpoint');
  }

  // Construct document ID from endpoint and method
  const documentId = `api-${endpoint.replace(/\//g, '-')}${method ? `-${method.toLowerCase()}` : ''}`;
  
  const response = await docClient.send(new GetCommand({
    TableName: INDEX_TABLE,
    Key: {
      PK: 'DOCUMENT',
      SK: documentId,
    },
  }));

  if (!response.Item) {
    return createErrorResponse(id, -32602, `Endpoint not found: ${endpoint}`);
  }

  return {
    jsonrpc: '2.0',
    id,
    result: { endpoint: response.Item },
  };
}

async function listEndpoints(id: string | number, args: any): Promise<MCPResponse> {
  const { tag } = args || {};
  
  // Query all API documents
  const response = await docClient.send(new QueryCommand({
    TableName: INDEX_TABLE,
    KeyConditionExpression: 'PK = :pk',
    FilterExpression: 'category = :category',
    ExpressionAttributeValues: {
      ':pk': 'DOCUMENT',
      ':category': 'api',
    },
  }));

  let endpoints = response.Items || [];
  
  // Filter by tag if provided
  if (tag) {
    endpoints = endpoints.filter(item => item.tags?.includes(tag));
  }

  const result = endpoints.map(item => ({
    id: item.id,
    path: item.path,
    method: item.method,
    title: item.title,
    tags: item.tags || [],
  }));

  return {
    jsonrpc: '2.0',
    id,
    result: { endpoints: result },
  };
}

async function getSchema(id: string | number, args: any): Promise<MCPResponse> {
  const { schemaName, format = 'typescript' } = args || {};
  
  if (!schemaName) {
    return createErrorResponse(id, -32602, 'Missing required parameter: schemaName');
  }

  // Get schema document from DynamoDB
  const documentId = `schema-${schemaName.toLowerCase()}`;
  const response = await docClient.send(new GetCommand({
    TableName: INDEX_TABLE,
    Key: {
      PK: 'DOCUMENT',
      SK: documentId,
    },
  }));

  if (!response.Item) {
    return createErrorResponse(id, -32602, `Schema not found: ${schemaName}`);
  }

  // Get schema content from S3
  const s3Response = await s3Client.send(new GetObjectCommand({
    Bucket: DOCS_BUCKET,
    Key: response.Item.s3Key || `schemas/${documentId}.${format}`,
  }));

  const content = await streamToString(s3Response.Body as StreamingBlobPayloadInputTypes);

  return {
    jsonrpc: '2.0',
    id,
    result: {
      schema: {
        name: schemaName,
        format,
        content,
      },
    },
  };
}

function createErrorResponse(
  id: string | number,
  code: number,
  message: string,
  data?: any
): MCPResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data,
    },
  };
}

async function streamToString(stream: StreamingBlobPayloadInputTypes): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as any) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

// Export handler with middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 