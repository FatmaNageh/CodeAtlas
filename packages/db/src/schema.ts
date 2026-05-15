import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const chatThreads = sqliteTable(
  "chat_threads",
  {
    id: text("id").primaryKey(),
    repoId: text("repo_id").notNull(),
    title: text("title").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    lastMessageAt: text("last_message_at").notNull(),
  },
  (table) => ({
    repoUpdatedIdx: index("chat_threads_repo_updated_idx").on(table.repoId, table.updatedAt),
    repoLastMessageIdx: index("chat_threads_repo_last_message_idx").on(table.repoId, table.lastMessageAt),
  }),
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    repoId: text("repo_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    sourcesJson: text("sources_json"),
    sequence: integer("sequence").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    threadSequenceUq: uniqueIndex("chat_messages_thread_sequence_uq").on(table.threadId, table.sequence),
    repoThreadIdx: index("chat_messages_repo_thread_idx").on(table.repoId, table.threadId),
  }),
);

export const evaluatorRuns = sqliteTable(
  "evaluator_runs",
  {
    id: text("id").primaryKey(),
    evaluationType: text("evaluation_type").notNull(),
    repoId: text("repo_id").notNull(),
    threadId: text("thread_id"),
    sourcePayloadJson: text("source_payload_json"),
    question: text("question").notNull(),
    response: text("response").notNull(),
    referenceAnswer: text("reference_answer"),
    retrievedContext: text("retrieved_context"),
    retrievalCount: integer("retrieval_count").notNull(),
    correctnessScore: real("correctness_score"),
    correctnessRationale: text("correctness_rationale"),
    groundednessScore: real("groundedness_score"),
    groundednessRationale: text("groundedness_rationale"),
    relevanceScore: real("relevance_score"),
    relevanceRationale: text("relevance_rationale"),
    retrievalRelevanceScore: real("retrieval_relevance_score"),
    retrievalRelevanceRationale: text("retrieval_relevance_rationale"),
    latencyMs: integer("latency_ms").notNull(),
    model: text("model").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    repoCreatedIdx: index("evaluator_runs_repo_created_idx").on(table.repoId, table.createdAt),
    threadCreatedIdx: index("evaluator_runs_thread_created_idx").on(table.threadId, table.createdAt),
  }),
);
