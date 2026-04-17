import { describe, expect, it } from 'vitest';

import { buildSummaryPrompt } from '@/prompts/summary';

describe('buildSummaryPrompt', () => {
  it('builds a concise prompt with file metadata and guidance', () => {
    const prompt = buildSummaryPrompt({
      filePath: 'src/service.ts',
      code: 'export function run() { return true; }',
      symbols: ['run', 'Service'],
      imports: ['src/dep.ts'],
    });

    expect(prompt).toContain('Analyze this code file: src/service.ts');
    expect(prompt).toContain('SYMBOLS: run, Service');
    expect(prompt).toContain('REFERENCES: src/dep.ts');
    expect(prompt).toContain('Provide a brief functional summary (2-3 sentences)');
  });

  it('truncates oversized code input to 3000 characters in prompt body', () => {
    const longCode = `${'a'.repeat(3000)}<TAIL_MARKER>${'b'.repeat(1900)}`;
    const prompt = buildSummaryPrompt({
      filePath: 'src/long.ts',
      code: longCode,
      symbols: [],
      imports: [],
    });

    const includedLongBlock = longCode.slice(0, 3000);
    expect(prompt).toContain(includedLongBlock);
    expect(prompt).not.toContain('<TAIL_MARKER>');
  });
});
