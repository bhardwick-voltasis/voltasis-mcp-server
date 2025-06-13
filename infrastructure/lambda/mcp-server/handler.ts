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
        
      case 'prompts/list':
        response = await handlePromptsList(request);
        break;
        
      case 'prompts/get':
        response = await handlePromptsGet(request);
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
        
      case 'sampling/createMessage':
        response = await handleSamplingCreateMessage(request);
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
  // Support protocol version negotiation for backward compatibility
  const clientProtocolVersion = request.params?.protocolVersion || '2024-11-05';
  
  logger.info('MCP initialization', { 
    clientProtocolVersion,
    clientInfo: request.params?.clientInfo 
  });
  
  return {
    jsonrpc: '2.0',
    id: request.id,
    result: {
      protocolVersion: clientProtocolVersion,
      capabilities: {
        tools: {
          listChanged: false // Set to true if you plan to support dynamic tool updates
        },
        resources: {
          subscribe: false, // Set to true if you plan to support resource subscriptions
          listChanged: false // Set to true if resources can change dynamically
        },
        prompts: {
          listChanged: false // Set to true if prompts can change dynamically
        }
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

async function handlePromptsList(request: MCPRequest): Promise<MCPResponse> {
  const prompts = [
    {
      name: 'create_time_entry',
      description: 'Template for creating a new time entry in Voltasis',
      arguments: [
        {
          name: 'project_name',
          description: 'The name of the project',
          required: true,
        },
        {
          name: 'duration_hours',
          description: 'Duration in hours',
          required: true,
        },
        {
          name: 'description',
          description: 'Description of the work done',
          required: false,
        },
      ],
    },
    {
      name: 'api_integration_guide',
      description: 'Step-by-step guide for integrating with Voltasis API',
      arguments: [
        {
          name: 'integration_type',
          description: 'Type of integration (webhook, polling, real-time)',
          required: true,
        },
        {
          name: 'programming_language',
          description: 'Programming language for code examples',
          required: false,
        },
      ],
    },
    {
      name: 'debug_api_error',
      description: 'Template for debugging common API errors',
      arguments: [
        {
          name: 'error_code',
          description: 'The HTTP error code received',
          required: true,
        },
        {
          name: 'endpoint',
          description: 'The API endpoint that returned the error',
          required: true,
        },
      ],
    },
  ];

  return {
    jsonrpc: '2.0',
    id: request.id,
    result: { prompts },
  };
}

async function handlePromptsGet(request: MCPRequest): Promise<MCPResponse> {
  const { name, arguments: args } = request.params || {};
  
  if (!name) {
    return createErrorResponse(request.id, -32602, 'Missing required parameter: name');
  }

  logger.info('Getting prompt', { prompt: name, arguments: args });

  // Define prompt templates
  const promptTemplates: Record<string, (args: any) => any> = {
    create_time_entry: (args) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `I need to create a time entry for the project "${args.project_name}" with a duration of ${args.duration_hours} hours.${args.description ? ` The work description is: ${args.description}` : ''}`
          }
        },
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `I'll help you create a time entry for the ${args.project_name} project. Here's the API call you need to make:

\`\`\`bash
curl -X POST https://api.voltasis.com/v1/time-entries \\
  -H "Authorization: Bearer YOUR_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "PROJECT_ID",
    "duration": ${args.duration_hours * 3600},
    "description": "${args.description || `Work on ${args.project_name}`}",
    "date": "${new Date().toISOString().split('T')[0]}"
  }'
\`\`\`

Make sure to replace PROJECT_ID with the actual project ID. You can find it by listing projects first.`
          }
        }
      ]
    }),
    
    api_integration_guide: (args) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `I need a guide for ${args.integration_type} integration with Voltasis API${args.programming_language ? ` using ${args.programming_language}` : ''}.`
          }
        },
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `Here's a comprehensive guide for ${args.integration_type} integration with Voltasis API${args.programming_language ? ` in ${args.programming_language}` : ''}:

## ${args.integration_type.charAt(0).toUpperCase() + args.integration_type.slice(1)} Integration Guide

### 1. Authentication
First, obtain your API token from your Voltasis account settings.

### 2. ${args.integration_type === 'webhook' ? 'Webhook Setup' : args.integration_type === 'polling' ? 'Polling Implementation' : 'Real-time Connection'}

${args.integration_type === 'webhook' ? `Configure your webhook endpoint in Voltasis:
- Go to Settings > Webhooks
- Add your endpoint URL
- Select events to subscribe to
- Verify the webhook signature for security` : 
args.integration_type === 'polling' ? `Implement a polling mechanism:
- Query the API at regular intervals
- Use the \`updated_since\` parameter for efficiency
- Implement exponential backoff for rate limiting` :
`Set up WebSocket connection:
- Connect to wss://api.voltasis.com/v1/stream
- Authenticate with your API token
- Subscribe to relevant events`}

