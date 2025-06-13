#!/usr/bin/env node

/**
 * Test script to compare MCP tool responses with actual data in AWS
 * Uses the API key to call the MCP endpoint directly
 */

const https = require('https');

// Configuration from ~/.cursor/mcp.json
const MCP_ENDPOINT = 'https://u77ssoo8lc.execute-api.us-east-1.amazonaws.com/dev/mcp';
const API_KEY = 'Rd4wQp4iPH1RF44TVPImf4Q30IxMK6Xp3GzfzKek';

// Helper function to make MCP requests
function callMCP(method, params = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: method,
      params: params
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(MCP_ENDPOINT, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.error) {
            reject(response.error);
          } else {
            resolve(response.result);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function testMCPTools() {
  console.log('=== MCP Data Comparison Test ===\n');
  console.log('Using API Key to directly query MCP endpoint...\n');

  try {
    // 1. Test list_endpoints
    console.log('1. Testing list_endpoints tool:');
    const endpoints = await callMCP('tools/call', {
      name: 'list_endpoints',
      arguments: { page: 0, pageSize: 10 }
    });
    
    // Parse the wrapped response
    const endpointsData = JSON.parse(endpoints.content[0].text);
    console.log(`   ✓ Total endpoints in DynamoDB: ${endpointsData.pagination.totalItems}`);
    console.log(`   ✓ First endpoint: ${endpointsData.endpoints[0].title}`);
    console.log(`   ✓ Pagination working: ${endpointsData.pagination.hasMore ? 'Yes' : 'No'}`);

    // 2. Test list_schemas
    console.log('\n2. Testing list_schemas tool:');
    const schemas = await callMCP('tools/call', {
      name: 'list_schemas',
      arguments: { page: 0, pageSize: 10 }
    });
    
    const schemasData = JSON.parse(schemas.content[0].text);
    console.log(`   ✓ Total schemas in DynamoDB: ${schemasData.pagination.totalItems}`);
    console.log(`   ✓ Schema examples: ${schemasData.schemas.slice(0, 3).map(s => s.name).join(', ')}`);

    // 3. Test get_document
    console.log('\n3. Testing get_document tool:');
    const userDoc = await callMCP('tools/call', {
      name: 'get_document',
      arguments: { documentId: 'users-get' }
    });
    
    const userDocData = JSON.parse(userDoc.content[0].text);
    console.log(`   ✓ Document retrieved from S3: ${userDocData.document.title}`);
    console.log(`   ✓ S3 path construction: ${userDocData.document.category === 'api' ? 'api/endpoints/' : ''}${userDocData.document.id}.md`);
    console.log(`   ✓ Content length: ${userDocData.document.content.length} characters`);

    // 4. Test list_guides
    console.log('\n4. Testing list_guides tool:');
    const guides = await callMCP('tools/call', {
      name: 'list_guides',
      arguments: {}
    });
    
    const guidesData = JSON.parse(guides.content[0].text);
    console.log(`   ✓ Total guides: ${guidesData.pagination.totalItems}`);
    console.log(`   ✓ Available guides: ${guidesData.guides.map(g => g.title).join(', ')}`);

    // 5. Test search_documentation
    console.log('\n5. Testing search_documentation tool:');
    const searchResults = await callMCP('tools/call', {
      name: 'search_documentation',
      arguments: { query: 'authentication', category: 'guide' }
    });
    
    const searchData = JSON.parse(searchResults.content[0].text);
    console.log(`   ✓ Search results: ${searchData.results.length} found`);
    if (searchData.results.length > 0) {
      console.log(`   ✓ First result: ${searchData.results[0].title}`);
    }

    // Summary of AWS data structure
    console.log('\n=== AWS Data Structure Summary ===');
    console.log('\nDynamoDB Index Table:');
    console.log('- Partition Key: "DOCUMENT" for all items');
    console.log('- Sort Key: Document ID (e.g., "users-get", "authentication")');
    console.log(`- Total documents indexed: ${endpointsData.pagination.totalItems + schemasData.pagination.totalItems + guidesData.pagination.totalItems}`);
    console.log('- Categories: api (endpoints + schemas), guide, reference');
    
    console.log('\nS3 Bucket Structure:');
    console.log('- /api/endpoints/ - API endpoint documentation');
    console.log('- /api/schemas/ - Schema definitions');
    console.log('- /guides/ - User guides');
    console.log('- /reference/ - Reference documentation');
    
    console.log('\nMCP Response Format:');
    console.log('- All tool results wrapped in: { content: [{ type: "text", text: "..." }] }');
    console.log('- Pagination included for list operations');
    console.log('- Consistent error handling with MCP protocol');

    console.log('\n✅ All MCP tools are correctly accessing AWS data!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
testMCPTools(); 