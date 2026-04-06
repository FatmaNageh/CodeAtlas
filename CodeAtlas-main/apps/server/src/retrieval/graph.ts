import { runCypher } from '../db/cypher';

// Pure function to get related symbols
export async function getRelatedSymbols(filePath: string, repoId: string) {
  return runCypher(
    `MATCH (f:CodeFile {repoId: $repoId, relPath: $filePath})-[:DECLARES]->(s:Symbol)
     OPTIONAL MATCH (s)<-[:REFERENCES]-(ref:Symbol {repoId: $repoId})
     OPTIONAL MATCH (s)<-[:CALLS]-(call:CallSite {repoId: $repoId})
     RETURN s.name as symbol, s.symbolKind as kind,
            collect(DISTINCT ref.name) as references,
            collect(DISTINCT call.location) as calls`,
    { repoId, filePath }
  );
}

// Pure function to get imports
export async function getFileImports(filePath: string, repoId: string) {
  return runCypher(
    `MATCH (f:CodeFile {repoId: $repoId, relPath: $filePath})-[:IMPORTS]->(imp:Import)
     RETURN imp.name as import`,
    { repoId, filePath }
  );
}
