import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

describe.skipIf(!process.env.E2E_BASE_URL)('E2E: Full Review Flow', () => {
  let sessionCookie: string;
  let paperId: string;
  let reviewId: string;

  beforeAll(async () => {
    // Login as admin (assumes setup already completed)
    const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.com', password: 'admin123' }),
    });
    expect(loginRes.ok).toBe(true);
    sessionCookie = loginRes.headers.get('set-cookie') ?? '';
  });

  it('uploads a paper', async () => {
    const formData = new FormData();
    formData.append('title', 'E2E Test Paper');
    formData.append('file', new Blob(['%PDF-1.4 fake content'], { type: 'application/pdf' }), 'test.pdf');

    const res = await fetch(`${BASE_URL}/api/v1/papers`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
      body: formData,
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    paperId = data.id;
    expect(paperId).toBeTruthy();
  });

  it('lists papers', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/papers`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.data.length).toBeGreaterThan(0);
  });

  it('gets paper detail', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/papers/${paperId}`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.title).toBe('E2E Test Paper');
  });

  it('creates a review job', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({
        paperId,
        venueBundleId: 'neurips/main/2026/v1',
        language: 'en',
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    reviewId = data.id;
    expect(reviewId).toBeTruthy();
  });

  it('gets review status', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/reviews/${reviewId}`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(['pending', 'processing', 'completed', 'failed']).toContain(data.status);
  });

  it('connects to SSE events', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/reviews/${reviewId}/events`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.ok).toBe(true);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    // Read first event
    const reader = res.body?.getReader();
    if (reader) {
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      expect(text).toContain('data:');
      reader.cancel();
    }
  });

  it('cancels a review', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/reviews/${reviewId}/cancel`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
    });
    expect(res.ok).toBe(true);
  });

  it('exports review as JSON', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/reviews/${reviewId}/export?format=json`, {
      headers: { Cookie: sessionCookie },
    });
    // May be 404 if review not completed yet
    expect([200, 404]).toContain(res.status);
  });

  it('exports review as Markdown', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/reviews/${reviewId}/export?format=markdown`, {
      headers: { Cookie: sessionCookie },
    });
    expect([200, 404]).toContain(res.status);
  });

  it('lists venues', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/venues`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(13);
  });

  it('deletes a paper and cascades', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/papers/${paperId}`, {
      method: 'DELETE',
      headers: { Cookie: sessionCookie },
    });
    expect(res.ok).toBe(true);

    // Verify gone
    const getRes = await fetch(`${BASE_URL}/api/v1/papers/${paperId}`, {
      headers: { Cookie: sessionCookie },
    });
    expect(getRes.status).toBe(404);
  });

  it('rejects unauthorized access', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/papers`);
    expect(res.status).toBe(401);
  });
});
