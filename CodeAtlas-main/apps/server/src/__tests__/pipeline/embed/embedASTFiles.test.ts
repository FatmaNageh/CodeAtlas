import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';

vi.mock('@/db/cypher', () => ({
  runCypher: vi.fn(),
}));

vi.mock('@/ai/embeddings', () => ({
  generateEmbeddings: vi.fn(),
}));

import { embedASTFiles } from '@/pipeline/embed/embedASTFiles';
import { runCypher } from '@/db/cypher';
import { generateEmbeddings } from '@/ai/embeddings';

const mockedRunCypher = vi.mocked(runCypher);
const mockedGenerateEmbeddings = vi.mocked(generateEmbeddings);

const fixturesDir = path.join(process.cwd(), 'src/__tests__/fixtures');
const embedTestDir = path.join(fixturesDir, 'temp-embed');

describe('embedASTFiles', () => {
  beforeEach(async () => {
    mockedRunCypher.mockReset();
    mockedGenerateEmbeddings.mockReset();

    await fs.rm(embedTestDir, { recursive: true, force: true });
    await fs.mkdir(path.join(embedTestDir, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(embedTestDir, 'src', 'math.ts'),
      'export function add(a: number, b: number): number {\n  return a + b;\n}\n\nexport function subtract(a: number, b: number): number {\n  return a - b;\n}',
      'utf-8',
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns early with zero counts when no symbols found', async () => {
    mockedRunCypher.mockResolvedValue([]);

    const result = await embedASTFiles('test-repo', embedTestDir, 10);

    expect(result).toEqual({ ok: true, files: 0, totalEmbedded: 0, failedBatches: 0 });
    expect(mockedGenerateEmbeddings).not.toHaveBeenCalled();
  });

  it('processes symbols and embeds chunks successfully', async () => {
    const mockSymbols = [
      { relPath: 'src/math.ts', symbolName: 'add', startLine: 1, endLine: 3 },
      { relPath: 'src/math.ts', symbolName: 'subtract', startLine: 5, endLine: 7 },
    ];

    mockedRunCypher
      .mockResolvedValueOnce(mockSymbols)
      .mockResolvedValueOnce(undefined);

    const mockEmbedding = new Array(1536).fill(0.01);
    mockedGenerateEmbeddings.mockResolvedValue([mockEmbedding, mockEmbedding]);

    const result = await embedASTFiles('test-repo', embedTestDir, 10);

    expect(result.ok).toBe(true);
    expect(result.files).toBe(1);
    expect(result.totalEmbedded).toBe(2);
    expect(result.failedBatches).toBe(0);
    expect(mockedGenerateEmbeddings).toHaveBeenCalledTimes(1);
    expect(mockedRunCypher).toHaveBeenCalledTimes(3);
  });

  it('respects batchSize parameter', async () => {
    const mockSymbols = [
      { relPath: 'src/math.ts', symbolName: 'sym1', startLine: 1, endLine: 2 },
      { relPath: 'src/math.ts', symbolName: 'sym2', startLine: 3, endLine: 4 },
      { relPath: 'src/math.ts', symbolName: 'sym3', startLine: 5, endLine: 6 },
      { relPath: 'src/math.ts', symbolName: 'sym4', startLine: 7, endLine: 8 },
    ];

    mockedRunCypher
      .mockResolvedValueOnce(mockSymbols)
      .mockResolvedValue(undefined);

    const mockEmbedding = new Array(1536).fill(0.01);
    mockedGenerateEmbeddings.mockResolvedValue([mockEmbedding, mockEmbedding]);

    await embedASTFiles('test-repo', embedTestDir, 2);

    expect(mockedGenerateEmbeddings).toHaveBeenCalledTimes(2);
  });

  it('respects maxFiles parameter', async () => {
    const mockSymbols = [
      { relPath: 'src/math.ts', symbolName: 'add', startLine: 1, endLine: 3 },
      { relPath: 'src/index.js', symbolName: 'hello', startLine: 1, endLine: 3 },
    ];

    mockedRunCypher.mockResolvedValue(mockSymbols);

    const mockEmbedding = new Array(1536).fill(0.01);
    mockedGenerateEmbeddings.mockResolvedValue([mockEmbedding]);

    await embedASTFiles('test-repo', embedTestDir, 10, 1);

    expect(mockedGenerateEmbeddings).toHaveBeenCalledTimes(1);
  });

  it('handles batch embedding failure gracefully', async () => {
    const mockSymbols = [
      { relPath: 'src/math.ts', symbolName: 'add', startLine: 1, endLine: 3 },
    ];

    mockedRunCypher.mockResolvedValueOnce(mockSymbols);

    mockedGenerateEmbeddings.mockRejectedValue(new Error('API timeout'));

    const result = await embedASTFiles('test-repo', embedTestDir, 10);

    expect(result.ok).toBe(false);
    expect(result.failedBatches).toBe(1);
    expect(result.failedBatchDetails).toHaveLength(1);
    expect(result.totalEmbedded).toBe(0);
  });

  it('handles null embeddings from fallback', async () => {
    const mockSymbols = [
      { relPath: 'src/math.ts', symbolName: 'add', startLine: 1, endLine: 3 },
      { relPath: 'src/math.ts', symbolName: 'subtract', startLine: 5, endLine: 7 },
    ];

    mockedRunCypher
      .mockResolvedValueOnce(mockSymbols)
      .mockResolvedValue(undefined);

    const mockEmbedding = new Array(1536).fill(0.01);
    mockedGenerateEmbeddings.mockResolvedValue([mockEmbedding, null]);

    const result = await embedASTFiles('test-repo', embedTestDir, 10);

    expect(result.totalEmbedded).toBe(1);
    expect(result.ok).toBe(true);
  });

  it('throws on invalid batchSize', async () => {
    await expect(embedASTFiles('test-repo', embedTestDir, 0)).rejects.toThrow(
      'batchSize must be >= 1',
    );
  });

  it('throws on invalid maxFiles', async () => {
    await expect(embedASTFiles('test-repo', embedTestDir, 10, 0)).rejects.toThrow(
      'maxFiles must be >= 1',
    );
  });

  it('handles missing file gracefully', async () => {
    const mockSymbols = [
      { relPath: 'src/nonexistent.ts', symbolName: 'missing', startLine: 1, endLine: 5 },
    ];

    mockedRunCypher.mockResolvedValue(mockSymbols);

    const result = await embedASTFiles('test-repo', embedTestDir, 10);

    expect(result.files).toBe(0);
    expect(result.totalEmbedded).toBe(0);
  });

  it('handles empty file gracefully', async () => {
    const emptyFile = path.join(embedTestDir, 'src', 'empty.ts');
    await fs.writeFile(emptyFile, '', 'utf-8');

    const mockSymbols = [
      { relPath: 'src/empty.ts', symbolName: 'empty', startLine: 1, endLine: 1 },
    ];

    mockedRunCypher.mockResolvedValue(mockSymbols);

    const result = await embedASTFiles('test-repo', embedTestDir, 10);

    expect(result.files).toBe(0);
    expect(result.totalEmbedded).toBe(0);

    await fs.rm(emptyFile, { force: true });
  });
});
