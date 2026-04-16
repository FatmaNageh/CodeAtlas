import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { indexRepository } from '../../pipeline/indexRepo';
import { embedASTFiles } from '../../pipeline/embed/embedASTFiles';
import { runCypher } from '../../db/cypher';
import { getNeo4jClient } from '../../db/neo4j/client';
import { ensureSchema } from '../../db/neo4j/schema';

const fixturesDir = path.join(process.cwd(), 'src/__tests__/fixtures');
const tempDir = path.join(fixturesDir, 'temp-integration');

let neo4jAvailable = false;

beforeAll(async () => {
  await fs.mkdir(tempDir, { recursive: true });
  try {
    const client = getNeo4jClient();
    neo4jAvailable = await client.ping();
  } catch {
    neo4jAvailable = false;
  }
});

afterAll(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
  try {
    await getNeo4jClient().close();
  } catch {
    // ignore
  }
});

describe('Integration tests (requires Neo4j)', () => {
  it('verifies Neo4j connection', async () => {
    expect(neo4jAvailable).toBe(true);
  });

  it('ensures schema exists', async () => {
    await ensureSchema();
    const indexes = await runCypher('SHOW INDEXES');
    expect(indexes.length).toBeGreaterThan(0);
  });

  it('full index pipeline creates nodes in Neo4j', async () => {
    const testDir = path.join(tempDir, 'full-index-test');
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'index.js'), 'function test() { return 42; }', 'utf-8');

    const result = await indexRepository({
      projectPath: testDir,
      mode: 'full',
      saveDebugJson: false,
      dryRun: false,
    });

    expect(result.mode).toBe('full');
    expect(result.dryRun).toBe(false);
    expect(result.scanned.totalFiles).toBeGreaterThanOrEqual(1);

    const nodeCount = await runCypher(
      'MATCH (n {repoId: $repoId}) RETURN count(n) as count',
      { repoId: result.repoId },
    );
    expect(nodeCount[0]).toBeDefined();
    expect(Number(nodeCount[0]?.count)).toBeGreaterThan(0);

    const fileNodes = await runCypher(
      'MATCH (f:CodeFile {repoId: $repoId}) RETURN f.relPath as relPath',
      { repoId: result.repoId },
    );
    expect(fileNodes.length).toBeGreaterThanOrEqual(1);
    expect(fileNodes.some((n) => n.relPath === 'index.js')).toBe(true);
  });

  it('incremental index updates only changed files', async () => {
    const testDir = path.join(tempDir, 'incremental-test');
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'index.js'), 'function test() { return 42; }', 'utf-8');
    await fs.writeFile(path.join(testDir, 'utils.js'), 'function helper() {}', 'utf-8');

    const fullResult = await indexRepository({
      projectPath: testDir,
      mode: 'full',
      saveDebugJson: false,
      dryRun: false,
    });

    await new Promise((r) => setTimeout(r, 50));
    await fs.writeFile(path.join(testDir, 'index.js'), 'function test() { return 99; }', 'utf-8');

    const incrResult = await indexRepository({
      projectPath: testDir,
      mode: 'incremental',
      saveDebugJson: false,
      dryRun: false,
    });

    expect(incrResult.mode).toBe('incremental');
    expect(incrResult.scanned.diff.changed.length).toBeGreaterThanOrEqual(1);

    const fileNodes = await runCypher(
      'MATCH (f:CodeFile {repoId: $repoId}) RETURN f.relPath as relPath ORDER BY f.relPath',
      { repoId: fullResult.repoId },
    );
    expect(fileNodes.length).toBeGreaterThanOrEqual(2);
  });

  it('embedding round-trip: generate, store, and retrieve', async () => {
    const testDir = path.join(tempDir, 'embed-test');
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(
      path.join(testDir, 'math.js'),
      'function add(a, b) { return a + b; }\nfunction subtract(a, b) { return a - b; }',
      'utf-8',
    );

    const indexResult = await indexRepository({
      projectPath: testDir,
      mode: 'full',
      saveDebugJson: false,
      dryRun: false,
    });

    const embedResult = await embedASTFiles(indexResult.repoId, testDir, 5);

    expect(embedResult.ok).toBe(true);
    expect(embedResult.totalEmbedded).toBeGreaterThanOrEqual(0);

    if (embedResult.totalEmbedded > 0) {
      const chunkNodes = await runCypher(
        'MATCH (a:ASTNode {repoId: $repoId}) WHERE a.embedding IS NOT NULL RETURN a.name as symbol, a.fileRelPath as relPath, size(a.embedding) as dim',
        { repoId: indexResult.repoId },
      );
      expect(chunkNodes.length).toBeGreaterThanOrEqual(1);
      expect(chunkNodes[0]).toBeDefined();
      expect(Number(chunkNodes[0]?.dim)).toBe(1536);
    }
  });

  it('removes deleted files on incremental run', async () => {
    const testDir = path.join(tempDir, 'delete-test');
    await fs.mkdir(testDir, { recursive: true });
    const toDelete = path.join(testDir, 'delete-me.js');
    await fs.writeFile(toDelete, 'function deleteMe() {}', 'utf-8');

    const fullResult = await indexRepository({
      projectPath: testDir,
      mode: 'full',
      saveDebugJson: false,
      dryRun: false,
    });

    const beforeDelete = await runCypher(
      'MATCH (f:CodeFile {repoId: $repoId, relPath: $relPath}) RETURN count(f) as count',
      { repoId: fullResult.repoId, relPath: 'delete-me.js' },
    );
    expect(beforeDelete[0]).toBeDefined();
    expect(Number(beforeDelete[0]?.count)).toBe(1);

    await fs.rm(toDelete, { force: true });

    const incrResult = await indexRepository({
      projectPath: testDir,
      mode: 'incremental',
      saveDebugJson: false,
      dryRun: false,
    });

    expect(incrResult.scanned.diff.removed.length).toBeGreaterThanOrEqual(1);

    const afterDelete = await runCypher(
      'MATCH (f:CodeFile {repoId: $repoId, relPath: $relPath}) RETURN count(f) as count',
      { repoId: fullResult.repoId, relPath: 'delete-me.js' },
    );
    expect(afterDelete[0]).toBeDefined();
    expect(Number(afterDelete[0]?.count)).toBe(0);
  });

  it('consecutive full runs replace nodes without duplicates', async () => {
    const testDir = path.join(tempDir, 'duplicate-test');
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'app.js'), 'function app() { return true; }', 'utf-8');

    const result1 = await indexRepository({
      projectPath: testDir,
      mode: 'full',
      saveDebugJson: false,
      dryRun: false,
    });

    const result2 = await indexRepository({
      projectPath: testDir,
      mode: 'full',
      saveDebugJson: false,
      dryRun: false,
    });

    expect(result1.repoId).toBe(result2.repoId);

    const fileCount = await runCypher(
      'MATCH (f:CodeFile {repoId: $repoId, relPath: $relPath}) RETURN count(f) as count',
      { repoId: result1.repoId, relPath: 'app.js' },
    );
    expect(fileCount[0]).toBeDefined();
    expect(Number(fileCount[0]?.count)).toBe(1);
  });

  it('indexes multi-language project correctly', async () => {
    const testDir = path.join(tempDir, 'multi-lang-test');
    await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(testDir, 'src', 'main.ts'), 'export function main(): void {}', 'utf-8');
    await fs.writeFile(path.join(testDir, 'src', 'utils.py'), 'def helper(): pass', 'utf-8');
    await fs.writeFile(path.join(testDir, 'README.md'), '# Multi Lang Project', 'utf-8');

    const result = await indexRepository({
      projectPath: testDir,
      mode: 'full',
      saveDebugJson: false,
      dryRun: false,
    });

    expect(result.scanned.totalFiles).toBeGreaterThanOrEqual(3);

    const codeFiles = await runCypher(
      'MATCH (f:CodeFile {repoId: $repoId}) RETURN f.relPath as relPath, f.language as language ORDER BY f.relPath',
      { repoId: result.repoId },
    );
    expect(codeFiles.length).toBeGreaterThanOrEqual(2);

    const textFiles = await runCypher(
      'MATCH (f:TextFile {repoId: $repoId}) RETURN f.relPath as relPath ORDER BY f.relPath',
      { repoId: result.repoId },
    );
    expect(textFiles.length).toBeGreaterThanOrEqual(1);

    const dirNodes = await runCypher(
      'MATCH (d:Directory {repoId: $repoId}) RETURN count(d) as count',
      { repoId: result.repoId },
    );
    expect(dirNodes[0]).toBeDefined();
    expect(Number(dirNodes[0]?.count)).toBeGreaterThanOrEqual(1);
  });
});
