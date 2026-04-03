import { describe, it, expect } from 'vitest';
import path from 'path';
import { scanRepo } from '../../pipeline/scan';

const fixturesDir = path.join(process.cwd(), 'src/__tests__/fixtures');

describe('scanRepo', () => {
  it('scans a simple JS project fixture', async () => {
    const result = await scanRepo(path.join(fixturesDir, 'simple-js-project'));
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.ignoredCount).toBe(0);

    const codeFiles = result.entries.filter((e) => e.kind === 'code');
    const textFiles = result.entries.filter((e) => e.kind === 'text');

    expect(codeFiles.length).toBeGreaterThanOrEqual(2);
    expect(textFiles.length).toBeGreaterThanOrEqual(1);

    const hasTsFile = codeFiles.some((e) => e.kind === 'code' && e.ext === '.ts');
    const hasJsFile = codeFiles.some((e) => e.kind === 'code' && e.ext === '.js');
    const hasMdFile = textFiles.some((e) => e.kind === 'text' && e.textKind === 'markdown');

    expect(hasTsFile).toBe(true);
    expect(hasJsFile).toBe(true);
    expect(hasMdFile).toBe(true);
  });

  it('computes hash when computeHash is true', async () => {
    const result = await scanRepo(path.join(fixturesDir, 'simple-js-project'), { computeHash: true });
    const codeFiles = result.entries.filter((e) => e.kind === 'code');
    expect(codeFiles.length).toBeGreaterThan(0);
    for (const f of codeFiles) {
      expect(f.hash).toBeDefined();
      expect(typeof f.hash).toBe('string');
      expect(f.hash!.length).toBe(40);
    }
  });

  it('does not compute hash when computeHash is false', async () => {
    const result = await scanRepo(path.join(fixturesDir, 'simple-js-project'), { computeHash: false });
    const codeFiles = result.entries.filter((e) => e.kind === 'code');
    for (const f of codeFiles) {
      expect(f.hash).toBeUndefined();
    }
  });

  it('returns empty entries for empty directory', async () => {
    const result = await scanRepo(path.join(fixturesDir, 'empty-repo'));
    expect(result.entries).toHaveLength(0);
    expect(result.ignoredCount).toBe(0);
  });

  it('normalizes paths to forward slashes', async () => {
    const result = await scanRepo(path.join(fixturesDir, 'simple-js-project'));
    for (const entry of result.entries) {
      expect(entry.relPath).not.toContain('\\');
    }
  });
});
