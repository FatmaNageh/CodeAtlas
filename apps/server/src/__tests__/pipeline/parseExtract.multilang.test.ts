import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parseAndExtract } from '@/pipeline/parseExtract';
import { scanRepo } from '@/pipeline/scan';

const fixturesDir = path.join(process.cwd(), 'src/__tests__/fixtures');
const tempDir = path.join(fixturesDir, 'temp-multilang-parse');

describe('parseAndExtract multi-language', () => {
  beforeEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });

    await fs.writeFile(
      path.join(tempDir, 'src', 'main.go'),
      [
        'package main',
        '',
        'func Add(a int, b int) int {',
        '  return a + b',
        '}',
      ].join('\n'),
      'utf-8',
    );

    await fs.writeFile(
      path.join(tempDir, 'src', 'user_service.rb'),
      [
        'class UserService',
        '  def create_user(name)',
        '    "created #{name}"',
        '  end',
        'end',
      ].join('\n'),
      'utf-8',
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('extracts typed symbols for Go and Ruby files', async () => {
    const scan = await scanRepo(tempDir);
    const codeFiles = scan.entries.filter((entry) => entry.kind === 'code');
    const facts = await parseAndExtract(codeFiles);

    const goFacts = facts['src/main.go'];
    const rubyFacts = facts['src/user_service.rb'];

    expect(goFacts?.kind).toBe('code');
    expect(rubyFacts?.kind).toBe('code');

    if (!goFacts || goFacts.kind !== 'code') {
      throw new Error('Expected Go facts to be code facts');
    }
    if (!rubyFacts || rubyFacts.kind !== 'code') {
      throw new Error('Expected Ruby facts to be code facts');
    }

    expect(goFacts.astNodes.length).toBeGreaterThan(0);
    expect(goFacts.astNodes.some((node) => node.kind === 'function')).toBe(true);

    expect(rubyFacts.astNodes.length).toBeGreaterThan(0);
    expect(rubyFacts.astNodes.some((node) => node.kind === 'class')).toBe(true);
    expect(rubyFacts.astNodes.some((node) => node.kind === 'method')).toBe(true);
  });
});
