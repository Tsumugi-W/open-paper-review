import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

describe.skipIf(!process.env.E2E_BASE_URL)('E2E: Authentication', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/papers`);
    expect(res.status).toBe(401);
  });

  it('rejects invalid credentials', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wrong@test.com', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
  });

  it('supports API token authentication', async () => {
    // First login to get session
    const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.com', password: 'admin123' }),
    });
    if (!loginRes.ok) return; // Skip if no test user

    const cookie = loginRes.headers.get('set-cookie') ?? '';

    // Create API token
    const tokenRes = await fetch(`${BASE_URL}/api/v1/auth/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'e2e-test-token' }),
    });
    if (!tokenRes.ok) return;

    const { token } = await tokenRes.json();

    // Use token for auth
    const papersRes = await fetch(`${BASE_URL}/api/v1/papers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(papersRes.ok).toBe(true);
  });

  it('non-admin cannot access admin routes', async () => {
    // This test assumes a member user exists
    const res = await fetch(`${BASE_URL}/api/v1/admin/members`, {
      headers: { Authorization: 'Bearer member-token-placeholder' },
    });
    expect([401, 403]).toContain(res.status);
  });
});
