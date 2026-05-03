import { runCypher } from "@/db/cypher";

export type RelatedASTNodeRow = {
  symbol: string;
  kind: string;
  qname: string;
  summaryCandidate: string | null;
  segmentReason: string | null;
  keywords: string[] | null;
  topLevelSymbols: string[] | null;
  relatedNames: string[];
};

export type FileReferenceRow = {
  reference: string;
};

export type AdjacentASTChunkRow = {
  id: string;
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
  sourceKind: "ast";
};

export async function getRelatedASTNodes(filePath: string, repoId: string): Promise<RelatedASTNodeRow[]> {
  return runCypher<RelatedASTNodeRow>(
    `/*cypher*/
    MATCH (f:CodeFile {repoId: $repoId, path: $filePath})
     MATCH (f)-[:HAS_AST]->(a:AstNode)
     OPTIONAL MATCH (a)-[:NEXT_AST]->(next:AstNode {repoId: $repoId})
     OPTIONAL MATCH (prev:AstNode {repoId: $repoId})-[:NEXT_AST]->(a)
     RETURN
        a.label AS symbol,
        a.unitKind AS kind,
        a.label AS qname,
        a.summaryCandidate AS summaryCandidate,
        a.segmentReason AS segmentReason,
        a.keywords AS keywords,
        a.topLevelSymbols AS topLevelSymbols,
        [name IN collect(DISTINCT coalesce(prev.label, next.label)) WHERE name IS NOT NULL] AS relatedNames
     ORDER BY a.segmentIndex, a.startLine`,
    { repoId, filePath },
  );
}

export async function getFileReferences(filePath: string, repoId: string): Promise<FileReferenceRow[]> {
  return runCypher<FileReferenceRow>(
    `/*cypher*/
    MATCH (f {repoId: $repoId, path: $filePath})
    WHERE f:CodeFile OR f:TextFile
    MATCH (f)-[:REFERENCES]->(ref)
    WHERE ref:CodeFile OR ref:TextFile
     RETURN DISTINCT ref.path AS reference
     ORDER BY ref.path`,
    { repoId, filePath },
  );
}

export async function getAdjacentASTChunks(
  astNodeIds: string[],
  repoId: string,
): Promise<AdjacentASTChunkRow[]> {
  if (astNodeIds.length === 0) return [];

  return runCypher<AdjacentASTChunkRow>(
    `/*cypher*/
    MATCH (a:AstNode {repoId: $repoId})
    WHERE a.id IN $astNodeIds
    MATCH (a)-[:NEXT_AST]-(neighbor:AstNode {repoId: $repoId})
    RETURN DISTINCT
      neighbor.id AS id,
      neighbor.filePath AS filePath,
      neighbor.text AS chunkText,
      coalesce(neighbor.label, neighbor.displayName, neighbor.qname, neighbor.name) AS symbol,
      neighbor.unitKind AS unitKind,
      neighbor.summaryCandidate AS summaryCandidate,
      neighbor.segmentReason AS segmentReason,
      neighbor.keywords AS keywords,
      neighbor.topLevelSymbols AS topLevelSymbols,
      neighbor.tokenCount AS tokenCount,
      neighbor.startLine AS startLine,
      neighbor.endLine AS endLine,
      'ast' AS sourceKind
    ORDER BY filePath, startLine`,
    { repoId, astNodeIds },
  );
}
