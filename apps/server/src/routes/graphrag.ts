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
import {
  createEvaluatorRun,
  listEvaluatorRuns,
} from "@CodeAtlas/db/evaluators";
import { models } from "@/config/openrouter";

export const graphragRoute = new Hono();

// Maximum number of dataset entries to process in a single batch to prevent unbounded LLM fan-out
const MAX_DATASET_BATCH = 50;

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

type EvaluatorScore = {
  score: number;
  rationale: string;
  majorErrors: number;
  minorErrors: number;
  unsupportedClaims: number;
};

type ResultItem = {
  path?: string;
  summary?: string;
  text?: string;
};

function isResultItem(obj: unknown): obj is ResultItem {
  if (typeof obj !== "object" || obj === null) return false;
  const candidate = obj as Record<string, unknown>;
  return (
    (candidate.path === undefined || typeof candidate.path === "string") &&
    (candidate.summary === undefined || typeof candidate.summary === "string") &&
    (candidate.text === undefined || typeof candidate.text === "string")
  );
}

type DatasetEntryItem = {
  question?: string;
  response?: string;
  referenceAnswer?: string;
  retrievedContext?: string;
  retrievalCount?: number;
  latencyMs?: number;
};

function isDatasetEntryItem(obj: unknown): obj is DatasetEntryItem {
  if (typeof obj !== "object" || obj === null) return false;
  const candidate = obj as Record<string, unknown>;
  return (
    (candidate.question === undefined || typeof candidate.question === "string") &&
    (candidate.response === undefined || typeof candidate.response === "string") &&
    (candidate.referenceAnswer === undefined || typeof candidate.referenceAnswer === "string") &&
    (candidate.retrievedContext === undefined || typeof candidate.retrievedContext === "string") &&
    (candidate.retrievalCount === undefined || typeof candidate.retrievalCount === "number") &&
    (candidate.latencyMs === undefined || typeof candidate.latencyMs === "number")
  );
}

type EvaluatorInput = {
  evaluationType: "ask" | "summarize" | "tour";
  repoId: string;
  threadId: string | null;
  question: string;
  response: string;
  referenceAnswer: string | null;
  retrievedContext: string;
  retrievalCount: number;
  latencyMs: number;
  sourcePayloadJson?: string | null;
};

function normalizeScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function clipText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n...[truncated]`;
}

function parseJudgeResponse(text: string): EvaluatorScore {
  const fallback: EvaluatorScore = {
    score: 0,
    rationale: "Judge output parsing failed.",
    majorErrors: 1,
    minorErrors: 0,
    unsupportedClaims: 1,
  };
  try {
    const payload = JSON.parse(text) as {
      score?: number;
      rationale?: string;
      majorErrors?: number;
      minorErrors?: number;
      unsupportedClaims?: number;
    };
    return {
      score: normalizeScore(typeof payload.score === "number" ? payload.score : 0),
      rationale:
        typeof payload.rationale === "string" && payload.rationale.trim().length > 0
          ? payload.rationale.trim()
          : "No rationale provided.",
      majorErrors:
        typeof payload.majorErrors === "number" && Number.isFinite(payload.majorErrors)
          ? Math.max(0, Math.floor(payload.majorErrors))
          : 0,
      minorErrors:
        typeof payload.minorErrors === "number" && Number.isFinite(payload.minorErrors)
          ? Math.max(0, Math.floor(payload.minorErrors))
          : 0,
      unsupportedClaims:
        typeof payload.unsupportedClaims === "number" && Number.isFinite(payload.unsupportedClaims)
          ? Math.max(0, Math.floor(payload.unsupportedClaims))
          : 0,
    };
  } catch {
    const scoreMatch = text.match(/"score"\s*:\s*([0-9]*\.?[0-9]+)/i);
    const scoreRaw = scoreMatch ? Number(scoreMatch[1]) : 0;
    return {
      score: normalizeScore(scoreRaw),
      rationale: text.trim().slice(0, 300) || fallback.rationale,
      majorErrors: 0,
      minorErrors: 0,
      unsupportedClaims: 0,
    };
  }
}

function applyPenaltyCalibration(score: EvaluatorScore): EvaluatorScore {
  const penalty =
    score.majorErrors * 0.2 +
    score.minorErrors * 0.07 +
    score.unsupportedClaims * 0.12;
  const adjusted = normalizeScore(score.score - penalty);
  return {
    ...score,
    score: adjusted,
    rationale: `${score.rationale} [calibrated: major=${score.majorErrors}, minor=${score.minorErrors}, unsupported=${score.unsupportedClaims}, penalty=${penalty.toFixed(2)}]`,
  };
}

async function runJudgeEvaluation(metric: {
  name: string;
  instructions: string;
  question: string;
  response: string;
  comparisonText: string;
}): Promise<EvaluatorScore> {
  const prompt = [
    "You are a strict RAG evaluator.",
    "Return ONLY valid JSON with shape: {\"score\": number, \"rationale\": string, \"majorErrors\": number, \"minorErrors\": number, \"unsupportedClaims\": number}",
    "score must be between 0 and 1.",
    "Use this rubric: 0.9-1.0 excellent, 0.7-0.89 good with small gaps, 0.4-0.69 partial, 0.1-0.39 weak, 0.0-0.09 wrong.",
    "majorErrors counts factual mistakes that change meaning.",
    "minorErrors counts omissions/wording problems.",
    "unsupportedClaims counts claims not supported by comparison context.",
    `Metric: ${metric.name}`,
    `Instructions: ${metric.instructions}`,
    "Question:",
    clipText(metric.question, 3000),
    "Response:",
    clipText(metric.response, 5000),
    "Comparison Context:",
    clipText(metric.comparisonText, 6000),
  ].join("\n\n");

  const raw = await generateTextWithContext(prompt, { temperature: 0, maxTokens: 220 });
  return applyPenaltyCalibration(parseJudgeResponse(raw));
}

async function evaluateByType(input: EvaluatorInput) {
  const questionForPrompt =
    input.evaluationType === "ask"
      ? input.question
      : input.evaluationType === "summarize"
        ? `Summarization task: ${input.question}`
        : `Tour generation task: ${input.question}`;

  const relevanceInstructions =
    input.evaluationType === "ask"
      ? "Score how well the response addresses the question directly and helpfully."
      : input.evaluationType === "summarize"
        ? "Score how well the summary covers the requested scope and key points of the target files."
        : "Score how useful the generated tour is for onboarding and understanding important repository files.";

  const groundednessInstructions =
    input.evaluationType === "ask"
      ? "Score how faithfully the response is supported by the retrieved context. Penalize hallucinations."
      : input.evaluationType === "summarize"
        ? "Score whether the summary remains faithful to provided source context and does not invent details."
        : "Score whether the tour explanation is faithful to the graph-derived metadata and step details in context.";

  const retrievalRelevanceInstructions =
    input.evaluationType === "ask"
      ? "Score how relevant the retrieved context is to answering the user question."
      : input.evaluationType === "summarize"
        ? "Score how relevant the selected source context is for generating a useful summary."
        : "Score how relevant the selected tour files are for a first-pass repository orientation.";

  const relevance = await runJudgeEvaluation({
    name: "Relevance",
    instructions: relevanceInstructions,
    question: questionForPrompt,
    response: input.response,
    comparisonText: input.question,
  });

  const groundedness = input.retrievedContext.trim().length > 0
    ? await runJudgeEvaluation({
      name: "Groundedness",
      instructions: groundednessInstructions,
      question: questionForPrompt,
      response: input.response,
      comparisonText: input.retrievedContext,
    })
    : { score: 0, rationale: "No retrieved context was available for groundedness evaluation." };

  const retrievalRelevance = input.retrievedContext.trim().length > 0
    ? await runJudgeEvaluation({
      name: "Retrieval relevance",
      instructions: retrievalRelevanceInstructions,
      question: questionForPrompt,
      response: input.response,
      comparisonText: input.retrievedContext,
    })
    : { score: 0, rationale: "No retrieved context was available for retrieval relevance evaluation." };

  const correctness = input.referenceAnswer && input.referenceAnswer.trim().length > 0
    ? await runJudgeEvaluation({
      name: "Correctness",
      instructions:
        "Score whether the response is correct compared to the reference answer. Focus on factual agreement.",
      question: questionForPrompt,
      response: input.response,
      comparisonText: input.referenceAnswer,
    })
    : null;

  return {
    relevance,
    groundedness,
    retrievalRelevance,
    correctness,
  };
}

async function persistEvaluationRun(input: EvaluatorInput) {
  const scores = await evaluateByType(input);

  return createEvaluatorRun({
    evaluationType: input.evaluationType,
    repoId: input.repoId,
    threadId: input.threadId,
    sourcePayloadJson: input.sourcePayloadJson ?? null,
    question: input.question,
    response: input.response,
    referenceAnswer: input.referenceAnswer,
    retrievedContext: input.retrievedContext,
    retrievalCount: input.retrievalCount,
    correctnessScore: scores.correctness?.score ?? null,
    correctnessRationale: scores.correctness?.rationale ?? null,
    groundednessScore: scores.groundedness.score,
    groundednessRationale: scores.groundedness.rationale,
    relevanceScore: scores.relevance.score,
    relevanceRationale: scores.relevance.rationale,
    retrievalRelevanceScore: scores.retrievalRelevance.score,
    retrievalRelevanceRationale: scores.retrievalRelevance.rationale,
    latencyMs: input.latencyMs,
    model: models.chat,
  });
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
    const summarizeStartedAt = Date.now();
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

    const summaryLines = (Array.isArray(results) ? results : [])
      .filter(isResultItem)
      .map((item) => {
        const filePath = typeof item.path === "string" ? item.path : "unknown";
        const summary =
          typeof item.summary === "string"
            ? item.summary
            : typeof item.text === "string"
              ? item.text
              : "No summary";
        return `File: ${filePath}\nSummary:\n${summary}`;
      })
      .join("\n\n");

    const retrievalContext = [
      `Requested files (${files.length}):`,
      files.slice(0, 50).join("\n"),
      errors.length > 0 ? `Errors:\n${errors.map((err) => String(err)).join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    persistEvaluationRun({
      evaluationType: "summarize",
      repoId,
      threadId: null,
      question: `Generate concise summaries for ${files.length} file(s).`,
      response: summaryLines || "No summaries generated.",
      referenceAnswer: null,
      retrievedContext: retrievalContext,
      retrievalCount: files.length,
      latencyMs: Date.now() - summarizeStartedAt,
      sourcePayloadJson: JSON.stringify({ files, resultCount: results.length, errorCount: errors.length }),
    }).catch((evalError) => {
      console.warn("[GRAPHRAG] Failed to persist summarize evaluator run:", evalError);
    });

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
    const tourStartedAt = Date.now();
    const result = await buildGraphTour(repoId, requestedLimit);

    const tourResponseText = result.steps
      .map(
        (step) =>
          `#${step.rank} ${step.filePath}\nscore=${step.score.toFixed(3)} degree=${step.metrics.totalDegree} depth=${step.metrics.depth}\n${step.summary}`,
      )
      .join("\n\n");
    const tourContext = result.steps
      .map(
        (step) =>
          `file=${step.filePath}; graphScore=${step.scoreBreakdown.graphScore.toFixed(3)}; inDegree=${step.metrics.inDegree}; outDegree=${step.metrics.outDegree}; totalDegree=${step.metrics.totalDegree}; depth=${step.metrics.depth}`,
      )
      .join("\n");

    persistEvaluationRun({
      evaluationType: "tour",
      repoId,
      threadId: null,
      question: `Generate an onboarding tour of top ${result.steps.length} important files.`,
      response: tourResponseText || "No tour steps generated.",
      referenceAnswer: null,
      retrievedContext: tourContext,
      retrievalCount: result.steps.length,
      latencyMs: Date.now() - tourStartedAt,
      sourcePayloadJson: JSON.stringify({ limit: requestedLimit ?? null, generatedAt: result.generatedAt }),
    }).catch((evalError) => {
      console.warn("[GRAPHRAG] Failed to persist tour evaluator run:", evalError);
    });

    return c.json(result);
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500);
  }
});

