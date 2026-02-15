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
  "CREATE CONSTRAINT codechunk_id IF NOT EXISTS FOR (n:CodeChunk) REQUIRE (n.repoId, n.relPath, n.symbol) IS UNIQUE",

  // Indexes
  "CREATE INDEX codefile_relPath IF NOT EXISTS FOR (n:CodeFile) ON (n.repoId, n.relPath)",
  "CREATE INDEX textfile_relPath IF NOT EXISTS FOR (n:TextFile) ON (n.repoId, n.relPath)",
  "CREATE INDEX sym_name IF NOT EXISTS FOR (n:Symbol) ON (n.repoId, n.name)",
  "CREATE INDEX sym_qname IF NOT EXISTS FOR (n:Symbol) ON (n.repoId, n.qname)",
  "CREATE INDEX sym_kind IF NOT EXISTS FOR (n:Symbol) ON (n.repoId, n.symbolKind)",
  "CREATE INDEX chunk_file IF NOT EXISTS FOR (n:DocChunk) ON (n.repoId, n.fileRelPath)",
  "CREATE INDEX codechunk_repo_path IF NOT EXISTS FOR (n:CodeChunk) ON (n.repoId, n.relPath)",
];

function getEmbedDim(): number {
  // OpenAI text-embedding-3-small uses 1536 dimensions by default
  const raw = process.env.OPENAI_EMBED_DIM ?? process.env.EMBED_DIM ?? process.env.OLLAMA_EMBED_DIM ?? "";
  const dim = raw ? Number(raw) : 1536;
  if (!raw) {
    console.warn(
      "[NEO4J-SCHEMA] Using default embedding dimension 1536 (OpenAI). " +
      "If using Ollama or other providers, set OLLAMA_EMBED_DIM or EMBED_DIM environment variable. " +
      "Ensure this matches the actual embedding model's dimension to avoid index mismatches."
    );
  }
  return Number.isFinite(dim) && dim > 0 ? dim : 1536;
}

async function checkNeo4jVectorDimension(neo4j: any, indexName: string, expectedDim: number): Promise<void> {
  const session = neo4j.session();
  try {
    const result = await session.run(
      `SHOW INDEXES YIELD name, options WHERE name = $indexName RETURN options`,
      { indexName }
    );
    if (result.records.length > 0) {
      const opts = result.records[0]?.get('options');
      if (opts && opts['vector.dimensions'] !== expectedDim) {
        console.warn(
          `[NEO4J-SCHEMA] Vector index "${indexName}" has dimension ${opts['vector.dimensions']} but expected ${expectedDim}. ` +
          `This may cause search failures. Consider re-creating the index or verify your embedding model configuration.`
        );
      }
    }
  } catch (err) {
    // Index check failed, likely Neo4j version doesn't support it or index doesn't exist yet
    console.debug("[NEO4J-SCHEMA] Could not check vector index dimension:", (err as any)?.message);
  } finally {
    await session.close();
  }
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
    `CREATE VECTOR INDEX codechunk_embedding IF NOT EXISTS
      FOR (c:CodeChunk) ON (c.embedding)
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
    
    // Check existing vector index dimensions for migrations
    await checkNeo4jVectorDimension(neo4j, 'symbol_embedding', embedDim);
    await checkNeo4jVectorDimension(neo4j, 'docchunk_embedding', embedDim);
    await checkNeo4jVectorDimension(neo4j, 'codechunk_embedding', embedDim);
    
    didRun = true;
  } finally {
    await session.close();
  }
}
