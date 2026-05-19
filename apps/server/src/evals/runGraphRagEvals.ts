import "dotenv/config";

if (!process.env.NEO4J_DISABLE_ROUTING) {
  process.env.NEO4J_DISABLE_ROUTING = "true";
}
import fs from "fs/promises";
import path from "path";

import {
  createClassificationEvaluator,
  createFaithfulnessEvaluator,
  type EvaluationResult,
} from "@arizeai/phoenix-evals";
import { runCypher } from "@/db/cypher";
import { createOpenRouterClient, models } from "@/config/openrouter";
import { z } from "zod";

import { initPhoenixTracing } from "@/observability/phoenix";
import type {
  AskSource,
  GraphRagEvalCase,
  GraphRagEvalResult,
} from "@/types/graphragEval";
import { ANSWER_RELEVANCE_PROMPT, REFERENCE_CORRECTNESS_PROMPT } from "@/evals/graphragEvalTemplates";

const EVAL_DATASET_PATH = path.resolve(
  process.cwd(),
  "src/evals/datasets/graphrag.jsonl",
);
const EVAL_OUTPUT_DIR = path.resolve(process.cwd(), ".eval-runs/graphrag");
const EVAL_OUTPUT_FILE = path.join(EVAL_OUTPUT_DIR, "latest.json");
const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3000";

const THRESHOLDS = {
  groundedness: 0.8,
  answerRelevance: 0.8,
  correctness: 0.75,
  sourceRecall: 0.6,
} as const;

const evalCaseSchema = z.object({
  id: z.string().min(1),
  repoId: z.string().min(1),
  question: z.string().min(1),
  expectedAnswer: z.string().min(1).optional(),
  expectedFacts: z.array(z.string().min(1)).optional(),
  expectedSources: z
    .array(
      z.object({
        filePath: z.string().min(1),
        symbol: z.string().min(1).optional(),
        sourceKind: z.enum(["ast", "text"]).optional(),
      }),
    )
    .optional(),
  tags: z.array(z.string().min(1)),
});

type EvaluationRecord = {
  question: string;
  answer: string;
  context: string;
  documentText: string;
  reference: string;
};

type AskResponse = {
  ok: boolean;
  answer?: string;
  sources?: AskSource[];
  error?: string;
  prompt?: string;
  nodeContext?: string;
  codeContext?: string;
  summaryContext?: string;
  retrievedContext?: string;
};

type RepoLookupRow = {
  repoId: string;
};

function parseJsonLine(line: string, lineNumber: number): GraphRagEvalCase {
  const parsed: unknown = JSON.parse(line);
  const result = evalCaseSchema.safeParse(parsed);
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join("; ");
    throw new Error(`Invalid eval case on line ${lineNumber}: ${message}`);
  }
  return result.data;
}

async function loadEvalCases(): Promise<GraphRagEvalCase[]> {
  const raw = await fs.readFile(EVAL_DATASET_PATH, "utf8");
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("//"));

  return lines.map((line, index) => parseJsonLine(line, index + 1));
}

async function resolveEvalRepoId(repoName: string): Promise<string> {
  const rows = await runCypher<RepoLookupRow>(
    `/*cypher*/
    MATCH (r:Repo {name: $repoName})
    WITH r
    ORDER BY r.rootPath ASC
    RETURN r.repoId AS repoId
    LIMIT 1`,
    { repoName },
  );

  const repoId = rows[0]?.repoId;
  if (!repoId) {
    throw new Error(`No repo found in Neo4j with name "${repoName}".`);
  }

  return repoId;
}