// GET /graphrag/evaluators/runs - List persisted evaluator runs
graphragRoute.get("/evaluators/runs", async (c) => {
  const repoId = c.req.query("repoId")?.trim();
  const limitRaw = c.req.query("limit");
  const parsedLimit = limitRaw == null ? 25 : Number.parseInt(limitRaw, 10);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 25;

  if (!repoId) {
    return c.json({ ok: false, error: "Missing repoId" }, 400);
  }

  try {
    const runs = await listEvaluatorRuns(repoId, limit);
    return c.json({ ok: true, repoId, runs });
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500);
  }
});

// POST /graphrag/evaluators/run - Evaluate a single response
graphragRoute.post("/evaluators/run", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!isDatasetEntryItem(body)) {
    return c.json({ ok: false, error: "Invalid request payload" }, 400);
  }
  const evaluationTypeRaw = typeof body.evaluationType === "string" ? (body as { evaluationType: string }).evaluationType.trim() : "ask";
  const evaluationType =
    evaluationTypeRaw === "summarize" || evaluationTypeRaw === "tour" ? evaluationTypeRaw : "ask";
  const repoId = typeof (body as { repoId?: unknown }).repoId === "string" ? ((body as { repoId: string }).repoId).trim() : "";
  const threadId = typeof (body as { threadId?: unknown }).threadId === "string" ? ((body as { threadId: string }).threadId).trim() : "";
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const response = typeof body.response === "string" ? body.response.trim() : "";
  const referenceAnswer =
    typeof body.referenceAnswer === "string" ? body.referenceAnswer.trim() : "";
  const retrievedContext =
    typeof body.retrievedContext === "string" ? body.retrievedContext : "";
  const retrievalCountRaw =
    typeof body.retrievalCount === "number" ? body.retrievalCount : Number(body.retrievalCount ?? 0);
  const retrievalCount = Number.isFinite(retrievalCountRaw)
    ? Math.max(0, Math.floor(retrievalCountRaw))
    : 0;
  const latencyMsRaw = typeof body.latencyMs === "number" ? body.latencyMs : Number(body.latencyMs ?? 0);
  const latencyMs = Number.isFinite(latencyMsRaw) ? Math.max(0, Math.floor(latencyMsRaw)) : 0;
  const sourcePayloadJson =
    typeof (body as { sourcePayloadJson?: unknown }).sourcePayloadJson === "string" ? ((body as { sourcePayloadJson: string }).sourcePayloadJson) : null;

  if (!repoId || !question || !response) {
    return c.json({ ok: false, error: "Missing repoId, question, or response" }, 400);
  }

  try {
    const run = await persistEvaluationRun({
      evaluationType,
      repoId,
      threadId: threadId || null,
      question,
      response,
      referenceAnswer: referenceAnswer || null,
      retrievedContext,
      retrievalCount,
      latencyMs,
      sourcePayloadJson,
    });

    return c.json({ ok: true, run });
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500);
  }
});

