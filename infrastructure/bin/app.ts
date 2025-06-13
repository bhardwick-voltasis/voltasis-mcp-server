#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VoltasisMCPServerStack } from '../lib/mcp-server-stack';

const app = new cdk.App();

// Get stage from environment variable
const stage = process.env.STAGE || 'dev';

// Validate stage
if (!['dev', 'staging', 'prod'].includes(stage)) {
  throw new Error(`Invalid stage: ${stage}. Must be one of: dev, staging, prod`);
}

// Account and region from environment or use defaults
const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const region = process.env.CDK_DEFAULT_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

if (!account) {
  throw new Error('AWS account ID not found. Set CDK_DEFAULT_ACCOUNT or AWS_ACCOUNT_ID environment variable.');
}

const env = { account, region };

// Deploy MCP Server Stack
new VoltasisMCPServerStack(app, `VoltasisMCPServerStack-${stage}`, {
  env,
  stage,
  description: `Voltasis MCP Server infrastructure for ${stage} environment`,
  tags: {
    Project: 'Voltasis',
    Component: 'MCP-Server',
    Environment: stage,
    ManagedBy: 'CDK',
  },
});

app.synth(); 