async function callAskEndpoint(repoId: string, question: string): Promise<AskResponse> {
  const res = await fetch(`${SERVER_URL}/graphrag/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoId, question }),
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    return { ok: false, error: errBody.error ?? res.statusText };
  }

  const data = (await res.json()) as AskResponse;
  return {
    ok: true,
    answer: data.answer,
    sources: data.sources ?? [],
    prompt: data.prompt,
    nodeContext: data.nodeContext,
    codeContext: data.codeContext,
    summaryContext: data.summaryContext,
    retrievedContext: data.retrievedContext,
  };
}

function flattenSources(sources: AskSource[]): Array<{ file: string; symbol: string; sourceKind: string }> {
  return sources.map((source) => ({
    file: source.file,
    symbol: source.symbol,
    sourceKind: source.sourceKind,
  }));
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function checkExpectedFacts(answer: string, facts: string[]): { score: number; explanation: string } {
  if (facts.length === 0) {
    return { score: 1, explanation: "No expected facts provided." };
  }

  const normalizedAnswer = normalizeText(answer);
  const matches = facts.filter((fact) => normalizedAnswer.includes(normalizeText(fact)));
  const score = matches.length / facts.length;
  const explanation = `Matched ${matches.length}/${facts.length} expected facts.`;
  return { score, explanation };
}

function scoreSourceRecall(
  expectedSources: NonNullable<GraphRagEvalCase["expectedSources"]>,
  retrievedSources: AskSource[],
): { score: number; explanation: string } {
  if (expectedSources.length === 0) {
    return { score: 1, explanation: "No expected sources provided." };
  }

  const retrieved = flattenSources(retrievedSources);
  const hits = expectedSources.filter((expected) => {
    return retrieved.some((source) => {
      if (expected.filePath !== source.file) return false;
      if (expected.sourceKind && expected.sourceKind !== source.sourceKind) return false;
      if (expected.symbol && expected.symbol.length > 0) {
        return source.symbol === expected.symbol;
      }
      return true;
    });
  });

  const score = hits.length / expectedSources.length;
  const explanation = `Matched ${hits.length}/${expectedSources.length} expected sources.`;
  return { score, explanation };
}

function buildReferenceText(evalCase: GraphRagEvalCase): string {
  if (evalCase.expectedAnswer) return evalCase.expectedAnswer;
  if (evalCase.expectedFacts && evalCase.expectedFacts.length > 0) {
    return evalCase.expectedFacts.join("\n");
  }
  return "";
}

function verdictForScore(score: number | undefined, threshold: number): boolean {
  return typeof score === "number" && score >= threshold;
}

function renderTable(rows: Array<Record<string, string>>): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0] ?? {});
  const widths = headers.map((header) =>
    Math.max(header.length, ...rows.map((row) => row[header]?.length ?? 0)),
  );

  const renderRow = (row: Record<string, string>): string => {
    return headers
      .map((header, index) => {
        const value = row[header] ?? "";
        const width = widths[index] ?? header.length;
        return value.padEnd(width);
      })
      .join(" | ");
  };

  const headerLine = renderRow(Object.fromEntries(headers.map((header) => [header, header])));
  const separator = widths.map((width) => "-".repeat(width)).join("-+-");
  console.log(headerLine);
  console.log(separator);
  for (const row of rows) {
    console.log(renderRow(row));
  }
}

async function writeReport(results: GraphRagEvalResult[], repoId: string): Promise<void> {
  await fs.mkdir(EVAL_OUTPUT_DIR, { recursive: true });
  await fs.writeFile(
    EVAL_OUTPUT_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        repoId,
        thresholds: THRESHOLDS,
        results,
      },
      null,
      2,
    ),
  );
}

async function run() {
  initPhoenixTracing();
  const evalCases = await loadEvalCases();
  const evalRepoName = evalCases[0]?.repoId ?? "fzf-master";
  const evalRepoId = await resolveEvalRepoId(evalRepoName);
  const openrouter = createOpenRouterClient();
  const model = openrouter(process.env.PHOENIX_EVAL_MODEL ?? models.chat);

  const faithfulnessEvaluator = createFaithfulnessEvaluator({ model });
  const answerRelevanceEvaluator = createClassificationEvaluator({
    model,
    name: "answer_relevance",
    promptTemplate: ANSWER_RELEVANCE_PROMPT,
    choices: { relevant: 1, unrelated: 0 },
  });
  const correctnessEvaluator = createClassificationEvaluator({
    model,
    name: "reference_correctness",
    promptTemplate: REFERENCE_CORRECTNESS_PROMPT,
    choices: { correct: 1, incorrect: 0 },
  });

  const results: GraphRagEvalResult[] = [];
  const tableRows: Array<Record<string, string>> = [];

  for (const evalCase of evalCases) {
    let askResult: AskResponse | null = null;
    let askError: string | null = null;
    try {
      askResult = await callAskEndpoint(evalRepoId, evalCase.question);
    } catch (error) {
      askError = error instanceof Error ? error.message : String(error);
    }

    if (!askResult || !askResult.ok) {
      const result: GraphRagEvalResult = {
        id: evalCase.id,
        question: evalCase.question,
        answer: "",
        retrievedSources: [],
        error: askError ?? askResult?.error ?? "Unknown error",
        retrieval: {
          prompt: "",
          nodeContext: "",
          codeContext: "",
          summaryContext: "",
          retrievedContext: "",
        },
        scores: {},
        labels: {},
        explanations: {
          error: askError ?? askResult?.error ?? "Unknown error",
        },
      };

      results.push(result);
      await writeReport(results, evalRepoId);
      tableRows.push({
        id: evalCase.id,
        grounded: "-",
        answerRel: "-",
        correct: "-",
        sourceRec: "-",
        pass: "no",
      });
      continue;
    }

    const answer = askResult.answer ?? "";
    const sources = askResult.sources ?? [];
    const reference = buildReferenceText(evalCase);
    const retrievedContext = askResult.retrievedContext ?? "";

    const evalRecord: EvaluationRecord = {
      question: evalCase.question,
      answer,
      context: retrievedContext,
      documentText: "",
      reference,
    };

    const faithfulness = await faithfulnessEvaluator.evaluate({
      input: evalRecord.question,
      output: evalRecord.answer,
      context: evalRecord.context,
    });
    const answerRelevance = await answerRelevanceEvaluator.evaluate({
      input: evalRecord.question,
      output: evalRecord.answer,
    });

    let correctnessResult: EvaluationResult | undefined;
    if (reference) {
      correctnessResult = await correctnessEvaluator.evaluate({
        input: evalRecord.question,
        output: evalRecord.answer,
        reference: evalRecord.reference,
      });
    }

    const sourceRecall = evalCase.expectedSources
      ? scoreSourceRecall(evalCase.expectedSources, sources)
      : { score: undefined, explanation: "" };

    const factScore = evalCase.expectedFacts
      ? checkExpectedFacts(answer, evalCase.expectedFacts)
      : { score: undefined, explanation: "" };

    const result: GraphRagEvalResult = {
      id: evalCase.id,
      question: evalCase.question,
      answer,
      retrievedSources: sources,
      retrieval: {
        prompt: askResult.prompt ?? "",
        nodeContext: askResult.nodeContext ?? "",
        codeContext: askResult.codeContext ?? "",
        summaryContext: askResult.summaryContext ?? "",
        retrievedContext,
      },
      scores: {
        retrievalRelevance: undefined,
        groundedness: faithfulness.score,
        answerRelevance: answerRelevance.score,
        correctness: correctnessResult?.score ?? factScore.score,
        sourceRecall: sourceRecall.score,
      },
      labels: {
        groundedness: faithfulness.label,
        answerRelevance: answerRelevance.label,
        correctness: correctnessResult?.label,
      },
      explanations: {
        groundedness: faithfulness.explanation ?? "",
        answerRelevance: answerRelevance.explanation ?? "",
        correctness: correctnessResult?.explanation ?? factScore.explanation,
        retrievalRelevance: "",
        sourceRecall: sourceRecall.explanation,
      },
    };

    results.push(result);
    await writeReport(results, evalRepoId);

    const groundedPass = verdictForScore(result.scores.groundedness, THRESHOLDS.groundedness);
    const answerRelPass = verdictForScore(result.scores.answerRelevance, THRESHOLDS.answerRelevance);
    const correctnessPass =
      reference || evalCase.expectedFacts
        ? verdictForScore(result.scores.correctness, THRESHOLDS.correctness)
        : true;
    const sourceRecallPass = evalCase.expectedSources
      ? verdictForScore(result.scores.sourceRecall, THRESHOLDS.sourceRecall)
      : true;

    const pass = groundedPass && answerRelPass && correctnessPass && sourceRecallPass;

    tableRows.push({
      id: evalCase.id,
      grounded: result.scores.groundedness?.toFixed(2) ?? "-",
      answerRel: result.scores.answerRelevance?.toFixed(2) ?? "-",
      correct: result.scores.correctness?.toFixed(2) ?? "-",
      sourceRec: result.scores.sourceRecall?.toFixed(2) ?? "-",
      pass: pass ? "yes" : "no",
    });
  }

  renderTable(tableRows);
  console.log(`\nWrote eval report to ${EVAL_OUTPUT_FILE}`);
}

run().catch((error) => {
  console.error("GraphRAG eval run failed:", error);
  process.exit(1);
});
