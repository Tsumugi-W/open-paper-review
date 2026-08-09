import type { RetrievalClient, RetrievedWork } from './types.js';

const BASE_URL = 'https://api.openalex.org';

export class OpenAlexClient implements RetrievalClient {
  private email?: string;
  private timeout: number;

  constructor(opts: { email?: string; timeout?: number }) {
    this.email = opts.email;
    this.timeout = opts.timeout ?? 10000;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/works?filter=title.search:test&per_page=1`, {
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
      'filter': `title.search:${query}`,
      'per_page': String(Math.min(limit, 25)),
      'select': 'id,title,authorships,publication_year,doi,cited_by_count,abstract_inverted_index',
    });

    const res = await fetch(`${BASE_URL}/works?${params}`, {
      signal: AbortSignal.timeout(this.timeout),
      headers: this.headers(),
    });

    if (!res.ok) return [];
    const data = await res.json() as any;
    return (data.results ?? []).map((w: any) => this.mapWork(w));
  }

  async getByDoi(doi: string): Promise<RetrievedWork | null> {
    const res = await fetch(`${BASE_URL}/works/doi:${doi}`, {
      signal: AbortSignal.timeout(this.timeout),
      headers: this.headers(),
    });
    if (!res.ok) return null;
    return this.mapWork(await res.json());
  }

  async getByTitle(title: string): Promise<RetrievedWork | null> {
    const results = await this.search(title, 1);
    return results[0] ?? null;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {};
    if (this.email) h['User-Agent'] = `OpenPaperReview/0.1 (mailto:${this.email})`;
    return h;
  }

  private mapWork(w: any): RetrievedWork {
    return {
      title: w.title ?? '',
      authors: (w.authorships ?? []).map((a: any) => a.author?.display_name ?? ''),
      year: w.publication_year ?? null,
      doi: w.doi?.replace('https://doi.org/', '') ?? null,
      openAlexId: w.id ?? null,
      semanticScholarId: null,
      url: w.doi ?? w.id ?? null,
      abstract: w.abstract_inverted_index ? this.reconstructAbstract(w.abstract_inverted_index) : null,
      citationCount: w.cited_by_count ?? null,
      source: 'openalex',
      verified: true,
      retrievedAt: new Date(),
    };
  }

  private reconstructAbstract(inverted: Record<string, number[]>): string {
    const words: [number, string][] = [];
    for (const [word, positions] of Object.entries(inverted)) {
      for (const pos of positions) {
        words.push([pos, word]);
      }
    }
    words.sort((a, b) => a[0] - b[0]);
    return words.map(([, w]) => w).join(' ');
  }
}
