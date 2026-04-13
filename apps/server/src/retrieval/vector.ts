import { runCypher } from '@/db/cypher';

export type SimilarASTNodeRow = {
  score: number;
  filePath: string;
  chunkText: string | null;
  symbol: string | null;
  startLine: number | null;
  endLine: number | null;
  sourceKind: 'ast' | 'text';
};

export type FileASTChunkRow = {
  id: string;
  text: string | null;
  name: string | null;
  qname: string | null;
  startLine: number | null;
  endLine: number | null;
  sourceKind: 'ast' | 'text';
};

export async function findSimilarChunks(
  queryEmbedding: number[],
  repoId: string,
  limit: number = 10
) {
  const fetchLimit = Math.max(Math.floor(limit) * 3, Math.floor(limit) + 10);

  const [astRows, textRows] = await Promise.all([
    runCypher<SimilarASTNodeRow>(
    `/*cypher*/
    CALL db.index.vector.queryNodes('astnode_embedding', toInteger($fetchLimit), $queryEmbedding)
      YIELD node, score
      WHERE node.repoId = $repoId AND node:AstNode
      RETURN
        score,
        node.filePath AS filePath,
        node.text AS chunkText,
        coalesce(node.qname, node.name) AS symbol,
        node.startLine AS startLine,
        node.endLine AS endLine,
        'ast' AS sourceKind
      ORDER BY score DESC
      LIMIT toInteger($limit)`,
    { queryEmbedding, repoId, fetchLimit, limit }
    ),
    runCypher<SimilarASTNodeRow>(
      `/*cypher*/
      CALL db.index.vector.queryNodes('textchunk_embedding', toInteger($fetchLimit), $queryEmbedding)
        YIELD node, score
        WHERE node.repoId = $repoId AND node:TextChunk
        RETURN
          score,
          node.filePath AS filePath,
          node.content AS chunkText,
          null AS symbol,
          node.startLine AS startLine,
          node.endLine AS endLine,
          'text' AS sourceKind
        ORDER BY score DESC
        LIMIT toInteger($limit)`,
      { queryEmbedding, repoId, fetchLimit, limit }
    ),
  ]);

  return [...astRows, ...textRows]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export async function getFileChunks(filePath: string, repoId: string) {
  const [astChunks, textChunks] = await Promise.all([
    runCypher<FileASTChunkRow>(
      `/*cypher*/
      MATCH (:CodeFile {repoId: $repoId, path: $filePath})-[:DECLARES]->(a:AstNode)
      RETURN
        a.id AS id,
        a.text AS text,
        a.name AS name,
        a.qname AS qname,
        a.startLine AS startLine,
        a.endLine AS endLine,
        'ast' AS sourceKind
      ORDER BY a.startLine`,
      { repoId, filePath }
    ),
    runCypher<FileASTChunkRow>(
      `/*cypher*/
      MATCH (:TextFile {repoId: $repoId, path: $filePath})-[:HAS_CHUNK]->(c:TextChunk)
      RETURN
        c.id AS id,
        c.content AS text,
        null AS name,
        null AS qname,
        c.startLine AS startLine,
        c.endLine AS endLine,
        'text' AS sourceKind
      ORDER BY c.chunkIndex`,
      { repoId, filePath }
    ),
  ]);

  return [...astChunks, ...textChunks].sort((left, right) => {
    const leftLine = left.startLine ?? Number.MAX_SAFE_INTEGER;
    const rightLine = right.startLine ?? Number.MAX_SAFE_INTEGER;
    return leftLine - rightLine;
  });
}
