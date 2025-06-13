// MCP Protocol Types
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface InitializeRequest extends MCPRequest {
  method: 'initialize';
  params: {
    protocolVersion: string;
    capabilities: {
      tools?: Record<string, any>;
      resources?: Record<string, any>;
    };
    clientInfo: {
      name: string;
      version: string;
    };
  };
}

export interface InitializeResponse {
  protocolVersion: string;
  capabilities: {
    tools?: Record<string, any>;
    resources?: Record<string, any>;
    prompts?: Record<string, any>;
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface ToolCallRequest extends MCPRequest {
  method: 'tools/call';
  params: {
    name: string;
    arguments?: Record<string, any>;
  };
}

export interface ResourceReadRequest extends MCPRequest {
  method: 'resources/read';
  params: {
    uri: string;
  };
}

export interface ResourceListRequest extends MCPRequest {
  method: 'resources/list';
  params?: {
    cursor?: string;
  };
}

export interface ToolsListRequest extends MCPRequest {
  method: 'tools/list';
  params?: {
    cursor?: string;
  };
} 