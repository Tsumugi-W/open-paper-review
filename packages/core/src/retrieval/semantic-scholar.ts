import type { RetrievalClient, RetrievedWork } from './types.js';

const BASE_URL = 'https://api.semanticscholar.org/graph/v1';

export class SemanticScholarClient implements RetrievalClient {
  private apiKey?: string;
  private timeout: number;

  constructor(opts: { apiKey?: string; timeout?: number }) {
    this.apiKey = opts.apiKey;
    this.timeout = opts.timeout ?? 10000;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await fetch(`${BASE_URL}/paper/search?query=test&limit=1`, {
        signal: AbortSignal.timeout(5000),
        headers: this.headers(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async search(query: string, limit: number): Promise<RetrievedWork[]> {
    const params = new URLSearchParams({
      query,
      limit: String(Math.min(limit, 20)),
      fields: 'title,authors,year,externalIds,citationCount,abstract',
    });

    const res = await fetch(`${BASE_URL}/paper/search?${params}`, {
      signal: AbortSignal.timeout(this.timeout),
      headers: this.headers(),
    });

    if (!res.ok) return [];
    const data = await res.json() as any;
    return (data.data ?? []).map((p: any) => this.mapPaper(p));
  }

  async getByDoi(doi: string): Promise<RetrievedWork | null> {
    const res = await fetch(`${BASE_URL}/paper/DOI:${doi}?fields=title,authors,year,externalIds,citationCount,abstract`, {
      signal: AbortSignal.timeout(this.timeout),
      headers: this.headers(),
    });
    if (!res.ok) return null;
    return this.mapPaper(await res.json());
  }

  async getByTitle(title: string): Promise<RetrievedWork | null> {
    const results = await this.search(title, 1);
    return results[0] ?? null;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) h['x-api-key'] = this.apiKey;
    return h;
  }

  private mapPaper(p: any): RetrievedWork {
    return {
      title: p.title ?? '',
      authors: (p.authors ?? []).map((a: any) => a.name ?? ''),
      year: p.year ?? null,
      doi: p.externalIds?.DOI ?? null,
      openAlexId: null,
      semanticScholarId: p.paperId ?? null,
      url: p.paperId ? `https://www.semanticscholar.org/paper/${p.paperId}` : null,
      abstract: p.abstract ?? null,
      citationCount: p.citationCount ?? null,
      source: 'semantic_scholar',
      verified: true,
      retrievedAt: new Date(),
    };
  }
}
