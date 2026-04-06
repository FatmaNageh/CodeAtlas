import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('@/tour/buildGraphTour', () => ({
  buildGraphTour: vi.fn(),
}));

import { graphragRoute } from '@/routes/graphrag';
import { buildGraphTour } from '@/tour/buildGraphTour';

const mockedBuildGraphTour = vi.mocked(buildGraphTour);

describe('GET /graphrag/tour', () => {
  beforeEach(() => {
    mockedBuildGraphTour.mockReset();
  });

  it('returns 400 when repoId is missing', async () => {
    const app = new Hono();
    app.route('/graphrag', graphragRoute);

    const response = await app.request('/graphrag/tour');
    const data = (await response.json()) as { ok: boolean; error?: string };

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Missing repoId');
  });

  it('returns tour payload on success', async () => {
    mockedBuildGraphTour.mockResolvedValue({
      ok: true,
      repoId: 'repo-1',
      mode: 'graph',
      generatedAt: '2026-01-01T00:00:00.000Z',
      steps: [
        {
          rank: 1,
          filePath: 'src/core.ts',
          score: 10,
          scoreBreakdown: { graphScore: 10 },
          metrics: { inDegree: 5, outDegree: 3, totalDegree: 8, depth: 1 },
          summary: 'Core summary',
        },
      ],
    });

    const app = new Hono();
    app.route('/graphrag', graphragRoute);

    const response = await app.request('/graphrag/tour?repoId=repo-1&limit=13');
    const data = (await response.json()) as {
      ok: boolean;
      repoId: string;
      mode: string;
      steps: Array<{ filePath: string }>;
    };

    expect(response.status).toBe(200);
    expect(mockedBuildGraphTour).toHaveBeenCalledWith('repo-1', 13);
    expect(data.ok).toBe(true);
    expect(data.repoId).toBe('repo-1');
    expect(data.mode).toBe('graph');
    expect(data.steps[0]?.filePath).toBe('src/core.ts');
  });
});
