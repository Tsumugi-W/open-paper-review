import { execFile } from 'child_process';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const DEFAULT_DPI = 150;
const PDFTOPPM_TIMEOUT_MS = 30_000;

/**
 * Render PDF pages to PNG images using pdftoppm (from Poppler utils).
 * Falls back gracefully if pdftoppm is not installed — warns and returns empty array.
 *
 * Uses execFile (not exec) to avoid shell injection.
 */
export async function renderPages(
  pdfPath: string,
  outputDir: string,
  dpi: number = DEFAULT_DPI,
): Promise<string[]> {
  // Check if pdftoppm is available
  const available = await isPdftoppmAvailable();
  if (!available) {
    console.warn('Warning: pdftoppm (Poppler) not found. Page rendering skipped. Install poppler-utils for image-based features.');
    return [];
  }

  const outputPrefix = join(outputDir, 'page');

  try {
    await execFileAsync(
      'pdftoppm',
      [
        '-png',
        '-r', String(dpi),
        pdfPath,
        outputPrefix,
      ],
      { timeout: PDFTOPPM_TIMEOUT_MS },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('TIMEOUT') || message.includes('killed')) {
      console.warn(`Warning: pdftoppm timed out after ${PDFTOPPM_TIMEOUT_MS}ms`);
      return [];
    }
    console.warn(`Warning: pdftoppm failed: ${message}`);
    return [];
  }

  // pdftoppm outputs files like page-01.png, page-02.png, etc.
  const files = await readdir(outputDir);
  const pngFiles = files
    .filter(f => f.startsWith('page') && f.endsWith('.png'))
    .sort()
    .map(f => join(outputDir, f));

  return pngFiles;
}

/**
 * Render a specific page range.
 */
export async function renderPageRange(
  pdfPath: string,
  outputDir: string,
  firstPage: number,
  lastPage: number,
  dpi: number = DEFAULT_DPI,
): Promise<string[]> {
  const available = await isPdftoppmAvailable();
  if (!available) {
    console.warn('Warning: pdftoppm not found. Page rendering skipped.');
    return [];
  }

  const outputPrefix = join(outputDir, 'page');

  try {
    await execFileAsync(
      'pdftoppm',
      [
        '-png',
        '-r', String(dpi),
        '-f', String(firstPage),
        '-l', String(lastPage),
        pdfPath,
        outputPrefix,
      ],
      { timeout: PDFTOPPM_TIMEOUT_MS },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Warning: pdftoppm failed for pages ${firstPage}-${lastPage}: ${message}`);
    return [];
  }

  const files = await readdir(outputDir);
  const pngFiles = files
    .filter(f => f.startsWith('page') && f.endsWith('.png'))
    .sort()
    .map(f => join(outputDir, f));

  return pngFiles;
}

async function isPdftoppmAvailable(): Promise<boolean> {
  try {
    await execFileAsync('which', ['pdftoppm'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
