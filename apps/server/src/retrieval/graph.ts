import { runCypher } from "@/db/cypher";

export type RelatedASTNodeRow = {
  symbol: string;
  kind: string;
  qname: string;
  relatedNames: string[];
};

export type FileReferenceRow = {
  reference: string;
};

export async function getRelatedASTNodes(filePath: string, repoId: string): Promise<RelatedASTNodeRow[]> {
  return runCypher<RelatedASTNodeRow>(
    `/*cypher*/
    MATCH (f:CodeFile {repoId: $repoId, path: $filePath})
     MATCH (f)-[:DECLARES|HAS_AST_ROOT]->(a:AstNode)
     OPTIONAL MATCH (a)-[:IMPORTS|EXTENDS|OVERRIDES]->(related:AstNode)
     RETURN
        a.name AS symbol,
        a.nodeType AS kind,
        a.qname AS qname,
       collect(DISTINCT related.name) AS relatedNames
     ORDER BY a.startLine`,
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
