#!/usr/bin/env node

import https from 'https';
import { URL } from 'url';
import * as readline from 'readline';
import * as fs from 'fs';

// Get configuration from environment
const endpoint = process.env.MCP_ENDPOINT || process.env.VOLTASIS_MCP_ENDPOINT;
const apiKey = process.env.VOLTASIS_MCP_API_KEY;
const DEBUG = process.env.MCP_DEBUG === 'true';

if (!endpoint || !apiKey) {
  // Exit silently if environment variables are missing
  process.exit(1);
}

// Debug logging function
function debugLog(message: string) {
  if (DEBUG) {
    fs.appendFileSync('/tmp/mcp-debug.log', `[${new Date().toISOString()}] ${message}\n`);
  }
}

debugLog('MCP AWS Client started');
debugLog(`Endpoint: ${endpoint}`);
debugLog(`API Key: ${apiKey.substring(0, 5)}...`);

// Parse the endpoint URL
const url = new URL(endpoint);
const mcpPath = url.pathname + '/mcp';

// Queue to maintain message order
const responseQueue: Map<number, any> = new Map();
let lastSentId = -1; // Start at -1 to handle id:0

// Function to send queued responses in order
function sendQueuedResponses() {
  while (responseQueue.has(lastSentId + 1)) {
    lastSentId++;
    const response = responseQueue.get(lastSentId);
    responseQueue.delete(lastSentId);
    debugLog(`Sending response: ${JSON.stringify(response)}`);
    process.stdout.write(JSON.stringify(response) + '\n');
  }
}

// Set up stdio interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Forward requests from stdio to HTTPS
rl.on('line', async (line) => {
  try {
    const message = JSON.parse(line);
    debugLog(`Received message: ${JSON.stringify(message)}`);
    
    // Handle notifications locally - they don't need responses
    if (message.method && message.method.startsWith('notifications/')) {
      // Notifications don't get responses in MCP protocol
      return;
    }
    
    // Handle initialized method (Cursor sends this after initialize)
    if (message.method === 'initialized') {
      // This is a notification-like method that expects a response
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {}
      };
      responseQueue.set(message.id, response);
      sendQueuedResponses();
      return;
    }
    
    // Handle ping/keepalive locally
    if (message.method === 'ping') {
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: { pong: true }
      };
      responseQueue.set(message.id, response);
      sendQueuedResponses();
      return;
    }
    
    // Send to AWS Lambda via API Gateway
    const options = {
      hostname: url.hostname,
      port: 443,
      path: mcpPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
    };

    const data = JSON.stringify(message);
    
    const req = https.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          
          // Check for protocol version mismatch
          if (message.method === 'initialize' && response.result) {
            const clientVersion = message.params?.protocolVersion;
            const serverVersion = response.result.protocolVersion;
            if (clientVersion !== serverVersion) {
              debugLog(`Protocol version mismatch: Client=${clientVersion}, Server=${serverVersion}`);
            }
          }
          
          // Add to queue and send in order
          responseQueue.set(message.id, response);
          sendQueuedResponses();
        } catch (error) {
          // Silently handle errors - don't write to stderr
          debugLog(`Error parsing response: ${error}`);
        }
      });
    });
    
    req.on('error', (error) => {
      // Send error response without logging to stderr
      const errorResponse = {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error.message
        }
      };
      responseQueue.set(message.id, errorResponse);
      sendQueuedResponses();
    });
    
    req.write(data);
    req.end();
    
  } catch (error) {
    // Silently handle errors - don't write to stderr
  }
});

// Keep process alive
process.stdin.resume();

// Handle readline close - only exit if explicitly closed, not on EOF
rl.on('close', () => {
  debugLog('Readline closed');
  // Don't exit immediately - wait for SIGTERM or SIGINT
});

// Handle process termination
process.on('SIGINT', () => {
  debugLog('Received SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  debugLog('Received SIGTERM');
  process.exit(0);
});

process.on('exit', (code) => {
  debugLog(`Process exiting with code ${code}`);
}); 