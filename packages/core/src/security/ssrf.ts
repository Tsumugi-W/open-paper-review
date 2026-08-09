const ALLOWED_HOSTS = new Set([
  'arxiv.org',
  'export.arxiv.org',
  'www.arxiv.org',
]);

const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^fc00:/i,
  /^fe80:/i,
  /^::1$/,
  /^localhost$/i,
];

const MAX_REDIRECTS = 3;
const MAX_RESPONSE_SIZE = 100 * 1024 * 1024; // 100MB
const REQUEST_TIMEOUT = 30000;

export class SsrfGuard {
  validateUrl(url: string): { valid: boolean; reason?: string } {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { valid: false, reason: 'Invalid URL' };
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, reason: `Protocol ${parsed.protocol} not allowed` };
    }

    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return { valid: false, reason: `Host ${parsed.hostname} not in allowlist` };
    }

    for (const pattern of PRIVATE_RANGES) {
      if (pattern.test(parsed.hostname)) {
        return { valid: false, reason: 'Private/internal addresses blocked' };
      }
    }

    return { valid: true };
  }

  async safeFetch(url: string): Promise<Response> {
    const check = this.validateUrl(url);
    if (!check.valid) {
      throw new SsrfError(check.reason ?? 'URL validation failed');
    }

    let currentUrl = url;
    let redirectCount = 0;

    while (redirectCount < MAX_REDIRECTS) {
      const response = await fetch(currentUrl, {
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        headers: {
          'User-Agent': 'OpenPaperReview/0.1',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new SsrfError('Redirect without location header');

        const redirectUrl = new URL(location, currentUrl).toString();
        const redirectCheck = this.validateUrl(redirectUrl);
        if (!redirectCheck.valid) {
          throw new SsrfError(`Redirect to blocked URL: ${redirectCheck.reason}`);
        }

        currentUrl = redirectUrl;
        redirectCount++;
        continue;
      }

      const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10);
      if (contentLength > MAX_RESPONSE_SIZE) {
        throw new SsrfError(`Response too large: ${contentLength} bytes`);
      }

      return response;
    }

    throw new SsrfError(`Too many redirects (${MAX_REDIRECTS})`);
  }
}

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}
