import { runCypher } from '../db/cypher';

export type SimilarASTNodeRow = {
  score: number;
  filePath: string;
  chunkText: string | null;
  symbol: string | null;
  startLine: number | null;
  endLine: number | null;
};

export type FileASTChunkRow = {
  id: string;
  text: string | null;
  name: string | null;
  qname: string | null;
  startLine: number | null;
  endLine: number | null;
};

export async function findSimilarChunks(
  queryEmbedding: number[],
  repoId: string,
  limit: number = 10
) {
  const fetchLimit = Math.max(Math.floor(limit) * 3, Math.floor(limit) + 10);
  
  return runCypher<SimilarASTNodeRow>(
    `CALL db.index.vector.queryNodes('astnode_embedding', toInteger($fetchLimit), $queryEmbedding)
      YIELD node, score
      WHERE node.repoId = $repoId AND node:ASTNode
      RETURN
        score,
        node.fileRelPath AS filePath,
        node.text AS chunkText,
        coalesce(node.qname, node.name) AS symbol,
        node.startLine AS startLine,
        node.endLine AS endLine
      ORDER BY score DESC
      LIMIT toInteger($limit)`,
    { queryEmbedding, repoId, fetchLimit, limit }
  );
}

export async function getFileChunks(filePath: string, repoId: string) {
  return runCypher<FileASTChunkRow>(
    `MATCH (:CodeFile {repoId: $repoId, relPath: $filePath})-[:DECLARES]->(a:ASTNode)
     RETURN
       a.id AS id,
       a.text AS text,
       a.name AS name,
       a.qname AS qname,
       a.startLine AS startLine,
       a.endLine AS endLine
     ORDER BY a.startLine`,
    { repoId, filePath }
  );
}
