import { getNeo4jClient } from "./client";

type IndexOptions = Record<string, boolean | number | string | null>;

const SCHEMA_QUERIES = [
  "CREATE CONSTRAINT repo_id IF NOT EXISTS FOR (Repo) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT directory_id IF NOT EXISTS FOR (n:Directory) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT codefile_id IF NOT EXISTS FOR (n:CodeFile) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT textfile_id IF NOT EXISTS FOR (n:TextFile) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT astnode_id IF NOT EXISTS FOR (n:ASTNode) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT textchunk_id IF NOT EXISTS FOR (n:TeXTChunk) REQUIRE n.id IS UNIQUE",
  
  "CREATE INDEX codefile_rel_path IF NOT EXISTS FOR (n:CodeFile) ON (n.repoId, n.relPath)",
  "CREATE INDEX textfile_rel_path IF NOT EXISTS FOR (n:TextFile) ON (n.repoId, n.relPath)",
  "CREATE INDEX astnode_file_rel_path IF NOT EXISTS FOR (n:ASTNode) ON (n.repoId, n.fileRelPath)",
  "CREATE INDEX astnode_qname IF NOT EXISTS FOR (n:ASTNode) ON (n.repoId, n.qname)",
  "CREATE INDEX textchunk_file_rel_path IF NOT EXISTS FOR (n:TEXTChunk) ON (n.repoId, n.fileRelPath)",

    "CREATE INDEX repo_path IF NOT EXISTS FOR (n:Repo) ON (n.repoId,n.path)",
  "CREATE INDEX dir_path IF NOT EXISTS FOR (n:Directory) ON (n.repoId,n.path)",
  "CREATE INDEX codefile_path IF NOT EXISTS FOR (n:CodeFile) ON (n.repoId,n.path)",
  "CREATE INDEX codefile_language IF NOT EXISTS FOR (n:CodeFile) ON (n.repoId,n.language)",
  "CREATE INDEX textfile_path IF NOT EXISTS FOR (n:TextFile) ON (n.repoId,n.path)",
  "CREATE INDEX textchunk_index IF NOT EXISTS FOR (n:TextChunk) ON (n.repoId,n.chunkIndex)",
  "CREATE INDEX astnode_kind IF NOT EXISTS FOR (n:AstNode) ON (n.repoId,n.kind)",
  "CREATE INDEX astnode_fqn IF NOT EXISTS FOR (n:AstNode) ON (n.repoId,n.fqn)",
  "CREATE INDEX astnode_language IF NOT EXISTS FOR (n:AstNode) ON (n.repoId,n.language)",

] as const;

function getEmbeddingDimension(): number {
  const rawDimension =
    process.env.OPENAI_EMBED_DIM ?? process.env.EMBED_DIM ?? process.env.OLLAMA_EMBED_DIM ?? "";
  const parsedDimension = rawDimension ? Number(rawDimension) : 1536;
  return Number.isFinite(parsedDimension) && parsedDimension > 0 ? parsedDimension : 1536;
}

function createVectorIndexQueries(embeddingDimension: number): string[] {
  return [
    `CREATE VECTOR INDEX codefile_embedding IF NOT EXISTS
      FOR (n:CodeFile) ON (n.embedding)
      OPTIONS { indexConfig: {\`vector.dimensions\`: ${embeddingDimension}, \`vector.similarity_function\`: 'cosine' } }`,
    `CREATE VECTOR INDEX textfile_embedding IF NOT EXISTS
      FOR (n:TextFile) ON (n.embedding)
      OPTIONS { indexConfig: {\`vector.dimensions\`: ${embeddingDimension}, \`vector.similarity_function\`: 'cosine' } }`,
    `CREATE VECTOR INDEX textchunk_embedding IF NOT EXISTS
      FOR (n:TEXTChunk) ON (n.embedding)
      OPTIONS { indexConfig: {\`vector.dimensions\`: ${embeddingDimension}, \`vector.similarity_function\`: 'cosine' } }`,
    `CREATE VECTOR INDEX astnode_embedding IF NOT EXISTS
      FOR (n:ASTNode) ON (n.embedding)
      OPTIONS { indexConfig: {\`vector.dimensions\`: ${embeddingDimension}, \`vector.similarity_function\`: 'cosine' } }`,
  ];
}

async function checkVectorIndexDimension(indexName: string, expectedDimension: number): Promise<void> {
  const neo4j = getNeo4jClient();
  const session = neo4j.session();

  try {
    const result = await session.run(
      "SHOW INDEXES YIELD name, options WHERE name = $indexName RETURN options",
      { indexName },
    );
    const options = result.records[0]?.get("options") as IndexOptions | undefined;
    const actualDimension = options?.["vector.dimensions"];
    if (typeof actualDimension === "number" && actualDimension !== expectedDimension) {
      console.warn(
        `[NEO4J-SCHEMA] Vector index "${indexName}" has dimension ${actualDimension}; expected ${expectedDimension}.`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.debug(`[NEO4J-SCHEMA] Could not inspect vector index "${indexName}": ${message}`);
  } finally {
    await session.close();
  }
}

let didRun = false;

export async function ensureSchema(): Promise<void> {
  if (didRun) return;

  const neo4j = getNeo4jClient();
  const session = neo4j.session();
  const embeddingDimension = getEmbeddingDimension();

  try {
    for (const query of [...SCHEMA_QUERIES, ...createVectorIndexQueries(embeddingDimension)]) {
      try {
        await session.run(query);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[neo4j schema] failed: ${query} -> ${message}`);
      }
    }

    await checkVectorIndexDimension("codefile_embedding", embeddingDimension);
    await checkVectorIndexDimension("textfile_embedding", embeddingDimension);
    await checkVectorIndexDimension("textchunk_embedding", embeddingDimension);
    await checkVectorIndexDimension("astnode_embedding", embeddingDimension);
    didRun = true;
  } finally {
    await session.close();
  }
}
