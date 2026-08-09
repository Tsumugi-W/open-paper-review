export interface CalibrationData {
  venueId: string;
  samples: CalibrationSample[];
  trainSet: CalibrationSample[];
  testSet: CalibrationSample[];
}

export interface CalibrationSample {
  paperId: string;
  source: string;
  rawScore: number;
  groundTruthScore: number;
  decision?: 'accept' | 'reject';
  license: string;
}

export interface CalibrationMetrics {
  dataSize: number;
  trainSize: number;
  testSize: number;
  mae: number;
  spearmanCorrelation: number;
  weightedKappa: number;
  acceptPrecision: number;
  acceptRecall: number;
  confidenceInterval95: [number, number];
  lastUpdated: string;
}

export interface BenchmarkCard {
  venueId: string;
  status: 'rubric_only' | 'calibrated';
  metrics: CalibrationMetrics | null;
  dataSources: string[];
  exclusions: string[];
  limitations: string[];
  generatedAt: string;
}
