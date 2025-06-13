#!/usr/bin/env tsx

import { execSync } from 'child_process';
import * as readline from 'readline';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

interface WebhookConfig {
  githubToken: string;
  repository: string;
  webhookUrl: string;
  webhookSecret: string;
  events: string[];
}

async function main() {
  console.log('🔧 Voltasis MCP Server - Webhook Setup\n');

  try {
    // Get configuration
    const config = await getConfiguration();

    // Create or update webhook
    await configureWebhook(config);

    // Save webhook secret to .env file
    await saveWebhookSecret(config.webhookSecret);

    console.log('\n✅ Webhook setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Add the following secrets to your GitHub repository:');
    console.log('   - WEBHOOK_SECRET: (saved in .env file)');
    console.log('   - AWS_ACCESS_KEY_ID: Your AWS access key');
    console.log('   - AWS_SECRET_ACCESS_KEY: Your AWS secret key');
    console.log('2. Deploy the infrastructure: npm run cdk:deploy');
    console.log('3. Push changes to trigger the webhook');
  } catch (error) {
    console.error('\n❌ Error setting up webhook:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

async function getConfiguration(): Promise<WebhookConfig> {
  // Get GitHub token
  const githubToken = process.env.GITHUB_TOKEN || await question('Enter your GitHub personal access token: ');
  
  // Get repository
  const defaultRepo = getDefaultRepository();
  const repository = await question(`Enter repository (default: ${defaultRepo}): `) || defaultRepo;
  
  // Get stage
  const stage = await question('Enter deployment stage (dev/staging/prod) [default: dev]: ') || 'dev';
  
  // Get webhook URL from CloudFormation or ask user
  let webhookUrl = '';
  try {
    webhookUrl = getWebhookUrlFromCloudFormation(stage);
    console.log(`Found webhook URL from CloudFormation: ${webhookUrl}`);
  } catch {
    webhookUrl = await question('Enter webhook URL (from CloudFormation outputs): ');
  }
  
  // Generate webhook secret
  const webhookSecret = crypto.randomBytes(32).toString('hex');
  console.log(`Generated webhook secret: ${webhookSecret.substring(0, 10)}...`);
  
  // Select events
  const events = await selectWebhookEvents();
  
  return {
    githubToken,
    repository,
    webhookUrl,
    webhookSecret,
    events,
  };
}

function getDefaultRepository(): string {
  try {
    const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim();
    const match = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

function getWebhookUrlFromCloudFormation(stage: string): string {
  try {
    const output = execSync(
      `aws cloudformation describe-stacks --stack-name VoltasisMCPServerStack-${stage} --query "Stacks[0].Outputs[?OutputKey=='MCPWebhookUrl'].OutputValue" --output text`,
      { encoding: 'utf-8' }
    ).trim();
    return output;
  } catch (error) {
    throw new Error('Could not retrieve webhook URL from CloudFormation');
  }
}

async function selectWebhookEvents(): Promise<string[]> {
  console.log('\nSelect webhook events to listen for:');
  console.log('1. Push events (recommended)');
  console.log('2. Release events (recommended)');
  console.log('3. Pull request events');
  console.log('4. Workflow run events');
  console.log('5. All of the above');
  
  const selection = await question('Enter your choice (1-5) [default: 5]: ') || '5';
  
  switch (selection) {
    case '1':
      return ['push'];
    case '2':
      return ['release'];
    case '3':
      return ['pull_request'];
    case '4':
      return ['workflow_run'];
    case '5':
    default:
      return ['push', 'release', 'pull_request', 'workflow_run'];
  }
}

async function configureWebhook(config: WebhookConfig): Promise<void> {
  const { githubToken, repository, webhookUrl, webhookSecret, events } = config;
  
  console.log('\nConfiguring GitHub webhook...');
  
  // Check if webhook already exists
  const existingWebhooks = await getExistingWebhooks(githubToken, repository);
  const existingWebhook = existingWebhooks.find((w: any) => w.config.url === webhookUrl);
  
  if (existingWebhook) {
    console.log('Webhook already exists, updating...');
    await updateWebhook(githubToken, repository, existingWebhook.id, webhookUrl, webhookSecret, events);
  } else {
    console.log('Creating new webhook...');
    await createWebhook(githubToken, repository, webhookUrl, webhookSecret, events);
  }
}

async function getExistingWebhooks(token: string, repository: string): Promise<any[]> {
  const response = await fetch(`https://api.github.com/repos/${repository}/hooks`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get webhooks: ${response.statusText}`);
  }
  
  return response.json();
}

async function createWebhook(
  token: string,
  repository: string,
  url: string,
  secret: string,
  events: string[]
): Promise<void> {
  const response = await fetch(`https://api.github.com/repos/${repository}/hooks`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'web',
      active: true,
      events,
      config: {
        url,
        content_type: 'json',
        secret,
        insecure_ssl: '0',
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create webhook: ${error}`);
  }
  
  console.log('✅ Webhook created successfully!');
}

async function updateWebhook(
  token: string,
  repository: string,
  hookId: number,
  url: string,
  secret: string,
  events: string[]
): Promise<void> {
  const response = await fetch(`https://api.github.com/repos/${repository}/hooks/${hookId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      active: true,
      events,
      config: {
        url,
        content_type: 'json',
        secret,
        insecure_ssl: '0',
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update webhook: ${error}`);
  }
  
  console.log('✅ Webhook updated successfully!');
}

async function saveWebhookSecret(secret: string): Promise<void> {
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  
  // Read existing .env file if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }
  
  // Update or add WEBHOOK_SECRET
  if (envContent.includes('WEBHOOK_SECRET=')) {
    envContent = envContent.replace(/WEBHOOK_SECRET=.*$/m, `WEBHOOK_SECRET=${secret}`);
  } else {
    envContent += `\n# GitHub Webhook Secret\nWEBHOOK_SECRET=${secret}\n`;
  }
  
  // Write back to .env file
  fs.writeFileSync(envPath, envContent);
  console.log('\n✅ Webhook secret saved to .env file');
}

// Run the script
main().catch(console.error); 