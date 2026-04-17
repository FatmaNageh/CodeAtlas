import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('@/services/indexing', () => ({
  indexRepoInputSchema: {
    safeParse: vi.fn(),
  },
  isIndexingInProgress: vi.fn(),
  startIndexing: vi.fn(),
}));

import { indexRepoRoute } from '@/routes/indexRepo';
import {
  indexRepoInputSchema,
  isIndexingInProgress,
  startIndexing,
} from '@/services/indexing';

const mockedSafeParse = vi.mocked(indexRepoInputSchema.safeParse);
const mockedIsIndexingInProgress = vi.mocked(isIndexingInProgress);
const mockedStartIndexing = vi.mocked(startIndexing);

describe('POST /indexRepo failure handling', () => {
  beforeEach(() => {
    mockedSafeParse.mockReset();
    mockedIsIndexingInProgress.mockReset();
    mockedStartIndexing.mockReset();
    mockedIsIndexingInProgress.mockReturnValue(false);
  });

  it('returns 500 when indexing service throws Neo4j connectivity error', async () => {
    const app = new Hono();
    app.route('/', indexRepoRoute);

    const validPayload: {
      projectPath: string;
      mode: 'full';
      saveDebugJson: boolean;
      computeHash: boolean;
      ignorePatterns: string[];
    } = {
      projectPath: '/tmp/repo',
      mode: 'full',
      saveDebugJson: false,
      computeHash: true,
      ignorePatterns: [],
    };

    mockedSafeParse.mockReturnValue({ success: true, data: validPayload });
    mockedStartIndexing.mockRejectedValue(
      new Error('Neo4j connection failed: ECONNREFUSED 127.0.0.1:7687'),
    );

    const response = await app.request('/indexRepo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    const data = (await response.json()) as { ok: boolean; error?: string };
    expect(response.status).toBe(500);
    expect(data.ok).toBe(false);
    expect(data.error).toContain('Neo4j connection failed');
  });
});
