import type { CalibrationData, CalibrationMetrics } from './types.js';

export class IsotonicCalibrator {
  private mapping: { x: number; y: number }[] = [];
  private fitted = false;

  fit(data: CalibrationData): CalibrationMetrics {
    const { trainSet, testSet } = data;
    if (trainSet.length < 80) {
      throw new Error('Insufficient training data (need >= 80 samples)');
    }

    const sorted = [...trainSet].sort((a, b) => a.rawScore - b.rawScore);
    this.mapping = this.fitIsotonic(
      sorted.map(s => s.rawScore),
      sorted.map(s => s.groundTruthScore)
    );
    this.fitted = true;

    const predictions = testSet.map(s => this.predict(s.rawScore));
    const actuals = testSet.map(s => s.groundTruthScore);

    return {
      dataSize: trainSet.length + testSet.length,
      trainSize: trainSet.length,
      testSize: testSet.length,
      mae: this.computeMAE(predictions, actuals),
      spearmanCorrelation: this.computeSpearman(predictions, actuals),
      weightedKappa: this.computeWeightedKappa(predictions, actuals),
      acceptPrecision: this.computePrecision(predictions, testSet),
      acceptRecall: this.computeRecall(predictions, testSet),
      confidenceInterval95: this.bootstrapCI(testSet, 1000),
      lastUpdated: new Date().toISOString(),
    };
  }

  predict(rawScore: number): number {
    if (!this.fitted || this.mapping.length === 0) {
      return rawScore;
    }

    if (rawScore <= this.mapping[0].x) return this.mapping[0].y;
    if (rawScore >= this.mapping[this.mapping.length - 1].x) {
      return this.mapping[this.mapping.length - 1].y;
    }

    for (let i = 0; i < this.mapping.length - 1; i++) {
      if (rawScore >= this.mapping[i].x && rawScore <= this.mapping[i + 1].x) {
        const t = (rawScore - this.mapping[i].x) / (this.mapping[i + 1].x - this.mapping[i].x);
        return this.mapping[i].y + t * (this.mapping[i + 1].y - this.mapping[i].y);
      }
    }
    return rawScore;
  }

  private fitIsotonic(x: number[], y: number[]): { x: number; y: number }[] {
    const n = x.length;
    const result = y.slice();
    const weight = new Array(n).fill(1);
    const blocks: { start: number; end: number; value: number; weight: number }[] = [];

    for (let i = 0; i < n; i++) {
      blocks.push({ start: i, end: i, value: result[i], weight: weight[i] });

      while (blocks.length >= 2) {
        const last = blocks[blocks.length - 1];
        const prev = blocks[blocks.length - 2];
        if (prev.value <= last.value) break;

        const merged = {
          start: prev.start,
          end: last.end,
          value: (prev.value * prev.weight + last.value * last.weight) / (prev.weight + last.weight),
          weight: prev.weight + last.weight,
        };
        blocks.splice(blocks.length - 2, 2, merged);
      }
    }

    const mapping: { x: number; y: number }[] = [];
    for (const block of blocks) {
      mapping.push({ x: x[block.start], y: block.value });
      if (block.start !== block.end) {
        mapping.push({ x: x[block.end], y: block.value });
      }
    }
    return mapping;
  }

  private computeMAE(pred: number[], actual: number[]): number {
    const sum = pred.reduce((acc, p, i) => acc + Math.abs(p - actual[i]), 0);
    return sum / pred.length;
  }

  private computeSpearman(pred: number[], actual: number[]): number {
    const n = pred.length;
    const rankPred = this.rank(pred);
    const rankActual = this.rank(actual);
    const d2 = rankPred.reduce((acc, r, i) => acc + (r - rankActual[i]) ** 2, 0);
    return 1 - (6 * d2) / (n * (n * n - 1));
  }

  private rank(arr: number[]): number[] {
    const indexed = arr.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);
    const ranks = new Array(arr.length);
    for (let i = 0; i < indexed.length; i++) {
      ranks[indexed[i].i] = i + 1;
    }
    return ranks;
  }

  private computeWeightedKappa(pred: number[], actual: number[]): number {
    const n = pred.length;
    const max = Math.max(...pred, ...actual);
    const min = Math.min(...pred, ...actual);
    const range = max - min || 1;

    let observed = 0;
    let expected = 0;
    for (let i = 0; i < n; i++) {
      observed += 1 - Math.abs(Math.round(pred[i]) - Math.round(actual[i])) / range;
      expected += 1 - Math.abs(Math.round(pred[i]) - Math.round(pred[(i + 1) % n])) / range;
    }
    observed /= n;
    expected /= n;

    return (observed - expected) / (1 - expected);
  }

  private computePrecision(pred: number[], testSet: { decision?: string; groundTruthScore: number }[]): number {
    const threshold = testSet.filter(s => s.decision === 'accept').reduce((sum, s) => sum + s.groundTruthScore, 0) /
      Math.max(testSet.filter(s => s.decision === 'accept').length, 1);

    const predictedAccept = pred.filter(p => p >= threshold);
    const truePositives = pred.filter((p, i) => p >= threshold && testSet[i].decision === 'accept');
    return truePositives.length / Math.max(predictedAccept.length, 1);
  }

  private computeRecall(pred: number[], testSet: { decision?: string; groundTruthScore: number }[]): number {
    const threshold = testSet.filter(s => s.decision === 'accept').reduce((sum, s) => sum + s.groundTruthScore, 0) /
      Math.max(testSet.filter(s => s.decision === 'accept').length, 1);

    const actualAccept = testSet.filter(s => s.decision === 'accept');
    const truePositives = pred.filter((p, i) => p >= threshold && testSet[i].decision === 'accept');
    return truePositives.length / Math.max(actualAccept.length, 1);
  }

  private bootstrapCI(testSet: { rawScore: number; groundTruthScore: number }[], iterations: number): [number, number] {
    const maes: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const sample = Array.from({ length: testSet.length }, () =>
        testSet[Math.floor(Math.random() * testSet.length)]
      );
      const preds = sample.map(s => this.predict(s.rawScore));
      const actuals = sample.map(s => s.groundTruthScore);
      maes.push(this.computeMAE(preds, actuals));
    }
    maes.sort((a, b) => a - b);
    return [maes[Math.floor(iterations * 0.025)], maes[Math.floor(iterations * 0.975)]];
  }
}
