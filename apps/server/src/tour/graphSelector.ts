export interface GraphTourFileMetric {
  filePath: string;
  inDegree: number;
  outDegree: number;
  depth: number;
  existingSummary: string | null;
}

export interface GraphTourStepCandidate {
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
  existingSummary: string | null;
}

const DEFAULT_LIMIT = 12;
const MIN_LIMIT = 10;
const MAX_LIMIT = 15;

export function clampTourLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || Number.isNaN(limit)) {
    return DEFAULT_LIMIT;
  }

  const normalized = Math.floor(limit);
  if (normalized < MIN_LIMIT) return MIN_LIMIT;
  if (normalized > MAX_LIMIT) return MAX_LIMIT;
  return normalized;
}
// TODO: handle potential NeoIntLike values in the Cypher results, ensuring we convert them to numbers safely. Also revise this formula logic 
function scoreFile(metric: GraphTourFileMetric): number {
  const totalDegree = metric.inDegree + metric.outDegree;
  const connectivityScore = totalDegree * 2.5;
  const inboundBonus = metric.inDegree * 1.1;
  const depthBonus = Math.max(0, 6 - metric.depth) * 0.75;
  return connectivityScore + inboundBonus + depthBonus;
}

export function selectGraphTour(
  fileMetrics: GraphTourFileMetric[],
  limit: number | undefined,
): GraphTourStepCandidate[] {
  const clampedLimit = clampTourLimit(limit);

  return fileMetrics
    .map((metric) => {
      const totalDegree = metric.inDegree + metric.outDegree;
      const graphScore = scoreFile(metric);
      return {
        filePath: metric.filePath,
        score: graphScore,
        scoreBreakdown: { graphScore },
        metrics: {
          inDegree: metric.inDegree,
          outDegree: metric.outDegree,
          totalDegree,
          depth: metric.depth,
        },
        existingSummary: metric.existingSummary,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.filePath.localeCompare(right.filePath);
    })
    .slice(0, clampedLimit);
}
