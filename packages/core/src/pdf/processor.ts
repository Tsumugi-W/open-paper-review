import { createHash } from 'crypto';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { PaperArtifact, ProcessingLimits, PageArtifact, TextBlock, FigureRef, ParsedReference, SectionIndex } from './types.js';
import { extractText, type PageText } from './text-extractor.js';
import { renderPages } from './page-renderer.js';
import { ocrPage, compareWithTextLayer } from './ocr.js';
import { parseSections, identifyAbstract, identifyReferencesStart } from './section-parser.js';
import { parseReferences } from './reference-parser.js';
import { extractFigures } from './figure-extractor.js';

const DEFAULT_LIMITS: ProcessingLimits = { maxFileSizeMb: 50, maxPages: 100 };

/** Minimum characters on a page to consider it as having valid text */
const LOW_TEXT_THRESHOLD = 50;

/**
 * Dependency interface for injecting bindings at runtime.
 * Enables testing without actual poppler/tesseract installations.
 */
export interface ProcessorDeps {
  extractText: (buffer: Buffer) => Promise<PageText[]>;
  renderPages: (pdfPath: string, outputDir: string, dpi?: number) => Promise<string[]>;
  ocrPage: (imagePath: string) => Promise<{ text: string; confidence: number }>;
  compareWithTextLayer: (ocrText: string, pdfText: string) => { discrepancy: boolean; ratio: number };
}

const DEFAULT_DEPS: ProcessorDeps = {
  extractText,
  renderPages,
  ocrPage,
  compareWithTextLayer,
};

export class PdfProcessor {
  private limits: ProcessingLimits;
  private deps: ProcessorDeps;

