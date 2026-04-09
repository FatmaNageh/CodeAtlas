import { getNeo4jClient } from "./client";

type IndexOptions = Record<string, boolean | number | string | null>;

const SCHEMA_QUERIES = [
  "CREATE CONSTRAINT reporoot_id IF NOT EXISTS FOR (n:RepoRoot) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT directory_id IF NOT EXISTS FOR (n:Directory) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT codefile_id IF NOT EXISTS FOR (n:CodeFile) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT textfile_id IF NOT EXISTS FOR (n:TextFile) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT astnode_id IF NOT EXISTS FOR (n:ASTNode) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT txtchunk_id IF NOT EXISTS FOR (n:TXTChunk) REQUIRE n.id IS UNIQUE",
  "CREATE INDEX codefile_rel_path IF NOT EXISTS FOR (n:CodeFile) ON (n.repoId, n.relPath)",
  "CREATE INDEX textfile_rel_path IF NOT EXISTS FOR (n:TextFile) ON (n.repoId, n.relPath)",
  "CREATE INDEX astnode_file_rel_path IF NOT EXISTS FOR (n:ASTNode) ON (n.repoId, n.fileRelPath)",
  "CREATE INDEX astnode_qname IF NOT EXISTS FOR (n:ASTNode) ON (n.repoId, n.qname)",
  "CREATE INDEX txtchunk_file_rel_path IF NOT EXISTS FOR (n:TXTChunk) ON (n.repoId, n.fileRelPath)",
] as const;

function getEmbeddingDimension(): number {
  const rawDimension =
    process.env.OPENAI_EMBED_DIM ?? process.env.EMBED_DIM ?? process.env.OLLAMA_EMBED_DIM ?? "";
  const parsedDimension = rawDimension ? Number(rawDimension) : 1536;
  return Number.isFinite(parsedDimension) && parsedDimension > 0 ? parsedDimension : 1536;
}

function createVectorIndexQuery(embeddingDimension: number): string {
  return `CREATE VECTOR INDEX astnode_embedding IF NOT EXISTS
    FOR (n:ASTNode) ON (n.embedding)
    OPTIONS { indexConfig: {\`vector.dimensions\`: ${embeddingDimension}, \`vector.similarity_function\`: 'cosine' } }`;
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
    for (const query of [...SCHEMA_QUERIES, createVectorIndexQuery(embeddingDimension)]) {
      try {
        await session.run(query);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[neo4j schema] failed: ${query} -> ${message}`);
      }
    }

    await checkVectorIndexDimension("astnode_embedding", embeddingDimension);
    didRun = true;
  } finally {
    await session.close();
  }
}
