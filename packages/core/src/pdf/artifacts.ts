import { createHash } from 'crypto';
import type { PaperArtifact } from './types.js';

export class ArtifactBuilder {
  private storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = storagePath;
  }

  buildManifest(artifact: PaperArtifact) {
    return {
      fileHash: artifact.fileHash,
      parserVersion: artifact.parserVersion,
      contentHash: createHash('sha256')
        .update(JSON.stringify({
          pages: artifact.pages.map(p => p.textContent),
          sections: artifact.sections,
        }))
        .digest('hex'),
      pageCount: artifact.pageCount,
      title: artifact.title,
      authors: artifact.authors,
      sectionCount: artifact.sections.length,
      chunkCount: artifact.chunks.length,
      figureCount: artifact.figures.length,
      referenceCount: artifact.references.length,
      createdAt: new Date().toISOString(),
    };
  }

  getPageImagePath(paperId: string, pageNumber: number): string {
    return `${this.storagePath}/papers/${paperId}/pages/${pageNumber}.png`;
  }

  getPaperDir(paperId: string): string {
    return `${this.storagePath}/papers/${paperId}`;
  }

  getExportPath(reviewId: string, format: string): string {
    return `${this.storagePath}/exports/${reviewId}.${format}`;
  }
}
