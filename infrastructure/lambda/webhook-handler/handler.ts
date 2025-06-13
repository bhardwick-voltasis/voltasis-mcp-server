import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import crypto from 'crypto';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});
const cloudFrontClient = new CloudFrontClient({});

const DOCS_BUCKET = process.env.DOCS_BUCKET!;
const INDEX_TABLE = process.env.INDEX_TABLE!;
const CLOUDFRONT_DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID!;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;

interface WebhookPayload {
  event: 'push' | 'pull_request' | 'release' | 'workflow_run';
  repository: {
    name: string;
    full_name: string;
    default_branch: string;
  };
  ref?: string;
  release?: {
    tag_name: string;
    name: string;
    body: string;
  };
  workflow_run?: {
    name: string;
    conclusion: string;
    status: string;
  };
  commits?: Array<{
    id: string;
    message: string;
    added: string[];
    modified: string[];
    removed: string[];
  }>;
}

interface DocumentUpdate {
  path: string;
  content: string;
  metadata: {
    lastUpdated: string;
    version?: string;
    category?: string;
    tags?: string[];
  };
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Verify webhook signature
    if (!verifyWebhookSignature(event)) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid signature' }),
      };
    }

    const payload: WebhookPayload = JSON.parse(event.body || '{}');
    console.log('Received webhook event:', payload.event);

    // Process different webhook events
    switch (payload.event) {
      case 'push':
        await handlePushEvent(payload);
        break;
      case 'release':
        await handleReleaseEvent(payload);
        break;
      case 'workflow_run':
        await handleWorkflowRunEvent(payload);
        break;
      default:
        console.log(`Unhandled event type: ${payload.event}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook processed successfully' }),
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

function verifyWebhookSignature(event: APIGatewayProxyEvent): boolean {
  const signature = event.headers['x-hub-signature-256'] || event.headers['X-Hub-Signature-256'];
  if (!signature) {
    return false;
  }

  const body = event.body || '';
  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex')}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

async function handlePushEvent(payload: WebhookPayload): Promise<void> {
  if (!payload.commits) {
    return;
  }

  const documentUpdates: DocumentUpdate[] = [];

  // Process commits to find documentation changes
  for (const commit of payload.commits) {
    const docFiles = [
      ...commit.added.filter(f => f.startsWith('docs/') || f.endsWith('.md')),
      ...commit.modified.filter(f => f.startsWith('docs/') || f.endsWith('.md')),
    ];

    for (const file of docFiles) {
      // Fetch file content from GitHub
      const content = await fetchFileFromGitHub(payload.repository.full_name, file, payload.ref);
      if (content) {
        documentUpdates.push({
          path: file,
          content,
          metadata: {
            lastUpdated: new Date().toISOString(),
            category: extractCategory(file),
            tags: extractTags(content),
          },
        });
      }
    }

    // Handle removed files
    for (const file of commit.removed.filter(f => f.startsWith('docs/') || f.endsWith('.md'))) {
      await removeDocumentFromIndex(file);
    }
  }

  // Process all document updates
  await processDocumentUpdates(documentUpdates);
}

async function handleReleaseEvent(payload: WebhookPayload): Promise<void> {
  if (!payload.release) {
    return;
  }

  const { tag_name, name, body } = payload.release;

  // Create release documentation
  const releaseDoc: DocumentUpdate = {
    path: `releases/${tag_name}.md`,
    content: `# ${name}\n\nVersion: ${tag_name}\n\n${body}`,
    metadata: {
      lastUpdated: new Date().toISOString(),
      version: tag_name,
      category: 'releases',
      tags: ['release', tag_name],
    },
  };

  await processDocumentUpdates([releaseDoc]);

  // Update version in all API documentation
  await updateApiDocumentationVersion(tag_name);
}

async function handleWorkflowRunEvent(payload: WebhookPayload): Promise<void> {
  if (!payload.workflow_run || payload.workflow_run.conclusion !== 'success') {
    return;
  }

  // If documentation build workflow completed successfully
  if (payload.workflow_run.name === 'Build Documentation') {
    // Trigger full documentation rebuild
    await triggerDocumentationRebuild();
  }
}

