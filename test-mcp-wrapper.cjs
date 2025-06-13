#!/usr/bin/env node

// Test wrapper to see if response format is the issue
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false
});

console.error('[WRAPPER] Starting test wrapper...');

rl.on('line', (line) => {
  try {
    const message = JSON.parse(line);
    console.error('[WRAPPER] Received:', message.method);
    
    // For tool calls, wrap the response properly
    if (message.method === 'tools/call' && message.id === 2) {
      // Send a properly formatted tool response
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: [
            {
              type: 'text',
              text: `Here are the Voltasis API endpoints:

1. GET /accept/invitation - Accept invitations
2. GET /admin/gdpr/external/requests - Retrieve GDPR requests
3. PUT /admin/gdpr/external/requests/id - Update GDPR requests
4. GET /admin/system/stats - Get system statistics
5. GET /api/v1/projects - List projects

Total: 264 endpoints across 88 pages.`
            }
          ]
        }
      };
      
      console.error('[WRAPPER] Sending wrapped response');
      process.stdout.write(JSON.stringify(response) + '\n');
    } else {
      // For other methods, just echo back success
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {}
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    }
  } catch (e) {
    console.error('[WRAPPER] Error:', e.message);
  }
});

process.stdin.resume(); 