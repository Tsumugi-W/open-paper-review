import type { PageArtifact, TextBlock } from '../pdf/types.js';
import type { InjectionFinding, SecurityScanResult } from './types.js';

const INSTRUCTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\s+/i,
  /system\s*:\s*/i,
  /\bact\s+as\b/i,
  /\brole\s*:\s*/i,
  /\bforget\s+(everything|all)\b/i,
  /\bdo\s+not\s+follow\b/i,
  /\boverride\b.*\binstructions?\b/i,
  /\bnew\s+instructions?\b/i,
  /\b(assistant|ai|model)\s*:/i,
  /\bprompt\s*injection\b/i,
  /\[INST\]/i,
  /<\|im_start\|>/i,
  /<<SYS>>/i,
];

const MIN_VISIBLE_FONT_SIZE = 4;
const TRANSPARENCY_THRESHOLD = 0.05;

export class InjectionDetector {
  async scan(pages: PageArtifact[]): Promise<SecurityScanResult> {
    const findings: InjectionFinding[] = [];

    for (const page of pages) {
      findings.push(...this.scanPatterns(page));
      findings.push(...this.scanVisualAnomalies(page));
      findings.push(...this.scanOcrDiscrepancy(page));
    }

    const riskLevel = this.assessRisk(findings);
    return {
      isClean: findings.length === 0,
      findings,
      riskLevel,
      requiresConfirmation: riskLevel === 'medium' || riskLevel === 'high',
      sanitizedPages: [...new Set(findings.filter(f => f.severity === 'high').map(f => f.pageNumber))],
    };
  }

  private scanPatterns(page: PageArtifact): InjectionFinding[] {
    const findings: InjectionFinding[] = [];
    const text = page.textContent;

    for (const pattern of INSTRUCTION_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        const start = Math.max(0, match.index! - 50);
        const end = Math.min(text.length, match.index! + match[0].length + 50);
        findings.push({
          layer: 'pattern',
          severity: 'medium',
          pageNumber: page.pageNumber,
          excerpt: text.slice(start, end),
          description: `Suspicious instruction-like pattern detected: "${match[0]}"`,
        });
      }
    }
    return findings;
  }

  private scanVisualAnomalies(page: PageArtifact): InjectionFinding[] {
    const findings: InjectionFinding[] = [];
    const blocks: TextBlock[] = page.textCoordinates ?? [];

    for (const block of blocks) {
      if (block.fontSize > 0 && block.fontSize < MIN_VISIBLE_FONT_SIZE) {
        findings.push({
          layer: 'visual',
          severity: 'high',
          pageNumber: page.pageNumber,
          excerpt: block.text.slice(0, 200),
          description: `Extremely small font (${block.fontSize}pt) - possibly hidden text`,
          coordinates: { x: block.x, y: block.y, width: block.width, height: block.height },
        });
      }

      if (!block.isVisible) {
        findings.push({
          layer: 'visual',
          severity: 'high',
          pageNumber: page.pageNumber,
          excerpt: block.text.slice(0, 200),
          description: 'Invisible/transparent text detected',
          coordinates: { x: block.x, y: block.y, width: block.width, height: block.height },
        });
      }

      if (block.x < 0 || block.y < 0 || block.x > 612 || block.y > 792) {
        findings.push({
          layer: 'visual',
          severity: 'high',
          pageNumber: page.pageNumber,
          excerpt: block.text.slice(0, 200),
          description: 'Text positioned outside visible page area',
          coordinates: { x: block.x, y: block.y, width: block.width, height: block.height },
        });
      }
    }
    return findings;
  }

  private scanOcrDiscrepancy(page: PageArtifact): InjectionFinding[] {
    const findings: InjectionFinding[] = [];
    if (!page.ocrContent || !page.hasOcrDiscrepancy) return findings;

    const textWords = new Set(page.textContent.toLowerCase().split(/\s+/));
    const ocrWords = new Set(page.ocrContent.toLowerCase().split(/\s+/));

    const hiddenInText = [...textWords].filter(w => w.length > 3 && !ocrWords.has(w));
    const ratio = hiddenInText.length / Math.max(textWords.size, 1);

    if (ratio > 0.1) {
      findings.push({
        layer: 'ocr_discrepancy',
        severity: 'medium',
        pageNumber: page.pageNumber,
        excerpt: hiddenInText.slice(0, 20).join(', '),
        description: `${(ratio * 100).toFixed(0)}% of text-layer words not found in OCR output - possible hidden content`,
      });
    }

    return findings;
  }

  private assessRisk(findings: InjectionFinding[]): 'none' | 'low' | 'medium' | 'high' {
    if (findings.length === 0) return 'none';
    if (findings.some(f => f.severity === 'high')) return 'high';
    if (findings.filter(f => f.severity === 'medium').length >= 2) return 'high';
    if (findings.some(f => f.severity === 'medium')) return 'medium';
    return 'low';
  }

  sanitizeContent(text: string, findings: InjectionFinding[]): string {
    let sanitized = text;
    for (const finding of findings.filter(f => f.severity === 'high')) {
      if (finding.excerpt.length > 10) {
        sanitized = sanitized.replace(finding.excerpt, '[CONTENT_REDACTED_SECURITY]');
      }
    }
    return sanitized;
  }
}
