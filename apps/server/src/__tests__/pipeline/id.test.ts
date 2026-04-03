import { describe, it, expect } from 'vitest';
import { sha1, normalizePath, repoIdFromPath } from '../../pipeline/id';

describe('sha1', () => {
  it('returns consistent hex output for same input', () => {
    const result1 = sha1('test');
    const result2 = sha1('test');
    expect(result1).toBe(result2);
  });

  it('returns 40-character hex string', () => {
    const result = sha1('hello world');
    expect(result).toMatch(/^[0-9a-f]{40}$/);
  });

  it('returns different hashes for different inputs', () => {
    const result1 = sha1('input1');
    const result2 = sha1('input2');
    expect(result1).not.toBe(result2);
  });

  it('handles empty string', () => {
    const result = sha1('');
    expect(result).toMatch(/^[0-9a-f]{40}$/);
  });

  it('handles unicode characters', () => {
    const result = sha1('こんにちは');
    expect(result).toMatch(/^[0-9a-f]{40}$/);
  });
});

describe('normalizePath', () => {
  it('converts Windows backslashes to forward slashes', () => {
    expect(normalizePath('src\\utils\\file.ts')).toBe('src/utils/file.ts');
  });

  it('leaves forward slashes unchanged', () => {
    expect(normalizePath('src/utils/file.ts')).toBe('src/utils/file.ts');
  });

  it('handles trailing backslash', () => {
    expect(normalizePath('src\\utils\\')).toBe('src/utils/');
  });

  it('handles mixed slashes', () => {
    expect(normalizePath('src/utils\\components/file.ts')).toBe('src/utils/components/file.ts');
  });

  it('returns same string if no backslashes present', () => {
    expect(normalizePath('already/normalized')).toBe('already/normalized');
  });
});

describe('repoIdFromPath', () => {
  it('returns same ID for same path', () => {
    const id1 = repoIdFromPath('/path/to/repo');
    const id2 = repoIdFromPath('/path/to/repo');
    expect(id1).toBe(id2);
  });

  it('returns different IDs for different paths', () => {
    const id1 = repoIdFromPath('/path/to/repo1');
    const id2 = repoIdFromPath('/path/to/repo2');
    expect(id1).not.toBe(id2);
  });

  it('returns 12-character hex string', () => {
    const id = repoIdFromPath('/some/path');
    expect(id).toMatch(/^[0-9a-f]{12}$/);
  });

  it('treats trailing slash equivalently (path.resolve normalizes)', () => {
    const id1 = repoIdFromPath('/path/to/repo');
    const id2 = repoIdFromPath('/path/to/repo/');
    expect(id1).toBe(id2);
  });

  it('handles Windows-style paths by normalizing slashes', () => {
    const id1 = repoIdFromPath('C:\\path\\to\\repo');
    const id2 = repoIdFromPath('C:/path/to/repo');
    expect(id1).toBe(id2);
  });
});
