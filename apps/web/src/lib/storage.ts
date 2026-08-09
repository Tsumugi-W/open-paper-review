import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const STORAGE_ROOT = process.env.STORAGE_PATH ?? join(process.cwd(), ".storage");

/**
 * Get the absolute path for a storage key.
 */
function getAbsolutePath(key: string): string {
  // Prevent path traversal
  const normalized = key.replace(/\.\./g, "").replace(/^\//, "");
  return join(STORAGE_ROOT, normalized);
}

/**
 * Save a file to local storage. Returns the relative storage key.
 */
export async function saveFile(key: string, data: Buffer): Promise<string> {
  const filePath = getAbsolutePath(key);
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, data);
  return key;
}

/**
 * Read a file from local storage.
 */
export async function readStoredFile(key: string): Promise<Buffer> {
  const filePath = getAbsolutePath(key);
  return readFile(filePath);
}

/**
 * Check if a file exists in storage.
 */
export function fileExists(key: string): boolean {
  const filePath = getAbsolutePath(key);
  return existsSync(filePath);
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(key: string): Promise<void> {
  const filePath = getAbsolutePath(key);
  await rm(filePath, { force: true });
}

/**
 * Delete a directory and all its contents.
 */
export async function deleteDirectory(key: string): Promise<void> {
  const dirPath = getAbsolutePath(key);
  await rm(dirPath, { recursive: true, force: true });
}
