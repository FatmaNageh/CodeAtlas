import { Hono } from "hono";
import path from "path";
import { embedASTFiles } from "@/pipeline/embed/embedASTFiles";
import { embedTextChunks } from "@/pipeline/embed/embedTextChunks";
import { generateBatchSummaries } from "@/pipeline/generateSummary";
import { assembleFileContext } from "@/retrieval/context";
import { generateTextWithContext } from "@/ai/generation";
import { generateEmbeddings, generateSingleEmbed } from "@/ai/embeddings";
import { isValidEmbeddingVector } from "@/utils/embedding";
import { findSimilarChunks, type SimilarASTNodeRow } from "@/retrieval/vector";
import { runCypher } from "@/db/cypher";
import fs from "fs/promises";
import { repoRoots } from "@/state/repoRoots";
import { embedDimensions } from "@/config/openrouter";
import { buildGraphTour } from "@/tour/buildGraphTour";
import { getAdjacentASTChunks } from "@/retrieval/graph";
import {
  appendThreadMessage,
  resolveThreadForQuestion,
} from "@CodeAtlas/db/chat";

export const graphragRoute = new Hono();

type AskNodeRef = {
  id: string;
  name?: string;
  path?: string;
};

type AskRequestBody = {
  repoId?: string;
  question?: string;
  threadId?: string;
  contextNodeId?: string;
  mentionedNodes?: AskNodeRef[];
  selectedNodes?: AskNodeRef[];
};

type SummaryRow = {
  path: string;
  summary: string;
  fileKind: string;
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
  textChunks: number;
  embeddedTextChunks: number;
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

type AskSource = {
  file: string;
  symbol: string;
  score: number;
  sourceKind: string;
};

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
): Promise<{ context: string; sources: AskSource[] }> {
  if (refs.length === 0) {
    return { context: "", sources: [] };
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

  for (const ref of refs) {
    const row = rowById.get(ref.id);
    const label = row?.labels?.[0] ?? "Node";
    const symbol = row?.qname ?? row?.name ?? ref.name ?? label;
    const filePath = row?.path ?? row?.filePath ?? ref.path ?? "";
    const nodeText = row?.text ?? row?.content ?? "";
    const summary = row?.summary ?? "";

    if (filePath) filePaths.add(filePath);

    sources.push({
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

      return parts.length > 1 ? parts.join("\n") : "";
    }),
  );

  return {
    context: [...sections, ...fileContextSections.filter(Boolean)].join("\n\n"),
    sources,
  };
}

// Helper: Convert absolute Windows/macOS paths to repo-relative POSIX paths
function normalizeToRepoPath(filePath: string, repoRoot: string): string {
  // Trim whitespace and quotes
  let p = filePath.trim().replace(/^["'](.*)["']$/, "$1");

  // If it's an absolute path, make it relative to repoRoot
  if (path.isAbsolute(p)) {
    p = path.relative(repoRoot, p);
  }

  // Ensure the path doesn't escape the repo root
  const resolvedPath = path.resolve(repoRoot, p);
  const normalizedRoot = path.resolve(repoRoot) + path.sep;
  if (
    !resolvedPath.startsWith(normalizedRoot) &&
    resolvedPath !== path.resolve(repoRoot)
  ) {
    throw new Error(`Path "${filePath}" is outside the repository root`);
  }

  // Convert backslashes to forward slashes for cross-platform consistency
  return p.replace(/\\/g, "/");
}

// POST /graphrag/embedRepo - Generate embeddings for entire repo
graphragRoute.post("/embedRepo", async (c) => {
  const { repoId, repoRoot: reqRepoRoot } = await c.req.json().catch(() => ({}));
  const repoRoot = typeof reqRepoRoot === "string" && reqRepoRoot.trim().length > 0
    ? reqRepoRoot.trim()
    : repoId
      ? repoRoots.get(repoId)
      : undefined;

  if (!repoId || !repoRoot) {
    return c.json({ ok: false, error: "Missing repoId or repoRoot" }, 400);
  }

  try {
    // Store repoRoot so /graphrag/summarize can normalize paths
    repoRoots.set(repoId, repoRoot);
    console.log(`[EMBED] Stored repoRoot for ${repoId}: ${repoRoot}`);

    const [astResult, textChunkResult] = await Promise.all([
      embedASTFiles(repoId, repoRoot),
      embedTextChunks(repoId),
    ]);

    return c.json({
      ok: astResult.ok && textChunkResult.ok,
      ast: astResult,
      textChunks: textChunkResult,
    });
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500);
  }
});

// POST /graphrag/summarize - Generate file summaries
graphragRoute.post("/summarize", async (c) => {
  const {
    repoId,
    filePaths,
    repoRoot: reqRepoRoot,
  }: {
    repoId?: string;
    filePaths?: string[];
    repoRoot?: string;
  } = await c.req.json().catch(() => ({}));
  console.log(repoId);

  if (!repoId) {
    return c.json({ ok: false, error: "Missing repoId" }, 400);
  }

  // Get repo root for path normalization - from request body or memory
  let repoRoot = reqRepoRoot || repoRoots.get(repoId);

  // If we have absolute paths but no repoRoot, we can't normalize
  if (!repoRoot && filePaths && filePaths.length > 0) {
    // Check if any path is absolute
    const hasAbsolutePath = filePaths.some((fp: string) => path.isAbsolute(fp));
    if (hasAbsolutePath) {
      return c.json(
        {
          ok: false,
          error: `Unknown repoId: ${repoId}. Please provide repoRoot in request or call /graphrag/embedRepo first.`,
        },
        400,
      );
    }
  }

  // Store repoRoot if provided in request for future use
  if (reqRepoRoot && repoId) {
    repoRoots.set(repoId, reqRepoRoot);
    console.log(`[SUMMARIZE] Stored repoRoot for ${repoId}: ${reqRepoRoot}`);
  }

  try {
    let files: string[];

    if (filePaths && filePaths.length > 0) {
      // Normalize provided file paths to repo-relative format
      files = filePaths.map((fp: string) => {
        if (repoRoot) {
          return normalizeToRepoPath(fp, repoRoot);
        }
        // If no repoRoot but paths are already relative, use as-is
        return fp.replace(/\\/g, "/");
      });
      console.log(
        `[SUMMARIZE] Normalized ${files.length} paths for repo ${repoId}`,
      );
    } else {
      // Get all files from database
      files = (await getAllFiles(repoId)).map((f) => f.filePath);
    }

    const { results, errors } = await generateBatchSummaries(files, repoId);
    return c.json({ ok: true, results, errors });
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500);
  }
});

// GET /graphrag/tour - Graph-only ranked onboarding tour
graphragRoute.get("/tour", async (c) => {
  const repoId = c.req.query("repoId")?.trim();
  const limitRaw = c.req.query("limit");
  const parsedLimit =
    limitRaw == null ? undefined : Number.parseInt(limitRaw, 10);
  const requestedLimit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;

  if (!repoId) {
    return c.json({ ok: false, error: "Missing repoId" }, 400);
  }

  try {
    const result = await buildGraphTour(repoId, requestedLimit);
    return c.json(result);
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500);
  }
});

