// Document Types for Voltasis API Documentation

export interface DocumentMetadata {
  id: string;
  title: string;
  category: 'api' | 'guide' | 'reference';
  tags: string[];
  related: string[];
  version: string;
  lastUpdated: string;
}

export interface APIEndpoint extends DocumentMetadata {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  authentication: boolean;
  organizationContext: boolean;
  description: string;
  headers?: Record<string, string>;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  examples?: Example[];
}

export interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header';
  type: string;
  required: boolean;
  description: string;
  default?: any;
  enum?: string[];
}

export interface RequestBody {
  required: boolean;
  content: {
    'application/json': {
      schema: Schema;
    };
  };
}

export interface Response {
  description: string;
  content?: {
    'application/json': {
      schema: Schema;
    };
  };
}

export interface Schema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
  oneOf?: Schema[];
  allOf?: Schema[];
  anyOf?: Schema[];
}

export interface Example {
  language: 'typescript' | 'javascript' | 'python' | 'curl';
  code: string;
  description?: string;
}

export interface DocumentIndex {
  version: string;
  generated: string;
  totalDocuments: number;
  categories: {
    api: DocumentReference[];
    guides: DocumentReference[];
    reference: DocumentReference[];
  };
  searchIndex: SearchEntry[];
}

export interface DocumentReference {
  id: string;
  title: string;
  path: string;
  tags: string[];
}

export interface SearchEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  weight: number;
} 