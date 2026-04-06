import { describe, it, expect } from 'vitest';
import {
  selectGraphTour,
  clampTourLimit,
  type GraphTourFileMetric,
} from '@/tour/graphSelector';

function makeMetric(
  filePath: string,
  inDegree: number,
  outDegree: number,
  depth: number,
): GraphTourFileMetric {
  return {
    filePath,
    inDegree,
    outDegree,
    depth,
    existingSummary: null,
  };
}

describe('clampTourLimit', () => {
  it('defaults to 12 when limit is missing', () => {
    expect(clampTourLimit(undefined)).toBe(12);
  });

  it('clamps lower values to 5', () => {
    expect(clampTourLimit(3)).toBe(5);
  });

  it('clamps upper values to 20', () => {
    expect(clampTourLimit(100)).toBe(20);
  });
});

describe('selectGraphTour', () => {
  it('ranks highly connected files higher', () => {
    const metrics: GraphTourFileMetric[] = [
      makeMetric('src/leaf.ts', 1, 0, 6),
      makeMetric('src/core.ts', 10, 8, 2),
      makeMetric('src/mid.ts', 4, 3, 3),
    ];

    const result = selectGraphTour(metrics, 12);
    expect(result[0]?.filePath).toBe('src/core.ts');
    expect(result[1]?.filePath).toBe('src/mid.ts');
    expect(result[2]?.filePath).toBe('src/leaf.ts');
  });

  it('uses deterministic file-path order for ties', () => {
    const metrics: GraphTourFileMetric[] = [
      makeMetric('zeta.ts', 5, 5, 2),
      makeMetric('alpha.ts', 5, 5, 2),
      makeMetric('beta.ts', 5, 5, 2),
    ];

    const result = selectGraphTour(metrics, 12);
    expect(result.map((step) => step.filePath)).toEqual([
      'alpha.ts',
      'beta.ts',
      'zeta.ts',
    ]);
  });

  it('returns at most the clamped limit', () => {
    const metrics: GraphTourFileMetric[] = Array.from({ length: 20 }, (_, index) =>
      makeMetric(`src/file-${String(index)}.ts`, 20 - index, 20 - index, 2),
    );

    const maxResult = selectGraphTour(metrics, 100);
    expect(maxResult).toHaveLength(20);

    const minResult = selectGraphTour(metrics, 1);
    expect(minResult).toHaveLength(5);
  });

  it('never includes more files than available', () => {
    const metrics: GraphTourFileMetric[] = [
      makeMetric('src/a.ts', 2, 1, 1),
      makeMetric('src/b.ts', 1, 1, 2),
    ];

    const result = selectGraphTour(metrics, 15);
    expect(result).toHaveLength(2);
  });
});