// POST /graphrag/ask - Q&A about code using RAG
graphragRoute.post("/ask", async (c) => {
  const {
    repoId,
    question,
    threadId,
    contextNodeId,
    mentionedNodes,
    selectedNodes,
  }: AskRequestBody = await c.req.json().catch(() => ({}));

  if (!repoId || !question) {
    return c.json({ ok: false, error: "Missing repoId or question" }, 400);
  }

  try {
    const thread = await resolveThreadForQuestion({
      repoId,
      threadId,
      question,
    });

    await appendThreadMessage({
      repoId,
      threadId: thread.id,
      role: "user",
      content: question,
    });

    const contextNodeRefs = uniqueNodeRefs(
      contextNodeId ? [{ id: contextNodeId }] : undefined,
      mentionedNodes,
      selectedNodes,
    );
    const nodeContextResult = await gatherNodeContext(repoId, contextNodeRefs);

    // Embed question
    const embeddingResult = await generateSingleEmbed(question);
    if (!isValidEmbeddingVector(embeddingResult, embedDimensions)) {
      throw new Error("Invalid embedding vector generated for the question");
    }

    // Find relevant chunks
    const chunks = await findSimilarChunks(embeddingResult, repoId, 5, question);
    const vectorSources: AskSource[] = chunks.map((chunk: SimilarASTNodeRow) => ({
      file: chunk.filePath ?? "unknown",
      symbol: chunk.symbol ?? "",
      score: chunk.score ?? 0,
      sourceKind: chunk.sourceKind,
    }));

    const adjacentAstChunks = await getAdjacentASTChunks(
      chunks
        .filter((chunk) => chunk.sourceKind === "ast" && typeof chunk.id === "string" && chunk.id.length > 0)
        .map((chunk) => chunk.id as string),
      repoId,
    );

    const adjacentChunkMap = new Map(
      adjacentAstChunks.map((chunk) => [chunk.id, { ...chunk, score: 0, id: chunk.id }] as const),
    );
    const expandedChunks = [
      ...chunks,
      ...Array.from(adjacentChunkMap.values()).filter(
        (chunk) => !chunks.some((existing) => existing.id === chunk.id),
      ),
    ];

    // Build code context if any chunks exist
    let codeContext =
      expandedChunks.length > 0
        ? expandedChunks.map((chunk) => formatRetrievedChunk(chunk)).join("\n\n")
        : "";
    // Trim excessively long code context to avoid huge prompts
    const MAX_CODE_CONTEXT = 8000; // characters
    if (codeContext && codeContext.length > MAX_CODE_CONTEXT) {
      codeContext = codeContext.slice(-MAX_CODE_CONTEXT);
    }
    // Fallback: if code context is empty, try reading from disk (for a best-effort context)
    if (!codeContext && expandedChunks.length > 0) {
      const repoRoot = repoRoots.get(repoId);
      if (repoRoot) {
        try {
          const texts = await Promise.all(
            expandedChunks.slice(0, 5).map(async (chunk) => {
              const rel = normalizeToRepoPath(chunk.filePath, repoRoot);
              const absPath = path.resolve(repoRoot, rel);
              const t = await fs.readFile(absPath, "utf8");
              return t;
            }),
          );
          const stacked = texts.filter((t) => t.length > 0).join("\n\n");
          if (stacked) {
            codeContext =
              stacked.length > MAX_CODE_CONTEXT
                ? stacked.slice(-MAX_CODE_CONTEXT)
                : stacked;
          }
        } catch {
          // ignore disk read errors; keep codeContext as empty to fall back to summaries
        }
      }
    }

    // Fallback: gather file summaries if no code context
    let summaryContext = "";
    if (!codeContext) {
      const sums = await runCypher<SummaryRow>(
        `/*cypher*/
        MATCH (f {repoId: $repoId})
        WHERE (f:CodeFile OR f:TextFile) AND f.summary IS NOT NULL
        RETURN f.path AS path,
               f.summary AS summary,
               CASE WHEN f:CodeFile THEN 'CodeFile' ELSE 'TextFile' END AS fileKind`,
        { repoId },
      );
      if (Array.isArray(sums) && sums.length > 0) {
        summaryContext = sums
          .map(
            (summaryRow) =>
              `File: ${summaryRow.path}\nType: ${summaryRow.fileKind}\nSummary:\n${summaryRow.summary}`,
          )
          .join("\n\n");
        // Cap length to avoid overly long prompts
        const MAX_SUMMARY_CONTEXT = 2000;
        if (summaryContext.length > MAX_SUMMARY_CONTEXT) {
          summaryContext = summaryContext.slice(0, MAX_SUMMARY_CONTEXT) + "...";
        }
      }
    }

    const combinedContext = [nodeContextResult.context, codeContext, summaryContext]
      .filter(Boolean)
      .join("\n\n");

    if (!combinedContext) {
      return c.json(
        {
          ok: false,
          error:
            "No relevant node context, code chunks, or file summaries found for this repository.",
        },
        400,
      );
    }

    console.log(
      "[GRAPHRAG] Context lengths -> code:",
      codeContext ? codeContext.length : 0,
      "node:",
      nodeContextResult.context ? nodeContextResult.context.length : 0,
      "summary:",
      summaryContext ? summaryContext.length : 0,
      "combined:",
      combinedContext.length,
    );
    const prompt = `Context:\n${combinedContext}\n\nQuestion: ${question}\n\nAnswer concisely:`;
    console.log(
      "[GRAPHRAG] Prompt prepared. length:",
      prompt.length,
      "nodeCtx",
      nodeContextResult.context ? nodeContextResult.context.length : 0,
      "codeCtx",
      codeContext ? codeContext.length : 0,
      "sumCtx",
      summaryContext ? summaryContext.length : 0,
      "chunks",
      expandedChunks.length,
    );
    if (codeContext) {
      const preview = codeContext.substring(0, 120).replace(/\n/g, " ");
      console.log("[GRAPHRAG] CodeContext preview:", preview);
    }

    // Generate answer
    const answer = await generateTextWithContext(prompt, { maxTokens: 1000 });

    const allSources = [...nodeContextResult.sources, ...vectorSources];

    await appendThreadMessage({
      repoId,
      threadId: thread.id,
      role: "assistant",
      content: answer,
      sourcesJson: JSON.stringify(allSources),
    });

    return c.json({
      ok: true,
      threadId: thread.id,
      answer,
      sources: allSources,
    });
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500);
  }
});

