import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('@/tour/buildGraphTour', () => ({
  buildGraphTour: vi.fn(),
}));

vi.mock('@/pipeline/generateSummary', () => ({
  generateBatchSummaries: vi.fn(),
}));

vi.mock('@/ai/embeddings', () => ({
  generateEmbeddings: vi.fn(),
  generateSingleEmbed: vi.fn(),
}));

import { graphragRoute } from '@/routes/graphrag';
import { generateBatchSummaries } from '@/pipeline/generateSummary';
import { generateSingleEmbed } from '@/ai/embeddings';

const mockedGenerateBatchSummaries = vi.mocked(generateBatchSummaries);
const mockedGenerateSingleEmbed = vi.mocked(generateSingleEmbed);

describe('graphrag route failure handling', () => {
  beforeEach(() => {
    mockedGenerateBatchSummaries.mockReset();
    mockedGenerateSingleEmbed.mockReset();
  });

  it('returns deterministic summarize payload when LLM is unreachable', async () => {
    const app = new Hono();
    app.route('/graphrag', graphragRoute);

    mockedGenerateBatchSummaries.mockResolvedValue({
      results: [],
      errors: ['Failed src/a.ts: Error: OpenRouter authentication failed'],
    });

    const response = await app.request('/graphrag/summarize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        repoId: 'repo-1',
        filePaths: ['src/a.ts'],
      }),
    });

    const data = (await response.json()) as {
      ok: boolean;
      results: Array<{ filePath: string; summary: string }>;
      errors: string[];
    };

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.results).toHaveLength(0);
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0]).toContain('OpenRouter authentication failed');
  });

  it('returns mixed summarize results with one entry per requested file', async () => {
    const app = new Hono();
    app.route('/graphrag', graphragRoute);

    const requestedFiles = ['src/a.ts', 'src/b.ts', 'src/c.ts'];
    mockedGenerateBatchSummaries.mockResolvedValue({
      results: [
        { filePath: 'src/a.ts', summary: 'File a summary.' },
        { filePath: 'src/c.ts', summary: 'File c summary.' },
      ],
      errors: ['Failed src/b.ts: Error: generation timeout'],
    });

    const response = await app.request('/graphrag/summarize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        repoId: 'repo-1',
        filePaths: requestedFiles,
      }),
    });

    const data = (await response.json()) as {
      ok: boolean;
      results: Array<{ filePath: string; summary: string }>;
      errors: string[];
    };

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);

    const handledFilePaths = new Set<string>([
      ...data.results.map((entry) => entry.filePath),
      ...data.errors
        .map((error) => {
          const match = error.match(/^Failed\s+([^:]+):/);
          return match?.[1] ?? '';
        })
        .filter((filePath) => filePath.length > 0),
    ]);

    expect(handledFilePaths.size).toBe(requestedFiles.length);
    for (const filePath of requestedFiles) {
      expect(handledFilePaths.has(filePath)).toBe(true);
    }
  });

  it('returns 500 with typed payload when ask embedding generation fails', async () => {
    const app = new Hono();
    app.route('/graphrag', graphragRoute);

    mockedGenerateSingleEmbed.mockRejectedValue(new Error('OpenRouter timeout'));

    const response = await app.request('/graphrag/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        repoId: 'repo-1',
        question: 'What does this service do?',
      }),
    });

    const data = (await response.json()) as { ok: boolean; error?: string };
    expect(response.status).toBe(500);
    expect(data.ok).toBe(false);
    expect(data.error).toContain('OpenRouter timeout');
  });
});
