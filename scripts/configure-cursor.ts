#!/usr/bin/env tsx
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

interface MCPConfig {
  mcpServers: {
    [key: string]: {
      command: string;
      args: string[];
      env?: Record<string, string>;
    };
  };
}

async function configureCursor() {
  console.log('🚀 Configuring Cursor for Voltasis MCP Server...\n');

  // Get the MCP config directory
  const cursorConfigDir = path.join(os.homedir(), '.cursor');
  const mcpConfigPath = path.join(cursorConfigDir, 'mcp.json');

  // Ensure the directory exists
  await fs.mkdir(cursorConfigDir, { recursive: true });

  // Read existing config or create new one
  let config: MCPConfig = { mcpServers: {} };
  
  try {
    const existingConfig = await fs.readFile(mcpConfigPath, 'utf-8');
    config = JSON.parse(existingConfig);
  } catch (error) {
    console.log('📝 Creating new MCP configuration...');
  }

  // Add Voltasis MCP server configuration
  const serverPath = path.resolve(process.cwd(), 'dist', 'local-server.js');
  
  config.mcpServers['voltasis-api'] = {
    command: 'node',
    args: [serverPath],
    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info'
    }
  };

  // Write the configuration
  await fs.writeFile(mcpConfigPath, JSON.stringify(config, null, 2));

  console.log('✅ Cursor configuration updated successfully!');
  console.log(`📍 Configuration file: ${mcpConfigPath}\n`);

  // Instructions for the user
  console.log('📋 Next steps:');
  console.log('1. Build the project: npm run build');
  console.log('2. Set up your API key (if using remote server):');
  console.log('   export VOLTASIS_MCP_API_KEY="your-api-key-here"');
  console.log('3. Restart Cursor to apply the configuration');
  console.log('\n🎉 You can now use Voltasis API documentation in Cursor!');

  // Create a sample .env file if it doesn't exist
  const envPath = path.join(process.cwd(), '.env');
  try {
    await fs.access(envPath);
  } catch {
    const envContent = `# Voltasis MCP Server Configuration
NODE_ENV=development
LOG_LEVEL=debug

# API Configuration (for remote server)
# MCP_ENDPOINT=https://mcp-api.voltasis.com
# VOLTASIS_MCP_API_KEY=your-api-key-here

# Local cache directory
MCP_CACHE_DIR=./mcp-docs-cache
`;
    await fs.writeFile(envPath, envContent);
    console.log('\n📄 Created sample .env file');
  }
}

// Run the configuration
configureCursor().catch(console.error); 