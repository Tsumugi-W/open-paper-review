import type { PageText } from './text-extractor.js';

export interface SectionEntry {
  title: string;
  level: number;
  startPage: number;
  startOffset: number;
  numbering: string | null;
}

// Known unnumbered section headings commonly found in academic papers
const KNOWN_SECTIONS = new Set([
  'abstract',
  'introduction',
  'background',
  'related work',
  'methodology',
  'methods',
  'method',
  'materials and methods',
  'experiments',
  'experimental setup',
  'results',
  'discussion',
  'conclusion',
  'conclusions',
  'future work',
  'acknowledgments',
  'acknowledgements',
  'references',
  'bibliography',
  'appendix',
  'supplementary material',
]);

// Pattern for numbered sections: 1. Introduction, 2.1 Method, 3.2.1 Sub-detail
const NUMBERED_HEADING = /^(\d+(?:\.\d+)*\.?)\s+([A-Z][A-Za-z\s&:,\-]+)$/;

// Pattern for unnumbered sections that match known headings
const UNNUMBERED_HEADING = /^([A-Z][A-Za-z\s&:,\-]+)$/;

/**
 * Parse academic paper sections from extracted page text.
 * Handles both numbered (1. Introduction, 2.1 Method) and unnumbered (Abstract, References) sections.
 */
export function parseSections(pages: PageText[]): SectionEntry[] {
  const sections: SectionEntry[] = [];

  for (const page of pages) {
    const lines = page.text.split('\n');

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx].trim();
      if (!line || line.length > 100) continue; // Skip empty lines and overly long lines (not headings)

      // Try numbered heading first
      const numberedMatch = line.match(NUMBERED_HEADING);
      if (numberedMatch) {
        const numbering = numberedMatch[1].replace(/\.$/, ''); // remove trailing dot
        const level = numbering.split('.').filter(Boolean).length;
        sections.push({
          title: line,
          level,
          startPage: page.pageNumber,
          startOffset: lineIdx,
          numbering,
        });
        continue;
      }

      // Try unnumbered heading (only if it matches a known section name)
      const unnumberedMatch = line.match(UNNUMBERED_HEADING);
      if (unnumberedMatch) {
        const normalized = unnumberedMatch[1].toLowerCase().trim();
        if (KNOWN_SECTIONS.has(normalized)) {
          sections.push({
            title: line,
            level: 1,
            startPage: page.pageNumber,
            startOffset: lineIdx,
            numbering: null,
          });
        }
      }
    }
  }

  return sections;
}

/**
 * Identify the abstract section boundaries.
 * Returns the abstract text if found, or null.
 */
export function identifyAbstract(pages: PageText[]): { text: string; startPage: number; endOffset: number } | null {
  if (pages.length === 0) return null;

  const firstPages = pages.slice(0, 2); // Abstract is typically on first 1-2 pages
  const fullText = firstPages.map(p => p.text).join('\n');

  // Look for explicit "Abstract" heading
  const abstractMatch = fullText.match(
    /\bAbstract\b[.\s:]*\n?([\s\S]+?)(?=\n\s*(?:\d+\.?\s+)?(?:Introduction|Keywords|1\s)|$)/i,
  );

  if (abstractMatch) {
    const abstractText = abstractMatch[1].trim();
    // Determine which page it's on
    let startPage = 1;
    const abstractPos = fullText.indexOf(abstractMatch[0]);
    let offset = 0;
    for (const p of firstPages) {
      if (offset + p.text.length > abstractPos) {
        startPage = p.pageNumber;
        break;
      }
      offset += p.text.length + 1;
    }

    return {
      text: abstractText.slice(0, 2000),
      startPage,
      endOffset: abstractPos + abstractMatch[0].length,
    };
  }

  return null;
}

/**
 * Find the start of the references section.
 * Returns the page number and line offset, or null if not found.
 */
export function identifyReferencesStart(pages: PageText[]): { pageNumber: number; lineOffset: number } | null {
  // Search from the end of the document (references are typically near the end)
  for (let i = pages.length - 1; i >= 0; i--) {
    const page = pages[i];
    const lines = page.text.split('\n');

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx].trim();
      if (/^(?:\d+\.?\s+)?References$/i.test(line) || /^Bibliography$/i.test(line)) {
        return { pageNumber: page.pageNumber, lineOffset: lineIdx };
      }
    }
  }
  return null;
}