  constructor(limits?: Partial<ProcessingLimits>, deps?: Partial<ProcessorDeps>) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.deps = { ...DEFAULT_DEPS, ...deps };
  }

  async process(filePath: string, fileBuffer: Buffer): Promise<PaperArtifact> {
    this.validateSize(fileBuffer);
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex');

    const pages = await this.extractPages(filePath, fileBuffer);
    if (pages.length > this.limits.maxPages) {
      throw new PdfProcessingError('PAGE_LIMIT_EXCEEDED', `PDF has ${pages.length} pages, limit is ${this.limits.maxPages}`);
    }

    const sections = this.buildSectionIndex(pages);
    const chunks = this.buildChunks(pages, sections);
    const figures = this.extractFigureRefs(pages);
    const references = this.extractReferences(pages);
    const { title, authors, abstract } = this.extractMetadata(pages);

    return {
      fileHash,
      parserVersion: '0.1.0',
      title,
      authors,
      abstract,
      pageCount: pages.length,
      pages,
      chunks,
      figures,
      references,
      sections,
    };
  }

  private validateSize(buffer: Buffer): void {
    const sizeMb = buffer.length / (1024 * 1024);
    if (sizeMb > this.limits.maxFileSizeMb) {
      throw new PdfProcessingError('FILE_TOO_LARGE', `File is ${sizeMb.toFixed(1)}MB, limit is ${this.limits.maxFileSizeMb}MB`);
    }
  }

  private async extractPages(_filePath: string, buffer: Buffer): Promise<PageArtifact[]> {
    // Step 1: Extract text layer using PDF.js
    const textPages = await this.deps.extractText(buffer);

    if (textPages.length > this.limits.maxPages) {
      throw new PdfProcessingError('PAGE_LIMIT_EXCEEDED', `PDF has ${textPages.length} pages, limit is ${this.limits.maxPages}`);
    }

    // Step 2: Render pages to images (for OCR and figure extraction)
    // Write the buffer to a temp file to avoid TOCTOU issues with filePath
    let tmpDir: string | null = null;
    let imagePaths: string[] = [];

    try {
      tmpDir = await mkdtemp(join(tmpdir(), 'opr-pdf-'));
      const tmpPdfPath = join(tmpDir, 'input.pdf');
      await writeFile(tmpPdfPath, buffer);
      imagePaths = await this.deps.renderPages(tmpPdfPath, tmpDir);
    } catch (err: unknown) {
      // Non-fatal: we can still work without images
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`Warning: Page rendering failed: ${message}`);
    }

    // Step 3: Build page artifacts, running OCR where needed
    const pageArtifacts: PageArtifact[] = [];

    try {
      for (let i = 0; i < textPages.length; i++) {
        const textPage = textPages[i];
        const imagePath = imagePaths[i] ?? '';
        const pdfTextContent = textPage.text;
        const hasLowText = pdfTextContent.trim().length < LOW_TEXT_THRESHOLD;

        let ocrContent: string | null = null;
        let hasOcrDiscrepancy = false;

        // Run OCR if: page has low text content (possibly scanned) and image is available
        if (hasLowText && imagePath) {
          try {
            const ocrResult = await this.deps.ocrPage(imagePath);
            ocrContent = ocrResult.text;
            // Compare OCR with PDF text layer to detect discrepancies
            // Even empty text layers are considered a discrepancy if OCR finds text
            const comparison = this.deps.compareWithTextLayer(ocrResult.text, pdfTextContent);
            hasOcrDiscrepancy = comparison.discrepancy;
          } catch (err: unknown) {
            // OCR failure is non-fatal
            const message = err instanceof Error ? err.message : String(err);
            console.warn(`Warning: OCR failed for page ${textPage.pageNumber}: ${message}`);
          }
        }

        // Convert text items to TextBlock format
        const textCoordinates: TextBlock[] = textPage.textItems.map(item => ({
          text: item.str,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          fontSize: item.fontSize,
          isVisible: true,
        }));

        // Use OCR text as primary content for scanned pages (low/no text layer)
        // but preserve the original PDF text in the coordinates
        const effectiveText = (hasLowText && ocrContent) ? ocrContent : pdfTextContent;

        pageArtifacts.push({
          pageNumber: textPage.pageNumber,
          textContent: effectiveText,
          ocrContent,
          imagePath: '', // Image paths are transient (temp dir); set empty for artifact
          textCoordinates,
          hasOcrDiscrepancy,
        });
      }
    } finally {
      // Cleanup temp directory after OCR is complete
      if (tmpDir) {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    }

    return pageArtifacts;
  }

  private buildSectionIndex(pages: PageArtifact[]): SectionIndex[] {
    // Convert PageArtifact to PageText format for the section parser
    const pageTexts: PageText[] = pages.map(p => ({
      pageNumber: p.pageNumber,
      text: p.textContent,
      textItems: p.textCoordinates.map(tc => ({
        str: tc.text,
        x: tc.x,
        y: tc.y,
        width: tc.width,
        height: tc.height,
        fontSize: tc.fontSize,
        fontName: 'unknown',
      })),
    }));

    const sections = parseSections(pageTexts);
    return sections.map(s => ({
      title: s.title,
      level: s.level,
      startPage: s.startPage,
      startOffset: s.startOffset,
    }));
  }

  private buildChunks(pages: PageArtifact[], sections: SectionIndex[]) {
    const chunks: { index: number; sectionTitle: string; content: string; startPage: number; endPage: number }[] = [];

    for (let i = 0; i < sections.length; i++) {
      const start = sections[i];
      const end = sections[i + 1];
      const startPage = start.startPage;
      const endPage = end ? end.startPage : pages.length;

      const content = pages
        .filter(p => p.pageNumber >= startPage && p.pageNumber <= endPage)
        .map(p => p.textContent)
        .join('\n');

      chunks.push({
        index: i,
        sectionTitle: start.title,
        content: content.slice(0, 8000),
        startPage,
        endPage,
      });
    }
    return chunks;
  }

  private extractFigureRefs(pages: PageArtifact[]): FigureRef[] {
    const pageTexts: PageText[] = pages.map(p => ({
      pageNumber: p.pageNumber,
      text: p.textContent,
      textItems: [],
    }));

    const figures = extractFigures(pageTexts);

    return figures.map(fig => ({
      id: fig.id,
      type: fig.type,
      caption: fig.caption,
      pageNumber: fig.captionPage,
      boundingBox: { x: 0, y: 0, width: 0, height: 0 },
      textReferences: fig.textReferences.map(r => r.pageNumber),
    }));
  }

  private extractReferences(pages: PageArtifact[]): ParsedReference[] {
    const pageTexts: PageText[] = pages.map(p => ({
      pageNumber: p.pageNumber,
      text: p.textContent,
      textItems: [],
    }));

    const refStart = identifyReferencesStart(pageTexts);
    if (!refStart) {
      // Fall back: try to find references section by splitting on "References"
      const fullText = pages.map(p => p.textContent).join('\n');
      const parts = fullText.split(/\bReferences\b/i);
      // Only use fallback if "References" was actually found (split produced >1 part)
      if (parts.length <= 1) {
        return [];
      }
      const refSection = parts[parts.length - 1];
      return parseReferences(refSection).map(r => ({
        index: r.index,
        rawText: r.rawText,
        title: r.title,
        authors: r.authors,
        year: r.year,
        doi: r.doi,
      }));
    }

    // Extract text from references section start to end
    const refPages = pages.filter(p => p.pageNumber >= refStart.pageNumber);
    let refText = '';
    for (const page of refPages) {
      if (page.pageNumber === refStart.pageNumber) {
        const lines = page.textContent.split('\n');
        refText += lines.slice(refStart.lineOffset + 1).join('\n') + '\n';
      } else {
        refText += page.textContent + '\n';
      }
    }

    return parseReferences(refText).map(r => ({
      index: r.index,
      rawText: r.rawText,
      title: r.title,
      authors: r.authors,
      year: r.year,
      doi: r.doi,
    }));
  }

  private extractMetadata(pages: PageArtifact[]) {
    const pageTexts: PageText[] = pages.slice(0, 2).map(p => ({
      pageNumber: p.pageNumber,
      text: p.textContent,
      textItems: [],
    }));

    const abstractResult = identifyAbstract(pageTexts);
    const firstPage = pages[0]?.textContent ?? '';
    const lines = firstPage.split('\n').filter(l => l.trim());

    return {
      title: lines[0]?.trim() ?? 'Untitled',
      authors: lines[1]?.split(/[,;]/).map(a => a.trim()).filter(Boolean) ?? [],
      abstract: abstractResult?.text ?? this.extractAbstractFallback(firstPage),
    };
  }

  private extractAbstractFallback(text: string): string {
    const match = text.match(/\bAbstract\b[.\s:]*(.+?)(?=\n\s*\n|\b(?:Introduction|1\.?\s))/is);
    return match ? match[1].trim().slice(0, 2000) : '';
  }
}

export class PdfProcessingError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'PdfProcessingError';
  }
}
