import { getNeo4jClient } from "./client";

const CONSTRAINTS: string[] = [
  "CREATE CONSTRAINT repo_id IF NOT EXISTS FOR (n:Repo) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT dir_id IF NOT EXISTS FOR (n:Directory) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT codefile_id IF NOT EXISTS FOR (n:CodeFile) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT textfile_id IF NOT EXISTS FOR (n:TextFile) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT sym_id IF NOT EXISTS FOR (n:Symbol) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT imp_id IF NOT EXISTS FOR (n:Import) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT call_id IF NOT EXISTS FOR (n:CallSite) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT chunk_id IF NOT EXISTS FOR (n:DocChunk) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT extmod_id IF NOT EXISTS FOR (n:ExternalModule) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT extsym_id IF NOT EXISTS FOR (n:ExternalSymbol) REQUIRE n.id IS UNIQUE",

  // Indexes
  "CREATE INDEX codefile_relPath IF NOT EXISTS FOR (n:CodeFile) ON (n.repoId, n.relPath)",
  "CREATE INDEX textfile_relPath IF NOT EXISTS FOR (n:TextFile) ON (n.repoId, n.relPath)",
  "CREATE INDEX sym_name IF NOT EXISTS FOR (n:Symbol) ON (n.repoId, n.name)",
  "CREATE INDEX sym_qname IF NOT EXISTS FOR (n:Symbol) ON (n.repoId, n.qname)",
  "CREATE INDEX sym_kind IF NOT EXISTS FOR (n:Symbol) ON (n.repoId, n.symbolKind)",
  "CREATE INDEX chunk_file IF NOT EXISTS FOR (n:DocChunk) ON (n.repoId, n.fileRelPath)",
];

function getEmbedDim(): number {
  const raw = process.env.OLLAMA_EMBED_DIM ?? process.env.OPENAI_EMBED_DIM ?? process.env.EMBED_DIM ?? "";
  const dim = raw ? Number(raw) : 1536;
  return Number.isFinite(dim) && dim > 0 ? dim : 1536;
}

function vectorIndexQueries(embedDim: number): string[] {
  // Neo4j 5 vector indexes. If your Neo4j version is older and doesn't support this,
  // these queries will fail safely and the server will still run.
  return [
    `CREATE VECTOR INDEX symbol_embedding IF NOT EXISTS
      FOR (s:Symbol) ON (s.embedding)
      OPTIONS { indexConfig: {\`vector.dimensions\`: ${embedDim}, \`vector.similarity_function\`: 'cosine' } }`,
    `CREATE VECTOR INDEX docchunk_embedding IF NOT EXISTS
      FOR (c:DocChunk) ON (c.embedding)
      OPTIONS { indexConfig: {\`vector.dimensions\`: ${embedDim}, \`vector.similarity_function\`: 'cosine' } }`,
  ];
}

let didRun = false;

export async function ensureSchema(): Promise<void> {
  if (didRun) return;
  const neo4j = getNeo4jClient();
  const session = neo4j.session();
  const embedDim = getEmbedDim();
  try {
    for (const q of [...CONSTRAINTS, ...vectorIndexQueries(embedDim)]) {
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
