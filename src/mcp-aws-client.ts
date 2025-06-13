#!/usr/bin/env node

import https from 'https';
import { URL } from 'url';
import * as readline from 'readline';

// Get configuration from environment
const endpoint = process.env.MCP_ENDPOINT || process.env.VOLTASIS_MCP_ENDPOINT;
const apiKey = process.env.VOLTASIS_MCP_API_KEY;

if (!endpoint || !apiKey) {
  console.error('Error: MCP_ENDPOINT and VOLTASIS_MCP_API_KEY environment variables are required');
  process.exit(1);
}

// Parse the endpoint URL
const url = new URL(endpoint);
const mcpPath = '/mcp';

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
          // Forward the response back to stdio
          process.stdout.write(body + '\n');
        } catch (error) {
          console.error('Error parsing response:', error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error);
      // Send error response
      const errorResponse = {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error.message
        }
      };
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    });
    
    req.write(data);
    req.end();
    
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

// Handle process termination
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
}); 