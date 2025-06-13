/**
 * Lambda Function Configuration for MCP Server
 * Optimized memory and timeout settings based on function workload characteristics
 */

export interface LambdaConfig {
  memory: number;
  timeout: number;
  description?: string;
  reservedConcurrency?: number;
  provisionedConcurrency?: number;
}

/**
 * MCP Server Lambda configurations
 */
export const mcpLambdaConfigs: Record<string, LambdaConfig> = {
  // MCP Protocol Handler - Main server function
  'mcp-server-handler': {
    memory: 512,
    timeout: 30,
    description: 'MCP Protocol handler - processes MCP requests',
    // reservedConcurrency: 10, // Commented out - account limit reached
  },

  // Document Processing Functions
  'mcp-document-processor': {
    memory: 1024,
    timeout: 300, // 5 minutes for large OpenAPI processing
    description: 'Converts OpenAPI specs to LLM-optimized markdown',
  },

  'mcp-index-builder': {
    memory: 512,
    timeout: 120,
    description: 'Builds search indexes for documentation',
  },

  // Utility Functions
  'mcp-cache-warmer': {
    memory: 256,
    timeout: 60,
    description: 'Pre-warms CloudFront cache with frequently accessed docs',
  },

  'mcp-document-validator': {
    memory: 256,
    timeout: 30,
    description: 'Validates markdown document structure',
  },
};

/**
 * Get Lambda configuration by handler name
 */
export function getMCPLambdaConfig(handlerName: string): LambdaConfig {
  const config = mcpLambdaConfigs[handlerName];
  if (!config) {
    // Default configuration for unknown handlers
    return {
      memory: 256,
      timeout: 30,
      description: 'MCP Server function',
    };
  }
  return config;
}

/**
 * Get all MCP Lambda configurations
 */
export function getAllMCPLambdaConfigs(): Record<string, LambdaConfig> {
  return mcpLambdaConfigs;
} 