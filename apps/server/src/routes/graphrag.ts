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

export const graphragRoute = new Hono();

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
  const { repoId, question } = await c.req.json().catch(() => ({}));

  if (!repoId || !question) {
    return c.json({ ok: false, error: "Missing repoId or question" }, 400);
  }

  try {
    // Embed question
    const embeddingResult = await generateSingleEmbed(question);
    if (!isValidEmbeddingVector(embeddingResult, embedDimensions)) {
      throw new Error("Invalid embedding vector generated for the question");
    }

    // Find relevant chunks
    const chunks = await findSimilarChunks(embeddingResult, repoId, 5);

    // Build code context if any chunks exist
    let codeContext =
      chunks && chunks.length > 0
        ? chunks.map((chunk) => chunk.chunkText ?? "").join("\n\n")
        : "";
    // Trim excessively long code context to avoid huge prompts
    const MAX_CODE_CONTEXT = 8000; // characters
    if (codeContext && codeContext.length > MAX_CODE_CONTEXT) {
      codeContext = codeContext.slice(-MAX_CODE_CONTEXT);
    }
    // Fallback: if code context is empty, try reading from disk (for a best-effort context)
    if (!codeContext && chunks && chunks.length > 0) {
      const repoRoot = repoRoots.get(repoId);
      if (repoRoot) {
        try {
          const texts = await Promise.all(
            chunks.slice(0, 5).map(async (chunk) => {
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

    if (!codeContext && !summaryContext) {
      return c.json(
        {
          ok: false,
          error:
            "No relevant code chunks or file summaries found for this repository.",
        },
        400,
      );
    }

    const combinedContext = [codeContext, summaryContext]
      .filter(Boolean)
      .join("\n\n");
    console.log(
      "[GRAPHRAG] Context lengths -> code:",
      codeContext ? codeContext.length : 0,
      "summary:",
      summaryContext ? summaryContext.length : 0,
      "combined:",
      combinedContext.length,
    );
    const prompt = `Context:\n${combinedContext}\n\nQuestion: ${question}\n\nAnswer concisely:`;
    console.log(
      "[GRAPHRAG] Prompt prepared. length:",
      prompt.length,
      "codeCtx",
      codeContext ? codeContext.length : 0,
      "sumCtx",
      summaryContext ? summaryContext.length : 0,
      "chunks",
      chunks ? chunks.length : 0,
    );
    if (codeContext) {
      const preview = codeContext.substring(0, 120).replace(/\n/g, " ");
      console.log("[GRAPHRAG] CodeContext preview:", preview);
    }

    // Generate answer
    const answer = await generateTextWithContext(prompt, { maxTokens: 1000 });

    return c.json({
      ok: true,
      answer,
      sources: chunks.map((chunk: SimilarASTNodeRow) => ({
        file: chunk.filePath ?? "unknown",
        symbol: chunk.symbol ?? "",
        score: chunk.score ?? 0,
        sourceKind: chunk.sourceKind,
      })),
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
       OPTIONAL MATCH (f)-[:DECLARES]->(a:AstNode {repoId: $repoId})
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
