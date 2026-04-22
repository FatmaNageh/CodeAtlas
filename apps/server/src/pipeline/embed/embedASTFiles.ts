import fs from "fs/promises";
import path from "path";

import { generateEmbeddings } from "../../ai/embeddings";
import { runCypher, writeCypher } from "../../db/cypher";
import { isValidEmbeddingVector } from "../../utils/embedding";

type ASTNodeRow = {
  astNodeId: string;
  relPath: string;
  symbolName: string;
  unitKind: string;
  summaryCandidate: string | null;
  segmentReason: string | null;
  keywords: string[] | null;
  topLevelSymbols: string[] | null;
  startLine: number;
  endLine: number;
};

type EmbeddingJob = {
  astNodeId: string;
  relPath: string;
  symbolName: string;
  startLine: number;
  endLine: number;
  embeddingText: string;
  text: string;
};

type AstEmbeddingWriteRow = {
  astNodeId: string;
  text: string;
  embedding: number[];
  startLine: number;
  endLine: number;
};

type AdaptiveConfig = {
  enabled: boolean;
  minBatchSize: number;
  maxBatchSize: number;
  minConcurrency: number;
  maxConcurrency: number;
  initialConcurrency: number;
  targetBatchMs: number;
  slowBatchMs: number;
};

type AdaptiveState = {
  batchSize: number;
  concurrency: number;
  successStreak: number;
  adjustments: number;
};

