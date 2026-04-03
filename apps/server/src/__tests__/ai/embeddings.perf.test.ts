import { describe, it, expect, vi } from 'vitest';

vi.mock('ai', () => ({
  embed: vi.fn(),
}));

vi.mock('@openrouter/ai-sdk-provider', () => ({
  openrouter: {
    textEmbeddingModel: vi.fn(() => 'mocked-model'),
  },
}));

import { embed } from 'ai';
import { generateEmbeddings, generateSingleEmbed } from '../../ai/embeddings';

const mockedEmbed = vi.mocked(embed);

describe('embedding performance benchmarks', () => {
  it('measures generateEmbeddings throughput', async () => {
    const mockEmbedding = new Array(1536).fill(0.01);
    mockedEmbed.mockResolvedValue({ embedding: mockEmbedding } as any);

    const texts = new Array(50).fill('function test() { return true; }');

    const start = performance.now();
    const results = await generateEmbeddings(texts);
    const duration = performance.now() - start;

    console.log(`[PERF] generateEmbeddings: ${duration.toFixed(0)}ms for ${texts.length} texts`);
    console.log(`[PERF] Texts/sec: ${(texts.length / (duration / 1000)).toFixed(1)}`);

    expect(results).toHaveLength(texts.length);
    expect(duration).toBeLessThan(60000);
  });

  it('measures generateSingleEmbed latency', async () => {
    const mockEmbedding = new Array(1536).fill(0.01);
    mockedEmbed.mockResolvedValue({ embedding: mockEmbedding } as any);

    const iterations = 10;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await generateSingleEmbed('function test() { return true; }');
      const duration = performance.now() - start;
      durations.push(duration);
    }

    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    console.log(`[PERF] generateSingleEmbed: avg=${avg.toFixed(0)}ms, min=${min.toFixed(0)}ms, max=${max.toFixed(0)}ms`);

    expect(avg).toBeLessThan(10000);
  });

  it('measures isValidEmbeddingVector throughput', async () => {
    const { isValidEmbeddingVector } = await import('../../utils/embedding');

    const vec = new Array(1536).fill(0.01);
    const iterations = 100000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      isValidEmbeddingVector(vec);
    }
    const duration = performance.now() - start;

    console.log(`[PERF] isValidEmbeddingVector: ${duration.toFixed(0)}ms for ${iterations} iterations`);
    console.log(`[PERF] Ops/sec: ${(iterations / (duration / 1000)).toFixed(0)}`);

    expect(duration).toBeLessThan(5000);
  });
});
