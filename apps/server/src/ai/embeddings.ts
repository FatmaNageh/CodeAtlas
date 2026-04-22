import { embed } from 'ai';

import { openrouter } from '@openrouter/ai-sdk-provider';

type GenerateEmbeddingsOptions = {
  concurrency?: number;
};

const DEFAULT_EMBEDDING_CONCURRENCY = 8;

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

      try {
        const result = await embed({
          model: openrouter.textEmbeddingModel('openai/text-embedding-3-small'),
          value: text,
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
  
  try {
    const result = await embed({
      model: openrouter.textEmbeddingModel("openai/text-embedding-3-small"),
      value: text,
    });
    
    console.log(`[EMBEDDINGS] ✓ Single embedding done`);
    return result.embedding;
  } catch (error) {
    console.error(`[EMBEDDINGS] ✗ Failed to generate embedding:`, error);
    // Propagate error to caller
    throw error;
  }
}
