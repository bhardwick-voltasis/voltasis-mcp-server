#!/usr/bin/env tsx
import { spawn } from 'child_process';
import path from 'path';

const serverPath = path.join(process.cwd(), 'dist', 'local-server.js');

console.log('🧪 Testing Voltasis MCP Server...\n');

const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Test requests
const testRequests = [
  {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  },
  {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  },
  {
    jsonrpc: '2.0',
    id: 3,
    method: 'resources/list',
    params: {}
  }
];

let currentRequest = 0;
const responses: any[] = [];

server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const response = JSON.parse(line);
      if (response.jsonrpc === '2.0') {
        responses.push(response);
        console.log(`✅ Response ${response.id}:`, JSON.stringify(response.result || response.error, null, 2));
        
        currentRequest++;
        if (currentRequest < testRequests.length) {
          // Send next request
          server.stdin.write(JSON.stringify(testRequests[currentRequest]) + '\n');
        } else {
          // All tests complete
          console.log('\n🎉 All tests passed!');
          server.kill();
          process.exit(0);
        }
      }
    } catch (error) {
      // Not JSON, probably a log message
      if (!line.includes('{')) {
        console.log('📝 Log:', line);
      }
    }
  }
});

server.stderr.on('data', (data) => {
  console.error('❌ Error:', data.toString());
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

server.on('close', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`❌ Server exited with code ${code}`);
    process.exit(1);
  }
});

// Send first request
console.log('📤 Sending initialize request...');
server.stdin.write(JSON.stringify(testRequests[0]) + '\n'); 