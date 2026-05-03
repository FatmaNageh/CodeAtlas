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

type MockEmbedResult = Awaited<ReturnType<typeof embed>>;

function makeVector(value: number): number[] {
  return new Array(1536).fill(value);
}

function makeEmbedResult(embedding: number[], value = 'mock-text'): MockEmbedResult {
  return {
    embedding,
    value,
    usage: { tokens: 0 },
    warnings: [],
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('embedding performance benchmarks', () => {
  it('improves throughput with concurrent batch embedding', async () => {
    mockedEmbed.mockImplementation(async () => {
      await wait(20);
      return makeEmbedResult(makeVector(0.01));
    });

    const texts = new Array(48)
      .fill('function test() { return true; }')
      .map((text, index) => `${text} // ${index}`);

    const sequentialStart = performance.now();
    const sequentialResults = await generateEmbeddings(texts, { concurrency: 1 });
    const sequentialDuration = performance.now() - sequentialStart;

    const concurrentStart = performance.now();
    const concurrentResults = await generateEmbeddings(texts, { concurrency: 8 });
    const concurrentDuration = performance.now() - concurrentStart;

    console.log(
      `[PERF] sequential=${sequentialDuration.toFixed(0)}ms concurrent=${concurrentDuration.toFixed(0)}ms for ${texts.length} texts`,
    );

    expect(sequentialResults).toHaveLength(texts.length);
    expect(concurrentResults).toHaveLength(texts.length);
    expect(concurrentDuration).toBeLessThan(sequentialDuration * 0.6);
  });

  it('measures generateSingleEmbed latency', async () => {
    mockedEmbed.mockImplementation(async () => {
      await wait(8);
      return makeEmbedResult(makeVector(0.01));
    });

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

    expect(avg).toBeLessThan(200);
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
