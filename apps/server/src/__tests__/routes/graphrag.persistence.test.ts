import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('@/tour/buildGraphTour', () => ({
  buildGraphTour: vi.fn(),
}));

vi.mock('@/pipeline/generateSummary', () => ({
  generateBatchSummaries: vi.fn(),
}));

vi.mock('@/retrieval/vector', () => ({
  findSimilarChunks: vi.fn(),
}));

vi.mock('@/retrieval/graph', () => ({
  getAdjacentASTChunks: vi.fn(),
}));

vi.mock('@/retrieval/context', () => ({
  assembleFileContext: vi.fn(),
}));

vi.mock('@/ai/embeddings', () => ({
  generateEmbeddings: vi.fn(),
  generateSingleEmbed: vi.fn(),
}));

vi.mock('@/ai/generation', () => ({
  generateTextWithContext: vi.fn(),
}));

vi.mock('@/db/cypher', () => ({
  runCypher: vi.fn(),
}));

vi.mock('@CodeAtlas/db/chat', () => ({
  resolveThreadForQuestion: vi.fn(),
  appendThreadMessage: vi.fn(),
}));

import { graphragRoute } from '@/routes/graphrag';
import { generateSingleEmbed } from '@/ai/embeddings';
import { generateTextWithContext } from '@/ai/generation';
import { findSimilarChunks } from '@/retrieval/vector';
import { getAdjacentASTChunks } from '@/retrieval/graph';
import { appendThreadMessage, resolveThreadForQuestion } from '@CodeAtlas/db/chat';

const mockedGenerateSingleEmbed = vi.mocked(generateSingleEmbed);
const mockedGenerateTextWithContext = vi.mocked(generateTextWithContext);
const mockedFindSimilarChunks = vi.mocked(findSimilarChunks);
const mockedGetAdjacentASTChunks = vi.mocked(getAdjacentASTChunks);
const mockedResolveThreadForQuestion = vi.mocked(resolveThreadForQuestion);
const mockedAppendThreadMessage = vi.mocked(appendThreadMessage);

describe('graphrag ask persistence', () => {
  beforeEach(() => {
    mockedGenerateSingleEmbed.mockReset();
    mockedGenerateTextWithContext.mockReset();
    mockedFindSimilarChunks.mockReset();
    mockedGetAdjacentASTChunks.mockReset();
    mockedResolveThreadForQuestion.mockReset();
    mockedAppendThreadMessage.mockReset();

    mockedResolveThreadForQuestion.mockResolvedValue({
      id: 'thread-1',
      repoId: 'repo-1',
      title: 'Question title',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
    });
    mockedAppendThreadMessage.mockResolvedValue({
      id: 'message-1',
      threadId: 'thread-1',
      repoId: 'repo-1',
      role: 'user',
      content: 'What does this do?',
      sourcesJson: null,
      sequence: 1,
      createdAt: new Date().toISOString(),
    });
    mockedGenerateSingleEmbed.mockResolvedValue(new Array(1536).fill(0.1));
    mockedFindSimilarChunks.mockResolvedValue([
      {
        id: 'chunk-1',
        filePath: 'src/service.ts',
        symbol: 'doWork',
        unitKind: null,
        summaryCandidate: null,
        segmentReason: null,
        keywords: null,
        topLevelSymbols: null,
        tokenCount: null,
        startLine: 1,
        endLine: 1,
        chunkText: 'export function doWork() { return true; }',
        score: 0.9,
        sourceKind: 'text',
      },
    ]);
    mockedGetAdjacentASTChunks.mockResolvedValue([]);
    mockedGenerateTextWithContext.mockResolvedValue('This is an answer.');
  });

  it('returns threadId and persists user + assistant messages', async () => {
    const app = new Hono();
    app.route('/graphrag', graphragRoute);

    const response = await app.request('/graphrag/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        repoId: 'repo-1',
        question: 'What does this do?',
      }),
    });

    const data = (await response.json()) as {
      ok: boolean;
      threadId?: string;
      answer?: string;
    };

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.threadId).toBe('thread-1');
    expect(data.answer).toBe('This is an answer.');
    expect(mockedResolveThreadForQuestion).toHaveBeenCalledTimes(1);
    expect(mockedAppendThreadMessage).toHaveBeenCalledTimes(2);
    expect(mockedAppendThreadMessage.mock.calls[0]?.[0]).toMatchObject({
      repoId: 'repo-1',
      threadId: 'thread-1',
      role: 'user',
      content: 'What does this do?',
    });
    expect(mockedAppendThreadMessage.mock.calls[1]?.[0]).toMatchObject({
      repoId: 'repo-1',
      threadId: 'thread-1',
      role: 'assistant',
    });
  });
});
