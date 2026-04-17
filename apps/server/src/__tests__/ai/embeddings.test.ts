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
    const mockEmbedding = new Array(1536).fill(0.01);
    mockedEmbed.mockResolvedValue({ embedding: mockEmbedding } as any);

    const result = await generateEmbeddings(['hello world']);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(mockEmbedding);
  });

  it('generates embeddings for multiple texts', async () => {
    const mockEmbedding1 = new Array(1536).fill(0.01);
    const mockEmbedding2 = new Array(1536).fill(0.02);
    mockedEmbed
      .mockResolvedValueOnce({ embedding: mockEmbedding1 } as any)
      .mockResolvedValueOnce({ embedding: mockEmbedding2 } as any);

    const result = await generateEmbeddings(['text1', 'text2']);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(mockEmbedding1);
    expect(result[1]).toBe(mockEmbedding2);
  });

  it('returns null on API failure', async () => {
    mockedEmbed.mockRejectedValue(new Error('API error'));

    const result = await generateEmbeddings(['fail']);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeNull();
  });

  it('handles mixed success and failure', async () => {
    const mockEmbedding = new Array(1536).fill(0.01);
    mockedEmbed
      .mockResolvedValueOnce({ embedding: mockEmbedding } as any)
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce({ embedding: mockEmbedding } as any);

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
    const mockEmbedding = new Array(1536).fill(0.01);
    mockedEmbed.mockResolvedValue({ embedding: mockEmbedding } as any);

    const result = await generateSingleEmbed('hello');
    expect(result).toBe(mockEmbedding);
    expect(result).toHaveLength(1536);
  });

  it('throws on API failure', async () => {
    mockedEmbed.mockRejectedValue(new Error('API error'));

    await expect(generateSingleEmbed('fail')).rejects.toThrow('API error');
  });

  it('handles empty string', async () => {
    const mockEmbedding = new Array(1536).fill(0.01);
    mockedEmbed.mockResolvedValue({ embedding: mockEmbedding } as any);

    const result = await generateSingleEmbed('');
    expect(result).toBe(mockEmbedding);
  });
});
