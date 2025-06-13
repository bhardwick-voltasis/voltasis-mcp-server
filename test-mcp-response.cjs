#!/usr/bin/env node

// Test script to verify MCP response format
const https = require('https');

// Test the actual response format
const testRequest = {
  jsonrpc: '2.0',
  id: 99,
  method: 'tools/call',
  params: {
    name: 'list_endpoints',
    arguments: { pageSize: 3 }
  }
};

const options = {
  hostname: 'u77ssoo8lc.execute-api.us-east-1.amazonaws.com',
  port: 443,
  path: '/dev/mcp',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': 'Rd4wQp4iPH1RF44TVPImf4Q30IxMK6Xp3GzfzKek'
  }
};

const req = https.request(options, (res) => {
  let body = '';
  
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    console.log('Body length:', body.length);
    console.log('Body:', body);
    
    try {
      const parsed = JSON.parse(body);
      console.log('\nParsed response:');
      console.log('- Has jsonrpc:', 'jsonrpc' in parsed);
      console.log('- Has id:', 'id' in parsed);
      console.log('- Has result:', 'result' in parsed);
      console.log('- Has error:', 'error' in parsed);
      
      if (parsed.result) {
        console.log('- Result type:', typeof parsed.result);
        console.log('- Result keys:', Object.keys(parsed.result));
      }
    } catch (e) {
      console.error('Failed to parse:', e.message);
    }
  });
});

req.on('error', console.error);
req.write(JSON.stringify(testRequest));
req.end(); 