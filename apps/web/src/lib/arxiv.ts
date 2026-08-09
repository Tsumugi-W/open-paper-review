const ARXIV_PDF_BASE = "https://arxiv.org/pdf/";
const ARXIV_API_BASE = "https://export.arxiv.org/api/query";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MiB
const MAX_REDIRECTS = 3;
const DOWNLOAD_TIMEOUT_MS = 60000; // 60 seconds

// SSRF protection: block private/internal IPs
const BLOCKED_HOSTS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^fc00:/,
  /^fe80:/,
  /^::1$/,
  /^localhost$/i,
];

function isBlockedHost(hostname: string): boolean {
  return BLOCKED_HOSTS.some((pattern) => pattern.test(hostname));
}

export interface ArxivMetadata {
  title: string;
  authors: string[];
  abstract: string;
  publishedDate: string;
}

/**
 * Fetch paper metadata from the arXiv API.
 */
async function fetchArxivMetadata(arxivId: string): Promise<ArxivMetadata> {
  const url = `${ARXIV_API_BASE}?id_list=${encodeURIComponent(arxivId)}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`arXiv API returned ${res.status}`);
  }

  const xml = await res.text();

  // Simple XML parsing for the fields we need
  const title = xml.match(/<title>([\s\S]*?)<\/title>/g)?.[1]
    ?.replace(/<\/?title>/g, "")
    .replace(/\s+/g, " ")
    .trim() ?? "Untitled";

  const authorMatches = xml.matchAll(/<name>(.*?)<\/name>/g);
  const authors = Array.from(authorMatches, (m) => m[1]);

  const abstract = xml.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]
    ?.replace(/\s+/g, " ")
    .trim() ?? "";

  const publishedDate = xml.match(/<published>(.*?)<\/published>/)?.[1] ?? "";

  return { title, authors, abstract, publishedDate };
}

/**
 * Download a paper PDF from arXiv with SSRF protection.
 */
export async function downloadArxivPaper(arxivId: string): Promise<{
  buffer: Buffer;
  metadata: ArxivMetadata;
}> {
  // Fetch metadata first
  const metadata = await fetchArxivMetadata(arxivId);

  // Download PDF
  let url = `${ARXIV_PDF_BASE}${encodeURIComponent(arxivId)}.pdf`;
  let redirectCount = 0;

  while (redirectCount <= MAX_REDIRECTS) {
    const parsedUrl = new URL(url);

    // SSRF protection
    if (isBlockedHost(parsedUrl.hostname)) {
      throw new Error("Download blocked: internal/private address detected");
    }

    // Only allow HTTPS
    if (parsedUrl.protocol !== "https:") {
      throw new Error("Download blocked: only HTTPS is allowed");
    }

    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });

    // Handle redirects manually for SSRF protection
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Redirect without Location header");
      url = new URL(location, url).toString();
      redirectCount++;
      continue;
    }

    if (!res.ok) {
      throw new Error(`arXiv download failed with status ${res.status}`);
    }

    // Check content length before downloading
    const contentLength = parseInt(res.headers.get("content-length") ?? "0", 10);
    if (contentLength > MAX_FILE_SIZE) {
      throw new Error(`File size ${(contentLength / 1024 / 1024).toFixed(1)}MiB exceeds limit`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`Downloaded file exceeds ${MAX_FILE_SIZE / 1024 / 1024}MiB limit`);
    }

    return { buffer, metadata };
  }

  throw new Error(`Too many redirects (max ${MAX_REDIRECTS})`);
}
