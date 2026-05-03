import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
    threadSequenceIdx: index("chat_messages_thread_sequence_idx").on(table.threadId, table.sequence),
    repoThreadIdx: index("chat_messages_repo_thread_idx").on(table.repoId, table.threadId),
  }),
);
