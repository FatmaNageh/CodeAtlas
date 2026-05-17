import fs from "fs/promises";
import path from "path";

import { generateTextWithContext } from "@/ai/generation";
import { generateEmbeddings, generateSingleEmbed } from "@/ai/embeddings";
import { embedDimensions } from "@/config/openrouter";
import { runCypher } from "@/db/cypher";
import { embedASTFiles } from "@/pipeline/embed/embedASTFiles";
import { generateBatchSummaries } from "@/pipeline/generateSummary";
import { assembleFileContext } from "@/retrieval/context";
import { getAdjacentASTChunks } from "@/retrieval/graph";
import { findSimilarChunks, type SimilarASTNodeRow } from "@/retrieval/vector";
import { repoRoots } from "@/state/repoRoots";
import { buildGraphTour } from "@/tour/buildGraphTour";
import {
  type AskGraphRagInput,
  type AskGraphRagResult,
  type AskNodeRef,
  type AskSource,
} from "@/types/graphragEval";
import { isValidEmbeddingVector } from "@/utils/embedding";

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

type FileSummaryRow = {
  summary: string | null;
  fileKind: string;
};

type ContextNodeRow = {
  id: string;
  labels: string[];
  path: string | null;
  filePath: string | null;
  name: string | null;
  qname: string | null;
  text: string | null;
  content: string | null;
  summary: string | null;
};

type AskInternalContext = {
  nodeContext: string;
  nodeSources: AskSource[];
};

type SummarySourceRow = {
  path: string;
  summary: string;
  fileKind: string;
};

function addUniqueSource(
  sources: AskSource[],
  seen: Set<string>,
  source: AskSource,
): void {
  const key = `${source.file}|${source.symbol}|${source.sourceKind}`;
  if (seen.has(key)) return;
  seen.add(key);
  sources.push(source);
}

