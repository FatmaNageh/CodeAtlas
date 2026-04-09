import { runCypher } from "../db/cypher";

export type RelatedASTNodeRow = {
  symbol: string;
  kind: string;
  relatedNames: string[];
};

export type FileReferenceRow = {
  reference: string;
};

export async function getRelatedASTNodes(filePath: string, repoId: string): Promise<RelatedASTNodeRow[]> {
  return runCypher<RelatedASTNodeRow>(
    `MATCH (f:CodeFile {repoId: $repoId, relPath: $filePath})-[:DECLARES]->(a:ASTNode)
     OPTIONAL MATCH (a)-[:IMPORTS|EXTENDS|OVERRIDES]->(related:ASTNode)
     RETURN
       a.name AS symbol,
       a.nodeType AS kind,
       collect(DISTINCT related.name) AS relatedNames
     ORDER BY a.startLine`,
    { repoId, filePath },
  );
}

export async function getFileReferences(filePath: string, repoId: string): Promise<FileReferenceRow[]> {
  return runCypher<FileReferenceRow>(
    `MATCH (f:CodeFile {repoId: $repoId, relPath: $filePath})-[:REFERENCES]->(ref:CodeFile)
     RETURN ref.relPath AS reference
     ORDER BY ref.relPath`,
    { repoId, filePath },
  );
}
