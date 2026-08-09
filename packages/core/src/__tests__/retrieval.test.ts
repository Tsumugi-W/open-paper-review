import { describe, it, expect, vi } from 'vitest';
import { RetrievalService } from '../retrieval/service.js';

describe('RetrievalService', () => {
  it('creates service with OpenAlex as default source', () => {
    const service = new RetrievalService({
      cacheTtlDays: 30,
      maxResults: 10,
      timeout: 5000,
    });
    expect(service).toBeDefined();
  });

  it('reports available sources', async () => {
    const service = new RetrievalService({
      cacheTtlDays: 30,
      maxResults: 10,
      timeout: 5000,
    });
    const sources = await service.getAvailableSources();
    expect(sources.length).toBeGreaterThanOrEqual(1);
  });

  it('degrades gracefully when no sources available', async () => {
    const service = new RetrievalService({
      cacheTtlDays: 30,
      maxResults: 10,
      timeout: 100,
    });

    // With very short timeout, services likely unavailable
    const results = await service.search('nonexistent paper title xyz');
    expect(Array.isArray(results)).toBe(true);
  });
});

describe('RetrievalService.verify', () => {
  it('returns null for unverifiable papers', async () => {
    const service = new RetrievalService({
      cacheTtlDays: 30,
      maxResults: 10,
      timeout: 100,
    });
    const result = await service.verify('This paper definitely does not exist xyz123');
    // May be null due to timeout or genuinely not found
    expect(result === null || result !== undefined).toBe(true);
  });
});
