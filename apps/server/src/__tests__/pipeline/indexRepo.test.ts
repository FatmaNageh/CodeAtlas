import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { indexRepository } from '../../pipeline/indexRepo';

const fixturesDir = path.join(process.cwd(), 'src/__tests__/fixtures');
const tempDir = path.join(fixturesDir, 'temp-indexrepo');

describe('indexRepository (dryRun)', () => {
  beforeEach(async () => {
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('runs full index on first run with no prior state', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), 'function test() {}', 'utf-8');
    const result = await indexRepository({
      projectPath: tempDir,
      mode: 'incremental',
      saveDebugJson: false,
      dryRun: true,
    });

    expect(result.mode).toBe('full');
    expect(result.dryRun).toBe(true);
    expect(result.scanned.totalFiles).toBeGreaterThanOrEqual(1);
    expect(result.scanned.processedFiles).toBeGreaterThanOrEqual(1);
    expect(result.repoId).toBeDefined();
    expect(result.stats).toBeDefined();
  });

  it('runs incremental with no changes after full', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), 'function test() {}', 'utf-8');

    await indexRepository({
      projectPath: tempDir,
      mode: 'full',
      saveDebugJson: false,
      dryRun: true,
    });

    const result = await indexRepository({
      projectPath: tempDir,
      mode: 'incremental',
      saveDebugJson: false,
      dryRun: true,
    });

    expect(result.mode).toBe('incremental');
    expect(result.scanned.diff.added).toHaveLength(0);
    expect(result.scanned.diff.changed).toHaveLength(0);
    expect(result.scanned.diff.removed).toHaveLength(0);
  });

  it('detects added file in incremental mode', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), 'function test() {}', 'utf-8');

    await indexRepository({
      projectPath: tempDir,
      mode: 'full',
      saveDebugJson: false,
      dryRun: true,
    });

    await new Promise((r) => setTimeout(r, 10));
    await fs.writeFile(path.join(tempDir, 'new.js'), 'function added() {}', 'utf-8');

    const result = await indexRepository({
      projectPath: tempDir,
      mode: 'incremental',
      saveDebugJson: false,
      dryRun: true,
    });

    expect(result.scanned.diff.added.length).toBeGreaterThanOrEqual(1);
    expect(result.scanned.processedFiles).toBeGreaterThanOrEqual(1);
  });

  it('detects modified file in incremental mode', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), 'function test() {}', 'utf-8');

    await indexRepository({
      projectPath: tempDir,
      mode: 'full',
      saveDebugJson: false,
      dryRun: true,
    });

    await new Promise((r) => setTimeout(r, 10));
    await fs.writeFile(path.join(tempDir, 'index.js'), 'function test() { console.log("modified"); }', 'utf-8');

    const result = await indexRepository({
      projectPath: tempDir,
      mode: 'incremental',
      saveDebugJson: false,
      dryRun: true,
    });

    expect(result.scanned.diff.changed.length).toBeGreaterThanOrEqual(1);
  });

  it('detects removed file in incremental mode', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), 'function test() {}', 'utf-8');
    await fs.writeFile(path.join(tempDir, 'remove.js'), 'function remove() {}', 'utf-8');

    await indexRepository({
      projectPath: tempDir,
      mode: 'full',
      saveDebugJson: false,
      dryRun: true,
    });

    await fs.rm(path.join(tempDir, 'remove.js'));

    const result = await indexRepository({
      projectPath: tempDir,
      mode: 'incremental',
      saveDebugJson: false,
      dryRun: true,
    });

    expect(result.scanned.diff.removed.length).toBeGreaterThanOrEqual(1);
  });

  it('handles empty directory', async () => {
    const result = await indexRepository({
      projectPath: tempDir,
      mode: 'full',
      saveDebugJson: false,
      dryRun: true,
    });

    expect(result.scanned.totalFiles).toBe(0);
    expect(result.scanned.processedFiles).toBe(0);
    expect(result.mode).toBe('full');
  });

  it('saves index state file', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), 'function test() {}', 'utf-8');

    await indexRepository({
      projectPath: tempDir,
      mode: 'full',
      saveDebugJson: false,
      dryRun: true,
    });

    const stateFile = path.join(tempDir, '.codeatlas', 'index-state.json');
    const content = await fs.readFile(stateFile, 'utf-8');
    const state = JSON.parse(content);
    expect(state.version).toBe(1);
    expect(state.files).toBeDefined();
  });

  it('skips Neo4j operations when dryRun is true', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), 'function test() {}', 'utf-8');

    const result = await indexRepository({
      projectPath: tempDir,
      mode: 'full',
      saveDebugJson: false,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    const stateFile = path.join(tempDir, '.codeatlas', 'index-state.json');
    await expect(fs.readFile(stateFile, 'utf-8')).resolves.toBeDefined();
  });
});
