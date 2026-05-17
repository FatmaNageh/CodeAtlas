import { embed } from 'ai';

import { openrouter } from '@openrouter/ai-sdk-provider';

type GenerateEmbeddingsOptions = {
  concurrency?: number;
};

const DEFAULT_EMBEDDING_CONCURRENCY = 8;
const MAX_EMBEDDING_INPUT_CHARS = 6000;

function normalizeEmbeddingInput(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_EMBEDDING_INPUT_CHARS) {
    return trimmed;
  }

  console.warn(
    `[EMBEDDINGS] Truncating embedding input from ${trimmed.length} to ${MAX_EMBEDDING_INPUT_CHARS} chars`,
  );
  return trimmed.slice(0, MAX_EMBEDDING_INPUT_CHARS);
}

function normalizeConcurrency(value: number | undefined): number {
  if (!value || Number.isNaN(value)) {
    return DEFAULT_EMBEDDING_CONCURRENCY;
  }

  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : 1;
}

// Pure function to generate embeddings for multiple texts using OpenRouter
export async function generateEmbeddings(
  texts: string[],
  options: GenerateEmbeddingsOptions = {},
): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];

  const concurrency = Math.min(normalizeConcurrency(options.concurrency), texts.length);
  const embeddings: Array<number[] | null> = new Array(texts.length).fill(null);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= texts.length) {
        return;
      }

      const text = texts[currentIndex];
      if (!text) {
        embeddings[currentIndex] = null;
        continue;
      }

      const embeddingInput = normalizeEmbeddingInput(text);

      try {
        const result = await embed({
          model: openrouter.textEmbeddingModel('openai/text-embedding-3-small'),
          value: embeddingInput,
          experimental_telemetry: { isEnabled: true },
        });
        embeddings[currentIndex] = result.embedding;
      } catch (error) {
        console.error(`[EMBEDDINGS] Failed to embed text ${currentIndex + 1}/${texts.length}:`, error);
        embeddings[currentIndex] = null;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return embeddings;
}

// Pure function to generate single embedding using OpenRouter
export async function generateSingleEmbed(text: string): Promise<number[]> {
  console.log(`[EMBEDDINGS] Generating single embedding (length: ${text.length})...`);
  const embeddingInput = normalizeEmbeddingInput(text);
  
  try {
    const result = await embed({
      model: openrouter.textEmbeddingModel("openai/text-embedding-3-small"),
      value: embeddingInput,
      experimental_telemetry: { isEnabled: true },
    });
    
    console.log(`[EMBEDDINGS] ✓ Single embedding done`);
    return result.embedding;
  } catch (error) {
    console.error(`[EMBEDDINGS] ✗ Failed to generate embedding:`, error);
    // Propagate error to caller
    throw error;
  }
}
