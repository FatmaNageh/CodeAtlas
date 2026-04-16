import { findSimilarChunks, getFileChunks, type FileASTChunkRow, type SimilarASTNodeRow } from "./vector";
import { getRelatedASTNodes, getFileReferences, type RelatedASTNodeRow } from "./graph";
import { generateSingleEmbed } from "../ai/embeddings";

export type FileContext = {
  fileChunks: FileASTChunkRow[];
  similarChunks: SimilarASTNodeRow[];
  relatedASTNodes: RelatedASTNodeRow[];
  references: string[];
};

function buildChunkRetrievalText(chunk: FileASTChunkRow): string {
  const parts: string[] = [];

  if (chunk.name) {
    parts.push(`Label: ${chunk.name}`);
  }
  if (chunk.unitKind) {
    parts.push(`Unit kind: ${chunk.unitKind}`);
  }
  if (chunk.segmentReason) {
    parts.push(`Segment reason: ${chunk.segmentReason}`);
  }
  if (chunk.topLevelSymbols && chunk.topLevelSymbols.length > 0) {
    parts.push(`Top-level symbols: ${chunk.topLevelSymbols.join(", ")}`);
  }
  if (chunk.keywords && chunk.keywords.length > 0) {
    parts.push(`Keywords: ${chunk.keywords.join(", ")}`);
  }
  if (chunk.summaryCandidate) {
    parts.push(`Summary: ${chunk.summaryCandidate}`);
  }
  if (chunk.text) {
    parts.push(chunk.text);
  }

  return parts.join("\n");
}

export async function assembleFileContext(filePath: string, repoId: string): Promise<FileContext> {
  const fileChunks = await getFileChunks(filePath, repoId);
  const sampleText = fileChunks.map((chunk) => buildChunkRetrievalText(chunk)).find(Boolean) ?? "";
  let similarChunks: SimilarASTNodeRow[] = [];
  
  if (sampleText) {
    try {
      const sampleEmbedding = await generateSingleEmbed(sampleText);
      similarChunks = await findSimilarChunks(sampleEmbedding, repoId, 5);
    } catch (e) {
      console.warn(`[CONTEXT] Could not find similar chunks for ${filePath}:`, e);
    }
  }
  
  const results = await Promise.allSettled([
    getRelatedASTNodes(filePath, repoId),
    getFileReferences(filePath, repoId),
  ]);
  
  const relatedASTNodes = results[0].status === "fulfilled" ? results[0].value : [];
  const references = results[1].status === "fulfilled" ? results[1].value : [];
  
  if (results[0].status === "rejected") {
    console.error(`[CONTEXT] Failed to get related AST nodes for ${filePath}:`, results[0].reason);
  }
  if (results[1].status === "rejected") {
    console.error(`[CONTEXT] Failed to get file references for ${filePath}:`, results[1].reason);
  }

  return {
    fileChunks,
    similarChunks,
    relatedASTNodes,
    references: references.map((row) => row.reference).filter(Boolean),
  };
}
