import { findSimilarChunks, getFileChunks } from './vector';
import { getRelatedSymbols, getFileImports } from './graph';
import { generateEmbeddings, generateSingleEmbed } from '../ai/embeddings';

// Pure function to assemble context for a file
export async function assembleFileContext(filePath: string, repoId: string) {
  // Get file chunks
  const fileChunksResult = await getFileChunks(filePath, repoId);
  const fileChunks = fileChunksResult.map((row: any) => row.c);
  
  // Get sample for vector search
  const sampleText = fileChunks[0]?.text || '';
  let similarChunks: any[] = [];
  
  if (sampleText) {
    try {
      const sampleEmbedding = await generateSingleEmbed(sampleText);
      similarChunks = await findSimilarChunks(sampleEmbedding, repoId, 5);
    } catch (e) {
      console.warn(`[CONTEXT] Could not find similar chunks for ${filePath}:`, e);
    }
  }
  
  // Get graph context - use Promise.allSettled to handle failures gracefully
  const results = await Promise.allSettled([
    getRelatedSymbols(filePath, repoId),
    getFileImports(filePath, repoId),
  ]);
  
  const relatedSymbolsResult = results[0].status === 'fulfilled' ? results[0].value : [];
  const importsResult = results[1].status === 'fulfilled' ? results[1].value : [];
  
  if (results[0].status === 'rejected') {
    console.error(`[CONTEXT] Failed to get related symbols for ${filePath}:`, results[0].reason);
  }
  if (results[1].status === 'rejected') {
    console.error(`[CONTEXT] Failed to get file imports for ${filePath}:`, results[1].reason);
  }

  return {
    fileChunks,
    similarChunks,
    relatedSymbols: relatedSymbolsResult,
    imports: importsResult.map((row: any) => row.import).filter(Boolean),
  };
}
