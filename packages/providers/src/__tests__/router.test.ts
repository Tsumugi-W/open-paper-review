import { describe, it, expect, vi } from 'vitest';
import { ProviderRouter } from '../router.js';
import type { ProviderAdapter } from '../types.js';

function mockProvider(name: string, capabilities: Partial<ProviderAdapter['capabilities']> = {}): ProviderAdapter {
  return {
    name,
    capabilities: {
      nativePdf: false,
      vision: true,
      structuredOutput: true,
      fileUpload: false,
      maxContextLength: 128000,
      maxOutputTokens: 4096,
      ...capabilities,
    },
    generateText: vi.fn().mockResolvedValue({
      text: 'response',
      usage: { inputTokens: 100, outputTokens: 50, cachedTokens: 0 },
      finishReason: 'stop',
    }),
    generateStructured: vi.fn().mockResolvedValue({
      data: {},
      usage: { inputTokens: 100, outputTokens: 50, cachedTokens: 0 },
      finishReason: 'stop',
    }),
    analyzeDocument: vi.fn().mockResolvedValue({
      text: 'analysis',
      usage: { inputTokens: 200, outputTokens: 100, cachedTokens: 0 },
      finishReason: 'stop',
    }),
    deleteRemoteArtifact: vi.fn().mockResolvedValue(undefined),
  } as unknown as ProviderAdapter;
}

describe('ProviderRouter', () => {
  it('selects provider with required capabilities', () => {
    const openai = mockProvider('openai', { nativePdf: false, vision: true });
    const anthropic = mockProvider('anthropic', { nativePdf: true, vision: true });

    const router = new ProviderRouter([openai, anthropic]);
    const selected = router.selectForCapabilities({ nativePdf: true });
    expect(selected?.name).toBe('anthropic');
  });

  it('falls back when primary lacks capability', () => {
    const openai = mockProvider('openai', { nativePdf: false });
    const anthropic = mockProvider('anthropic', { nativePdf: true });

    const router = new ProviderRouter([openai, anthropic]);
    const selected = router.selectForCapabilities({ nativePdf: true });
    expect(selected?.name).toBe('anthropic');
  });

  it('returns null when no provider matches', () => {
    const openai = mockProvider('openai', { nativePdf: false, vision: false });

    const router = new ProviderRouter([openai]);
    const selected = router.selectForCapabilities({ nativePdf: true, vision: true });
    expect(selected).toBeNull();
  });

  it('respects context length requirements', () => {
    const small = mockProvider('small', { maxContextLength: 8000 });
    const large = mockProvider('large', { maxContextLength: 200000 });

    const router = new ProviderRouter([small, large]);
    const selected = router.selectForContextLength(100000);
    expect(selected?.name).toBe('large');
  });
});
