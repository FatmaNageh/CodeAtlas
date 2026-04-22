import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';

vi.mock('@/db/cypher', () => ({
  runCypher: vi.fn(),
  writeCypher: vi.fn(),
}));

vi.mock('@/ai/embeddings', () => ({
  generateEmbeddings: vi.fn(),
}));

import { embedASTFiles } from '@/pipeline/embed/embedASTFiles';
import { runCypher, writeCypher } from '@/db/cypher';
import { generateEmbeddings } from '@/ai/embeddings';

const mockedRunCypher = vi.mocked(runCypher);
const mockedWriteCypher = vi.mocked(writeCypher);
const mockedGenerateEmbeddings = vi.mocked(generateEmbeddings);

const fixturesDir = path.join(process.cwd(), 'src/__tests__/fixtures');
const embedTestDir = path.join(fixturesDir, 'temp-embed');

describe('embedASTFiles', () => {
  beforeEach(async () => {
    mockedRunCypher.mockReset();
    mockedWriteCypher.mockReset();
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
      { astNodeId: 'ast-1', relPath: 'src/math.ts', symbolName: 'add', startLine: 1, endLine: 3, unitKind: 'function', summaryCandidate: null, segmentReason: null, keywords: null, topLevelSymbols: null },
      { astNodeId: 'ast-2', relPath: 'src/math.ts', symbolName: 'subtract', startLine: 5, endLine: 7, unitKind: 'function', summaryCandidate: null, segmentReason: null, keywords: null, topLevelSymbols: null },
    ];

    mockedRunCypher
      .mockResolvedValueOnce([{ relPath: 'src/math.ts' }])
      .mockResolvedValueOnce(mockSymbols)
      .mockResolvedValue([]);
    mockedWriteCypher.mockResolvedValue([]);

    const mockEmbedding = new Array(1536).fill(0.01);
    mockedGenerateEmbeddings.mockResolvedValue([mockEmbedding, mockEmbedding]);

    const result = await embedASTFiles('test-repo', embedTestDir, 10);

    expect(result.ok).toBe(true);
    expect(result.files).toBe(1);
    expect(result.totalEmbedded).toBe(2);
    expect(result.failedBatches).toBe(0);
    expect(mockedGenerateEmbeddings).toHaveBeenCalledTimes(1);
    expect(mockedRunCypher).toHaveBeenCalledTimes(2);
  });

  it('respects batchSize parameter', async () => {
    const mockSymbols = [
      { astNodeId: 'ast-1', relPath: 'src/math.ts', symbolName: 'sym1', startLine: 1, endLine: 2, unitKind: 'function', summaryCandidate: null, segmentReason: null, keywords: null, topLevelSymbols: null },
      { astNodeId: 'ast-2', relPath: 'src/math.ts', symbolName: 'sym2', startLine: 3, endLine: 4, unitKind: 'function', summaryCandidate: null, segmentReason: null, keywords: null, topLevelSymbols: null },
      { astNodeId: 'ast-3', relPath: 'src/math.ts', symbolName: 'sym3', startLine: 5, endLine: 6, unitKind: 'function', summaryCandidate: null, segmentReason: null, keywords: null, topLevelSymbols: null },
      { astNodeId: 'ast-4', relPath: 'src/math.ts', symbolName: 'sym4', startLine: 7, endLine: 8, unitKind: 'function', summaryCandidate: null, segmentReason: null, keywords: null, topLevelSymbols: null },
    ];

    mockedRunCypher
      .mockResolvedValueOnce([{ relPath: 'src/math.ts' }])
      .mockResolvedValueOnce(mockSymbols)
      .mockResolvedValue([]);
    mockedWriteCypher.mockResolvedValue([]);

    const mockEmbedding = new Array(1536).fill(0.01);
    mockedGenerateEmbeddings.mockResolvedValue([mockEmbedding, mockEmbedding]);

    await embedASTFiles('test-repo', embedTestDir, 2);

    expect(mockedGenerateEmbeddings).toHaveBeenCalledTimes(2);
  });

  it('respects maxFiles parameter', async () => {
    const mockSymbols = [
      { astNodeId: 'ast-1', relPath: 'src/math.ts', symbolName: 'add', startLine: 1, endLine: 3 },
      { astNodeId: 'ast-2', relPath: 'src/index.js', symbolName: 'hello', startLine: 1, endLine: 3 },
    ];

    mockedRunCypher.mockResolvedValue(mockSymbols);

    const mockEmbedding = new Array(1536).fill(0.01);
    mockedGenerateEmbeddings.mockResolvedValue([mockEmbedding]);

    await embedASTFiles('test-repo', embedTestDir, 10, 1);

    expect(mockedGenerateEmbeddings).toHaveBeenCalledTimes(1);
  });

  it('handles batch embedding failure gracefully', async () => {
    const mockSymbols = [
      { astNodeId: 'ast-1', relPath: 'src/math.ts', symbolName: 'add', startLine: 1, endLine: 3, unitKind: 'function', summaryCandidate: null, segmentReason: null, keywords: null, topLevelSymbols: null },
    ];

    mockedRunCypher
      .mockResolvedValueOnce([{ relPath: 'src/math.ts' }])
      .mockResolvedValueOnce(mockSymbols);
    mockedWriteCypher.mockResolvedValue([]);

    mockedGenerateEmbeddings.mockRejectedValue(new Error('API timeout'));

    const result = await embedASTFiles('test-repo', embedTestDir, 10);

    expect(result.ok).toBe(false);
    expect(result.failedBatches).toBe(1);
    expect(result.failedBatchDetails).toHaveLength(1);
    expect(result.totalEmbedded).toBe(0);
  });

  it('handles null embeddings from fallback', async () => {
    const mockSymbols = [
      { astNodeId: 'ast-1', relPath: 'src/math.ts', symbolName: 'add', startLine: 1, endLine: 3, unitKind: 'function', summaryCandidate: null, segmentReason: null, keywords: null, topLevelSymbols: null },
      { astNodeId: 'ast-2', relPath: 'src/math.ts', symbolName: 'subtract', startLine: 5, endLine: 7, unitKind: 'function', summaryCandidate: null, segmentReason: null, keywords: null, topLevelSymbols: null },
    ];

    mockedRunCypher
      .mockResolvedValueOnce([{ relPath: 'src/math.ts' }])
      .mockResolvedValueOnce(mockSymbols)
      .mockResolvedValue([]);
    mockedWriteCypher.mockResolvedValue([]);

    const mockEmbedding = new Array(1536).fill(0.01);
    mockedGenerateEmbeddings.mockResolvedValue([mockEmbedding, new Array(1536).fill(null)]);

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
      { astNodeId: 'ast-1', relPath: 'src/nonexistent.ts', symbolName: 'missing', startLine: 1, endLine: 5 },
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
      { astNodeId: 'ast-1', relPath: 'src/empty.ts', symbolName: 'empty', startLine: 1, endLine: 1 },
    ];

    mockedRunCypher.mockResolvedValue(mockSymbols);

    const result = await embedASTFiles('test-repo', embedTestDir, 10);

    expect(result.files).toBe(0);
    expect(result.totalEmbedded).toBe(0);

    await fs.rm(emptyFile, { force: true });
  });

  it('embeds class chunks including class and method context', async () => {
    const classFile = path.join(embedTestDir, 'src', 'user-service.ts');
    await fs.writeFile(
      classFile,
      [
        'export class UserService {',
        '  createUser(name: string): string {',
        '    return `created:${name}`;',
        '  }',
        '',
        '  deleteUser(name: string): string {',
        '    return `deleted:${name}`;',
        '  }',
        '}',
      ].join('\n'),
      'utf-8',
    );

    const classSymbols = [
      {
        astNodeId: 'ast-class-1',
        relPath: 'src/user-service.ts',
        symbolName: 'UserService',
        unitKind: 'class',
        summaryCandidate: 'Service that manages user lifecycle methods.',
        segmentReason: 'class declaration',
        keywords: ['user', 'service'],
        topLevelSymbols: ['UserService'],
        startLine: 1,
        endLine: 9,
      },
    ];

    mockedRunCypher
      .mockResolvedValueOnce([{ relPath: 'src/user-service.ts' }])
      .mockResolvedValueOnce(classSymbols);
    mockedWriteCypher.mockResolvedValue([]);

    const mockEmbedding = new Array(1536).fill(0.01);
    mockedGenerateEmbeddings.mockResolvedValue([mockEmbedding]);

    const result = await embedASTFiles('test-repo', embedTestDir, 10);

    expect(result.ok).toBe(true);
    expect(result.totalEmbedded).toBe(1);
    expect(mockedGenerateEmbeddings).toHaveBeenCalledTimes(1);

    const firstCall = mockedGenerateEmbeddings.mock.calls[0];
    expect(firstCall).toBeDefined();
    const firstBatch = firstCall?.[0];
    expect(firstBatch).toBeDefined();
    const firstText = firstBatch?.[0];
    expect(firstText).toContain('Label: UserService');
    expect(firstText).toContain('Unit kind: class');
    expect(firstText).toContain('class UserService');
    expect(firstText).toContain('createUser(name: string): string');
    expect(firstText).toContain('deleteUser(name: string): string');
  });

  it('partitions 2000 embedding jobs without dropping or duplicating chunks', async () => {
    const totalSymbols = 2000;
    const batchSize = 128;
    const bulkFile = path.join(embedTestDir, 'src', 'bulk.ts');

    const lines = Array.from(
      { length: totalSymbols },
      (_, index) => `export function fn${index}(): number { return ${index}; }`,
    );
    await fs.writeFile(bulkFile, lines.join('\n'), 'utf-8');

    const bulkSymbols = Array.from({ length: totalSymbols }, (_, index) => ({
      astNodeId: `ast-${index}`,
      relPath: 'src/bulk.ts',
      symbolName: `fn${index}`,
      unitKind: 'function',
      summaryCandidate: null,
      segmentReason: 'function declaration',
      keywords: ['function'],
      topLevelSymbols: [`fn${index}`],
      startLine: index + 1,
      endLine: index + 1,
    }));

    mockedRunCypher
      .mockResolvedValueOnce([{ relPath: 'src/bulk.ts' }])
      .mockResolvedValueOnce(bulkSymbols);
    mockedWriteCypher.mockResolvedValue([]);
    mockedGenerateEmbeddings.mockImplementation(async (texts: string[]) =>
      texts.map(() => new Array(1536).fill(0.01)),
    );

    const result = await embedASTFiles('test-repo', embedTestDir, batchSize);

    expect(result.ok).toBe(true);
    expect(result.files).toBe(1);
    expect(result.totalEmbedded).toBe(totalSymbols);
    expect(result.failedBatches).toBe(0);
    expect(mockedGenerateEmbeddings).toHaveBeenCalledTimes(
      Math.ceil(totalSymbols / batchSize),
    );

    const allTexts = mockedGenerateEmbeddings.mock.calls.flatMap((call) => call[0]);
    expect(allTexts).toHaveLength(totalSymbols);
    expect(new Set(allTexts).size).toBe(totalSymbols);
  });

  it('supports adaptive mode and reports adaptive tuning info', async () => {
    const mockSymbols = [
      { astNodeId: 'ast-1', relPath: 'src/math.ts', symbolName: 'add', startLine: 1, endLine: 3, unitKind: 'function', summaryCandidate: null, segmentReason: null, keywords: null, topLevelSymbols: null },
      { astNodeId: 'ast-2', relPath: 'src/math.ts', symbolName: 'subtract', startLine: 5, endLine: 7, unitKind: 'function', summaryCandidate: null, segmentReason: null, keywords: null, topLevelSymbols: null },
    ];

    mockedRunCypher
      .mockResolvedValueOnce([{ relPath: 'src/math.ts' }])
      .mockResolvedValueOnce(mockSymbols);
    mockedWriteCypher.mockResolvedValue([]);
    mockedGenerateEmbeddings.mockResolvedValue([
      new Array(1536).fill(0.01),
      new Array(1536).fill(0.02),
    ]);

    const result = await embedASTFiles('test-repo', embedTestDir, 10, Number.POSITIVE_INFINITY, true);

    expect(result.ok).toBe(true);
    expect(result.totalEmbedded).toBe(2);
    expect(result.adaptive).toBeDefined();
    expect(result.adaptive?.enabled).toBe(true);

    const call = mockedGenerateEmbeddings.mock.calls[0];
    expect(call?.[1]).toEqual({ concurrency: 4 });
  });
});
