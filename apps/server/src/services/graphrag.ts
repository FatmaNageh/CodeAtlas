import fs from "fs/promises";
import path from "path";

import { generateTextWithContext } from "@/ai/generation";
import { generateEmbeddings, generateSingleEmbed } from "@/ai/embeddings";
import { embedDimensions } from "@/config/openrouter";
import { runCypher } from "@/db/cypher";
import { embedASTFiles } from "@/pipeline/embed/embedASTFiles";
import { generateBatchSummaries } from "@/pipeline/generateSummary";
import { assembleFileContext } from "@/retrieval/context";
import { findSimilarChunks, type SimilarASTNodeRow } from "@/retrieval/vector";
import { repoRoots } from "@/state/repoRoots";
import { buildGraphTour } from "@/tour/buildGraphTour";
import { isValidEmbeddingVector } from "@/utils/embedding";

type SummaryRow = {
  path: string;
  summary: string;
};

type FilePathRow = {
  filePath: string;
};

type CountRow = {
  n: number;
};

type StatusRow = {
  path: string;
  astNodes: number;
  embeddedAstNodes: number;
};

export function normalizeToRepoPath(filePath: string, repoRoot: string): string {
  let normalizedPath = filePath.trim().replace(/^["'](.*)["']$/, "$1");

  if (path.isAbsolute(normalizedPath)) {
    normalizedPath = path.relative(repoRoot, normalizedPath);
  }

  const resolvedPath = path.resolve(repoRoot, normalizedPath);
  const normalizedRoot = path.resolve(repoRoot) + path.sep;
  if (
    !resolvedPath.startsWith(normalizedRoot) &&
    resolvedPath !== path.resolve(repoRoot)
  ) {
    throw new Error(`Path "${filePath}" is outside the repository root`);
  }

  return normalizedPath.replace(/\\/g, "/");
}

export async function embedRepository(
  repoId: string,
  repoRoot: string,
  options?: { batchSize?: number; maxFiles?: number },
) {
  repoRoots.set(repoId, repoRoot);
  return embedASTFiles(repoId, repoRoot, options?.batchSize, options?.maxFiles);
}

async function getAllFiles(repoId: string): Promise<FilePathRow[]> {
  return runCypher<FilePathRow>(
    "/*cypher*/MATCH (f:CodeFile {repoId: $repoId}) RETURN coalesce(f.path, f.relPath) AS filePath",
    { repoId },
  );
}

export async function summarizeRepository(input: {
  repoId: string;
  filePaths?: string[];
  repoRoot?: string;
}) {
  const { repoId, filePaths, repoRoot: requestedRepoRoot } = input;
  let repoRoot = requestedRepoRoot || repoRoots.get(repoId);

  if (!repoRoot && filePaths && filePaths.some((filePath) => path.isAbsolute(filePath))) {
    throw new Error(
      `Unknown repoId: ${repoId}. Please provide repoRoot in request or call /graphrag/embedRepo first.`,
    );
  }

  if (requestedRepoRoot) {
    repoRoots.set(repoId, requestedRepoRoot);
    repoRoot = requestedRepoRoot;
  }

  const files =
    filePaths && filePaths.length > 0
      ? filePaths.map((filePath) =>
          repoRoot ? normalizeToRepoPath(filePath, repoRoot) : filePath.replace(/\\/g, "/"),
        )
      : (await getAllFiles(repoId)).map((file) => file.filePath);

  return generateBatchSummaries(files, repoId);
}

export async function getGraphTour(repoId: string, requestedLimit?: number) {
  return buildGraphTour(repoId, requestedLimit);
}

export async function askGraphRag(repoId: string, question: string) {
  const embeddingResult = await generateSingleEmbed(question);
  if (!isValidEmbeddingVector(embeddingResult, embedDimensions)) {
    throw new Error("Invalid embedding vector generated for the question");
  }

  const chunks = await findSimilarChunks(embeddingResult, repoId, 5);

  let codeContext =
    chunks.length > 0 ? chunks.map((chunk) => chunk.chunkText ?? "").join("\n\n") : "";
  const maxCodeContext = 8000;
  if (codeContext.length > maxCodeContext) {
    codeContext = codeContext.slice(-maxCodeContext);
  }

  if (!codeContext && chunks.length > 0) {
    const repoRoot = repoRoots.get(repoId);
    if (repoRoot) {
      try {
        const texts = await Promise.all(
          chunks.slice(0, 5).map(async (chunk) => {
            const relPath = normalizeToRepoPath(chunk.filePath, repoRoot);
            const absPath = path.resolve(repoRoot, relPath);
            return fs.readFile(absPath, "utf8");
          }),
        );
        const stacked = texts.filter((text) => text.length > 0).join("\n\n");
        if (stacked) {
          codeContext =
            stacked.length > maxCodeContext ? stacked.slice(-maxCodeContext) : stacked;
        }
      } catch {
        codeContext = "";
      }
    }
  }

  let summaryContext = "";
  if (!codeContext) {
    const summaries = await runCypher<SummaryRow>(
      "/*cypher*/MATCH (f:CodeFile {repoId: $repoId}) WHERE f.summary IS NOT NULL RETURN coalesce(f.path, f.relPath) AS path, f.summary AS summary",
      { repoId },
    );
    if (summaries.length > 0) {
      summaryContext = summaries
        .map((summaryRow) => `File: ${summaryRow.path}\nSummary:\n${summaryRow.summary}`)
        .join("\n\n");
      const maxSummaryContext = 2000;
      if (summaryContext.length > maxSummaryContext) {
        summaryContext = summaryContext.slice(0, maxSummaryContext) + "...";
      }
    }
  }

  if (!codeContext && !summaryContext) {
    throw new Error("No relevant code chunks or file summaries found for this repository.");
  }

  const combinedContext = [codeContext, summaryContext].filter(Boolean).join("\n\n");
  const prompt = `Context:\n${combinedContext}\n\nQuestion: ${question}\n\nAnswer concisely:`;
  const answer = await generateTextWithContext(prompt, { maxTokens: 1000 });

  return {
    answer,
    sources: chunks.map((chunk: SimilarASTNodeRow) => ({
      file: chunk.filePath ?? "unknown",
      symbol: chunk.symbol ?? "",
      score: chunk.score ?? 0,
    })),
  };
}

export async function getGraphContext(filePath: string, repoId: string) {
  return assembleFileContext(filePath, repoId);
}

export async function testEmbeddingGeneration() {
  const testText = 'function hello() { return "world"; }';
  const embedding = await generateEmbeddings([testText]);
  return {
    message: "Embedding generation works!",
    embeddingLength: embedding.length,
    sample: embedding.slice(0, 5),
  };
}

export async function getRepositoryGraphStatus(repoId: string) {
  const totalFiles =
    (await runCypher<CountRow>(
      "/*cypher*/MATCH (f:CodeFile {repoId: $repoId}) RETURN count(f) AS n",
      { repoId },
    ))?.[0]?.n ?? 0;

  const summarizedFiles =
    (await runCypher<CountRow>(
      "/*cypher*/MATCH (f:CodeFile {repoId: $repoId}) WHERE f.summary IS NOT NULL RETURN count(f) AS n",
      { repoId },
    ))?.[0]?.n ?? 0;

  const totalChunks =
    (await runCypher<CountRow>(
      "/*cypher*/MATCH (a:AstNode {repoId: $repoId}) RETURN count(a) AS n",
      { repoId },
    ))?.[0]?.n ?? 0;

  const embeddedChunks =
    (await runCypher<CountRow>(
      "/*cypher*/MATCH (a:AstNode {repoId: $repoId}) WHERE a.embeddings IS NOT NULL RETURN count(a) AS n",
      { repoId },
    ))?.[0]?.n ?? 0;

  const perFile = await runCypher<StatusRow>(
    `/*cypher*/
     MATCH (f:CodeFile {repoId: $repoId})
      OPTIONAL MATCH (f)-[:HAS_AST]->(a:AstNode {repoId: $repoId})
      WITH coalesce(f.path, f.relPath) AS path, count(a) AS astNodes,
           sum(CASE WHEN a.embeddings IS NOT NULL THEN 1 ELSE 0 END) AS embeddedAstNodes
      RETURN path, astNodes, embeddedAstNodes`,
    { repoId },
  );

  return {
    repoId,
    totalFiles,
    summarizedFiles,
    totalChunks,
    embeddedChunks,
    perFile,
  };
}
