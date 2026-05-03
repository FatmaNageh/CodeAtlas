import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('ai', () => ({
  embed: vi.fn(),
}));

vi.mock('@openrouter/ai-sdk-provider', () => ({
  openrouter: {
    textEmbeddingModel: vi.fn(() => 'mocked-model'),
  },
}));

import { embed } from 'ai';
import { generateEmbeddings, generateSingleEmbed } from '../../ai/embeddings';

const mockedEmbed = vi.mocked(embed);

type MockEmbedResult = Awaited<ReturnType<typeof embed>>;

function makeVector(value: number): number[] {
  return new Array(1536).fill(value);
}

function makeEmbedResult(embedding: number[], value = 'mock-text'): MockEmbedResult {
  return {
    embedding,
    value,
    usage: { tokens: 0 },
    warnings: [],
  };
}

describe('generateEmbeddings', () => {
  beforeEach(() => {
    mockedEmbed.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array for empty input', async () => {
    const result = await generateEmbeddings([]);
    expect(result).toEqual([]);
    expect(mockedEmbed).not.toHaveBeenCalled();
  });

  it('generates embeddings for single text', async () => {
    const mockEmbedding = makeVector(0.01);
    mockedEmbed.mockResolvedValue(makeEmbedResult(mockEmbedding));

    const result = await generateEmbeddings(['hello world']);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(mockEmbedding);
  });

  it('generates embeddings for multiple texts', async () => {
    const mockEmbedding1 = makeVector(0.01);
    const mockEmbedding2 = makeVector(0.02);
    mockedEmbed
      .mockResolvedValueOnce(makeEmbedResult(mockEmbedding1, 'text1'))
      .mockResolvedValueOnce(makeEmbedResult(mockEmbedding2, 'text2'));

    const result = await generateEmbeddings(['text1', 'text2']);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(mockEmbedding1);
    expect(result[1]).toBe(mockEmbedding2);
  });

  it('returns fallback null on API failure', async () => {
    mockedEmbed.mockRejectedValue(new Error('API error'));

    const result = await generateEmbeddings(['fail']);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeNull();
  });

  it('handles mixed success and failure', async () => {
    const mockEmbedding = makeVector(0.01);
    mockedEmbed
      .mockResolvedValueOnce(makeEmbedResult(mockEmbedding, 'success1'))
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce(makeEmbedResult(mockEmbedding, 'success2'));

    const result = await generateEmbeddings(['success1', 'fail', 'success2']);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(mockEmbedding);
    expect(result[1]).toBeNull();
    expect(result[2]).toBe(mockEmbedding);
  });
});

describe('generateSingleEmbed', () => {
  beforeEach(() => {
    mockedEmbed.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns embedding for valid text', async () => {
    const mockEmbedding = makeVector(0.01);
    mockedEmbed.mockResolvedValue(makeEmbedResult(mockEmbedding, 'hello'));

    const result = await generateSingleEmbed('hello');
    expect(result).toBe(mockEmbedding);
    expect(result).toHaveLength(1536);
  });

  it('throws on API failure', async () => {
    mockedEmbed.mockRejectedValue(new Error('API error'));

    await expect(generateSingleEmbed('fail')).rejects.toThrow('API error');
  });

  it('handles empty string', async () => {
    const mockEmbedding = makeVector(0.01);
    mockedEmbed.mockResolvedValue(makeEmbedResult(mockEmbedding, ''));

    const result = await generateSingleEmbed('');
    expect(result).toBe(mockEmbedding);
  });

  it('keeps output aligned to input order with parallel execution', async () => {
    const values = [0.1, 0.2, 0.3, 0.4];
    mockedEmbed.mockImplementation(async ({ value }) => {
      const text = String(value);
      const numeric = Number(text.replace('text-', ''));
      const delayMs = (5 - numeric) * 5;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return makeEmbedResult(makeVector(numeric / 10), text);
    });

    const result = await generateEmbeddings(
      values.map((value) => `text-${value}`),
      { concurrency: 4 },
    );

    expect(result[0]?.[0]).toBe(0.01);
    expect(result[1]?.[0]).toBe(0.02);
    expect(result[2]?.[0]).toBe(0.03);
    expect(result[3]?.[0]).toBe(0.04);
  });
});
