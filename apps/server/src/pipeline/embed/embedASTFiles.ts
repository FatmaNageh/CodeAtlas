import fs from "fs/promises";
import path from "path";

import { generateEmbeddings } from "../../ai/embeddings";
import { runCypher } from "../../db/cypher";

type ASTNodeRow = {
  astNodeId: string;
  relPath: string;
  symbolName: string;
  startLine: number;
  endLine: number;
};

type EmbeddingJob = {
  astNodeId: string;
  relPath: string;
  symbolName: string;
  startLine: number;
  endLine: number;
  text: string;
};

export async function embedASTFiles(
  repoId: string,
  repoRoot: string,
  batchSize = 10,
  maxFiles = Number.POSITIVE_INFINITY,
) {
  if (batchSize < 1) {
    throw new Error(`batchSize must be >= 1, got ${batchSize}`);
  }
  if (maxFiles < 1) {
    throw new Error(`maxFiles must be >= 1, got ${maxFiles}`);
  }

  const repoRootResolved = path.resolve(repoRoot);

  // First, get the capped list of file paths
  const filePathRows = await runCypher<{ relPath: string }>(
    `
    MATCH (f:CodeFile {repoId: $repoId})-[:DECLARES]->(a:ASTNode)
    WHERE a.startLine IS NOT NULL AND a.endLine IS NOT NULL
    RETURN DISTINCT f.relPath AS relPath
    ORDER BY relPath
    LIMIT $maxFiles
    `,
    { repoId, maxFiles },
  );

  if (filePathRows.length === 0) {
    return { ok: true, files: 0, totalEmbedded: 0, failedBatches: 0 };
  }

  const relPaths = filePathRows.map((row) => row.relPath);

  // Now fetch AST nodes only for those capped files
  const rows = await runCypher<ASTNodeRow>(
    `
    MATCH (f:CodeFile {repoId: $repoId})-[:DECLARES]->(a:ASTNode)
    WHERE f.relPath IN $relPaths
      AND a.startLine IS NOT NULL AND a.endLine IS NOT NULL
    RETURN
      a.id AS astNodeId,
      f.relPath AS relPath,
      coalesce(a.qname, a.name) AS symbolName,
      a.startLine AS startLine,
      a.endLine AS endLine
    ORDER BY relPath, startLine
    `,
    { repoId, relPaths },
  );

  const rowsByFile = new Map<string, ASTNodeRow[]>();
  for (const row of rows) {
    const entries = rowsByFile.get(row.relPath) ?? [];
    entries.push(row);
    rowsByFile.set(row.relPath, entries);
  }

  let filesProcessed = 0;
  let totalEmbedded = 0;
  let failedBatches = 0;
  const failedBatchDetails: string[] = [];

  for (const [relPath, astRows] of rowsByFile.entries()) {

    const absPath = path.resolve(repoRootResolved, relPath);
    if (!absPath.startsWith(repoRootResolved + path.sep) && absPath !== repoRootResolved) {
      continue;
    }

    const text = await fs.readFile(absPath, "utf8").catch(() => "");
    if (!text) continue;

    const lines = text.split(/\r?\n/);
    const jobs: EmbeddingJob[] = astRows
      .map((row) => {
        const snippet = lines.slice(row.startLine - 1, row.endLine).join("\n").trim();
        if (!snippet) return null;
        return {
          astNodeId: row.astNodeId,
          relPath: row.relPath,
          symbolName: row.symbolName,
          startLine: Number(row.startLine),
          endLine: Number(row.endLine),
          text: snippet,
        };
      })
      .filter((job): job is EmbeddingJob => job !== null);

    if (jobs.length === 0) continue;

    for (let index = 0; index < jobs.length; index += batchSize) {
      const batch = jobs.slice(index, index + batchSize);
      try {
        const embeddings = await generateEmbeddings(batch.map((job) => job.text));
        for (const [batchIndex, job] of batch.entries()) {
          const embedding = embeddings[batchIndex];
          if (!job || !embedding) continue;

          await runCypher(
            `
            MATCH (a:ASTNode {id: $astNodeId, repoId: $repoId})
            SET
              a.text = $text,
              a.embedding = $embedding,
              a.embeddingStartLine = $startLine,
              a.embeddingEndLine = $endLine,
              a.embeddingUpdatedAt = datetime()
            RETURN a.id AS id
            `,
            {
              astNodeId: job.astNodeId,
              repoId,
              text: job.text,
              embedding,
              startLine: job.startLine,
              endLine: job.endLine,
            },
          );
          totalEmbedded++;
        }
      } catch (error) {
        failedBatches++;
        const message = error instanceof Error ? error.message : String(error);
        failedBatchDetails.push(
          `Batch ${Math.floor(index / batchSize) + 1} in ${relPath}: ${message}`,
        );
      }
    }

    filesProcessed++;
  }

  return {
    ok: failedBatches === 0,
    files: filesProcessed,
    totalEmbedded,
    failedBatches,
    failedBatchDetails: failedBatchDetails.length > 0 ? failedBatchDetails : undefined,
  };
}