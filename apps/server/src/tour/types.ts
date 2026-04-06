export type TourMode = 'graph';

export interface TourStep {
  rank: number;
  filePath: string;
  score: number;
  scoreBreakdown: {
    graphScore: number;
  };
  metrics: {
    inDegree: number;
    outDegree: number;
    totalDegree: number;
    depth: number;
  };
  summary: string;
}

export interface TourResponse {
  ok: true;
  repoId: string;
  mode: TourMode;
  generatedAt: string;
  steps: TourStep[];
}
