import fs from 'fs/promises';
import path from 'path';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { indexRepository } from '@/pipeline/indexRepo';

const fixturesDir = path.join(process.cwd(), 'src/__tests__/fixtures');
const perfRepo = path.join(fixturesDir, 'temp-perf-repo');

describe('indexRepository performance benchmarks', () => {
  beforeAll(async () => {
    await fs.rm(perfRepo, { recursive: true, force: true });
    await fs.mkdir(path.join(perfRepo, 'src'), { recursive: true });
    await fs.writeFile(path.join(perfRepo, 'src', 'index.ts'), 'export function main(): number { return 1; }', 'utf-8');
    await fs.writeFile(path.join(perfRepo, 'src', 'util.ts'), 'export const plus = (a: number, b: number): number => a + b;', 'utf-8');
    await fs.writeFile(path.join(perfRepo, 'README.md'), '# Perf fixture\n\nSmall fixture for pipeline perf tests.', 'utf-8');
  });

  afterAll(async () => {
    await fs.rm(perfRepo, { recursive: true, force: true });
  });

  it('measures full index performance on fzf-master', async () => {
    const start = performance.now();

    const result = await indexRepository({
      projectPath: perfRepo,
      mode: 'full',
      saveDebugJson: false,
      dryRun: true,
    });

    const duration = performance.now() - start;

    console.log(`[PERF] Full index: ${duration.toFixed(0)}ms`);
    console.log(`[PERF] Files scanned: ${result.scanned.totalFiles}`);
    console.log(`[PERF] Files processed: ${result.scanned.processedFiles}`);
    console.log(`[PERF] AST nodes: ${result.stats.astNodes}`);
    console.log(`[PERF] Edges: ${result.stats.edges}`);
    console.log(`[PERF] Files/sec: ${(result.scanned.totalFiles / (duration / 1000)).toFixed(1)}`);

    expect(duration).toBeLessThan(60000);
    expect(result.scanned.totalFiles).toBeGreaterThan(0);
  });

  it('measures incremental index performance (no changes)', async () => {
    await indexRepository({
      projectPath: perfRepo,
      mode: 'full',
      saveDebugJson: false,
      dryRun: true,
    });

    const start = performance.now();

    const result = await indexRepository({
      projectPath: perfRepo,
      mode: 'incremental',
      saveDebugJson: false,
      dryRun: true,
    });

    const duration = performance.now() - start;

    console.log(`[PERF] Incremental (no changes): ${duration.toFixed(0)}ms`);
    console.log(`[PERF] Files processed: ${result.scanned.processedFiles}`);

    expect(duration).toBeLessThan(30000);
    expect(result.scanned.processedFiles).toBe(0);
  });

  it('measures scan phase performance', async () => {
    const { scanRepo } = await import('../../pipeline/scan');

    const start = performance.now();
    const scanResult = await scanRepo(perfRepo);
    const duration = performance.now() - start;

    console.log(`[PERF] Scan phase: ${duration.toFixed(0)}ms`);
    console.log(`[PERF] Files found: ${scanResult.entries.length}`);
    console.log(`[PERF] Ignored: ${scanResult.ignoredCount}`);
    console.log(`[PERF] Files/sec: ${(scanResult.entries.length / (duration / 1000)).toFixed(1)}`);

    expect(duration).toBeLessThan(10000);
    expect(scanResult.entries.length).toBeGreaterThan(0);
  });

  it('measures parse and extract performance', async () => {
    const { scanRepo } = await import('../../pipeline/scan');
    const { parseAndExtract } = await import('../../pipeline/parseExtract');

    const scanResult = await scanRepo(perfRepo);
    const codeFiles = scanResult.entries.filter((e) => e.kind === 'code');

    const start = performance.now();
    const facts = await parseAndExtract(codeFiles);
    const duration = performance.now() - start;
    const extractedSymbolCount = Object.values(facts).reduce((count, fileFacts) => {
      return fileFacts.kind === 'code' ? count + fileFacts.astNodes.length : count;
    }, 0);

    console.log(`[PERF] Parse & Extract: ${duration.toFixed(0)}ms`);
    console.log(`[PERF] Code files: ${codeFiles.length}`);
    console.log(`[PERF] Symbols extracted: ${extractedSymbolCount}`);
    console.log(`[PERF] Files/sec: ${(codeFiles.length / (duration / 1000)).toFixed(1)}`);

    expect(duration).toBeLessThan(30000);
  });

  it('measures buildIR performance', async () => {
    const { scanRepo } = await import('../../pipeline/scan');
    const { parseAndExtract } = await import('../../pipeline/parseExtract');
    const { buildIR } = await import('../../pipeline/ir');

    const scanResult = await scanRepo(perfRepo);
    const codeFiles = scanResult.entries.filter((e) => e.kind === 'code');
    const facts = await parseAndExtract(codeFiles);

    const start = performance.now();
    const ir = await buildIR(scanResult, facts);
    const duration = performance.now() - start;

    console.log(`[PERF] Build IR: ${duration.toFixed(0)}ms`);
    console.log(`[PERF] Nodes: ${ir.nodes.length}`);
    console.log(`[PERF] Edges: ${ir.edges.length}`);
    console.log(`[PERF] Nodes/sec: ${(ir.nodes.length / (duration / 1000)).toFixed(1)}`);

    expect(duration).toBeLessThan(10000);
    expect(ir.nodes.length).toBeGreaterThan(0);
    expect(ir.edges.length).toBeGreaterThan(0);
  });
});
