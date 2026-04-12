import { describe, it, expect } from 'vitest';
import path from 'path';
import { indexRepository } from '../../pipeline/indexRepo';

const fzfMaster = path.join(process.cwd(), '../../example_files/fzf-master');

describe('indexRepository performance benchmarks', () => {
  it('measures full index performance on fzf-master', async () => {
    const start = performance.now();

    const result = await indexRepository({
      projectPath: fzfMaster,
      mode: 'full',
      saveDebugJson: false,
      dryRun: true,
    });

    const duration = performance.now() - start;

    console.log(`[PERF] Full index: ${duration.toFixed(0)}ms`);
    console.log(`[PERF] Files scanned: ${result.scanned.totalFiles}`);
    console.log(`[PERF] Files processed: ${result.scanned.processedFiles}`);
    console.log(`[PERF] AST nodes: ${result.stats.astNodes}`);
    console.log(`[PERF] References: ${result.stats.references}`);
    console.log(`[PERF] Files/sec: ${(result.scanned.totalFiles / (duration / 1000)).toFixed(1)}`);

    expect(duration).toBeLessThan(60000);
    expect(result.scanned.totalFiles).toBeGreaterThan(0);
  });

  it('measures incremental index performance (no changes)', async () => {
    await indexRepository({
      projectPath: fzfMaster,
      mode: 'full',
      saveDebugJson: false,
      dryRun: true,
    });

    const start = performance.now();

    const result = await indexRepository({
      projectPath: fzfMaster,
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
    const scanResult = await scanRepo(fzfMaster);
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

    const scanResult = await scanRepo(fzfMaster);
    const codeFiles = scanResult.entries.filter((e) => e.kind === 'code');

    const start = performance.now();
    const facts = await parseAndExtract(codeFiles);
    const duration = performance.now() - start;
    const extractedSymbolCount = Object.values(facts).reduce((count, fileFacts) => {
      return fileFacts.kind === 'code' ? count + fileFacts.symbols.length : count;
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

    const scanResult = await scanRepo(fzfMaster);
    const codeFiles = scanResult.entries.filter((e) => e.kind === 'code');
    const facts = await parseAndExtract(codeFiles);

    const start = performance.now();
    const ir = buildIR(scanResult, facts);
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
