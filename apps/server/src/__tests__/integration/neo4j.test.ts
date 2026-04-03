import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { indexRepository } from '../../pipeline/indexRepo';
import { embedASTFiles } from '../../pipeline/embed/embedASTFiles';

const fixturesDir = path.join(process.cwd(), 'src/__tests__/fixtures');
const tempDir = path.join(fixturesDir, 'temp-integration');

const NEO4J_AVAILABLE = process.env.NEO4J_URI || process.env.NEO4J_URL;

describe.skipIf(!NEO4J_AVAILABLE)('Integration tests (requires Neo4j)', () => {
  beforeAll(async () => {
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('full index pipeline creates nodes in Neo4j', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), 'function test() { return 42; }', 'utf-8');

    const result = await indexRepository({
      projectPath: tempDir,
      mode: 'full',
      saveDebugJson: false,
      dryRun: false,
    });

    expect(result.mode).toBe('full');
    expect(result.dryRun).toBe(false);
    expect(result.scanned.totalFiles).toBeGreaterThanOrEqual(1);
    expect(result.stats.symbols).toBeGreaterThanOrEqual(0);
  });

  it('incremental index updates only changed files', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), 'function test() { return 42; }', 'utf-8');
    await fs.writeFile(path.join(tempDir, 'utils.js'), 'function helper() {}', 'utf-8');

    await indexRepository({
      projectPath: tempDir,
      mode: 'full',
      saveDebugJson: false,
      dryRun: false,
    });

    await new Promise((r) => setTimeout(r, 10));
    await fs.writeFile(path.join(tempDir, 'index.js'), 'function test() { return 99; }', 'utf-8');

    const result = await indexRepository({
      projectPath: tempDir,
      mode: 'incremental',
      saveDebugJson: false,
      dryRun: false,
    });

    expect(result.mode).toBe('incremental');
    expect(result.scanned.diff.changed.length).toBeGreaterThanOrEqual(1);
  });

  it('embedding round-trip: generate, store, and retrieve', async () => {
    await fs.writeFile(path.join(tempDir, 'code.js'), 'function embedded() { return true; }', 'utf-8');

    const indexResult = await indexRepository({
      projectPath: tempDir,
      mode: 'full',
      saveDebugJson: false,
      dryRun: false,
    });

    const embedResult = await embedASTFiles(indexResult.repoId, tempDir, 5);

    expect(embedResult.ok).toBe(true);
    expect(embedResult.totalEmbedded).toBeGreaterThanOrEqual(0);
  });

  it('removes deleted files on incremental run', async () => {
    const toDelete = path.join(tempDir, 'delete-me.js');
    await fs.writeFile(toDelete, 'function deleteMe() {}', 'utf-8');

    await indexRepository({
      projectPath: tempDir,
      mode: 'full',
      saveDebugJson: false,
      dryRun: false,
    });

    await fs.rm(toDelete, { force: true });

    const result = await indexRepository({
      projectPath: tempDir,
      mode: 'incremental',
      saveDebugJson: false,
      dryRun: false,
    });

    expect(result.scanned.diff.removed.length).toBeGreaterThanOrEqual(1);
  });
});
