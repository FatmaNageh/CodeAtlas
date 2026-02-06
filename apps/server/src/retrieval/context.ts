import { findSimilarChunks, getFileChunks } from './vector';
import { getRelatedSymbols, getFileImports } from './graph';
import { generateEmbedding } from '../ai/embeddings';

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
      const sampleEmbedding = await generateEmbedding(sampleText);
      similarChunks = await findSimilarChunks(sampleEmbedding, repoId, 5);
    } catch (e) {
      console.warn(`[CONTEXT] Could not find similar chunks for ${filePath}:`, e);
    }
  }
  
  // Get graph context
  const [relatedSymbolsResult, importsResult] = await Promise.all([
    getRelatedSymbols(filePath, repoId),
    getFileImports(filePath, repoId),
  ]);

  return {
    fileChunks,
    similarChunks,
    relatedSymbols: relatedSymbolsResult,
    imports: importsResult.map((row: any) => row.import).filter(Boolean),
  };
}
