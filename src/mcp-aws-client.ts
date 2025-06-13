#!/usr/bin/env node

import https from 'https';
import { URL } from 'url';
import * as readline from 'readline';
import * as fs from 'fs';

// Get configuration from environment
const endpoint = process.env.MCP_ENDPOINT || process.env.VOLTASIS_MCP_ENDPOINT;
const apiKey = process.env.VOLTASIS_MCP_API_KEY;
const DEBUG = process.env.MCP_DEBUG === 'true';

// Simple logging function
function log(message: string, data?: any) {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}${data ? ' ' + JSON.stringify(data) : ''}`;
    fs.appendFileSync('/tmp/mcp-debug.log', logEntry + '\n');
    console.error(logEntry); // Also log to stderr for real-time monitoring
  }
}

log('MCP Transparent Proxy starting...', {
  endpoint: endpoint || 'NOT SET',
  apiKeyPresent: !!apiKey
});

if (!endpoint || !apiKey) {
  log('ERROR: Missing required environment variables');
  process.exit(1);
}

// Parse the endpoint URL
const url = new URL(endpoint);
const mcpPath = url.pathname + '/mcp';

// Simple transparent proxy - just forward messages
const rl = readline.createInterface({
  input: process.stdin,
  terminal: false
});

rl.on('line', (line) => {
  try {
    const message = JSON.parse(line);
    log(`>>> Request from Cursor: ${message.method}`, { id: message.id });
    
    // Handle notifications locally - they don't expect responses
    if (message.method && message.method.startsWith('notifications/')) {
      log('Notification handled locally (no response needed)');
      return;
    }
    
    // Forward to Lambda
    const data = JSON.stringify(message);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: mcpPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        log(`<<< Response from Lambda: ${res.statusCode}`, { 
          size: body.length,
          id: message.id 
        });
        
        // Forward response directly to Cursor
        try {
          // Validate it's valid JSON
          const parsed = JSON.parse(body);
          
          // Log exactly what we're sending
          log('Response content:', {
            id: message.id,
            bodyLength: body.length,
            firstChars: body.substring(0, 100),
            lastChars: body.substring(body.length - 50),
            hasNewline: body.includes('\n'),
            parsed: JSON.stringify(parsed).substring(0, 200)
          });
          
          // Send it directly to stdout
          process.stdout.write(body + '\n');
          
          // Verify it was written
          log('Response written to stdout', { 
            id: message.id,
            bytesWritten: body.length + 1 // +1 for newline
          });
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          log('ERROR: Invalid JSON from Lambda', { error, body: body.substring(0, 200) });
          // Send error response
          const errorResponse = {
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32603,
              message: 'Invalid response from server',
              data: { parseError: error }
            }
          };
          process.stdout.write(JSON.stringify(errorResponse) + '\n');
        }
      });
    });
    
    req.on('error', (error: NodeJS.ErrnoException) => {
      log('ERROR: HTTPS request failed', { error: error.message });
      // Send error response
      const errorResponse = {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: 'Network error',
          data: error.message
        }
      };
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    });
    
    req.write(data);
    req.end();
    
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    log('ERROR: Failed to parse message from Cursor', { error });
  }
});

// Keep the process alive
process.stdin.resume();

// Clean shutdown
process.on('SIGINT', () => {
  log('Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Shutting down...');
  process.exit(0);
}); 