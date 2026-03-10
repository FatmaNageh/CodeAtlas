import { runCypher } from '../db/cypher';

// Pure function for vector similarity search
export async function findSimilarChunks(
  queryEmbedding: number[],
  repoId: string,
  limit: number = 10
) {
  // Over-fetch to account for repo ID filtering that happens in the WHERE clause
  // The db.index.vector.queryNodes returns results before filtering by repoId,
  // so we fetch more and let the WHERE clause filter them down
  // Ensure we always pass integer values to Cypher (LIMIT expects an integer)
  const fetchLimit = Math.max(Math.floor(limit) * 3, Math.floor(limit) + 10);
  
  const results = await runCypher(
    `CALL db.index.vector.queryNodes('codechunk_embedding', toInteger($fetchLimit), $queryEmbedding)
      YIELD node, score
      WHERE node.repoId = $repoId
      RETURN node, score, node.relPath AS filePath, node.text AS chunkText
      ORDER BY score DESC
      LIMIT toInteger($limit)`,
    { queryEmbedding, repoId, fetchLimit, limit }
  );
  
  return results;
}

// Pure function to get file chunks
export async function getFileChunks(filePath: string, repoId: string) {
  return runCypher(
    `MATCH (c:CodeChunk {repoId: $repoId, relPath: $filePath})
     RETURN c
     ORDER BY c.startLine`,
    { repoId, filePath }
  );
}
