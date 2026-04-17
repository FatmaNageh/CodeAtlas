import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('@CodeAtlas/db/chat', () => ({
  listChatThreads: vi.fn(),
  createChatThread: vi.fn(),
  getChatThreadForRepo: vi.fn(),
  listThreadMessages: vi.fn(),
  clearThreadMessages: vi.fn(),
}));

import { chatThreadsRoute } from '@/routes/chatThreads';
import {
  clearThreadMessages,
  createChatThread,
  getChatThreadForRepo,
  listChatThreads,
  listThreadMessages,
} from '@CodeAtlas/db/chat';

const mockedListChatThreads = vi.mocked(listChatThreads);
const mockedCreateChatThread = vi.mocked(createChatThread);
const mockedGetChatThreadForRepo = vi.mocked(getChatThreadForRepo);
const mockedListThreadMessages = vi.mocked(listThreadMessages);
const mockedClearThreadMessages = vi.mocked(clearThreadMessages);

describe('chat threads route', () => {
  beforeEach(() => {
    mockedListChatThreads.mockReset();
    mockedCreateChatThread.mockReset();
    mockedGetChatThreadForRepo.mockReset();
    mockedListThreadMessages.mockReset();
    mockedClearThreadMessages.mockReset();
  });

  it('lists threads for repo', async () => {
    const app = new Hono();
    app.route('/chat', chatThreadsRoute);

    mockedListChatThreads.mockResolvedValue([
      {
        id: 'thread-1',
        repoId: 'repo-1',
        title: 'First thread',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        lastMessageAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const response = await app.request('/chat/threads?repoId=repo-1');
    const data = (await response.json()) as {
      ok: boolean;
      threads: Array<{ id: string; repoId: string; title: string }>;
    };

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.threads[0]?.id).toBe('thread-1');
    expect(data.threads[0]?.repoId).toBe('repo-1');
  });

  it('creates thread with repo id', async () => {
    const app = new Hono();
    app.route('/chat', chatThreadsRoute);

    mockedCreateChatThread.mockResolvedValue({
      id: 'thread-2',
      repoId: 'repo-1',
      title: 'New thread',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastMessageAt: '2026-01-01T00:00:00.000Z',
    });

    const response = await app.request('/chat/threads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repoId: 'repo-1' }),
    });
    const data = (await response.json()) as {
      ok: boolean;
      thread?: { id: string };
    };

    expect(response.status).toBe(201);
    expect(data.ok).toBe(true);
    expect(data.thread?.id).toBe('thread-2');
  });

  it('loads thread messages only when thread belongs to repo', async () => {
    const app = new Hono();
    app.route('/chat', chatThreadsRoute);

    mockedGetChatThreadForRepo.mockResolvedValue({
      id: 'thread-1',
      repoId: 'repo-1',
      title: 'Thread',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastMessageAt: '2026-01-01T00:00:00.000Z',
    });
    mockedListThreadMessages.mockResolvedValue([
      {
        id: 'msg-1',
        threadId: 'thread-1',
        repoId: 'repo-1',
        role: 'assistant',
        content: 'Hello',
        sourcesJson: JSON.stringify([{ file: 'src/a.ts' }]),
        createdAt: '2026-01-01T00:00:00.000Z',
        sequence: 1,
      },
    ]);

    const response = await app.request('/chat/threads/thread-1/messages?repoId=repo-1');
    const data = (await response.json()) as {
      ok: boolean;
      messages: Array<{ contextFiles: string[] }>;
    };

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.messages[0]?.contextFiles).toEqual(['src/a.ts']);
  });

  it('returns 404 when thread does not belong to repo', async () => {
    const app = new Hono();
    app.route('/chat', chatThreadsRoute);

    mockedGetChatThreadForRepo.mockResolvedValue(null);

    const response = await app.request('/chat/threads/thread-x/messages?repoId=repo-1');
    const data = (await response.json()) as { ok: boolean; error?: string };

    expect(response.status).toBe(404);
    expect(data.ok).toBe(false);
    expect(data.error).toContain('Thread not found');
  });

  it('clears one thread history only', async () => {
    const app = new Hono();
    app.route('/chat', chatThreadsRoute);

    mockedClearThreadMessages.mockResolvedValue();

    const response = await app.request('/chat/threads/thread-1/clear', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repoId: 'repo-1' }),
    });
    const data = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockedClearThreadMessages).toHaveBeenCalledWith('repo-1', 'thread-1');
  });
});
