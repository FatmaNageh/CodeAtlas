import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { openrouter } from '@openrouter/ai-sdk-provider';

// Pure function to generate embeddings for multiple texts using OpenAI (not OpenRouter)
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  
  console.log(`[EMBEDDINGS] Generating embeddings for ${texts.length} texts...`);
  
  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i]!;
    try {
      console.log(`[EMBEDDINGS] Processing text ${i + 1}/${texts.length} (length: ${text.length})...`);
      const result = await embed({
       // model: openai.textEmbeddingModel('text-embedding-3-small'),
       model:openrouter.textEmbeddingModel("openai/text-embedding-3-small"),
        value: text,
      });
      embeddings.push(result.embedding);
      console.log(`[EMBEDDINGS] ✓ Text ${i + 1} done`);
    } catch (error) {
      console.error(`[EMBEDDINGS] ✗ Failed to embed text ${i + 1}:`, error);
      // Push a zero vector as fallback
      embeddings.push(new Array(1536).fill(0));
    }
  }
  
  console.log(`[EMBEDDINGS] Completed ${embeddings.length} embeddings`);
  return embeddings;
}

// Pure function to generate single embedding using OpenAI
export async function generateEmbedding(text: string): Promise<number[]> {
  console.log(`[EMBEDDINGS] Generating single embedding (length: ${text.length})...`);
  
  try {
    const result = await embed({
      model: openai.textEmbeddingModel('text-embedding-3-small'),
      value: text,
    });
    
    console.log(`[EMBEDDINGS] ✓ Single embedding done`);
    return result.embedding;
  } catch (error) {
    console.error(`[EMBEDDINGS] ✗ Failed to generate embedding:`, error);
    // Return a zero vector as fallback
    return new Array(1536).fill(0);
  }
}
