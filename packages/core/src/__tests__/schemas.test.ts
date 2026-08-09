import { describe, it, expect } from 'vitest';
import {
  GateFindingSchema,
  GateResultSchema,
  PaperBriefingSchema,
  RelatedWorkResultSchema,
  SpecialistAuditSchema,
  ScorePriorSchema,
  ScoreCandidateSchema,
  CandidateSelectionSchema,
  SynthesisResultSchema,
  CalibrationResultSchema,
  ImprovementSuggestionSchema,
} from '../schemas/index.js';

describe('GateFindingSchema', () => {
  it('validates a valid hard_stop finding', () => {
    const finding = {
      type: 'hard_stop',
      category: 'format',
      message: 'PDF is encrypted',
      evidence: [{ paperId: 'p1', pageNumber: 1, excerpt: 'encrypted header' }],
      pageNumbers: [1],
    };
    expect(GateFindingSchema.safeParse(finding).success).toBe(true);
  });

  it('rejects invalid type', () => {
    const finding = {
      type: 'invalid',
      category: 'format',
      message: 'test',
      evidence: [],
      pageNumbers: [],
    };
    expect(GateFindingSchema.safeParse(finding).success).toBe(false);
  });
});

describe('PaperBriefingSchema', () => {
  it('validates a complete briefing', () => {
    const briefing = {
      title: 'Test Paper',
      authors: ['Author A'],
      abstract: 'Abstract text',
      contributions: [{ claim: 'Novel method', evidence: [{ paperId: 'p1', pageNumber: 1, excerpt: 'We propose...' }] }],
      methodology: { summary: 'Method description', evidence: [{ paperId: 'p1', pageNumber: 3, excerpt: 'Our method...' }] },
      experiments: { summary: 'Experiment details', evidence: [{ paperId: 'p1', pageNumber: 5, excerpt: 'We evaluate...' }] },
      limitations: [{ description: 'Limited scope', evidence: [{ paperId: 'p1', pageNumber: 7, excerpt: 'Our work is limited...' }] }],
      sections: [{ title: 'Introduction', startPage: 1, endPage: 2 }],
    };
    const result = PaperBriefingSchema.safeParse(briefing);
    expect(result.success).toBe(true);
  });
});

describe('ScoreCandidateSchema', () => {
  it('validates a candidate with required fields', () => {
    const candidate = {
      score: 7,
      rationale: 'Strong empirical results',
      strengths: [{ point: 'Novel approach', evidence: [{ paperId: 'p1', pageNumber: 2, excerpt: 'text' }] }],
      weaknesses: [{ point: 'Limited baselines', evidence: [{ paperId: 'p1', pageNumber: 5, excerpt: 'text' }] }],
      confidence: 0.8,
      supportingEvidence: [{ paperId: 'p1', pageNumber: 3, excerpt: 'Results show...' }],
      counterEvidence: [{ paperId: 'p1', pageNumber: 6, excerpt: 'However...' }],
    };
    expect(ScoreCandidateSchema.safeParse(candidate).success).toBe(true);
  });

  it('rejects candidate without rationale', () => {
    const candidate = {
      score: 5,
      strengths: [],
      weaknesses: [],
      confidence: 0.5,
      supportingEvidence: [],
      counterEvidence: [],
    };
    expect(ScoreCandidateSchema.safeParse(candidate).success).toBe(false);
  });
});

describe('CalibrationResultSchema', () => {
  it('validates a calibration with correction', () => {
    const result = {
      originalScore: 6,
      calibratedScore: 7,
      scoreBodyConsistent: false,
      correctionApplied: true,
      correctionReason: 'Body text supports higher score than initially assigned',
      dimensionScores: { novelty: 7, soundness: 8, clarity: 6 },
      venueScaleCompliant: true,
    };
    expect(CalibrationResultSchema.safeParse(result).success).toBe(true);
  });
});
