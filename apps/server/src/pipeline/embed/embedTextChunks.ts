import { generateEmbeddings } from "@/ai/embeddings";
import { runCypher, writeCypher } from "@/db/cypher";
import { isValidEmbeddingVector } from "@/utils/embedding";

type TextChunkRow = {
  textChunkId: string;
  content: string;
};

type TextChunkEmbeddingWriteRow = {
  textChunkId: string;
  embedding: number[];
};

export async function embedTextChunks(
  repoId: string,
  batchSize = 25,
): Promise<{
  ok: boolean;
  totalEmbedded: number;
  failedBatches: number;
  failedBatchDetails?: string[];
}> {
  if (batchSize < 1) {
    throw new Error(`batchSize must be >= 1, got ${batchSize}`);
  }

  const rows = await runCypher<TextChunkRow>(
    `/*cypher*/
    MATCH (c:TextChunk {repoId: $repoId})
    WHERE c.content IS NOT NULL AND trim(c.content) <> ''
    RETURN c.id AS textChunkId, c.content AS content
    ORDER BY c.filePath, c.chunkIndex
    `,
    { repoId },
  );

  let totalEmbedded = 0;
  let failedBatches = 0;
  const failedBatchDetails: string[] = [];

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);

    try {
      const embeddings = await generateEmbeddings(batch.map((row) => row.content));

      const rowsToWrite: TextChunkEmbeddingWriteRow[] = [];

      for (const [batchIndex, row] of batch.entries()) {
        const embedding = embeddings[batchIndex];
        if (!isValidEmbeddingVector(embedding)) continue;

        rowsToWrite.push({
          textChunkId: row.textChunkId,
          embedding,
        });
      }

      if (rowsToWrite.length > 0) {
        await writeCypher(
          `/*cypher*/
          UNWIND $rows AS row
          MATCH (c:TextChunk {id: row.textChunkId, repoId: $repoId})
          SET
            c.embeddings = row.embedding,
            c.embeddingUpdatedAt = datetime()
          RETURN count(c) AS updated
          `,
          {
            repoId,
            rows: rowsToWrite,
          },
        );

        totalEmbedded += rowsToWrite.length;
      }
    } catch (error) {
      failedBatches++;
      const message = error instanceof Error ? error.message : String(error);
      failedBatchDetails.push(
        `Batch ${Math.floor(index / batchSize) + 1}: ${message}`,
      );
    }
  }

  return {
    ok: failedBatches === 0,
    totalEmbedded,
    failedBatches,
    failedBatchDetails:
      failedBatchDetails.length > 0 ? failedBatchDetails : undefined,
  };
}
