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
  const fetchLimit = Math.max(limit * 3, limit + 10);
  
  const results = await runCypher(
    `CALL db.index.vector.queryNodes('codechunk_embedding', $fetchLimit, $queryEmbedding)
     YIELD node, score
     WHERE node.repoId = $repoId
     RETURN node, score
     ORDER BY score DESC
     LIMIT $limit`,
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
