import { runCypher } from '@/db/cypher';

export type SimilarASTNodeRow = {
  id: string | null;
  score: number;
  filePath: string;
  chunkText: string | null;
  symbol: string | null;
  unitKind: string | null;
  summaryCandidate: string | null;
  segmentReason: string | null;
  keywords: string[] | null;
  topLevelSymbols: string[] | null;
  tokenCount: number | null;
  startLine: number | null;
  endLine: number | null;
  sourceKind: 'ast' | 'text';
};

export type FileASTChunkRow = {
  id: string;
  text: string | null;
  name: string | null;
  qname: string | null;
  unitKind: string | null;
  summaryCandidate: string | null;
  segmentReason: string | null;
  keywords: string[] | null;
  topLevelSymbols: string[] | null;
  tokenCount: number | null;
  startLine: number | null;
  endLine: number | null;
  sourceKind: 'ast' | 'text';
};

function tokenizeQueryText(queryText: string): string[] {
  return Array.from(
    new Set(
      queryText
        .toLowerCase()
        .match(/[a-z_][a-z0-9_]*/g)
        ?.filter((token) => token.length >= 2) ?? [],
    ),
  );
}

function metadataTextForChunk(chunk: SimilarASTNodeRow): string {
  return [
    chunk.filePath,
    chunk.symbol,
    chunk.unitKind,
    chunk.summaryCandidate,
    chunk.segmentReason,
    ...(chunk.keywords ?? []),
    ...(chunk.topLevelSymbols ?? []),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

export function rankChunkForGraphRag(
  chunk: SimilarASTNodeRow,
  queryTokens: string[],
): number {
  const vectorScore = chunk.score;
  if (queryTokens.length === 0) return vectorScore;

  const metadataText = metadataTextForChunk(chunk);
  const chunkText = chunk.chunkText?.toLowerCase() ?? "";

  let metadataMatches = 0;
  let contentMatches = 0;

  for (const token of queryTokens) {
    if (metadataText.includes(token)) metadataMatches += 1;
    if (chunkText.includes(token)) contentMatches += 1;
  }

  const metadataBoost = metadataMatches * 0.08;
  const contentBoost = contentMatches * 0.03;
  const astBoost = chunk.sourceKind === "ast" ? 0.02 : 0;

  return vectorScore + metadataBoost + contentBoost + astBoost;
}

export async function findSimilarChunks(
  queryEmbedding: number[],
  repoId: string,
  limit: number = 10,
  queryText: string = "",
) {
  const fetchLimit = Math.max(Math.floor(limit) * 3, Math.floor(limit) + 10);
  const queryTokens = tokenizeQueryText(queryText);

  const [astRows, textRows] = await Promise.all([
    runCypher<SimilarASTNodeRow>(
    `/*cypher*/
    CALL db.index.vector.queryNodes('astnode_embedding', toInteger($fetchLimit), $queryEmbedding)
      YIELD node, score
      WHERE node.repoId = $repoId AND node:AstNode
      RETURN
        score,
        node.id AS id,
        node.filePath AS filePath,
        node.text AS chunkText,
        coalesce(node.label, node.displayName, node.qname, node.name) AS symbol,
        node.unitKind AS unitKind,
        node.summaryCandidate AS summaryCandidate,
        node.segmentReason AS segmentReason,
        node.keywords AS keywords,
        node.topLevelSymbols AS topLevelSymbols,
        node.tokenCount AS tokenCount,
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
          node.id AS id,
          node.filePath AS filePath,
          node.content AS chunkText,
          null AS symbol,
          null AS unitKind,
          null AS summaryCandidate,
          null AS segmentReason,
          null AS keywords,
          null AS topLevelSymbols,
          null AS tokenCount,
          node.startLine AS startLine,
          node.endLine AS endLine,
          'text' AS sourceKind
        ORDER BY score DESC
        LIMIT toInteger($limit)`,
      { queryEmbedding, repoId, fetchLimit, limit }
    ),
  ]);

  return [...astRows, ...textRows]
    .sort(
      (left, right) =>
        rankChunkForGraphRag(right, queryTokens) -
        rankChunkForGraphRag(left, queryTokens),
    )
    .slice(0, limit);
}

export async function getFileChunks(filePath: string, repoId: string) {
  const [astChunks, textChunks] = await Promise.all([
    runCypher<FileASTChunkRow>(
      `/*cypher*/
      MATCH (:CodeFile {repoId: $repoId, path: $filePath})-[:HAS_AST]->(a:AstNode)
      RETURN
        a.id AS id,
        a.text AS text,
        a.label AS name,
        a.label AS qname,
        a.unitKind AS unitKind,
        a.summaryCandidate AS summaryCandidate,
        a.segmentReason AS segmentReason,
        a.keywords AS keywords,
        a.topLevelSymbols AS topLevelSymbols,
        a.tokenCount AS tokenCount,
        a.startLine AS startLine,
        a.endLine AS endLine,
        'ast' AS sourceKind
      ORDER BY a.segmentIndex, a.startLine`,
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
        null AS unitKind,
        null AS summaryCandidate,
        null AS segmentReason,
        null AS keywords,
        null AS topLevelSymbols,
        null AS tokenCount,
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
