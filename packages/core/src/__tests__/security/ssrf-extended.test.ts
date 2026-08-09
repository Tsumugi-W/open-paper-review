import { describe, it, expect } from 'vitest';
import { SsrfGuard } from '../../security/ssrf.js';

describe('SSRF Extended Security Tests', () => {
  const guard = new SsrfGuard();

  describe('URL bypass attempts', () => {
    it('blocks localhost variants', () => {
      expect(guard.validateUrl('http://localhost/payload').valid).toBe(false);
      expect(guard.validateUrl('http://LOCALHOST/payload').valid).toBe(false);
      expect(guard.validateUrl('http://127.0.0.1/payload').valid).toBe(false);
      expect(guard.validateUrl('http://127.0.0.255/payload').valid).toBe(false);
      expect(guard.validateUrl('http://0.0.0.0/payload').valid).toBe(false);
    });

    it('blocks internal network ranges', () => {
      expect(guard.validateUrl('http://10.0.0.1/internal').valid).toBe(false);
      expect(guard.validateUrl('http://10.255.255.255/internal').valid).toBe(false);
      expect(guard.validateUrl('http://172.16.0.1/internal').valid).toBe(false);
      expect(guard.validateUrl('http://172.31.255.255/internal').valid).toBe(false);
      expect(guard.validateUrl('http://192.168.0.1/internal').valid).toBe(false);
      expect(guard.validateUrl('http://192.168.255.255/internal').valid).toBe(false);
    });

    it('blocks IPv6 private addresses', () => {
      expect(guard.validateUrl('http://[::1]/payload').valid).toBe(false);
      expect(guard.validateUrl('http://[fc00::1]/payload').valid).toBe(false);
      expect(guard.validateUrl('http://[fe80::1]/payload').valid).toBe(false);
    });

    it('blocks link-local addresses', () => {
      expect(guard.validateUrl('http://169.254.169.254/latest/meta-data').valid).toBe(false);
    });

    it('blocks non-HTTP protocols', () => {
      expect(guard.validateUrl('file:///etc/passwd').valid).toBe(false);
      expect(guard.validateUrl('ftp://arxiv.org/paper.pdf').valid).toBe(false);
      expect(guard.validateUrl('gopher://evil.com/payload').valid).toBe(false);
      expect(guard.validateUrl('dict://evil.com/payload').valid).toBe(false);
    });

    it('blocks arbitrary hosts not in allowlist', () => {
      expect(guard.validateUrl('https://evil.com/payload').valid).toBe(false);
      expect(guard.validateUrl('https://arxiv.org.evil.com/pdf').valid).toBe(false);
      expect(guard.validateUrl('https://notarxiv.org/pdf').valid).toBe(false);
    });

    it('rejects malformed URLs', () => {
      expect(guard.validateUrl('').valid).toBe(false);
      expect(guard.validateUrl('not-a-url').valid).toBe(false);
      expect(guard.validateUrl('://missing-scheme').valid).toBe(false);
      expect(guard.validateUrl('http://').valid).toBe(false);
    });
  });

  describe('Allowed URLs', () => {
    it('allows legitimate arXiv URLs', () => {
      expect(guard.validateUrl('https://arxiv.org/pdf/2301.00001v1').valid).toBe(true);
      expect(guard.validateUrl('https://arxiv.org/abs/2301.00001').valid).toBe(true);
      expect(guard.validateUrl('https://export.arxiv.org/pdf/2301.00001').valid).toBe(true);
      expect(guard.validateUrl('https://www.arxiv.org/pdf/2301.00001').valid).toBe(true);
    });
  });

  describe('Path traversal in URLs', () => {
    it('does not allow path traversal to change effective host', () => {
      // These should be allowed by host check but don't traverse
      const result = guard.validateUrl('https://arxiv.org/../../etc/passwd');
      expect(result.valid).toBe(true); // Host is valid; path traversal is server-side concern
    });
  });
});
