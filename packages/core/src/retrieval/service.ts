import type { RetrievalClient, RetrievalConfig, RetrievedWork } from './types.js';
import { OpenAlexClient } from './openalex.js';
import { SemanticScholarClient } from './semantic-scholar.js';

export class RetrievalService {
  private clients: RetrievalClient[] = [];
  private config: RetrievalConfig;

  constructor(config: RetrievalConfig) {
    this.config = config;
    this.clients.push(new OpenAlexClient({
      email: config.openAlexEmail,
      timeout: config.timeout,
    }));
    if (config.semanticScholarApiKey) {
      this.clients.push(new SemanticScholarClient({
        apiKey: config.semanticScholarApiKey,
        timeout: config.timeout,
      }));
    }
  }

  async search(query: string): Promise<RetrievedWork[]> {
    const results: RetrievedWork[] = [];
    const seen = new Set<string>();

    for (const client of this.clients) {
      if (!(await client.isAvailable())) continue;
      try {
        const works = await client.search(query, this.config.maxResults);
        for (const work of works) {
          const key = work.doi ?? work.title.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            results.push(work);
          }
        }
      } catch {
        // Degrade gracefully, try next client
      }
    }

    return results.slice(0, this.config.maxResults);
  }

  async verify(title: string, doi?: string | null): Promise<RetrievedWork | null> {
    for (const client of this.clients) {
      if (!(await client.isAvailable())) continue;
      try {
        if (doi) {
          const result = await client.getByDoi(doi);
          if (result) return result;
        }
        const result = await client.getByTitle(title);
        if (result) return result;
      } catch {
        continue;
      }
    }
    return null;
  }

  async getAvailableSources(): Promise<string[]> {
    const available: string[] = [];
    for (const client of this.clients) {
      if (await client.isAvailable()) {
        available.push(client.constructor.name);
      }
    }
    if (available.length === 0) {
      available.push('paper_references');
    }
    return available;
  }
}
