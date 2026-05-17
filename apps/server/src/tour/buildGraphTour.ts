import { runCypher } from '@/db/cypher';
import { generateBatchSummaries } from '@/pipeline/generateSummary';
import {
  selectGraphTour,
  clampTourLimit,
  type GraphTourFileMetric,
} from '@/tour/graphSelector';
import type { TourResponse } from '@/tour/types';
import { generateTextWithContext } from '@/ai/generation';

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

function buildOverallRepositorySummaryFallback(steps: TourResponse['steps']): string {
  if (steps.length === 0) {
    return 'No repository tour data is available yet. Generate a tour after indexing to see an overall summary.';
  }

  const totalDegree = steps.reduce((sum, step) => sum + step.metrics.totalDegree, 0);
  const avgDegree = totalDegree / steps.length;
  const topStep = steps[0];
  const avgDepth =
    steps.reduce((sum, step) => sum + step.metrics.depth, 0) / steps.length;
  const hotFiles = steps.slice(0, Math.min(3, steps.length)).map((step) => step.filePath);

  const connectivityLabel =
    avgDegree >= 10
      ? 'highly interconnected'
      : avgDegree >= 5
        ? 'moderately interconnected'
        : 'lightly interconnected';

  return [
    `This repository appears ${connectivityLabel}, with the top tour files averaging ${avgDegree.toFixed(1)} graph connections and depth ${avgDepth.toFixed(1)} from the repo root.`,
    topStep
      ? `The strongest hub in this tour slice is \`${topStep.filePath}\` (score ${topStep.score.toFixed(2)}, degree ${topStep.metrics.totalDegree}).`
      : '',
    hotFiles.length > 0
      ? `Start with: ${hotFiles.map((path) => `\`${path}\``).join(', ')}.`
      : '',
  ]
    .filter((line) => line.length > 0)
    .join('\n\n');
}

async function generateOverallRepositorySummary(steps: TourResponse['steps']): Promise<string> {
  const fallback = buildOverallRepositorySummaryFallback(steps);
  if (steps.length === 0) return fallback;

  const context = steps
    .map(
      (step) =>
        [
          `rank=${step.rank}`,
          `file=${step.filePath}`,
          `score=${step.score.toFixed(3)}`,
          `inDegree=${step.metrics.inDegree}`,
          `outDegree=${step.metrics.outDegree}`,
          `depth=${step.metrics.depth}`,
          `stepSummary=${step.summary.replace(/\s+/g, ' ').trim()}`,
        ].join('; '),
    )
    .join('\n');

  const prompt = [
    'You are summarizing a source-code repository for onboarding.',
    'Write a concise high-signal overview based ONLY on the provided tour context.',
    'Focus on architecture, major capabilities, and where to start reading the code.',
    'Do not mention graph metrics unless directly useful to understanding the repository.',
    'Return exactly 3 short paragraphs in plain text.',
    '',
    'Tour context:',
    context,
  ].join('\n');

  try {
    const raw = await generateTextWithContext(prompt, { temperature: 0.2, maxTokens: 280 });
    const cleaned = raw.trim();
    return cleaned.length > 0 ? cleaned : fallback;
  } catch {
    return fallback;
  }
}

export async function buildGraphTour(repoId: string, requestedLimit: number | undefined): Promise<TourResponse> {
  const metricsRows = await runCypher<GraphTourMetricRow>(
    `/*cypher*/
    MATCH (f:CodeFile {repoId: $repoId})
    OPTIONAL MATCH (f)-[outRel:REFERENCES]->(outTarget {repoId: $repoId})
      WHERE outTarget:CodeFile OR outTarget:TextFile
    WITH f, count(outRel) AS outDegree
    OPTIONAL MATCH (inSource {repoId: $repoId})-[inRel:REFERENCES]->(f)
      WHERE inSource:CodeFile OR inSource:TextFile
    WITH f, outDegree, count(inRel) AS inDegree
    OPTIONAL MATCH p = (root)-[:CONTAINS*0..]->(f)
      WHERE root.repoId = $repoId AND root:Repo
    WITH f, inDegree, outDegree, min(length(p)) AS depth
    RETURN
      f.path AS filePath,
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

  const boundedSteps = steps.slice(0, clampTourLimit(requestedLimit));
  const overallSummary = await generateOverallRepositorySummary(boundedSteps);

  return {
    ok: true,
    repoId,
    mode: 'graph',
    generatedAt: new Date().toISOString(),
    overallSummary,
    steps: boundedSteps,
  };
}
