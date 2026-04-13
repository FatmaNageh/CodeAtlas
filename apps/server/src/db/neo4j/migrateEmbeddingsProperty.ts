import "dotenv/config";

import { ensureSchema } from "./schema";
import { getNeo4jClient } from "./client";

async function main(): Promise<void> {
  await ensureSchema();

  const client = getNeo4jClient();
  const session = client.session();

  try {
    const result = await session.executeWrite(async (tx) => {
      const ast = await tx.run(
        `/*cypher*/
        MATCH (n:AstNode)
        WHERE n.embedding IS NOT NULL
        SET n.embeddings = n.embedding
        REMOVE n.embedding
        RETURN count(n) AS count`,
      );

      const textChunk = await tx.run(
        `/*cypher*/
        MATCH (n:TextChunk)
        WHERE n.embedding IS NOT NULL
        SET n.embeddings = n.embedding
        REMOVE n.embedding
        RETURN count(n) AS count`,
      );

      const codeFile = await tx.run(
        `/*cypher*/
        MATCH (n:CodeFile)
        WHERE n.embedding IS NOT NULL
        SET n.embeddings = n.embedding
        REMOVE n.embedding
        RETURN count(n) AS count`,
      );

      const textFile = await tx.run(
        `/*cypher*/
        MATCH (n:TextFile)
        WHERE n.embedding IS NOT NULL
        SET n.embeddings = n.embedding
        REMOVE n.embedding
        RETURN count(n) AS count`,
      );

      const summaries = await tx.run(
        `/*cypher*/
        MATCH (n)
        WHERE (n:CodeFile OR n:TextFile) AND n.summary IS NOT NULL
        RETURN count(n) AS count`,
      );

      return {
        migratedAstNodes: ast.records[0]?.get("count"),
        migratedTextChunks: textChunk.records[0]?.get("count"),
        migratedCodeFiles: codeFile.records[0]?.get("count"),
        migratedTextFiles: textFile.records[0]?.get("count"),
        filesWithSummary: summaries.records[0]?.get("count"),
      };
    });

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await session.close();
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
