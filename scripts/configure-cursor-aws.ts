#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

// Get stage from command line
const stage = process.argv[2] || 'dev';

// Validate stage
if (!['dev', 'staging', 'prod'].includes(stage)) {
  console.error(`${colors.red}Error: Invalid stage '${stage}'. Must be one of: dev, staging, prod${colors.reset}`);
  process.exit(1);
}

// Load environment configuration
const envFile = `.env.${stage}`;
if (!fs.existsSync(envFile)) {
  console.error(`${colors.red}Error: Configuration file ${envFile} not found. Run deploy script first.${colors.reset}`);
  process.exit(1);
}

// Parse environment file
const envConfig: Record<string, string> = {};
const envContent = fs.readFileSync(envFile, 'utf8');
envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, value] = line.split('=');
    if (key && value) {
      envConfig[key.trim()] = value.trim();
    }
  }
});

console.log(`${colors.green}Configuring Cursor for ${stage} environment${colors.reset}`);

// Get API key value
const apiKeyId = envConfig.MCP_API_KEY_ID;
console.log(`${colors.yellow}Retrieving API key...${colors.reset}`);

let apiKeyValue: string;
try {
  apiKeyValue = execSync(
    `aws apigateway get-api-key --api-key ${apiKeyId} --include-value --query value --output text`,
    { encoding: 'utf8' }
  ).trim();
} catch (error) {
  console.error(`${colors.red}Error retrieving API key. Make sure you have AWS credentials configured.${colors.reset}`);
  process.exit(1);
}

// Cursor configuration directory
const cursorConfigDir = path.join(os.homedir(), '.cursor-server', 'User', 'globalStorage');
const cursorConfigFile = path.join(cursorConfigDir, 'cursor-mcp-config.json');

// Ensure directory exists
fs.mkdirSync(cursorConfigDir, { recursive: true });

// MCP configuration
const mcpConfig = {
  mcpServers: {
    'voltasis-api-aws': {
      command: 'node',
      args: [
        path.join(process.cwd(), 'dist', 'mcp-aws-client.js')
      ],
      env: {
        MCP_ENDPOINT: envConfig.MCP_ENDPOINT.replace('/mcp', ''), // Remove /mcp suffix
        VOLTASIS_MCP_API_KEY: apiKeyValue,
        NODE_ENV: 'production',
      }
    }
  }
};

// Read existing configuration if it exists
let existingConfig: any = {};
if (fs.existsSync(cursorConfigFile)) {
  try {
    existingConfig = JSON.parse(fs.readFileSync(cursorConfigFile, 'utf8'));
  } catch (error) {
    console.warn(`${colors.yellow}Warning: Could not parse existing configuration${colors.reset}`);
  }
}

// Merge configurations
const mergedConfig = {
  ...existingConfig,
  mcpServers: {
    ...existingConfig.mcpServers,
    ...mcpConfig.mcpServers,
  }
};

// Write configuration
fs.writeFileSync(cursorConfigFile, JSON.stringify(mergedConfig, null, 2));
console.log(`${colors.green}Configuration written to: ${cursorConfigFile}${colors.reset}`);

// Create a local .env file for the MCP client
const localEnvContent = `# MCP Client Configuration for ${stage}
MCP_ENDPOINT=${envConfig.MCP_ENDPOINT.replace('/mcp', '')}
VOLTASIS_MCP_API_KEY=${apiKeyValue}
NODE_ENV=production
`;

fs.writeFileSync('.env.mcp-client', localEnvContent);
console.log(`${colors.green}Client configuration saved to .env.mcp-client${colors.reset}`);

// Summary
console.log(`
${colors.green}Cursor configuration complete!${colors.reset}

The AWS-hosted MCP server has been configured in Cursor.

${colors.yellow}Next steps:${colors.reset}
1. Restart Cursor to apply the configuration
2. In Cursor, you can now ask questions about the Voltasis API
3. The MCP server will fetch documentation from AWS

${colors.yellow}Test the configuration:${colors.reset}
- Open Cursor
- Ask: "What endpoints are available in the Voltasis API?"
- The response should come from the AWS-hosted MCP server

${colors.yellow}Server details:${colors.reset}
- Environment: ${stage}
- API Endpoint: ${envConfig.MCP_ENDPOINT}
- Documentation URL: ${envConfig.MCP_CLOUDFRONT_URL}
`); 