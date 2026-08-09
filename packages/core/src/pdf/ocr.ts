import Tesseract from 'tesseract.js';

export interface OcrResult {
  imagePath: string;
  text: string;
  confidence: number;
}

const MAX_CONCURRENCY = 2;

/**
 * Perform OCR on a single page image.
 */
export async function ocrPage(imagePath: string): Promise<{ text: string; confidence: number }> {
  const { data } = await Tesseract.recognize(imagePath, 'eng', {
    logger: () => {}, // suppress progress logs
  });

  return {
    text: data.text,
    confidence: data.confidence,
  };
}

/**
 * Perform OCR on multiple page images with limited concurrency.
 */
export async function ocrPages(imagePaths: string[]): Promise<OcrResult[]> {
  const results: OcrResult[] = [];
  const queue = [...imagePaths];

  // Process in batches of MAX_CONCURRENCY
  while (queue.length > 0) {
    const batch = queue.splice(0, MAX_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (imagePath) => {
        const { text, confidence } = await ocrPage(imagePath);
        return { imagePath, text, confidence };
      }),
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Compare OCR text with the PDF text layer to detect discrepancies.
 * This helps identify pages where the text layer may be inaccurate (e.g., scanned pages
 * with a bad text layer overlay, or OCR artifacts from the PDF producer).
 *
 * Returns a discrepancy flag and a similarity ratio (0 = completely different, 1 = identical).
 */
export function compareWithTextLayer(
  ocrText: string,
  pdfText: string,
): { discrepancy: boolean; ratio: number } {
  // Normalize both texts for comparison
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[\s\r\n]+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();

  const normOcr = normalize(ocrText);
  const normPdf = normalize(pdfText);

  if (normOcr.length === 0 && normPdf.length === 0) {
    return { discrepancy: false, ratio: 1 };
  }

  if (normOcr.length === 0 || normPdf.length === 0) {
    return { discrepancy: true, ratio: 0 };
  }

  // Use word overlap as a similarity metric
  const ocrWords = new Set(normOcr.split(' ').filter(Boolean));
  const pdfWords = new Set(normPdf.split(' ').filter(Boolean));

  const intersection = new Set([...ocrWords].filter(w => pdfWords.has(w)));
  const union = new Set([...ocrWords, ...pdfWords]);

  const ratio = union.size > 0 ? intersection.size / union.size : 1;

  // A discrepancy is flagged when overlap is below 70%
  const DISCREPANCY_THRESHOLD = 0.7;
  return {
    discrepancy: ratio < DISCREPANCY_THRESHOLD,
    ratio,
  };
}
