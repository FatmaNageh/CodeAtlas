import { getNeo4jClient } from "./client";

const CONSTRAINTS: string[] = [
  "CREATE CONSTRAINT repo_id IF NOT EXISTS FOR (n:Repo) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT dir_id IF NOT EXISTS FOR (n:Directory) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT file_id IF NOT EXISTS FOR (n:File) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT sym_id IF NOT EXISTS FOR (n:Symbol) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT imp_id IF NOT EXISTS FOR (n:Import) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT call_id IF NOT EXISTS FOR (n:CallSite) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT chunk_id IF NOT EXISTS FOR (n:DocChunk) REQUIRE n.id IS UNIQUE",
  "CREATE INDEX file_relPath IF NOT EXISTS FOR (n:File) ON (n.repoId, n.relPath)",
  "CREATE INDEX sym_name IF NOT EXISTS FOR (n:Symbol) ON (n.repoId, n.name)",
  "CREATE INDEX chunk_file IF NOT EXISTS FOR (n:DocChunk) ON (n.repoId, n.fileRelPath)",
];

let didRun = false;

export async function ensureSchema(): Promise<void> {
  if (didRun) return;
  const neo4j = getNeo4jClient();
  const session = neo4j.session();
  try {
    for (const q of CONSTRAINTS) {
      try {
        await session.run(q);
      } catch (e) {
        console.warn("[neo4j schema] failed:", q, (e as any)?.message || e);
      }
    }
    didRun = true;
  } finally {
    await session.close();
  }
}