// GET /graphrag/context - Retrieve assembled context
graphragRoute.get("/context", async (c) => {
  const filePath = c.req.query("filePath");
  const repoId = c.req.query("repoId");

  if (!repoId) {
    return c.json({ ok: false, error: "Missing repoId" }, 400);
  }

  if (!filePath) {
    return c.json({ ok: false, error: "Missing filePath" }, 400);
  }

  try {
    const context = await assembleFileContext(filePath, repoId);
    return c.json({ ok: true, context });
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500);
  }
});

// GET /graphrag/test-embedding - Test if embeddings are working
graphragRoute.get("/test-embedding", async (c) => {
  try {
    console.log("[TEST] Testing embedding generation...");
    const testText = 'function hello() { return "world"; }';
    const embedding = await generateEmbeddings([testText]);

    return c.json({
      ok: true,
      message: "Embedding generation works!",
      embeddingLength: embedding.length,
      sample: embedding.slice(0, 5),
    });
  } catch (err) {
    console.error("[TEST] Embedding test failed:", err);
    return c.json(
      {
        ok: false,
        error: "Embedding test failed",
      },
      500,
    );
  }
});

// GET /graphrag/status - Repo health check (counts of files, summaries, chunks, embeddings)
graphragRoute.get("/status", async (c) => {
  const repoId = c.req.query("repoId");
  if (!repoId) {
    return c.json({ ok: false, error: "Missing repoId" }, 400);
  }
  try {
    const totalFiles =
      (
        await runCypher<CountRow>(
          "/*cypher*/MATCH (f:CodeFile {repoId: $repoId}) RETURN count(f) AS n",
          { repoId },
        )
      )?.[0]?.n ?? 0;
    const totalTextFiles =
      (
        await runCypher<CountRow>(
          "/*cypher*/MATCH (f:TextFile {repoId: $repoId}) RETURN count(f) AS n",
          { repoId },
        )
      )?.[0]?.n ?? 0;
    const summarizedFiles =
      (
        await runCypher<CountRow>(
          `/*cypher*/
          MATCH (f {repoId: $repoId})
          WHERE (f:CodeFile OR f:TextFile) AND f.summary IS NOT NULL
          RETURN count(f) AS n`,
          { repoId },
        )
      )?.[0]?.n ?? 0;
    const totalChunks =
      (
        await runCypher<CountRow>(
          "/*cypher*/MATCH (a:AstNode {repoId: $repoId}) RETURN count(a) AS n",
          { repoId },
        )
      )?.[0]?.n ?? 0;
    const totalTextChunks =
      (
        await runCypher<CountRow>(
          "/*cypher*/MATCH (c:TextChunk {repoId: $repoId}) RETURN count(c) AS n",
          { repoId },
        )
      )?.[0]?.n ?? 0;
    const embeddedChunks =
      (
        await runCypher<CountRow>(
          "/*cypher*/MATCH (a:AstNode {repoId: $repoId}) WHERE a.embeddings IS NOT NULL RETURN count(a) AS n",
          { repoId },
        )
      )?.[0]?.n ?? 0;
    const embeddedTextChunks =
      (
        await runCypher<CountRow>(
          "/*cypher*/MATCH (c:TextChunk {repoId: $repoId}) WHERE c.embeddings IS NOT NULL RETURN count(c) AS n",
          { repoId },
        )
      )?.[0]?.n ?? 0;

    const perFile = await runCypher<StatusRow>(
      `/*cypher*/
      MATCH (f {repoId: $repoId})
      WHERE f:CodeFile OR f:TextFile
       OPTIONAL MATCH (f)-[:HAS_AST]->(a:AstNode {repoId: $repoId})
       OPTIONAL MATCH (f)-[:HAS_CHUNK]->(c:TextChunk {repoId: $repoId})
       WITH f.path AS path,
            count(DISTINCT a) AS astNodes,
            sum(CASE WHEN a.embeddings IS NOT NULL THEN 1 ELSE 0 END) AS embeddedAstNodes,
            count(DISTINCT c) AS textChunks,
            sum(CASE WHEN c.embeddings IS NOT NULL THEN 1 ELSE 0 END) AS embeddedTextChunks
       RETURN path, astNodes, embeddedAstNodes, textChunks, embeddedTextChunks`,
      { repoId },
    );

    return c.json({
      ok: true,
      repoId,
      totalFiles,
      totalTextFiles,
      summarizedFiles,
      totalChunks,
      embeddedChunks,
      totalTextChunks,
      embeddedTextChunks,
      perFile,
    });
  } catch (err) {
    console.error("[GRAPHRAG] Error during /status processing:", err);
    return c.json(
      {
        ok: false,
        error: "Failed to retrieve repository status.",
      },
      500,
    );
  }
});

// Helper function
async function getAllFiles(repoId: string) {
  return runCypher<FilePathRow>(
    `/*cypher*/
    MATCH (f {repoId: $repoId})
    WHERE f:CodeFile OR f:TextFile
    RETURN f.path as filePath
    ORDER BY filePath`,
    { repoId },
  );
}
