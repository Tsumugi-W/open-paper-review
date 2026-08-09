import { describe, it, expect } from 'vitest';
import { SsrfGuard } from '../security/ssrf.js';

describe('SsrfGuard', () => {
  const guard = new SsrfGuard();

  describe('validateUrl', () => {
    it('allows arxiv.org URLs', () => {
      expect(guard.validateUrl('https://arxiv.org/pdf/2301.00001v1').valid).toBe(true);
      expect(guard.validateUrl('https://export.arxiv.org/pdf/2301.00001').valid).toBe(true);
    });

    it('blocks non-allowlisted hosts', () => {
      const result = guard.validateUrl('https://evil.com/payload');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not in allowlist');
    });

    it('blocks private IP addresses', () => {
      expect(guard.validateUrl('http://127.0.0.1/file').valid).toBe(false);
      expect(guard.validateUrl('http://10.0.0.1/file').valid).toBe(false);
      expect(guard.validateUrl('http://192.168.1.1/file').valid).toBe(false);
      expect(guard.validateUrl('http://172.16.0.1/file').valid).toBe(false);
    });

    it('blocks non-http protocols', () => {
      expect(guard.validateUrl('file:///etc/passwd').valid).toBe(false);
      expect(guard.validateUrl('ftp://arxiv.org/file').valid).toBe(false);
    });

    it('rejects invalid URLs', () => {
      expect(guard.validateUrl('not-a-url').valid).toBe(false);
      expect(guard.validateUrl('').valid).toBe(false);
    });
  });
});
