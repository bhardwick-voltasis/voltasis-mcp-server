import { 
  MCPRequest, 
  MCPResponse, 
  InitializeRequest,
  InitializeResponse,
  Tool,
  Resource,
  ToolCallRequest,
  ResourceReadRequest,
  ResourceListRequest,
  ToolsListRequest
} from '../types/mcp.types.js';
import { DocumentManager } from '../documents/document-manager.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('mcp-protocol');

export class MCPProtocolHandler {
  private protocolVersion = '2024-11-05';
  private serverName = 'Voltasis API Documentation Server';
  private serverVersion = '1.0.0';
  private documentManager: DocumentManager;
  private initialized = false;

  constructor() {
    this.documentManager = new DocumentManager(process.env.MCP_CACHE_DIR || './mcp-docs');
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.documentManager.initialize();
      this.initialized = true;
    }
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    logger.debug('Handling MCP request', { method: request.method, id: request.id });

    try {
      // Handle notifications (they don't have responses)
      if (request.method.startsWith('notifications/')) {
        logger.debug('Received notification', { method: request.method });
        // Notifications don't get responses in JSON-RPC
        return null as any;
      }

      switch (request.method) {
        case 'initialize':
          return this.createResponse(
            request.id, 
            await this.handleInitialize(request as InitializeRequest)
          );

        case 'tools/list':
          return this.createResponse(
            request.id,
            await this.handleToolsList(request as ToolsListRequest)
          );

        case 'prompts/list':
          return this.createResponse(
            request.id,
            await this.handlePromptsList(request)
          );

        case 'prompts/get':
          return this.createResponse(
            request.id,
            await this.handlePromptsGet(request)
          );

        case 'resources/list':
          return this.createResponse(
            request.id,
            await this.handleResourcesList(request as ResourceListRequest)
          );

        case 'resources/read':
          return this.createResponse(
            request.id,
            await this.handleResourceRead(request as ResourceReadRequest)
          );

        case 'tools/call':
          return this.createResponse(
            request.id,
            await this.handleToolCall(request as ToolCallRequest)
          );

        case 'sampling/createMessage':
          return this.createResponse(
            request.id,
            await this.handleSamplingCreateMessage(request)
          );

        default:
          throw this.createError(-32601, `Method not found: ${request.method}`);
      }
    } catch (error) {
      logger.error('Error handling MCP request', { error, method: request.method });
      
      if (error instanceof MCPProtocolError) {
        return this.createErrorResponse(request.id, error);
      }
      
      return this.createErrorResponse(
        request.id,
        this.createError(-32603, 'Internal error', { message: String(error) })
      );
    }
  }

  private async handleInitialize(request: InitializeRequest): Promise<InitializeResponse> {
    logger.info('Initializing MCP connection', { 
      clientInfo: request.params.clientInfo,
      protocolVersion: request.params.protocolVersion 
    });

    // Initialize the document manager
    await this.initialize();

    // Use the client's protocol version for compatibility
    const clientProtocolVersion = request.params.protocolVersion || this.protocolVersion;

    return {
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
        name: this.serverName,
        version: this.serverVersion
      }
    };
  }

  private async handleToolsList(_request: ToolsListRequest): Promise<{ tools: Tool[] }> {
    const tools: Tool[] = [
      {
        name: 'search_documentation',
        description: 'Search through Voltasis API documentation for relevant information',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to find relevant documentation'
            },
            category: {
              type: 'string',
              enum: ['api', 'guide', 'reference', 'all'],
              description: 'Category to search within'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'get_endpoint_details',
        description: 'Get detailed information about a specific API endpoint',
        inputSchema: {
          type: 'object',
          properties: {
            endpoint: {
              type: 'string',
              description: 'The endpoint path (e.g., /api/v1/users)'
            },
            method: {
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
              description: 'HTTP method'
            }
          },
          required: ['endpoint']
        }
      },
      {
        name: 'list_endpoints',
        description: 'List all available API endpoints',
        inputSchema: {
          type: 'object',
          properties: {
            tag: {
              type: 'string',
              description: 'Filter endpoints by tag'
            },
            category: {
              type: 'string',
              description: 'Filter by category'
            }
          }
        }
      },
      {
        name: 'get_schema',
        description: 'Get TypeScript/JSON schema for a specific model',
        inputSchema: {
          type: 'object',
          properties: {
            schemaName: {
              type: 'string',
              description: 'Name of the schema (e.g., User, TimeEntry)'
            },
            format: {
              type: 'string',
              enum: ['typescript', 'json'],
              description: 'Output format for the schema'
            }
          },
          required: ['schemaName']
        }
      }
    ];

    return { tools };
  }

  private async handlePromptsList(_request: MCPRequest): Promise<{ prompts: any[] }> {
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

    return { prompts };
  }

  private async handlePromptsGet(request: MCPRequest): Promise<any> {
    const { name, arguments: args } = request.params || {};
    
    if (!name) {
      throw this.createError(-32602, 'Missing required parameter: name');
    }

    logger.debug('Getting prompt', { prompt: name, arguments: args });

    // For local implementation, return simpler prompt templates
    const promptTemplates: Record<string, (args: any) => any> = {
      create_time_entry: (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Create a time entry for project "${args.project_name}" with duration ${args.duration_hours} hours.${args.description ? ` Description: ${args.description}` : ''}`
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
              text: `Provide a ${args.integration_type} integration guide for Voltasis API${args.programming_language ? ` using ${args.programming_language}` : ''}.`
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
              text: `Help debug a ${args.error_code} error when calling ${args.endpoint} endpoint.`
            }
          }
        ]
      })
    };

    const promptTemplate = promptTemplates[name];
    if (!promptTemplate) {
      throw this.createError(-32602, `Unknown prompt: ${name}`);
    }

    return promptTemplate(args || {});
  }

  private async handleResourcesList(_request: ResourceListRequest): Promise<{ resources: Resource[] }> {
    await this.initialize(); // Ensure initialized
    
    const documents = this.documentManager.getAvailableResources();
    
    const resources: Resource[] = documents.map(doc => ({
      uri: `voltasis://${doc.id}`,
      name: doc.title,
      description: doc.tags.join(', '),
      mimeType: 'text/markdown'
    }));

    return { resources };
  }

  private async handleResourceRead(request: ResourceReadRequest): Promise<{ contents: any[] }> {
    const { uri } = request.params;
    logger.debug('Reading resource', { uri });

    const content = await this.documentManager.getResourceContent(uri);
    
    if (!content) {
      throw this.createError(-32602, `Resource not found: ${uri}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: content
        }
      ]
    };
  }

  private async handleToolCall(request: ToolCallRequest): Promise<any> {
    const { name, arguments: args } = request.params;
    logger.debug('Calling tool', { name, arguments: args });

    await this.initialize(); // Ensure initialized

    switch (name) {
      case 'search_documentation':
        return await this.searchDocumentation(args);
      
      case 'get_endpoint_details':
        return await this.getEndpointDetails(args);
      
      case 'list_endpoints':
        return await this.listEndpoints(args);
      
      case 'get_schema':
        return await this.getSchema(args);
      
      default:
        throw this.createError(-32602, `Unknown tool: ${name}`);
    }
  }

  private async searchDocumentation(args: any): Promise<{ results: any[] }> {
    const { query, category = 'all' } = args;
    const searchResults = await this.documentManager.searchDocuments(query, category);
    
    const results = searchResults.map(doc => ({
      id: doc.id,
      title: doc.title,
      uri: `voltasis://${doc.id}`,
      tags: doc.tags,
      relevance: 1.0 // Simple relevance scoring
    }));

    return { results };
  }

  private async getEndpointDetails(args: any): Promise<{ endpoint: any }> {
    const { endpoint, method } = args;
    const endpointDoc = await this.documentManager.getEndpointByPath(endpoint, method);
    
    if (!endpointDoc) {
      throw this.createError(-32602, `Endpoint not found: ${endpoint}`);
    }

    return { endpoint: endpointDoc };
  }

  private async listEndpoints(args: any): Promise<{ endpoints: any[] }> {
    const { tag, category } = args;
    const endpoints = await this.documentManager.listEndpoints(tag, category);
    
    return { 
      endpoints: endpoints.map(ep => ({
        id: ep.id,
        path: ep.path,
        method: ep.method,
        title: ep.title,
        tags: ep.tags
      }))
    };
  }

  private async getSchema(args: any): Promise<{ schema: any }> {
    const { schemaName, format = 'typescript' } = args;
    
    // This would need to be implemented to fetch actual schemas
    // For now, return a placeholder
    return { 
      schema: {
        name: schemaName,
        format,
        content: `// Schema for ${schemaName} will be loaded here`
      }
    };
  }

  private async handleSamplingCreateMessage(request: MCPRequest): Promise<any> {
    const { messages, modelPreferences, includeContext, metadata } = request.params || {};
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw this.createError(-32602, 'Missing required parameter: messages');
    }

    logger.debug('Sampling request received', { 
      messageCount: messages.length,
      includeContext,
      modelPreferences,
      metadata 
    });

    // For local implementation, sampling is not supported
    // This would require integration with the host's LLM
    throw this.createError(
      -32601, 
      'Sampling is not supported by this server. Sampling requires client-side LLM access.'
    );
  }

  private createResponse(id: string | number, result: any): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      result
    };
  }

  private createErrorResponse(id: string | number, error: MCPProtocolError): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: error.code,
        message: error.message,
        data: error.data
      }
    };
  }

  private createError(code: number, message: string, data?: any): MCPProtocolError {
    return new MCPProtocolError(code, message, data);
  }
}

class MCPProtocolError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'MCPProtocolError';
  }
} 