### 3. Error Handling
Implement robust error handling for:
- Network failures
- Rate limiting (429 errors)
- Invalid responses
- Authentication failures

### 4. Best Practices
- Always use HTTPS
- Implement request retries with backoff
- Log all API interactions for debugging
- Monitor your API usage`
          }
        }
      ]
    }),
    
    debug_api_error: (args) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `I'm getting a ${args.error_code} error when calling ${args.endpoint}. How do I debug this?`
          }
        },
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `Let's debug the ${args.error_code} error on ${args.endpoint}:

## Error Analysis

${args.error_code === '401' ? `### 401 Unauthorized
This indicates an authentication problem:
1. Check your API token is valid and not expired
2. Ensure the Authorization header is properly formatted: \`Bearer YOUR_TOKEN\`
3. Verify the token has the necessary permissions for this endpoint` :
args.error_code === '403' ? `### 403 Forbidden
You're authenticated but lack permission:
1. Check your account permissions
2. Verify you have access to the requested resource
3. Ensure you're using the correct organization context` :
args.error_code === '404' ? `### 404 Not Found
The resource doesn't exist:
1. Verify the endpoint URL is correct
2. Check if the resource ID exists
3. Ensure you're using the correct API version` :
args.error_code === '429' ? `### 429 Too Many Requests
You've hit the rate limit:
1. Check the Retry-After header for when to retry
2. Implement exponential backoff
3. Consider caching responses to reduce API calls` :
args.error_code === '500' ? `### 500 Internal Server Error
Server-side issue:
1. Check the Voltasis status page
2. Retry with exponential backoff
3. Contact support if the issue persists` :
`### ${args.error_code} Error
General debugging steps:
1. Check the response body for error details
2. Verify request headers and body format
3. Test with minimal parameters first`}

## Debugging Steps

1. **Enable verbose logging** to see the full request/response
2. **Test with curl** to isolate the issue:
   \`\`\`bash
   curl -v -X GET ${args.endpoint} \\
     -H "Authorization: Bearer YOUR_TOKEN"
   \`\`\`
3. **Check the API documentation** for this endpoint
4. **Use the API explorer** in your Voltasis dashboard

## Need More Help?
- Check the error details in the response body
- Review the API documentation for ${args.endpoint}
- Contact support with your request ID`
          }
        }
      ]
    })
  };

  const promptTemplate = promptTemplates[name];
  if (!promptTemplate) {
    return createErrorResponse(request.id, -32602, `Unknown prompt: ${name}`);
  }

  try {
    const prompt = promptTemplate(args || {});
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: prompt,
    };
  } catch (error) {
    logger.error('Error generating prompt', { error, prompt: name });
    return createErrorResponse(request.id, -32603, 'Failed to generate prompt');
  }
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

async function handleSamplingCreateMessage(request: MCPRequest): Promise<MCPResponse> {
  const { messages, modelPreferences, includeContext, metadata } = request.params || {};
  
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return createErrorResponse(request.id, -32602, 'Missing required parameter: messages');
  }

  logger.info('Sampling request received', { 
    messageCount: messages.length,
    includeContext,
    modelPreferences,
    metadata 
  });

  // Note: This is a placeholder implementation
  // In a real implementation, this would:
  // 1. Forward the request to the client's LLM
  // 2. Optionally include context from MCP resources
  // 3. Return the LLM's response
  
  // For now, we'll return an error indicating sampling is not supported
  // This is because Lambda-based servers typically don't have direct access to the client's LLM
  return createErrorResponse(
    request.id, 
    -32601, 
    'Sampling is not supported by this server. Sampling requires client-side LLM access.'
  );
  
  // If you want to implement sampling in the future, you would need to:
  // 1. Set up a way for the Lambda to communicate back to the client
  // 2. Have the client handle the actual LLM call
  // 3. Return the results through the Lambda
  
  // Example of what a successful response would look like:
  /*
  return {
    jsonrpc: '2.0',
    id: request.id,
    result: {
      role: 'assistant',
      content: {
        type: 'text',
        text: 'This is the LLM response'
      },
      model: 'claude-3-opus-20240229',
      stopReason: 'end_turn',
    }
  };
  */
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