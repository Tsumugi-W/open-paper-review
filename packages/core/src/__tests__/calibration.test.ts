import { describe, it, expect } from 'vitest';
import { IsotonicCalibrator } from '../calibration/isotonic.js';

describe('IsotonicCalibrator', () => {
  it('performs monotonic calibration', () => {
    const calibrator = new IsotonicCalibrator();

    const trainSamples = Array.from({ length: 100 }, (_, i) => ({
      paperId: `paper_${i}`,
      source: 'test',
      rawScore: 1 + (i / 100) * 9,
      groundTruthScore: 1 + (i / 100) * 9 + (Math.random() - 0.5),
      decision: i > 60 ? 'accept' as const : 'reject' as const,
      license: 'CC-BY-4.0',
    }));

    const testSamples = Array.from({ length: 25 }, (_, i) => ({
      paperId: `test_${i}`,
      source: 'test',
      rawScore: 1 + (i / 25) * 9,
      groundTruthScore: 1 + (i / 25) * 9 + (Math.random() - 0.5) * 0.5,
      decision: i > 15 ? 'accept' as const : 'reject' as const,
      license: 'CC-BY-4.0',
    }));

    const metrics = calibrator.fit({
      venueId: 'test/main/2026/v1',
      samples: [...trainSamples, ...testSamples],
      trainSet: trainSamples,
      testSet: testSamples,
    });

    expect(metrics.dataSize).toBe(125);
    expect(metrics.mae).toBeGreaterThanOrEqual(0);
    expect(metrics.spearmanCorrelation).toBeGreaterThan(0);
    expect(metrics.confidenceInterval95[0]).toBeLessThan(metrics.confidenceInterval95[1]);
  });

  it('requires minimum training data', () => {
    const calibrator = new IsotonicCalibrator();
    expect(() => calibrator.fit({
      venueId: 'test/main/2026/v1',
      samples: [],
      trainSet: Array.from({ length: 50 }, (_, i) => ({
        paperId: `p${i}`, source: 'test', rawScore: i, groundTruthScore: i, license: 'CC-BY-4.0',
      })),
      testSet: [],
    })).toThrow('Insufficient training data');
  });

  it('prediction is monotonically non-decreasing', () => {
    const calibrator = new IsotonicCalibrator();
    const trainSamples = Array.from({ length: 100 }, (_, i) => ({
      paperId: `p${i}`, source: 'test',
      rawScore: i / 10,
      groundTruthScore: i / 10 + (Math.random() - 0.5) * 2,
      license: 'CC-BY-4.0',
    }));

    calibrator.fit({
      venueId: 'test/main/2026/v1',
      samples: trainSamples,
      trainSet: trainSamples,
      testSet: trainSamples.slice(0, 25),
    });

    let prev = -Infinity;
    for (let x = 0; x <= 10; x += 0.5) {
      const pred = calibrator.predict(x);
      expect(pred).toBeGreaterThanOrEqual(prev - 0.001);
      prev = pred;
    }
  });
});
