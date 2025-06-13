#!/usr/bin/env tsx
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface DocumentMetadata {
  id: string;
  title: string;
  category: 'api' | 'guide' | 'reference';
  tags: string[];
  related?: string[];
  version: string;
  lastUpdated: string;
  method?: string;
  path?: string;
}

interface DocumentReference {
  id: string;
  title: string;
  path: string;
  tags: string[];
}

interface DocumentIndex {
  version: string;
  generated: string;
  totalDocuments: number;
  categories: {
    api: DocumentReference[];
    guides: DocumentReference[];
    reference: DocumentReference[];
  };
  searchIndex: Array<{
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    weight: number;
  }>;
}

async function parseMarkdownFile(filePath: string): Promise<DocumentMetadata | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    
    if (!frontmatterMatch) {
      console.warn(`No frontmatter found in ${filePath}`);
      return null;
    }

    const frontmatter = frontmatterMatch[1];
    const metadata: any = {};

    // Parse frontmatter (simple YAML parsing)
    const lines = frontmatter.split('\n');
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      
      // Handle arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        metadata[key] = value
          .slice(1, -1)
          .split(',')
          .map(item => item.trim());
      } 
      // Handle booleans
      else if (value === 'true' || value === 'false') {
        metadata[key] = value === 'true';
      }
      // Handle strings
      else {
        metadata[key] = value.replace(/^["']|["']$/g, '');
      }
    }

    // Extract content preview for search
    const contentBody = content.substring(frontmatterMatch[0].length).trim();
    const preview = contentBody.substring(0, 500).replace(/\n/g, ' ');
    metadata.contentPreview = preview;

    return metadata as DocumentMetadata;
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    return null;
  }
}

async function scanDirectory(dir: string, baseDir: string): Promise<Array<{ metadata: DocumentMetadata; relativePath: string }>> {
  const results: Array<{ metadata: DocumentMetadata; relativePath: string }> = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subResults = await scanDirectory(fullPath, baseDir);
        results.push(...subResults);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const metadata = await parseMarkdownFile(fullPath);
        if (metadata) {
          const relativePath = path.relative(baseDir, fullPath);
          results.push({ metadata, relativePath });
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error);
  }
  
  return results;
}

async function generateIndex() {
  console.log('🔍 Generating documentation index...\n');

  const docsPath = path.join(process.cwd(), 'mcp-docs');
  
  // Ensure docs directory exists
  try {
    await fs.access(docsPath);
  } catch {
    console.log('📁 Creating mcp-docs directory...');
    await fs.mkdir(docsPath, { recursive: true });
    await fs.mkdir(path.join(docsPath, 'api', 'endpoints'), { recursive: true });
    await fs.mkdir(path.join(docsPath, 'api', 'schemas'), { recursive: true });
    await fs.mkdir(path.join(docsPath, 'guides'), { recursive: true });
    await fs.mkdir(path.join(docsPath, 'reference'), { recursive: true });
  }

  // Scan all documentation files
  const documents = await scanDirectory(docsPath, docsPath);
  
  // Create index structure
  const index: DocumentIndex = {
    version: '1.0.0',
    generated: new Date().toISOString(),
    totalDocuments: documents.length,
    categories: {
      api: [],
      guides: [],
      reference: []
    },
    searchIndex: []
  };

  // Process documents
  for (const { metadata, relativePath } of documents) {
    const docRef: DocumentReference = {
      id: metadata.id,
      title: metadata.title,
      path: relativePath,
      tags: metadata.tags || []
    };

    // Add to appropriate category
    if (metadata.category === 'api') {
      index.categories.api.push(docRef);
    } else if (metadata.category === 'guide') {
      index.categories.guides.push(docRef);
    } else if (metadata.category === 'reference') {
      index.categories.reference.push(docRef);
    }

    // Add to search index
    index.searchIndex.push({
      id: metadata.id,
      title: metadata.title,
      content: (metadata as any).contentPreview || '',
      category: metadata.category,
      tags: metadata.tags || [],
      weight: metadata.category === 'api' ? 1.5 : 1.0
    });
  }

  // Write index file
  const indexPath = path.join(docsPath, 'index.json');
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2));

  console.log('✅ Index generated successfully!');
  console.log(`📊 Total documents: ${index.totalDocuments}`);
  console.log(`   - API: ${index.categories.api.length}`);
  console.log(`   - Guides: ${index.categories.guides.length}`);
  console.log(`   - Reference: ${index.categories.reference.length}`);
  console.log(`\n📍 Index file: ${indexPath}`);
}

// Run the index generation
generateIndex().catch(console.error); 