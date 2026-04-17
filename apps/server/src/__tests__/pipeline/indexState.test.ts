import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { loadIndexState, saveIndexState, diffScan } from '@/pipeline/indexState';
import type { ScanResult, IndexState } from '@/pipeline/indexState';

describe('loadIndexState', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(process.cwd(), 'src/__tests__/fixtures/temp-state');
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns null when state file does not exist', async () => {
    const result = await loadIndexState(tmpDir);
    expect(result).toBeNull();
  });

  it('returns null for invalid JSON', async () => {
    const stateDir = path.join(tmpDir, '.codeatlas');
    await fs.mkdir(stateDir, { recursive: true });
    await fs.writeFile(path.join(stateDir, 'index-state.json'), 'not json');
    const result = await loadIndexState(tmpDir);
    expect(result).toBeNull();
  });

  it('returns null for wrong version', async () => {
    const stateDir = path.join(tmpDir, '.codeatlas');
    await fs.mkdir(stateDir, { recursive: true });
    await fs.writeFile(path.join(stateDir, 'index-state.json'), JSON.stringify({ version: 3 }));
    const result = await loadIndexState(tmpDir);
    expect(result).toBeNull();
  });

  it('returns valid state when file exists and is valid', async () => {
    const stateDir = path.join(tmpDir, '.codeatlas');
    await fs.mkdir(stateDir, { recursive: true });
    const state = {
      version: 1,
      repoRoot: tmpDir,
      scannedAt: new Date().toISOString(),
      files: {},
    };
    await fs.writeFile(path.join(stateDir, 'index-state.json'), JSON.stringify(state));
    const result = await loadIndexState(tmpDir);
    expect(result).not.toBeNull();
    expect(result?.version).toBe(1);
    expect(result?.repoRoot).toBe(tmpDir);
  });
});

describe('saveIndexState', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(process.cwd(), 'src/__tests__/fixtures/temp-save-state');
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates state file and directory', async () => {
    const scan: ScanResult = {
      repoRoot: tmpDir,
      entries: [],
      ignoredCount: 0,
      scannedAt: new Date().toISOString(),
    };
    const result = await saveIndexState(tmpDir, scan);
    expect(result.version).toBe(2);
    expect(result.files).toEqual({});

    const stateFile = path.join(tmpDir, '.codeatlas', 'index-state.json');
    const content = await fs.readFile(stateFile, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.version).toBe(2);
  });

  it('saves file metadata correctly', async () => {
    const scan: ScanResult = {
      repoRoot: tmpDir,
      entries: [
        {
          kind: 'code',
          relPath: 'src/index.ts',
          absPath: path.join(tmpDir, 'src/index.ts'),
          language: 'typescript',
          ext: '.ts',
          size: 100,
          mtimeMs: 1234567890,
        },
      ],
      ignoredCount: 0,
      scannedAt: new Date().toISOString(),
    };
    const result = await saveIndexState(tmpDir, scan);
    expect(result.files['src/index.ts']).toEqual({
      kind: 'code',
      mtimeMs: 1234567890,
      size: 100,
      hash: undefined,
    });
  });
});

