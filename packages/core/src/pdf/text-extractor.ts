// Use the legacy build which includes a fake worker for Node.js environments
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem as PdfJsTextItem } from 'pdfjs-dist/types/src/display/api.js';
import { PdfProcessingError } from './processor.js';

export interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
}

export interface PageText {
  pageNumber: number;
  text: string;
  textItems: TextItem[];
}

/**
 * Extract text content from a PDF buffer using pdfjs-dist.
 * Handles encrypted PDFs (throws specific error) and damaged PDFs.
 */
export async function extractText(buffer: Buffer): Promise<PageText[]> {
  const data = new Uint8Array(buffer);

  let doc;
  try {
    const loadingTask = getDocument({
      data,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: true,
    });
    doc = await loadingTask.promise;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('encrypted') || message.includes('password')) {
      throw new PdfProcessingError('ENCRYPTED_PDF', 'PDF is encrypted and requires a password');
    }
    throw new PdfProcessingError('PDF_LOAD_FAILED', `Failed to load PDF: ${message}`);
  }

  const pages: PageText[] = [];

  try {
    for (let i = 1; i <= doc.numPages; i++) {
      let page;
      try {
        page = await doc.getPage(i);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        // If a single page is damaged, record it with empty text
        pages.push({ pageNumber: i, text: '', textItems: [] });
        console.warn(`Warning: Could not read page ${i}: ${message}`);
        continue;
      }

      let textContent;
      try {
        textContent = await page.getTextContent();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        pages.push({ pageNumber: i, text: '', textItems: [] });
        console.warn(`Warning: Could not extract text from page ${i}: ${message}`);
        continue;
      }

      const viewport = page.getViewport({ scale: 1.0 });
      const textItems: TextItem[] = [];
      const textParts: string[] = [];

      for (const item of textContent.items) {
        // Skip items that aren't standard text items
        if (!('str' in item)) continue;
        const ti = item as PdfJsTextItem;
        if (!ti.str) continue;

        const tx = ti.transform;
        // transform is [scaleX, skewX, skewY, scaleY, translateX, translateY]
        const fontSize = Math.abs(tx[3]) || Math.abs(tx[0]) || 12;
        const x = tx[4];
        const y = viewport.height - tx[5]; // Convert to top-left origin
        const width = ti.width ?? 0;
        const height = ti.height ?? fontSize;

        textItems.push({
          str: ti.str,
          x,
          y,
          width,
          height,
          fontSize,
          fontName: ti.fontName ?? 'unknown',
        });

        textParts.push(ti.str);
        if (ti.hasEOL) {
          textParts.push('\n');
        }
      }

      pages.push({
        pageNumber: i,
        text: textParts.join(''),
        textItems,
      });
    }
  } finally {
    // Always destroy the document to free resources
    doc.destroy();
  }

  return pages;
}
