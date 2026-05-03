import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { chatMessages, chatThreads } from "./schema";

export type ChatRole = "user" | "assistant" | "system";

export type ChatThreadRecord = typeof chatThreads.$inferSelect;
export type ChatMessageRecord = typeof chatMessages.$inferSelect;

const DEFAULT_THREAD_TITLE = "New chat";

let ensureSchemaPromise: Promise<void> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeThreadTitle(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return DEFAULT_THREAD_TITLE;
  return compact.length <= 80 ? compact : `${compact.slice(0, 77).trimEnd()}...`;
}

export async function ensureChatPersistenceSchema(): Promise<void> {
  if (!ensureSchemaPromise) {
    ensureSchemaPromise = (async () => {
      await db.run(sql.raw("PRAGMA foreign_keys = ON;"));
      await db.run(
        sql.raw(`
          CREATE TABLE IF NOT EXISTS chat_threads (
            id TEXT PRIMARY KEY NOT NULL,
            repo_id TEXT NOT NULL,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_message_at TEXT NOT NULL
          );
        `),
      );
      await db.run(
        sql.raw(`
          CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY NOT NULL,
            thread_id TEXT NOT NULL,
            repo_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            sources_json TEXT,
            sequence INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
          );
        `),
      );
      await db.run(
        sql.raw("CREATE INDEX IF NOT EXISTS chat_threads_repo_updated_idx ON chat_threads(repo_id, updated_at);"),
      );
      await db.run(
        sql.raw("CREATE INDEX IF NOT EXISTS chat_threads_repo_last_message_idx ON chat_threads(repo_id, last_message_at);"),
      );
      await db.run(
        sql.raw("CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_thread_sequence_uq ON chat_messages(thread_id, sequence);"),
      );
      await db.run(
        sql.raw("CREATE INDEX IF NOT EXISTS chat_messages_thread_sequence_idx ON chat_messages(thread_id, sequence);"),
      );
      await db.run(
        sql.raw("CREATE INDEX IF NOT EXISTS chat_messages_repo_thread_idx ON chat_messages(repo_id, thread_id);"),
      );
    })();
  }

  await ensureSchemaPromise;
}

export async function createChatThread(input: {
  repoId: string;
  title?: string;
}): Promise<ChatThreadRecord> {
  await ensureChatPersistenceSchema();
  const createdAt = nowIso();
  const thread: ChatThreadRecord = {
    id: createId(),
    repoId: input.repoId,
    title: sanitizeThreadTitle(input.title ?? DEFAULT_THREAD_TITLE),
    createdAt,
    updatedAt: createdAt,
    lastMessageAt: createdAt,
  };

  await db.insert(chatThreads).values(thread);
  return thread;
}

export async function listChatThreads(repoId: string): Promise<ChatThreadRecord[]> {
  await ensureChatPersistenceSchema();
  return db
    .select()
    .from(chatThreads)
    .where(eq(chatThreads.repoId, repoId))
    .orderBy(desc(chatThreads.lastMessageAt), desc(chatThreads.updatedAt));
}

export async function getChatThreadById(threadId: string): Promise<ChatThreadRecord | null> {
  await ensureChatPersistenceSchema();
  const rows = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
  return rows[0] ?? null;
}

export async function getChatThreadForRepo(repoId: string, threadId: string): Promise<ChatThreadRecord | null> {
  await ensureChatPersistenceSchema();
  const rows = await db
    .select()
    .from(chatThreads)
    .where(and(eq(chatThreads.id, threadId), eq(chatThreads.repoId, repoId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listThreadMessages(repoId: string, threadId: string): Promise<ChatMessageRecord[]> {
  await ensureChatPersistenceSchema();
  return db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.repoId, repoId), eq(chatMessages.threadId, threadId)))
    .orderBy(asc(chatMessages.sequence), asc(chatMessages.createdAt));
}

export async function resolveThreadForQuestion(input: {
  repoId: string;
  threadId?: string;
  question: string;
}): Promise<ChatThreadRecord> {
  await ensureChatPersistenceSchema();

  if (input.threadId && input.threadId.trim().length > 0) {
    const existing = await getChatThreadForRepo(input.repoId, input.threadId);
    if (!existing) {
      throw new Error("Thread does not exist for this repository.");
    }
    return existing;
  }

  return createChatThread({
    repoId: input.repoId,
    title: sanitizeThreadTitle(input.question),
  });
}

export async function appendThreadMessage(input: {
  repoId: string;
  threadId: string;
  role: ChatRole;
  content: string;
  sourcesJson?: string | null;
}): Promise<ChatMessageRecord> {
  await ensureChatPersistenceSchema();

  return db.transaction(async (tx) => {
    const threadRows = await tx
      .select()
      .from(chatThreads)
      .where(and(eq(chatThreads.id, input.threadId), eq(chatThreads.repoId, input.repoId)))
      .limit(1);
    const thread = threadRows[0];

    if (!thread) {
      throw new Error("Thread does not exist for this repository.");
    }

    const maxRows = await tx
      .select({ maxSequence: sql<number>`coalesce(max(${chatMessages.sequence}), 0)` })
      .from(chatMessages)
      .where(eq(chatMessages.threadId, input.threadId));

    const messageCountRows = await tx
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .where(eq(chatMessages.threadId, input.threadId));

    const createdAt = nowIso();
    const nextSequence = (maxRows[0]?.maxSequence ?? 0) + 1;
    const message: ChatMessageRecord = {
      id: createId(),
      repoId: input.repoId,
      threadId: input.threadId,
      role: input.role,
      content: input.content,
      sourcesJson: input.sourcesJson ?? null,
      sequence: nextSequence,
      createdAt,
    };

    await tx.insert(chatMessages).values(message);

    const shouldSetTitle =
      input.role === "user" &&
      thread.title === DEFAULT_THREAD_TITLE &&
      (messageCountRows[0]?.count ?? 0) === 0;

    await tx
      .update(chatThreads)
      .set({
        title: shouldSetTitle ? sanitizeThreadTitle(input.content) : thread.title,
        updatedAt: createdAt,
        lastMessageAt: createdAt,
      })
      .where(eq(chatThreads.id, input.threadId));

    return message;
  });
}

export async function clearThreadMessages(repoId: string, threadId: string): Promise<void> {
  await ensureChatPersistenceSchema();

  const thread = await getChatThreadForRepo(repoId, threadId);
  if (!thread) {
    throw new Error("Thread does not exist for this repository.");
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(chatMessages)
      .where(and(eq(chatMessages.repoId, repoId), eq(chatMessages.threadId, threadId)));

    await tx
      .update(chatThreads)
      .set({
        updatedAt: nowIso(),
        lastMessageAt: thread.createdAt,
      })
      .where(eq(chatThreads.id, threadId));
  });
}
