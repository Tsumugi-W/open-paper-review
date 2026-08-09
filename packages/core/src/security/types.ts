export interface InjectionFinding {
  layer: 'pattern' | 'visual' | 'ocr_discrepancy' | 'llm_classifier';
  severity: 'high' | 'medium' | 'low';
  pageNumber: number;
  excerpt: string;
  description: string;
  coordinates?: { x: number; y: number; width: number; height: number };
}

export interface SecurityScanResult {
  isClean: boolean;
  findings: InjectionFinding[];
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  requiresConfirmation: boolean;
  sanitizedPages: number[];
}
