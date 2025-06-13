import { ScheduledEvent } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const logger = new Logger();
const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const { DOCS_BUCKET, INDEX_TABLE } = process.env;

interface DocumentMetadata {
  id: string;
  category: string;
  title: string;
  tags: string[];
  path?: string;
  method?: string;
  lastModified: string;
  size: number;
}

export const handler = async (event: ScheduledEvent): Promise<void> => {
  logger.info('Index builder started', { time: event.time });

  try {
    // List all markdown files in S3
    const documents = await listAllDocuments();
    logger.info('Found documents', { count: documents.length });

    // Build search indexes
    const indexes = await buildSearchIndexes(documents);
    logger.info('Built indexes', { 
      documentCount: indexes.documents.length,
      tagCount: indexes.tags.length 
    });

    // Update DynamoDB indexes
    await updateIndexes(indexes);
    logger.info('Updated indexes in DynamoDB');

    // Generate summary statistics
    const stats = generateStatistics(documents);
    await updateStatistics(stats);
    logger.info('Updated statistics', { stats });

  } catch (error) {
    logger.error('Error building indexes', { error });
    throw error;
  }
};

async function listAllDocuments(): Promise<DocumentMetadata[]> {
  const documents: DocumentMetadata[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: DOCS_BUCKET,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }));

    if (response.Contents) {
      for (const object of response.Contents) {
        if (object.Key?.endsWith('.md')) {
          const metadata = extractMetadataFromKey(object.Key);
          documents.push({
            ...metadata,
            lastModified: object.LastModified?.toISOString() || new Date().toISOString(),
            size: object.Size || 0,
          });
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return documents;
}

function extractMetadataFromKey(key: string): Omit<DocumentMetadata, 'lastModified' | 'size'> {
  // Parse S3 key to extract metadata
  // Example: api/endpoints/api-v1-users-get.md
  const parts = key.split('/');
  const filename = parts[parts.length - 1].replace('.md', '');
  
  let category = 'unknown';
  let tags: string[] = [];
  
  if (key.startsWith('api/')) {
    category = 'api';
    tags.push('api');
    
    if (key.includes('/endpoints/')) {
      tags.push('endpoint');
      
      // Extract method from filename
      const methodMatch = filename.match(/-(get|post|put|delete|patch)$/);
      if (methodMatch) {
        tags.push(methodMatch[1]);
      }
    } else if (key.includes('/schemas/')) {
      tags.push('schema');
    }
  } else if (key.startsWith('guides/')) {
    category = 'guide';
    tags.push('guide');
  } else if (key.startsWith('reference/')) {
    category = 'reference';
    tags.push('reference');
  }

  return {
    id: filename,
    category,
    title: formatTitle(filename),
    tags,
  };
}

function formatTitle(filename: string): string {
  // Convert filename to readable title
  // api-v1-users-get -> GET /api/v1/users
  const parts = filename.split('-');
  const method = parts[parts.length - 1].toUpperCase();
  
  if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const path = parts.slice(0, -1).join('/').replace('api/', '/api/');
    return `${method} ${path}`;
  }
  
  // Otherwise, just format as title case
  return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

interface SearchIndexes {
  documents: any[];
  tags: any[];
  categories: any[];
}

async function buildSearchIndexes(documents: DocumentMetadata[]): Promise<SearchIndexes> {
  const documentItems: any[] = [];
  const tagItems: any[] = [];
  const categoryItems: any[] = [];
  
  const tagCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();

  for (const doc of documents) {
    // Document index entry
    documentItems.push({
      PutRequest: {
        Item: {
          PK: 'DOCUMENT',
          SK: doc.id,
          ...doc,
          searchText: `${doc.title} ${doc.tags.join(' ')}`.toLowerCase(),
        },
      },
    });

    // Tag index entries
    for (const tag of doc.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      
      tagItems.push({
        PutRequest: {
          Item: {
            PK: 'TAG',
            SK: `${tag}#${doc.id}`,
            tag,
            documentId: doc.id,
            documentTitle: doc.title,
            relevance: 1.0,
          },
        },
      });
    }

    // Category counts
    categoryCounts.set(doc.category, (categoryCounts.get(doc.category) || 0) + 1);
  }

  // Category summary entries
  for (const [category, count] of categoryCounts) {
    categoryItems.push({
      PutRequest: {
        Item: {
          PK: 'CATEGORY',
          SK: category,
          category,
          documentCount: count,
          lastUpdated: new Date().toISOString(),
        },
      },
    });
  }

  return {
    documents: documentItems,
    tags: tagItems,
    categories: categoryItems,
  };
}

async function updateIndexes(indexes: SearchIndexes): Promise<void> {
  // Batch write to DynamoDB (max 25 items per batch)
  const allItems = [...indexes.documents, ...indexes.tags, ...indexes.categories];
  
  for (let i = 0; i < allItems.length; i += 25) {
    const batch = allItems.slice(i, i + 25);
    
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [INDEX_TABLE!]: batch,
      },
    }));
    
    // Small delay to avoid throttling
    if (i + 25 < allItems.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

interface Statistics {
  totalDocuments: number;
  documentsByCategory: Record<string, number>;
  documentsByTag: Record<string, number>;
  totalSize: number;
  lastUpdated: string;
}

function generateStatistics(documents: DocumentMetadata[]): Statistics {
  const stats: Statistics = {
    totalDocuments: documents.length,
    documentsByCategory: {},
    documentsByTag: {},
    totalSize: 0,
    lastUpdated: new Date().toISOString(),
  };

  for (const doc of documents) {
    // Category counts
    stats.documentsByCategory[doc.category] = (stats.documentsByCategory[doc.category] || 0) + 1;
    
    // Tag counts
    for (const tag of doc.tags) {
      stats.documentsByTag[tag] = (stats.documentsByTag[tag] || 0) + 1;
    }
    
    // Total size
    stats.totalSize += doc.size;
  }

  return stats;
}

async function updateStatistics(stats: Statistics): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: INDEX_TABLE!,
    Item: {
      PK: 'STATS',
      SK: 'SUMMARY',
      ...stats,
    },
  }));
} 