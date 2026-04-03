import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db/cypher', () => ({
  runCypher: vi.fn(),
}));

vi.mock('@/pipeline/generateSummary', () => ({
  generateBatchSummaries: vi.fn(),
}));

import { runCypher } from '@/db/cypher';
import { generateBatchSummaries } from '@/pipeline/generateSummary';
import { buildGraphTour } from '@/tour/buildGraphTour';

const mockedRunCypher = vi.mocked(runCypher);
const mockedGenerateBatchSummaries = vi.mocked(generateBatchSummaries);

describe('buildGraphTour', () => {
  beforeEach(() => {
    mockedRunCypher.mockReset();
    mockedGenerateBatchSummaries.mockReset();
  });

  it('reuses existing summaries and only generates missing ones', async () => {
    mockedRunCypher.mockResolvedValue([
      {
        filePath: 'src/core.ts',
        inDegree: 9,
        outDegree: 8,
        depth: 1,
        existingSummary: 'Existing summary for core',
      },
      {
        filePath: 'src/feature.ts',
        inDegree: 5,
        outDegree: 3,
        depth: 2,
        existingSummary: null,
      },
    ]);

    mockedGenerateBatchSummaries.mockResolvedValue({
      results: [{ filePath: 'src/feature.ts', summary: 'Generated summary for feature' }],
      errors: [],
    });

    const result = await buildGraphTour('repo-test', 12);

    expect(result.ok).toBe(true);
    expect(result.repoId).toBe('repo-test');
    expect(result.mode).toBe('graph');
    expect(result.steps).toHaveLength(2);

    expect(mockedGenerateBatchSummaries).toHaveBeenCalledWith(['src/feature.ts'], 'repo-test');
    expect(result.steps[0]?.summary.length).toBeGreaterThan(0);
    expect(result.steps[1]?.summary.length).toBeGreaterThan(0);
  });

  it('uses fallback summary when generation fails', async () => {
    mockedRunCypher.mockResolvedValue([
      {
        filePath: 'src/no-summary.ts',
        inDegree: 7,
        outDegree: 4,
        depth: 2,
        existingSummary: null,
      },
    ]);

    mockedGenerateBatchSummaries.mockResolvedValue({
      results: [],
      errors: ['Failed src/no-summary.ts: Error: model unavailable'],
    });

    const result = await buildGraphTour('repo-test', 12);
    expect(result.steps[0]?.summary).toBe('Summary unavailable for this file in v1 graph tour.');
  });
});