async function fetchFileFromGitHub(
  repo: string,
  path: string,
  ref?: string
): Promise<string | null> {
  try {
    const token = process.env.GITHUB_TOKEN;
    const branch = ref?.replace('refs/heads/', '') || 'main';
    
    const response = await fetch(
      `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3.raw',
        },
      }
    );

    if (response.ok) {
      return await response.text();
    }
  } catch (error) {
    console.error(`Error fetching file ${path}:`, error);
  }
  return null;
}

async function processDocumentUpdates(updates: DocumentUpdate[]): Promise<void> {
  const timestamp = Date.now();
  const invalidationPaths: string[] = [];

  for (const update of updates) {
    // Upload to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: DOCS_BUCKET,
      Key: update.path,
      Body: update.content,
      ContentType: 'text/markdown',
      Metadata: update.metadata as any,
    }));

    // Update DynamoDB index
    await docClient.send(new PutCommand({
      TableName: INDEX_TABLE,
      Item: {
        PK: `DOC#${update.path}`,
        SK: 'METADATA',
        path: update.path,
        ...update.metadata,
        content: update.content.substring(0, 1000), // Store preview
        timestamp,
      },
    }));

    // Add to invalidation paths
    invalidationPaths.push(`/${update.path}`);
  }

  // Invalidate CloudFront cache
  if (invalidationPaths.length > 0) {
    await invalidateCloudFrontCache(invalidationPaths);
  }
}

async function removeDocumentFromIndex(path: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: INDEX_TABLE,
    Key: {
      PK: `DOC#${path}`,
      SK: 'METADATA',
    },
    UpdateExpression: 'SET #status = :deleted, #deletedAt = :timestamp',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#deletedAt': 'deletedAt',
    },
    ExpressionAttributeValues: {
      ':deleted': 'deleted',
      ':timestamp': new Date().toISOString(),
    },
  }));
}

async function updateApiDocumentationVersion(version: string): Promise<void> {
  // Update version metadata in DynamoDB
  await docClient.send(new PutCommand({
    TableName: INDEX_TABLE,
    Item: {
      PK: 'CONFIG',
      SK: 'API_VERSION',
      version,
      lastUpdated: new Date().toISOString(),
    },
  }));
}

async function triggerDocumentationRebuild(): Promise<void> {
  // This would trigger a full documentation rebuild process
  // For now, we'll just log it
  console.log('Triggering full documentation rebuild...');
  
  // Could invoke another Lambda function or Step Function here
  // to handle the full rebuild process
}

async function invalidateCloudFrontCache(paths: string[]): Promise<void> {
  try {
    await cloudFrontClient.send(new CreateInvalidationCommand({
      DistributionId: CLOUDFRONT_DISTRIBUTION_ID,
      InvalidationBatch: {
        CallerReference: `webhook-${Date.now()}`,
        Paths: {
          Quantity: paths.length,
          Items: paths,
        },
      },
    }));
  } catch (error) {
    console.error('Error invalidating CloudFront cache:', error);
  }
}

function extractCategory(filePath: string): string {
  const parts = filePath.split('/');
  if (parts[0] === 'docs' && parts.length > 2) {
    return parts[1];
  }
  return 'general';
}

function extractTags(content: string): string[] {
  const tags: string[] = [];
  
  // Extract tags from frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const tagsMatch = frontmatterMatch[1].match(/tags:\s*\[(.*?)\]/);
    if (tagsMatch) {
      tags.push(...tagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, '')));
    }
  }

  // Extract headers as tags
  const headers = content.match(/^#{1,3}\s+(.+)$/gm);
  if (headers) {
    headers.forEach(header => {
      const tag = header.replace(/^#+\s+/, '').toLowerCase().replace(/\s+/g, '-');
      if (tag.length > 2 && tag.length < 30) {
        tags.push(tag);
      }
    });
  }

  return [...new Set(tags)];
} 