// ─── Coordinates ─────────────────────────────────────────────────────────────

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Evidence Reference ──────────────────────────────────────────────────────

export interface EvidenceRef {
  paperId: string;
  pageNumber: number;
  chunkId?: string;
  excerpt: string;
  coordinates?: BoundingBox;
  confidence: number;
}
