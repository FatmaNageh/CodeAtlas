import { embedDimensions } from "@/config/openrouter";
import { getNeo4jClient } from "./client";

type IndexOptions = Record<string, boolean | number | string | null>;

const SCHEMA_QUERIES = [
  "CREATE CONSTRAINT repo_id IF NOT EXISTS FOR (n:Repo) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT directory_id IF NOT EXISTS FOR (n:Directory) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT codefile_id IF NOT EXISTS FOR (n:CodeFile) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT textfile_id IF NOT EXISTS FOR (n:TextFile) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT textchunk_id IF NOT EXISTS FOR (n:TextChunk) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT astnode_id IF NOT EXISTS FOR (n:AstNode) REQUIRE n.id IS UNIQUE",

  "CREATE INDEX repo_repo_id IF NOT EXISTS FOR (n:Repo) ON (n.repoId)",
  "CREATE INDEX repo_root_path IF NOT EXISTS FOR (n:Repo) ON (n.rootPath)",
  "CREATE INDEX repo_identity_key IF NOT EXISTS FOR (n:Repo) ON (n.identityKey)",

  "CREATE INDEX directory_repo_path IF NOT EXISTS FOR (n:Directory) ON (n.repoId, n.path)",
  "CREATE INDEX directory_identity_key IF NOT EXISTS FOR (n:Directory) ON (n.identityKey)",

  "CREATE INDEX codefile_repo_path IF NOT EXISTS FOR (n:CodeFile) ON (n.repoId, n.path)",
  "CREATE INDEX codefile_language IF NOT EXISTS FOR (n:CodeFile) ON (n.repoId, n.language)",
  "CREATE INDEX codefile_identity_key IF NOT EXISTS FOR (n:CodeFile) ON (n.identityKey)",

  "CREATE INDEX textfile_repo_path IF NOT EXISTS FOR (n:TextFile) ON (n.repoId, n.path)",
  "CREATE INDEX textfile_identity_key IF NOT EXISTS FOR (n:TextFile) ON (n.identityKey)",

  "CREATE INDEX textchunk_file_path IF NOT EXISTS FOR (n:TextChunk) ON (n.repoId, n.filePath)",
  "CREATE INDEX textchunk_chunk_index IF NOT EXISTS FOR (n:TextChunk) ON (n.repoId, n.chunkIndex)",
  "CREATE INDEX textchunk_identity_key IF NOT EXISTS FOR (n:TextChunk) ON (n.identityKey)",

  "CREATE INDEX astnode_file_path IF NOT EXISTS FOR (n:AstNode) ON (n.repoId, n.filePath)",
  "CREATE INDEX astnode_normalized_kind IF NOT EXISTS FOR (n:AstNode) ON (n.repoId, n.normalizedKind)",
  "CREATE INDEX astnode_identity_key IF NOT EXISTS FOR (n:AstNode) ON (n.identityKey)",
] as const;

function getEmbeddingDimension(): number {
  const rawDimension =
    process.env.OPENAI_EMBED_DIM ??
    process.env.EMBED_DIM ??
    process.env.OLLAMA_EMBED_DIM ??
    embedDimensions ??
    "";

  const parsedDimension = rawDimension ? Number(rawDimension) : 1536;
  return Number.isFinite(parsedDimension) && parsedDimension > 0
    ? parsedDimension
    : 1536;
}

function createVectorIndexQueries(embeddingDimension: number): string[] {
  return [
    `/*cypher*/
    CREATE VECTOR INDEX codefile_embedding IF NOT EXISTS
      FOR (n:CodeFile) ON (n.embedding)
      OPTIONS { indexConfig: {\`vector.dimensions\`: ${embeddingDimension}, \`vector.similarity_function\`: 'cosine' } }
      `,

    `/*cypher*/
    CREATE VECTOR INDEX textfile_embedding IF NOT EXISTS
      FOR (n:TextFile) ON (n.embedding)
      OPTIONS { indexConfig: {\`vector.dimensions\`: ${embeddingDimension}, \`vector.similarity_function\`: 'cosine' } }
      `,

    `/*cypher*/
    CREATE VECTOR INDEX textchunk_embedding IF NOT EXISTS
      FOR (n:TextChunk) ON (n.embedding)
      OPTIONS { indexConfig: {\`vector.dimensions\`: ${embeddingDimension}, \`vector.similarity_function\`: 'cosine' } }
      `,

    `/*cypher*/
    CREATE VECTOR INDEX astnode_embedding IF NOT EXISTS
      FOR (n:AstNode) ON (n.embedding)
      OPTIONS { indexConfig: {\`vector.dimensions\`: ${embeddingDimension}, \`vector.similarity_function\`: 'cosine' } }
      `,
  ];
}

async function checkVectorIndexDimension(
  indexName: string,
  expectedDimension: number,
): Promise<void> {
  const neo4j = getNeo4jClient();
  const session = neo4j.session();

  try {
    const result = await session.run(
      "SHOW INDEXES YIELD name, options WHERE name = $indexName RETURN options",
      { indexName },
    );

    const options = result.records[0]?.get("options") as
      | IndexOptions
      | undefined;
    const actualDimension = options?.["vector.dimensions"];

    if (
      typeof actualDimension === "number" &&
      actualDimension !== expectedDimension
    ) {
      console.warn(
        `[NEO4J-SCHEMA] Vector index "${indexName}" has dimension ${actualDimension}; expected ${expectedDimension}.`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.debug(
      `[NEO4J-SCHEMA] Could not inspect vector index "${indexName}": ${message}`,
    );
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
    for (const query of [
      ...SCHEMA_QUERIES,
      ...createVectorIndexQueries(embeddingDimension),
    ]) {
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
