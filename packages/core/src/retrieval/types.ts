export interface RetrievedWork {
  title: string;
  authors: string[];
  year: number | null;
  doi: string | null;
  openAlexId: string | null;
  semanticScholarId: string | null;
  url: string | null;
  abstract: string | null;
  citationCount: number | null;
  source: RetrievalSource;
  verified: boolean;
  retrievedAt: Date;
}

export type RetrievalSource = 'openalex' | 'semantic_scholar' | 'paper_references';

export interface RetrievalConfig {
  openAlexEmail?: string;
  semanticScholarApiKey?: string;
  cacheTtlDays: number;
  maxResults: number;
  timeout: number;
}

export interface RetrievalClient {
  search(query: string, limit: number): Promise<RetrievedWork[]>;
  getByDoi(doi: string): Promise<RetrievedWork | null>;
  getByTitle(title: string): Promise<RetrievedWork | null>;
  isAvailable(): Promise<boolean>;
}
