export interface ExtractedReference {
  index: number;
  rawText: string;
  title: string | null;
  authors: string[];
  year: number | null;
  doi: string | null;
  style: 'numbered' | 'author-year' | 'unknown';
}

// DOI pattern: 10.xxxx/...
const DOI_PATTERN = /\b(10\.\d{4,}\/[^\s,;)\]]+)/g;

// Year pattern: (19xx) or (20xx) standalone
const YEAR_PATTERN = /\b((?:19|20)\d{2})\b/;

/**
 * Parse references from the references section text.
 * Handles:
 * - [1] numbered style
 * - (Author, Year) / Author (Year) style
 * - Numbered bibliography without brackets (1. Author, ...)
 */
export function parseReferences(text: string): ExtractedReference[] {
  if (!text || text.trim().length === 0) return [];

  // Try numbered [N] style first
  const numberedRefs = parseNumberedBracket(text);
  if (numberedRefs.length > 0) return numberedRefs;

  // Try numbered "N." style
  const dotNumberedRefs = parseDotNumbered(text);
  if (dotNumberedRefs.length > 0) return dotNumberedRefs;

  // Fallback: try author-year style (line-based splitting)
  return parseAuthorYear(text);
}

/**
 * Parse [1] Author, Title... style references.
 */
function parseNumberedBracket(text: string): ExtractedReference[] {
  const results: ExtractedReference[] = [];
  // Match [N] followed by text until the next [N] or end
  const pattern = /\[(\d+)\]\s*([\s\S]*?)(?=\[\d+\]|$)/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const index = parseInt(match[1], 10);
    const rawText = match[2].trim().replace(/\s+/g, ' ');
    if (!rawText) continue;

    results.push({
      index,
      rawText,
      ...extractMetadataFromRaw(rawText),
      style: 'numbered',
    });
  }

  return results;
}

/**
 * Parse "1. Author, Title..." style references.
 */
function parseDotNumbered(text: string): ExtractedReference[] {
  const results: ExtractedReference[] = [];
  const pattern = /(?:^|\n)\s*(\d+)\.\s+([\s\S]*?)(?=\n\s*\d+\.\s|$)/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const index = parseInt(match[1], 10);
    const rawText = match[2].trim().replace(/\s+/g, ' ');
    if (!rawText) continue;

    results.push({
      index,
      rawText,
      ...extractMetadataFromRaw(rawText),
      style: 'numbered',
    });
  }

  return results;
}

/**
 * Parse author-year style references (line-based).
 * Each reference typically starts with author names and ends with a year.
 */
function parseAuthorYear(text: string): ExtractedReference[] {
  const results: ExtractedReference[] = [];

  // Split on blank-line or detect line patterns starting with uppercase
  const entries = text.split(/\n\s*\n/).filter(e => e.trim().length > 20);

  for (let i = 0; i < entries.length; i++) {
    const rawText = entries[i].trim().replace(/\s+/g, ' ');

    results.push({
      index: i + 1,
      rawText,
      ...extractMetadataFromRaw(rawText),
      style: 'author-year',
    });
  }

  return results;
}

/**
 * Extract metadata (year, DOI, partial title, authors) from raw reference text.
 */
function extractMetadataFromRaw(rawText: string): {
  title: string | null;
  authors: string[];
  year: number | null;
  doi: string | null;
} {
  // Extract DOI
  const doiMatch = rawText.match(DOI_PATTERN);
  const doi = doiMatch ? doiMatch[0] : null;

  // Extract year
  const yearMatch = rawText.match(YEAR_PATTERN);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  // Attempt to extract title — heuristic: text between first period/comma and next period
  // after author names, often in quotes or italics
  let title: string | null = null;

  // Try quoted title first
  const quotedTitle = rawText.match(/[""“]([^""”]+)[""”]/);
  if (quotedTitle) {
    title = quotedTitle[1].trim();
  } else {
    // Heuristic: after first ". " or ", " that follows the year or author block,
    // take text up to the next period
    const afterAuthors = rawText.match(/(?:\.\s+|\,\s+(?:\d{4}\b[.,]?\s*))([A-Z][^.]{10,})\./);
    if (afterAuthors) {
      title = afterAuthors[1].trim();
    }
  }

  // Extract authors — text before the year or before the first period
  const authors: string[] = [];
  const authorPart = rawText.split(/\(\d{4}\)|,?\s*\d{4}\b/)[0] ?? '';
  const authorCandidates = authorPart.split(/,\s*(?:and\s+)?|;\s*|\s+and\s+/i);
  for (const candidate of authorCandidates) {
    const trimmed = candidate.trim();
    // Basic name validation: has at least 2 chars and contains a letter
    if (trimmed.length >= 2 && /[A-Za-z]/.test(trimmed) && trimmed.length < 60) {
      authors.push(trimmed);
    }
  }

  return { title, authors, year, doi };
}
