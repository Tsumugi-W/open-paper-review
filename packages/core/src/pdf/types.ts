export interface PaperArtifact {
  fileHash: string;
  parserVersion: string;
  title: string;
  authors: string[];
  abstract: string;
  pageCount: number;
  pages: PageArtifact[];
  chunks: ChunkArtifact[];
  figures: FigureRef[];
  references: ParsedReference[];
  sections: SectionIndex[];
}

export interface PageArtifact {
  pageNumber: number;
  textContent: string;
  ocrContent: string | null;
  imagePath: string;
  textCoordinates: TextBlock[];
  hasOcrDiscrepancy: boolean;
}

export interface TextBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  isVisible: boolean;
}

export interface ChunkArtifact {
  index: number;
  sectionTitle: string;
  content: string;
  startPage: number;
  endPage: number;
}

export interface FigureRef {
  id: string;
  type: 'figure' | 'table' | 'equation';
  caption: string;
  pageNumber: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  textReferences: number[];
}

export interface ParsedReference {
  index: number;
  rawText: string;
  title: string | null;
  authors: string[];
  year: number | null;
  doi: string | null;
}

export interface SectionIndex {
  title: string;
  level: number;
  startPage: number;
  startOffset: number;
}

export interface ProcessingLimits {
  maxFileSizeMb: number;
  maxPages: number;
}
