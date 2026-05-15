import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { evaluatorRuns } from "./schema";

export type EvaluatorRunRecord = typeof evaluatorRuns.$inferSelect;

type CreateEvaluatorRunInput = Omit<EvaluatorRunRecord, "id" | "createdAt"> & {
  id?: string;
  createdAt?: string;
};

let ensureEvaluatorSchemaPromise: Promise<void> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function ensureEvaluatorPersistenceSchema(): Promise<void> {
  if (!ensureEvaluatorSchemaPromise) {
    ensureEvaluatorSchemaPromise = (async () => {
      await db.run(
        sql.raw(`
          CREATE TABLE IF NOT EXISTS evaluator_runs (
            id TEXT PRIMARY KEY NOT NULL,
            evaluation_type TEXT NOT NULL,
            repo_id TEXT NOT NULL,
            thread_id TEXT,
            source_payload_json TEXT,
            question TEXT NOT NULL,
            response TEXT NOT NULL,
            reference_answer TEXT,
            retrieved_context TEXT,
            retrieval_count INTEGER NOT NULL,
            correctness_score REAL,
            correctness_rationale TEXT,
            groundedness_score REAL,
            groundedness_rationale TEXT,
            relevance_score REAL,
            relevance_rationale TEXT,
            retrieval_relevance_score REAL,
            retrieval_relevance_rationale TEXT,
            latency_ms INTEGER NOT NULL,
            model TEXT NOT NULL,
            created_at TEXT NOT NULL
          );
        `),
      );
      try {
        await db.run(sql.raw("ALTER TABLE evaluator_runs ADD COLUMN evaluation_type TEXT NOT NULL DEFAULT 'ask';"));
      } catch {
        // Column already exists
      }
      try {
        await db.run(sql.raw("ALTER TABLE evaluator_runs ADD COLUMN source_payload_json TEXT;"));
      } catch {
        // Column already exists
      }
      await db.run(
        sql.raw("CREATE INDEX IF NOT EXISTS evaluator_runs_repo_created_idx ON evaluator_runs(repo_id, created_at);"),
      );
      await db.run(
        sql.raw("CREATE INDEX IF NOT EXISTS evaluator_runs_thread_created_idx ON evaluator_runs(thread_id, created_at);"),
      );
    })();
  }

  await ensureEvaluatorSchemaPromise;
}

export async function createEvaluatorRun(input: CreateEvaluatorRunInput): Promise<EvaluatorRunRecord> {
  await ensureEvaluatorPersistenceSchema();
  const row: EvaluatorRunRecord = {
    id: input.id ?? createId(),
    evaluationType: input.evaluationType,
    repoId: input.repoId,
    threadId: input.threadId ?? null,
    sourcePayloadJson: input.sourcePayloadJson ?? null,
    question: input.question,
    response: input.response,
    referenceAnswer: input.referenceAnswer ?? null,
    retrievedContext: input.retrievedContext ?? null,
    retrievalCount: input.retrievalCount,
    correctnessScore: input.correctnessScore ?? null,
    correctnessRationale: input.correctnessRationale ?? null,
    groundednessScore: input.groundednessScore ?? null,
    groundednessRationale: input.groundednessRationale ?? null,
    relevanceScore: input.relevanceScore ?? null,
    relevanceRationale: input.relevanceRationale ?? null,
    retrievalRelevanceScore: input.retrievalRelevanceScore ?? null,
    retrievalRelevanceRationale: input.retrievalRelevanceRationale ?? null,
    latencyMs: input.latencyMs,
    model: input.model,
    createdAt: input.createdAt ?? nowIso(),
  };

  await db.insert(evaluatorRuns).values(row);
  return row;
}

export async function listEvaluatorRuns(repoId: string, limit = 50): Promise<EvaluatorRunRecord[]> {
  await ensureEvaluatorPersistenceSchema();
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  return db
    .select()
    .from(evaluatorRuns)
    .where(eq(evaluatorRuns.repoId, repoId))
    .orderBy(desc(evaluatorRuns.createdAt))
    .limit(safeLimit);
}

export async function listEvaluatorRunsByThread(
  repoId: string,
  threadId: string,
  limit = 50,
): Promise<EvaluatorRunRecord[]> {
  await ensureEvaluatorPersistenceSchema();
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  return db
    .select()
    .from(evaluatorRuns)
    .where(and(eq(evaluatorRuns.repoId, repoId), eq(evaluatorRuns.threadId, threadId)))
    .orderBy(desc(evaluatorRuns.createdAt))
    .limit(safeLimit);
}