// POST /graphrag/evaluators/dataset-run - Evaluate a batch with reference answers
graphragRoute.post("/evaluators/dataset-run", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const repoId = typeof (body as { repoId?: unknown }).repoId === "string" ? ((body as { repoId: string }).repoId).trim() : "";
  const evaluationTypeRaw = typeof (body as { evaluationType?: unknown }).evaluationType === "string" ? ((body as { evaluationType: string }).evaluationType).trim() : "ask";
  const evaluationType =
    evaluationTypeRaw === "summarize" || evaluationTypeRaw === "tour" ? evaluationTypeRaw : "ask";
  const entriesRaw = Array.isArray((body as { entries?: unknown }).entries) ? (body as { entries: unknown[] }).entries : [];

  if (!repoId || entriesRaw.length === 0) {
    return c.json({ ok: false, error: "Missing repoId or entries" }, 400);
  }

  if (entriesRaw.length > MAX_DATASET_BATCH) {
    return c.json(
      {
        ok: false,
        error: `Dataset batch size (${entriesRaw.length}) exceeds maximum allowed (${MAX_DATASET_BATCH})`,
      },
      400,
    );
  }

  try {
    const createdRuns = [];
    for (const entry of entriesRaw) {
      if (!isDatasetEntryItem(entry)) {
        continue;
      }

      const question = typeof entry.question === "string" ? entry.question.trim() : "";
      const response = typeof entry.response === "string" ? entry.response.trim() : "";
      const referenceAnswer =
        typeof entry.referenceAnswer === "string" ? entry.referenceAnswer.trim() : "";
      const retrievedContext =
        typeof entry.retrievedContext === "string" ? entry.retrievedContext : "";
      const retrievalCountRaw =
        typeof entry.retrievalCount === "number"
          ? entry.retrievalCount
          : Number(entry.retrievalCount ?? 0);
      const retrievalCount = Number.isFinite(retrievalCountRaw)
        ? Math.max(0, Math.floor(retrievalCountRaw))
        : 0;
      const latencyMsRaw =
        typeof entry.latencyMs === "number" ? entry.latencyMs : Number(entry.latencyMs ?? 0);
      const latencyMs = Number.isFinite(latencyMsRaw) ? Math.max(0, Math.floor(latencyMsRaw)) : 0;

      if (!question || !response || !referenceAnswer) {
        continue;
      }

      const run = await persistEvaluationRun({
        evaluationType,
        repoId,
        threadId: null,
        question,
        response,
        referenceAnswer,
        retrievedContext,
        retrievalCount,
        latencyMs,
        sourcePayloadJson: JSON.stringify({ dataset: true }),
      });
      createdRuns.push(run);
    }

    return c.json({ ok: true, repoId, created: createdRuns.length, runs: createdRuns });
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
    const askStartedAt = Date.now();
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

    const retrievalContextForEval = [nodeContextResult.context, codeContext, summaryContext]
      .filter(Boolean)
      .join("\n\n");

    persistEvaluationRun({
      evaluationType: "ask",
      repoId,
      threadId: thread.id,
      question,
      response: answer,
      referenceAnswer: null,
      retrievedContext: retrievalContextForEval,
      retrievalCount: expandedChunks.length,
      latencyMs: Date.now() - askStartedAt,
      sourcePayloadJson: JSON.stringify({ sourceCount: allSources.length }),
    }).catch((evalError) => {
      console.warn("[GRAPHRAG] Failed to persist evaluator run:", evalError);
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
