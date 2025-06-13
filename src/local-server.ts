#!/usr/bin/env node
import readline from 'readline';
import { MCPProtocolHandler } from './mcp/protocol.js';
import { MCPRequest } from './types/mcp.types.js';
import { createLogger } from './utils/logger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const logger = createLogger('local-server');
const protocolHandler = new MCPProtocolHandler();

// Create readline interface for stdio communication
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

logger.info('Starting Voltasis MCP Server (stdio mode)');

// Handle incoming messages
rl.on('line', async (line) => {
  try {
    // Parse the incoming JSON-RPC request
    const request: MCPRequest = JSON.parse(line);
    logger.debug('Received request', { method: request.method });

    // Handle the request
    const response = await protocolHandler.handleRequest(request);

    // Send the response back via stdout
    console.log(JSON.stringify(response));
  } catch (error) {
    logger.error('Error processing request', { error });
    
    // Send error response
    const errorResponse = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error',
        data: { message: String(error) }
      }
    };
    console.log(JSON.stringify(errorResponse));
  }
});

// Handle server shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down MCP server');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down MCP server');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
}); 