export function normalizeToRepoPath(filePath: string, repoRoot: string): string {
  let normalizedPath = filePath.trim().replace(/^(["'])(.*)\1$/, "$2");

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
  options?: { batchSize?: number; maxFiles?: number; adaptive?: boolean },
) {
  repoRoots.set(repoId, repoRoot);
  return embedASTFiles(
    repoId,
    repoRoot,
    options?.batchSize,
    options?.maxFiles,
    options?.adaptive,
  );
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

function formatRetrievedChunk(chunk: SimilarASTNodeRow): string {
  const parts: string[] = [];

  if (chunk.filePath) {
    parts.push(`File: ${chunk.filePath}`);
  }
  if (chunk.symbol) {
    parts.push(`Label: ${chunk.symbol}`);
  }
  if (chunk.unitKind) {
    parts.push(`Unit kind: ${chunk.unitKind}`);
  }
  if (chunk.segmentReason) {
    parts.push(`Segment reason: ${chunk.segmentReason}`);
  }
  if (chunk.topLevelSymbols && chunk.topLevelSymbols.length > 0) {
    parts.push(`Top-level symbols: ${chunk.topLevelSymbols.join(", ")}`);
  }
  if (chunk.keywords && chunk.keywords.length > 0) {
    parts.push(`Keywords: ${chunk.keywords.join(", ")}`);
  }
  if (chunk.summaryCandidate) {
    parts.push(`Summary: ${chunk.summaryCandidate}`);
  }
  if (chunk.startLine != null || chunk.endLine != null) {
    parts.push(`Lines: ${chunk.startLine ?? "?"}-${chunk.endLine ?? "?"}`);
  }
  if (chunk.chunkText) {
    parts.push("Code:");
    parts.push(chunk.chunkText);
  }

  return parts.join("\n");
}

function uniqueNodeRefs(...groups: (AskNodeRef[] | undefined)[]): AskNodeRef[] {
  const out: AskNodeRef[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    for (const ref of group ?? []) {
      const id = typeof ref?.id === "string" ? ref.id.trim() : "";
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        name: typeof ref.name === "string" ? ref.name : undefined,
        path: typeof ref.path === "string" ? ref.path : undefined,
      });
    }
  }

  return out;
}

async function getFileSummary(filePath: string, repoId: string): Promise<string> {
  const rows = await runCypher<FileSummaryRow>(
    `/*cypher*/
    MATCH (f {repoId: $repoId, path: $filePath})
    WHERE f:CodeFile OR f:TextFile
    RETURN f.summary AS summary,
           CASE WHEN f:CodeFile THEN 'CodeFile' ELSE 'TextFile' END AS fileKind
    LIMIT 1`,
    { repoId, filePath },
  );

  const row = rows[0];
  if (!row?.summary) return "";

  return `File: ${filePath}\nType: ${row.fileKind}\nSummary:\n${row.summary}`;
}

async function gatherNodeContext(
  repoId: string,
  refs: AskNodeRef[],
): Promise<AskInternalContext> {
  if (refs.length === 0) {
    return { nodeContext: "", nodeSources: [] };
  }

  const rows = await runCypher<ContextNodeRow>(
    `/*cypher*/
    UNWIND $nodeIds AS nodeId
    MATCH (n {repoId: $repoId, id: nodeId})
    RETURN n.id AS id,
           labels(n) AS labels,
           n.path AS path,
           n.filePath AS filePath,
           n.name AS name,
           n.qname AS qname,
           n.text AS text,
           n.content AS content,
           n.summary AS summary`,
    { repoId, nodeIds: refs.map((ref) => ref.id) },
  );

  const rowById = new Map(rows.map((row) => [row.id, row] as const));
  const filePaths = new Set<string>();
  const sections: string[] = [];
  const sources: AskSource[] = [];
  const seenSources = new Set<string>();

  for (const ref of refs) {
    const row = rowById.get(ref.id);
    const label = row?.labels?.[0] ?? "Node";
    const symbol = row?.qname ?? row?.name ?? ref.name ?? label;
    const filePath = row?.path ?? row?.filePath ?? ref.path ?? "";
    const nodeText = row?.text ?? row?.content ?? "";
    const summary = row?.summary ?? "";

    if (filePath) filePaths.add(filePath);

    addUniqueSource(sources, seenSources, {
      file: filePath || "unknown",
      symbol,
      score: 1,
      sourceKind: `node:${label}`,
    });

    const parts = [
      `Selected context node: ${symbol}`,
      `Type: ${label}`,
      filePath ? `Path: ${filePath}` : "",
      summary ? `Summary:\n${summary}` : "",
      nodeText ? `Relevant content:\n${nodeText.slice(0, 2400)}` : "",
    ].filter(Boolean);

    if (parts.length > 0) {
      sections.push(parts.join("\n"));
    }
  }

  const fileContextSections = await Promise.all(
    Array.from(filePaths).map(async (filePath) => {
      const [fileContext, fileSummary] = await Promise.all([
        assembleFileContext(filePath, repoId).catch(() => null),
        getFileSummary(filePath, repoId).catch(() => ""),
      ]);

      const chunkText =
        fileContext?.fileChunks
          .map((chunk) => chunk.text ?? "")
          .filter((text) => text.trim().length > 0)
          .slice(0, 6)
          .join("\n\n") ?? "";
      const relatedSymbols =
        fileContext?.relatedASTNodes
          .map((node) => node.symbol)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
          .slice(0, 12)
          .join(", ") ?? "";
      const references = fileContext?.references.slice(0, 12).join(", ") ?? "";

      const parts = [
        `Context file: ${filePath}`,
        fileSummary,
        chunkText ? `File content:\n${chunkText.slice(0, 3200)}` : "",
        relatedSymbols ? `Symbols: ${relatedSymbols}` : "",
        references ? `References: ${references}` : "",
      ].filter(Boolean);

      if (parts.length > 1) {
        addUniqueSource(sources, seenSources, {
          file: filePath,
          symbol: relatedSymbols.split(", ")[0] || filePath,
          score: 0.75,
          sourceKind: fileSummary ? "file-summary" : "file-context",
        });
      }

      return parts.length > 1 ? parts.join("\n") : "";
    }),
  );

  return {
    nodeContext: [...sections, ...fileContextSections.filter(Boolean)].join("\n\n"),
    nodeSources: sources,
  };
}

export async function askGraphRag(input: AskGraphRagInput): Promise<AskGraphRagResult> {
  const { repoId, question, contextNodeId, mentionedNodes, selectedNodes } = input;
  const contextNodeRefs = uniqueNodeRefs(
    contextNodeId ? [{ id: contextNodeId }] : undefined,
    mentionedNodes,
    selectedNodes,
  );
  const nodeContextResult = await gatherNodeContext(repoId, contextNodeRefs);

  const embeddingResult = await generateSingleEmbed(question);
  if (!isValidEmbeddingVector(embeddingResult, embedDimensions)) {
    throw new Error("Invalid embedding vector generated for the question");
  }

  const initialChunks = await findSimilarChunks(embeddingResult, repoId, 5, question);
  console.log("[GRAPHRAG] initialChunks count:", initialChunks.length, "for repoId:", repoId);
  if (initialChunks.length > 0) {
    console.log("[GRAPHRAG] First chunk:", JSON.stringify({
      filePath: initialChunks[0].filePath,
      symbol: initialChunks[0].symbol,
      sourceKind: initialChunks[0].sourceKind,
      chunkTextLen: initialChunks[0].chunkText?.length ?? 0,
    }));
  }
  const vectorSources: AskSource[] = initialChunks.map((chunk) => ({
    file: chunk.filePath ?? "unknown",
    symbol: chunk.symbol ?? "",
    score: chunk.score ?? 0,
    sourceKind: chunk.sourceKind,
  }));

  const adjacentAstChunks = await getAdjacentASTChunks(
    initialChunks
      .filter((chunk) => chunk.sourceKind === "ast" && typeof chunk.id === "string" && chunk.id.length > 0)
      .map((chunk) => chunk.id as string),
    repoId,
  );

  const adjacentChunkMap = new Map(
    adjacentAstChunks.map((chunk) => [chunk.id, { ...chunk, score: 0, id: chunk.id }] as const),
  );
  const expandedChunks = [
    ...initialChunks,
    ...Array.from(adjacentChunkMap.values()).filter(
      (chunk) => !initialChunks.some((existing) => existing.id === chunk.id),
    ),
  ];

  let codeContext =
    expandedChunks.length > 0
      ? expandedChunks.map((chunk) => formatRetrievedChunk(chunk)).join("\n\n")
      : "";
  const maxCodeContext = 8000;
  if (codeContext && codeContext.length > maxCodeContext) {
    codeContext = codeContext.slice(-maxCodeContext);
  }

  if (!codeContext && expandedChunks.length > 0) {
    const repoRoot = repoRoots.get(repoId);
    if (repoRoot) {
      try {
        const texts = await Promise.all(
          expandedChunks.slice(0, 5).map(async (chunk) => {
            const relPath = normalizeToRepoPath(chunk.filePath, repoRoot);
            const absPath = path.resolve(repoRoot, relPath);
            return fs.readFile(absPath, "utf8");
          }),
        );
        const stacked = texts.filter((text) => text.length > 0).join("\n\n");
        if (stacked) {
          codeContext = stacked.length > maxCodeContext ? stacked.slice(-maxCodeContext) : stacked;
        }
      } catch {
        codeContext = "";
      }
    }
  }

  let summaryContext = "";
  if (!codeContext) {
    const summaries = await runCypher<SummarySourceRow>(
      `/*cypher*/
      MATCH (f {repoId: $repoId})
      WHERE (f:CodeFile OR f:TextFile) AND f.summary IS NOT NULL
      RETURN f.path AS path,
             f.summary AS summary,
             CASE WHEN f:CodeFile THEN 'CodeFile' ELSE 'TextFile' END AS fileKind`,
      { repoId },
    );
    if (summaries.length > 0) {
      summaryContext = summaries
        .map(
          (summaryRow) =>
            `File: ${summaryRow.path}\nType: ${summaryRow.fileKind}\nSummary:\n${summaryRow.summary}`,
        )
        .join("\n\n");
      const maxSummaryContext = 2000;
      if (summaryContext.length > maxSummaryContext) {
        summaryContext = summaryContext.slice(0, maxSummaryContext) + "...";
      }

    }
  }

  const retrievedContext = [nodeContextResult.nodeContext, codeContext, summaryContext]
    .filter(Boolean)
    .join("\n\n");

  if (!retrievedContext) {
    throw new Error(
      "No relevant node context, code chunks, or file summaries found for this repository.",
    );
  }

  const prompt = `Context:\n${retrievedContext}\n\nQuestion: ${question}\n\nAnswer concisely:`;
  const answer = await generateTextWithContext(prompt, { maxTokens: 1000 });

  return {
    answer,
    sources: [...nodeContextResult.nodeSources, ...vectorSources],
    embeddingOk: true,
    prompt,
    nodeContext: nodeContextResult.nodeContext,
    codeContext,
    summaryContext,
    initialChunks,
    expandedChunks,
    retrievedContext,
  };
}

export async function askGraphRagSimple(repoId: string, question: string) {
  return askGraphRag({ repoId, question });
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
