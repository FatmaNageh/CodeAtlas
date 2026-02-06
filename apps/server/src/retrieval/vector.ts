import { runCypher } from '../db/cypher';

// Pure function for vector similarity search
export async function findSimilarChunks(
  queryEmbedding: number[],
  repoId: string,
  limit: number = 10
) {
  return runCypher(
    `CALL db.index.vector.queryNodes('codechunk_embedding', $limit, $queryEmbedding)
     YIELD node, score
     WHERE node.repoId = $repoId
     RETURN node, score
     ORDER BY score DESC`,
    { queryEmbedding, repoId, limit }
  );
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