describe('diffScan', () => {
  it('classifies all files as added when no previous state', () => {
    const curr: ScanResult = {
      repoRoot: '/test',
      entries: [
        { kind: 'code', relPath: 'a.ts', absPath: '/test/a.ts', language: 'typescript', ext: '.ts', size: 100, mtimeMs: 1000 },
        { kind: 'code', relPath: 'b.ts', absPath: '/test/b.ts', language: 'typescript', ext: '.ts', size: 200, mtimeMs: 2000 },
      ],
      ignoredCount: 0,
      scannedAt: new Date().toISOString(),
    };
    const diff = diffScan(null, curr);
    expect(diff.added).toHaveLength(2);
    expect(diff.changed).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.unchanged).toHaveLength(0);
  });

  it('classifies all files as unchanged when no changes', () => {
    const prev: IndexState = {
      version: 1,
      repoRoot: '/test',
      scannedAt: new Date().toISOString(),
      files: {
        'a.ts': { kind: 'code', mtimeMs: 1000, size: 100 },
        'b.ts': { kind: 'code', mtimeMs: 2000, size: 200 },
      },
    };
    const curr: ScanResult = {
      repoRoot: '/test',
      entries: [
        { kind: 'code', relPath: 'a.ts', absPath: '/test/a.ts', language: 'typescript', ext: '.ts', size: 100, mtimeMs: 1000 },
        { kind: 'code', relPath: 'b.ts', absPath: '/test/b.ts', language: 'typescript', ext: '.ts', size: 200, mtimeMs: 2000 },
      ],
      ignoredCount: 0,
      scannedAt: new Date().toISOString(),
    };
    const diff = diffScan(prev, curr);
    expect(diff.added).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.unchanged).toHaveLength(2);
  });

  it('detects file modification via mtime change', () => {
    const prev: IndexState = {
      version: 1,
      repoRoot: '/test',
      scannedAt: new Date().toISOString(),
      files: {
        'a.ts': { kind: 'code', mtimeMs: 1000, size: 100 },
      },
    };
    const curr: ScanResult = {
      repoRoot: '/test',
      entries: [
        { kind: 'code', relPath: 'a.ts', absPath: '/test/a.ts', language: 'typescript', ext: '.ts', size: 150, mtimeMs: 2000 },
      ],
      ignoredCount: 0,
      scannedAt: new Date().toISOString(),
    };
    const diff = diffScan(prev, curr);
    expect(diff.changed).toHaveLength(1);
    expect(diff.unchanged).toHaveLength(0);
  });

  it('detects file removal', () => {
    const prev: IndexState = {
      version: 1,
      repoRoot: '/test',
      scannedAt: new Date().toISOString(),
      files: {
        'a.ts': { kind: 'code', mtimeMs: 1000, size: 100 },
        'b.ts': { kind: 'code', mtimeMs: 2000, size: 200 },
      },
    };
    const curr: ScanResult = {
      repoRoot: '/test',
      entries: [
        { kind: 'code', relPath: 'a.ts', absPath: '/test/a.ts', language: 'typescript', ext: '.ts', size: 100, mtimeMs: 1000 },
      ],
      ignoredCount: 0,
      scannedAt: new Date().toISOString(),
    };
    const diff = diffScan(prev, curr);
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]?.relPath).toBe('b.ts');
    expect(diff.unchanged).toHaveLength(1);
  });

  it('handles mixed scenario (add + change + remove + unchanged)', () => {
    const prev: IndexState = {
      version: 1,
      repoRoot: '/test',
      scannedAt: new Date().toISOString(),
      files: {
        'unchanged.ts': { kind: 'code', mtimeMs: 1000, size: 100 },
        'changed.ts': { kind: 'code', mtimeMs: 2000, size: 200 },
        'removed.ts': { kind: 'code', mtimeMs: 3000, size: 300 },
      },
    };
    const curr: ScanResult = {
      repoRoot: '/test',
      entries: [
        { kind: 'code', relPath: 'unchanged.ts', absPath: '/test/unchanged.ts', language: 'typescript', ext: '.ts', size: 100, mtimeMs: 1000 },
        { kind: 'code', relPath: 'changed.ts', absPath: '/test/changed.ts', language: 'typescript', ext: '.ts', size: 250, mtimeMs: 2500 },
        { kind: 'code', relPath: 'added.ts', absPath: '/test/added.ts', language: 'typescript', ext: '.ts', size: 400, mtimeMs: 4000 },
      ],
      ignoredCount: 0,
      scannedAt: new Date().toISOString(),
    };
    const diff = diffScan(prev, curr);
    expect(diff.added).toHaveLength(1);
    expect(diff.changed).toHaveLength(1);
    expect(diff.removed).toHaveLength(1);
    expect(diff.unchanged).toHaveLength(1);
  });

  it('detects changes via hash when mtime and size are same', () => {
    const prev: IndexState = {
      version: 2,
      repoRoot: '/test',
      scannedAt: new Date().toISOString(),
      scanHashMode: 'code',
      files: {
        'a.ts': { kind: 'code', mtimeMs: 1000, size: 100, hash: 'abc123' },
      },
    };
    const curr: ScanResult = {
      repoRoot: '/test',
      entries: [
        { kind: 'code', relPath: 'a.ts', absPath: '/test/a.ts', language: 'typescript', ext: '.ts', size: 100, mtimeMs: 1000, hash: 'def456' },
      ],
      ignoredCount: 0,
      scannedAt: new Date().toISOString(),
      hashMode: 'code',
    };
    const diff = diffScan(prev, curr);
    expect(diff.changed).toHaveLength(1);
  });
});
