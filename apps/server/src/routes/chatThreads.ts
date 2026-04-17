import { Hono } from "hono";
import {
  clearThreadMessages,
  createChatThread,
  getChatThreadForRepo,
  listChatThreads,
  listThreadMessages,
} from "@CodeAtlas/db/chat";

type ThreadMessageResponse = {
  id: string;
  threadId: string;
  repoId: string;
  role: "user" | "assistant" | "system";
  content: string;
  contextFiles: string[];
  createdAt: string;
  sequence: number;
};

function parseSourcesJson(sourcesJson: string | null): string[] {
  if (!sourcesJson) return [];

  try {
    const parsed = JSON.parse(sourcesJson) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (typeof item !== "object" || item === null) return "";
        const candidate = (item as { file?: unknown }).file;
        return typeof candidate === "string" ? candidate.trim() : "";
      })
      .filter((value) => value.length > 0);
  } catch {
    return [];
  }
}

export const chatThreadsRoute = new Hono();

chatThreadsRoute.get("/threads", async (c) => {
  const repoId = c.req.query("repoId")?.trim();
  if (!repoId) {
    return c.json({ ok: false, error: "Missing repoId" }, 400);
  }

  try {
    const threads = await listChatThreads(repoId);
    return c.json({ ok: true, threads });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ ok: false, error: message }, 500);
  }
});

chatThreadsRoute.post("/threads", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const repoId = typeof body.repoId === "string" ? body.repoId.trim() : "";
  const title = typeof body.title === "string" ? body.title : undefined;

  if (!repoId) {
    return c.json({ ok: false, error: "Missing repoId" }, 400);
  }

  try {
    const thread = await createChatThread({ repoId, title });
    return c.json({ ok: true, thread }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ ok: false, error: message }, 500);
  }
});

chatThreadsRoute.get("/threads/:threadId/messages", async (c) => {
  const repoId = c.req.query("repoId")?.trim();
  const threadId = c.req.param("threadId")?.trim();

  if (!repoId) {
    return c.json({ ok: false, error: "Missing repoId" }, 400);
  }
  if (!threadId) {
    return c.json({ ok: false, error: "Missing threadId" }, 400);
  }

  try {
    const thread = await getChatThreadForRepo(repoId, threadId);
    if (!thread) {
      return c.json({ ok: false, error: "Thread not found for repository" }, 404);
    }

    const messages = await listThreadMessages(repoId, threadId);
    const responseMessages: ThreadMessageResponse[] = messages.map((message) => ({
      id: message.id,
      threadId: message.threadId,
      repoId: message.repoId,
      role: message.role as "user" | "assistant" | "system",
      content: message.content,
      contextFiles: parseSourcesJson(message.sourcesJson),
      createdAt: message.createdAt,
      sequence: message.sequence,
    }));

    return c.json({ ok: true, thread, messages: responseMessages });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ ok: false, error: message }, 500);
  }
});

chatThreadsRoute.post("/threads/:threadId/clear", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const repoId = typeof body.repoId === "string" ? body.repoId.trim() : "";
  const threadId = c.req.param("threadId")?.trim();

  if (!repoId) {
    return c.json({ ok: false, error: "Missing repoId" }, 400);
  }
  if (!threadId) {
    return c.json({ ok: false, error: "Missing threadId" }, 400);
  }

  try {
    await clearThreadMessages(repoId, threadId);
    return c.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("does not exist")) {
      return c.json({ ok: false, error: "Thread not found for repository" }, 404);
    }
    return c.json({ ok: false, error: message }, 500);
  }
});
