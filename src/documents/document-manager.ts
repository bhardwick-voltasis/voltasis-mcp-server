import fs from 'fs/promises';
import path from 'path';
import { DocumentIndex, DocumentMetadata, APIEndpoint, DocumentReference } from '../types/document.types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('document-manager');

export class DocumentManager {
  private documentsPath: string;
  private index: DocumentIndex | null = null;
  private documents: Map<string, APIEndpoint | DocumentMetadata> = new Map();

  constructor(documentsPath: string = './mcp-docs') {
    this.documentsPath = documentsPath;
  }

  async initialize(): Promise<void> {
    logger.info('Initializing document manager', { path: this.documentsPath });
    
    // Load the document index
    await this.loadIndex();
    
    // Load all documents into memory for fast access
    await this.loadDocuments();
  }

  private async loadIndex(): Promise<void> {
    try {
      const indexPath = path.join(this.documentsPath, 'index.json');
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      this.index = JSON.parse(indexContent);
      logger.info('Document index loaded', { 
        totalDocuments: this.index?.totalDocuments,
        generated: this.index?.generated 
      });
    } catch (error) {
      logger.warn('No document index found, creating empty index', { error });
      this.index = {
        version: '1.0.0',
        generated: new Date().toISOString(),
        totalDocuments: 0,
        categories: {
          api: [],
          guides: [],
          reference: []
        },
        searchIndex: []
      };
    }
  }

  private async loadDocuments(): Promise<void> {
    if (!this.index) return;

    const allDocs = [
      ...this.index.categories.api,
      ...this.index.categories.guides,
      ...this.index.categories.reference
    ];

    for (const docRef of allDocs) {
      try {
        const docPath = path.join(this.documentsPath, docRef.path);
        const content = await fs.readFile(docPath, 'utf-8');
        const document = this.parseDocument(content);
        if (document) {
          this.documents.set(docRef.id, document);
        }
      } catch (error) {
        logger.error('Failed to load document', { id: docRef.id, error });
      }
    }

    logger.info('Documents loaded', { count: this.documents.size });
  }

  private parseDocument(content: string): APIEndpoint | DocumentMetadata | null {
    try {
      // Extract frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) return null;

      const frontmatter = frontmatterMatch[1];
      const metadata: any = {};

      // Parse frontmatter (simple YAML parsing)
      frontmatter.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          const value = valueParts.join(':').trim();
          metadata[key.trim()] = value.replace(/^["']|["']$/g, '');
        }
      });

      // Parse arrays
      if (metadata.tags) {
        metadata.tags = metadata.tags.replace(/[\[\]]/g, '').split(',').map((t: string) => t.trim());
      }
      if (metadata.related) {
        metadata.related = metadata.related.replace(/[\[\]]/g, '').split(',').map((r: string) => r.trim());
      }

      return metadata;
    } catch (error) {
      logger.error('Failed to parse document', { error });
      return null;
    }
  }

  async searchDocuments(query: string, category?: string): Promise<DocumentReference[]> {
    if (!this.index) return [];

    const results: DocumentReference[] = [];
    const queryLower = query.toLowerCase();

    // Search through all documents
    const categories = category && category !== 'all' 
      ? { [category]: this.index.categories[category as keyof typeof this.index.categories] }
      : this.index.categories;

    for (const [_cat, docs] of Object.entries(categories)) {
      for (const doc of docs) {
        // Simple search implementation
        if (doc.title.toLowerCase().includes(queryLower) ||
            doc.tags.some(tag => tag.toLowerCase().includes(queryLower))) {
          results.push(doc);
        }
      }
    }

    return results;
  }

  async getDocument(id: string): Promise<APIEndpoint | DocumentMetadata | null> {
    return this.documents.get(id) || null;
  }

  async getEndpointByPath(endpoint: string, method?: string): Promise<APIEndpoint | null> {
    for (const [_id, doc] of this.documents) {
      if ('path' in doc && doc.path === endpoint) {
        if (!method || doc.method === method) {
          return doc as APIEndpoint;
        }
      }
    }
    return null;
  }

  async listEndpoints(tag?: string, category?: string): Promise<APIEndpoint[]> {
    const endpoints: APIEndpoint[] = [];

    for (const [_id, doc] of this.documents) {
      if ('path' in doc && doc.category === 'api') {
        const endpoint = doc as APIEndpoint;
        
        if (tag && !endpoint.tags.includes(tag)) continue;
        if (category && endpoint.category !== category) continue;
        
        endpoints.push(endpoint);
      }
    }

    return endpoints;
  }

  async getResourceContent(uri: string): Promise<string | null> {
    // Extract document ID from URI (e.g., voltasis://api/overview -> api/overview)
    const docId = uri.replace('voltasis://', '');
    
    // Try to find the document
    const doc = await this.getDocument(docId);
    if (!doc) {
      // Try to find by path
      const docRef = this.findDocumentByPath(docId);
      if (docRef) {
        try {
          const docPath = path.join(this.documentsPath, docRef.path);
          return await fs.readFile(docPath, 'utf-8');
        } catch (error) {
          logger.error('Failed to read document file', { uri, error });
        }
      }
    }

    return null;
  }

  private findDocumentByPath(searchPath: string): DocumentReference | null {
    if (!this.index) return null;

    const allDocs = [
      ...this.index.categories.api,
      ...this.index.categories.guides,
      ...this.index.categories.reference
    ];

    return allDocs.find(doc => 
      doc.id === searchPath || 
      doc.path.includes(searchPath)
    ) || null;
  }

  getAvailableResources(): DocumentReference[] {
    if (!this.index) return [];

    return [
      ...this.index.categories.api,
      ...this.index.categories.guides,
      ...this.index.categories.reference
    ];
  }
} 