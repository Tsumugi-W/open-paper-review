import type { PageText } from './text-extractor.js';

export interface FigureCaption {
  id: string;
  type: 'figure' | 'table';
  number: number;
  caption: string;
  pageNumber: number;
}

export interface FigureReference {
  id: string;
  pageNumber: number;
  offset: number;
}

export interface FigureInfo {
  id: string;
  type: 'figure' | 'table';
  number: number;
  caption: string;
  captionPage: number;
  textReferences: FigureReference[];
}

// Patterns for figure/table captions (typically at the start of a line)
const CAPTION_PATTERN = /(?:^|\n)\s*((?:Figure|Fig\.?|Table|Tab\.?)\s+(\d+))[.:]\s*([^\n]+)/gi;

// Patterns for inline references to figures/tables in body text
const REFERENCE_PATTERN = /(?:Figure|Fig\.?|Table|Tab\.?)\s+(\d+)/gi;

/**
 * Extract figure and table information from parsed page text.
 * Identifies captions and maps where they are referenced in the body text.
 */
export function extractFigures(pages: PageText[]): FigureInfo[] {
  const captions = extractCaptions(pages);
  const references = extractReferences(pages);

  // Combine captions with their references
  const figures: FigureInfo[] = captions.map(cap => {
    const refs = references.filter(ref => ref.id === cap.id);
    return {
      id: cap.id,
      type: cap.type,
      number: cap.number,
      caption: cap.caption,
      captionPage: cap.pageNumber,
      textReferences: refs,
    };
  });

  return figures;
}

/**
 * Extract figure/table captions from pages.
 */
function extractCaptions(pages: PageText[]): FigureCaption[] {
  const captions: FigureCaption[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    CAPTION_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = CAPTION_PATTERN.exec(page.text)) !== null) {
      const prefix = match[1];
      const number = parseInt(match[2], 10);
      const captionText = match[3].trim();
      const type: 'figure' | 'table' = prefix.toLowerCase().startsWith('tab') ? 'table' : 'figure';
      const id = `${type}_${number}`;

      if (!seen.has(id)) {
        seen.add(id);
        captions.push({
          id,
          type,
          number,
          caption: captionText,
          pageNumber: page.pageNumber,
        });
      }
    }
  }

  return captions;
}

/**
 * Find all inline references to figures/tables in the text body.
 */
function extractReferences(pages: PageText[]): FigureReference[] {
  const refs: FigureReference[] = [];

  for (const page of pages) {
    REFERENCE_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = REFERENCE_PATTERN.exec(page.text)) !== null) {
      const prefix = match[0];
      const number = parseInt(match[1], 10);
      const type: 'figure' | 'table' = prefix.toLowerCase().startsWith('tab') ? 'table' : 'figure';
      const id = `${type}_${number}`;

      refs.push({
        id,
        pageNumber: page.pageNumber,
        offset: match.index,
      });
    }
  }

  return refs;
}