type EmbedASTFilesResult = {
  ok: boolean;
  files: number;
  totalEmbedded: number;
  failedBatches: number;
  failedBatchDetails?: string[];
  adaptive?: {
    enabled: boolean;
    finalBatchSize: number;
    finalConcurrency: number;
    adjustments: number;
  };
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function createAdaptiveConfig(enabled: boolean): AdaptiveConfig {
  return {
    enabled,
    minBatchSize: 5,
    maxBatchSize: 64,
    minConcurrency: 2,
    maxConcurrency: 12,
    initialConcurrency: 4,
    targetBatchMs: 1200,
    slowBatchMs: 2800,
  };
}

function createAdaptiveState(batchSize: number, config: AdaptiveConfig): AdaptiveState {
  return {
    batchSize: clamp(Math.floor(batchSize), config.minBatchSize, config.maxBatchSize),
    concurrency: clamp(config.initialConcurrency, config.minConcurrency, config.maxConcurrency),
    successStreak: 0,
    adjustments: 0,
  };
}

function tuneAdaptiveOnSuccess(
  state: AdaptiveState,
  config: AdaptiveConfig,
  batchLength: number,
  durationMs: number,
): void {
  state.successStreak += 1;

  const oldBatchSize = state.batchSize;
  const oldConcurrency = state.concurrency;

  if (durationMs <= config.targetBatchMs && batchLength >= state.batchSize) {
    if (state.successStreak % 2 === 0) {
      state.batchSize = clamp(state.batchSize + 4, config.minBatchSize, config.maxBatchSize);
    }

    if (state.successStreak % 3 === 0) {
      state.concurrency = clamp(
        state.concurrency + 1,
        config.minConcurrency,
        config.maxConcurrency,
      );
    }
  }

  if (durationMs >= config.slowBatchMs) {
    state.batchSize = clamp(Math.floor(state.batchSize * 0.8), config.minBatchSize, config.maxBatchSize);
    state.concurrency = clamp(state.concurrency - 1, config.minConcurrency, config.maxConcurrency);
    state.successStreak = 0;
  }

  if (state.batchSize !== oldBatchSize || state.concurrency !== oldConcurrency) {
    state.adjustments += 1;
  }
}

function tuneAdaptiveOnFailure(state: AdaptiveState, config: AdaptiveConfig): void {
  const oldBatchSize = state.batchSize;
  const oldConcurrency = state.concurrency;

  state.batchSize = clamp(Math.floor(state.batchSize * 0.6), config.minBatchSize, config.maxBatchSize);
  state.concurrency = clamp(state.concurrency - 2, config.minConcurrency, config.maxConcurrency);
  state.successStreak = 0;

  if (state.batchSize !== oldBatchSize || state.concurrency !== oldConcurrency) {
    state.adjustments += 1;
  }
}

function buildEmbeddingText(job: {
  symbolName: string;
  unitKind: string;
  summaryCandidate: string | null;
  segmentReason: string | null;
  keywords: string[] | null;
  topLevelSymbols: string[] | null;
  text: string;
}): string {
  const parts = [
    `Label: ${job.symbolName}`,
    `Unit kind: ${job.unitKind}`,
  ];

  if (job.segmentReason) {
    parts.push(`Segment reason: ${job.segmentReason}`);
  }
  if (job.topLevelSymbols && job.topLevelSymbols.length > 0) {
    parts.push(`Top-level symbols: ${job.topLevelSymbols.join(", ")}`);
  }
  if (job.keywords && job.keywords.length > 0) {
    parts.push(`Keywords: ${job.keywords.join(", ")}`);
  }
  if (job.summaryCandidate) {
    parts.push(`Summary: ${job.summaryCandidate}`);
  }

  parts.push("Code:");
  parts.push(job.text);

  return parts.join("\n");
}

export async function embedASTFiles(
  repoId: string,
  repoRoot: string,
  batchSize = 10,
  maxFiles = Number.POSITIVE_INFINITY,
  adaptive = false,
): Promise<EmbedASTFilesResult> {
  if (batchSize < 1) {
    throw new Error(`batchSize must be >= 1, got ${batchSize}`);
  }
  const normalizedMaxFiles = Number.isFinite(maxFiles)
    ? Math.floor(maxFiles)
    : null;

  if (normalizedMaxFiles !== null && normalizedMaxFiles < 1) {
    throw new Error(`maxFiles must be >= 1, got ${maxFiles}`);
  }

  const repoRootResolved = path.resolve(repoRoot);

  // First, get the capped list of file paths
  const filePathRows =
    normalizedMaxFiles === null
      ? await runCypher<{ relPath: string }>(
          `/*cypher*/
    MATCH (f:CodeFile {repoId: $repoId})-[:HAS_AST]->(a:AstNode)
    WHERE a.startLine IS NOT NULL AND a.endLine IS NOT NULL
    RETURN DISTINCT f.path AS relPath
    ORDER BY relPath
    `,
          { repoId },
        )
      : await runCypher<{ relPath: string }>(
          `/*cypher*/
    MATCH (f:CodeFile {repoId: $repoId})-[:HAS_AST]->(a:AstNode)
    WHERE a.startLine IS NOT NULL AND a.endLine IS NOT NULL
    RETURN DISTINCT f.path AS relPath
    ORDER BY relPath
    LIMIT $maxFiles
    `,
          { repoId, maxFiles: normalizedMaxFiles },
        );

  if (filePathRows.length === 0) {
    return {
      ok: true,
      files: 0,
      totalEmbedded: 0,
      failedBatches: 0,
    };
  }

  const relPaths = filePathRows.map((row) => row.relPath);

  // Now fetch AST nodes only for those capped files
  const rows = await runCypher<ASTNodeRow>(
    `/*cypher*/
    MATCH (f:CodeFile {repoId: $repoId})-[:HAS_AST]->(a:AstNode)
    WHERE f.path IN $relPaths
      AND a.startLine IS NOT NULL AND a.endLine IS NOT NULL
    RETURN
      a.id AS astNodeId,
      f.path AS relPath,
      coalesce(a.label, a.displayName, a.qname, a.name) AS symbolName,
      a.unitKind AS unitKind,
      a.summaryCandidate AS summaryCandidate,
      a.segmentReason AS segmentReason,
      a.keywords AS keywords,
      a.topLevelSymbols AS topLevelSymbols,
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

  const adaptiveConfig = createAdaptiveConfig(adaptive);
  const adaptiveState = createAdaptiveState(batchSize, adaptiveConfig);

  for (const [relPath, astRows] of rowsByFile.entries()) {
    const absPath = path.resolve(repoRootResolved, relPath);
    if (
      !absPath.startsWith(repoRootResolved + path.sep) &&
      absPath !== repoRootResolved
    ) {
      continue;
    }

    const text = await fs.readFile(absPath, "utf8").catch(() => "");
    if (!text) continue;

    const lines = text.split(/\r?\n/);
    const jobs: EmbeddingJob[] = astRows
      .map((row) => {
        const snippet = lines
          .slice(row.startLine - 1, row.endLine)
          .join("\n")
          .trim();
        if (!snippet) return null;
        return {
          astNodeId: row.astNodeId,
          relPath: row.relPath,
          symbolName: row.symbolName,
          startLine: Number(row.startLine),
          endLine: Number(row.endLine),
          embeddingText: buildEmbeddingText({
            symbolName: row.symbolName,
            unitKind: row.unitKind,
            summaryCandidate: row.summaryCandidate,
            segmentReason: row.segmentReason,
            keywords: row.keywords,
            topLevelSymbols: row.topLevelSymbols,
            text: snippet,
          }),
          text: snippet,
        };
      })
      .filter((job): job is EmbeddingJob => job !== null);

    if (jobs.length === 0) continue;

    let index = 0;
    let batchNumber = 0;
    while (index < jobs.length) {
      batchNumber += 1;
      const currentBatchSize = adaptiveConfig.enabled ? adaptiveState.batchSize : batchSize;
      const batch = jobs.slice(index, index + currentBatchSize);
      index += batch.length;

      const startedAt = Date.now();
      try {
        const embeddings = await generateEmbeddings(
          batch.map((job) => job.embeddingText),
          adaptiveConfig.enabled ? { concurrency: adaptiveState.concurrency } : undefined,
        );

        const rowsToWrite: AstEmbeddingWriteRow[] = [];
        for (const [batchIndex, job] of batch.entries()) {
          const embedding = embeddings[batchIndex];
          if (!job) continue;
          if (!isValidEmbeddingVector(embedding)) continue;

          rowsToWrite.push({
            astNodeId: job.astNodeId,
            text: job.text,
            embedding,
            startLine: job.startLine,
            endLine: job.endLine,
          });
        }

        if (rowsToWrite.length > 0) {
          await writeCypher(
            `/*cypher*/
            UNWIND $rows AS row
            MATCH (a:AstNode {id: row.astNodeId, repoId: $repoId})
            SET
              a.text = row.text,
              a.embeddings = row.embedding,
              a.embeddingStartLine = row.startLine,
              a.embeddingEndLine = row.endLine,
              a.embeddingUpdatedAt = datetime()
            RETURN count(a) AS updated
            `,
            {
              repoId,
              rows: rowsToWrite,
            },
          );

          totalEmbedded += rowsToWrite.length;
        }

        if (adaptiveConfig.enabled) {
          tuneAdaptiveOnSuccess(adaptiveState, adaptiveConfig, batch.length, Date.now() - startedAt);
        }
      } catch (error) {
        failedBatches++;
        if (adaptiveConfig.enabled) {
          tuneAdaptiveOnFailure(adaptiveState, adaptiveConfig);
        }
        const message = error instanceof Error ? error.message : String(error);
        failedBatchDetails.push(
          `Batch ${batchNumber} in ${relPath}: ${message}`,
        );
      }
    }

    filesProcessed++;
  }

  const result: EmbedASTFilesResult = {
    ok: failedBatches === 0,
    files: filesProcessed,
    totalEmbedded,
    failedBatches,
    failedBatchDetails:
      failedBatchDetails.length > 0 ? failedBatchDetails : undefined,
    ...(adaptiveConfig.enabled
      ? {
          adaptive: {
            enabled: true,
            finalBatchSize: adaptiveState.batchSize,
            finalConcurrency: adaptiveState.concurrency,
            adjustments: adaptiveState.adjustments,
          },
        }
      : {}),
  };

  return result;
}
