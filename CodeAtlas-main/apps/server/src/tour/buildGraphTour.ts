import { runCypher } from '@/db/cypher';
import { generateBatchSummaries } from '@/pipeline/generateSummary';
import {
  selectGraphTour,
  clampTourLimit,
  type GraphTourFileMetric,
} from '@/tour/graphSelector';
import type { TourResponse } from '@/tour/types';

interface NeoIntLike {
  toNumber: () => number;
}

interface GraphTourMetricRow {
  filePath: string;
  inDegree: number | NeoIntLike;
  outDegree: number | NeoIntLike;
  depth: number | NeoIntLike;
  existingSummary: string | null;
}

function toNumber(value: number | NeoIntLike, fallback: number): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  const converted = value.toNumber();
  return Number.isFinite(converted) ? converted : fallback;
}

function mapRowsToFileMetrics(rows: GraphTourMetricRow[]): GraphTourFileMetric[] {
  return rows
    .filter((row) => typeof row.filePath === 'string' && row.filePath.length > 0)
    .map((row) => ({
      filePath: row.filePath,
      inDegree: toNumber(row.inDegree, 0),
      outDegree: toNumber(row.outDegree, 0),
      depth: toNumber(row.depth, 99),
      existingSummary: row.existingSummary,
    }));
}

export async function buildGraphTour(repoId: string, requestedLimit: number | undefined): Promise<TourResponse> {
  const metricsRows = await runCypher<GraphTourMetricRow>(
    `
    MATCH (f:CodeFile {repoId: $repoId})
    OPTIONAL MATCH (f)-[outRel]->()
    WITH f, count(outRel) AS outDegree
    OPTIONAL MATCH ()-[inRel]->(f)
    WITH f, outDegree, count(inRel) AS inDegree
    OPTIONAL MATCH p = (root)-[:CONTAINS*0..]->(f)
      WHERE root.repoId = $repoId AND (root:Repository OR root:Repo)
    WITH f, inDegree, outDegree, min(length(p)) AS depth
    RETURN
      f.relPath AS filePath,
      inDegree,
      outDegree,
      coalesce(depth, 99) AS depth,
      f.summary AS existingSummary
    `,
    { repoId },
  );

  const fileMetrics = mapRowsToFileMetrics(metricsRows);
  const selected = selectGraphTour(fileMetrics, requestedLimit);

  const missingSummaryPaths = selected
    .filter((step) => !step.existingSummary || step.existingSummary.trim().length === 0)
    .map((step) => step.filePath);

  const generatedSummaries = new Map<string, string>();
  const failedSummaryPaths = new Set<string>();

  if (missingSummaryPaths.length > 0) {
    const { results, errors } = await generateBatchSummaries(missingSummaryPaths, repoId);
    for (const item of results) {
      generatedSummaries.set(item.filePath, item.summary);
    }
    for (const errorMessage of errors) {
      const match = /^Failed\s+(.+?):/.exec(errorMessage);
      if (match && match[1]) {
        failedSummaryPaths.add(match[1]);
      }
    }
  }

  const fallbackSummary = 'Summary unavailable for this file in v1 graph tour.';
  const steps = selected.map((step, index) => {
    const generated = generatedSummaries.get(step.filePath);
    const hasFailure = failedSummaryPaths.has(step.filePath);
    const summary =
      step.existingSummary?.trim() ||
      generated?.trim() ||
      (hasFailure ? fallbackSummary : fallbackSummary);

    return {
      rank: index + 1,
      filePath: step.filePath,
      score: Number(step.score.toFixed(3)),
      scoreBreakdown: step.scoreBreakdown,
      metrics: step.metrics,
      summary,
    };
  });

  return {
    ok: true,
    repoId,
    mode: 'graph',
    generatedAt: new Date().toISOString(),
    steps: steps.slice(0, clampTourLimit(requestedLimit)),
  };
}
