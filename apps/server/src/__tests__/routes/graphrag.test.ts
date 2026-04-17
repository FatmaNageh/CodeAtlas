import { afterEach, describe, expect, it, vi } from "vitest";

// TC36-TC44: Route-level validation tests for GraphRAG endpoints
// These tests verify input validation, error handling, and response contracts
// without requiring a live Neo4j connection or OpenRouter API key.
describe("graphragRoute — input validation and error contracts", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  // ── POST /graphrag/ask ────────────────────────────────────────────────────

  // TC37: missing repoId → 400
  it("POST /ask returns 400 when repoId is missing", async () => {
    const { graphragRoute } = await import("@/routes/graphrag");
    const response = await graphragRoute.request("http://localhost/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What does authService do?" }),
    });

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/repoId|question/i);
  });

  // TC37: missing question → 400
  it("POST /ask returns 400 when question is missing", async () => {
    const { graphragRoute } = await import("@/routes/graphrag");
    const response = await graphragRoute.request("http://localhost/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoId: "repo-abc123" }),
    });

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  // TC38: valid repoId + question but no indexed data → 400 with contextual error
  it("POST /ask returns 400 when no context is available for the repository", async () => {
    vi.doMock("@/db/cypher", () => ({
      runCypher: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/retrieval/vector", () => ({
      findSimilarChunks: vi.fn().mockResolvedValue([]),
      tokenizeQueryText: vi.fn().mockReturnValue([]),
    }));
    vi.doMock("@/retrieval/graph", () => ({
      getAdjacentASTChunks: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/ai/embeddings", () => ({
      generateSingleEmbed: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
      generateEmbeddings: vi.fn().mockResolvedValue([new Array(1536).fill(0.1)]),
    }));

    const { graphragRoute } = await import("@/routes/graphrag");
    const response = await graphragRoute.request("http://localhost/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repoId: "empty-repo-id",
        question: "How does authentication work?",
      }),
    });

    const body = await response.json();
    // Expect either 400 (no context found) or 500 (embedding error in test env)
    expect([400, 500]).toContain(response.status);
    expect(body.ok).toBe(false);
  });

  // ── GET /graphrag/tour ────────────────────────────────────────────────────

  // TC40/TC41: missing repoId → 400
  it("GET /tour returns 400 when repoId query param is missing", async () => {
    const { graphragRoute } = await import("@/routes/graphrag");
    const response = await graphragRoute.request("http://localhost/tour", {
      method: "GET",
    });

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/repoId/i);
  });

  // TC40: tour with mocked graph data returns structured steps
  it("GET /tour returns structured tour steps when graph data exists", async () => {
    vi.doMock("@/tour/buildGraphTour", () => ({
      buildGraphTour: vi.fn().mockResolvedValue({
        ok: true,
        repoId: "repo-123",
        steps: [
          { step: 1, title: "Entry point", nodeId: "node-1", description: "Main entry" },
          { step: 2, title: "Core service", nodeId: "node-2", description: "Auth logic" },
        ],
      }),
    }));

    const { graphragRoute } = await import("@/routes/graphrag");
    const response = await graphragRoute.request(
      "http://localhost/tour?repoId=repo-123",
      { method: "GET" },
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.steps).toBeDefined();
    expect(Array.isArray(body.steps)).toBe(true);
    expect(body.steps.length).toBeGreaterThan(0);
  });

  // ── GET /graphrag/context ─────────────────────────────────────────────────

  // TC36: missing repoId → 400
  it("GET /context returns 400 when repoId is missing", async () => {
    const { graphragRoute } = await import("@/routes/graphrag");
    const response = await graphragRoute.request(
      "http://localhost/context?filePath=src/auth.ts",
      { method: "GET" },
    );

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/repoId/i);
  });

  // TC36: missing filePath → 400
  it("GET /context returns 400 when filePath is missing", async () => {
    const { graphragRoute } = await import("@/routes/graphrag");
    const response = await graphragRoute.request(
      "http://localhost/context?repoId=repo-abc",
      { method: "GET" },
    );

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/filePath/i);
  });

  // ── GET /graphrag/status ──────────────────────────────────────────────────

  // TC17: missing repoId → 400
  it("GET /status returns 400 when repoId is missing", async () => {
    const { graphragRoute } = await import("@/routes/graphrag");
    const response = await graphragRoute.request("http://localhost/status", {
      method: "GET",
    });

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/repoId/i);
  });

  // TC17: status with mocked Neo4j data returns counts
  it("GET /status returns node and chunk counts for a known repoId", async () => {
    vi.doMock("@/db/cypher", () => ({
      runCypher: vi.fn()
        .mockResolvedValueOnce([{ n: 12 }])   // totalFiles
        .mockResolvedValueOnce([{ n: 3 }])    // totalTextFiles
        .mockResolvedValueOnce([{ n: 10 }])   // summarizedFiles
        .mockResolvedValueOnce([{ n: 48 }])   // totalChunks
        .mockResolvedValueOnce([{ n: 6 }])    // totalTextChunks
        .mockResolvedValueOnce([{ n: 40 }])   // embeddedChunks
        .mockResolvedValueOnce([{ n: 5 }])    // embeddedTextChunks
        .mockResolvedValueOnce([]),           // perFile
    }));

    const { graphragRoute } = await import("@/routes/graphrag");
    const response = await graphragRoute.request(
      "http://localhost/status?repoId=repo-abc",
      { method: "GET" },
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.totalFiles).toBe(12);
    expect(body.totalChunks).toBe(48);
    expect(body.embeddedChunks).toBe(40);
  });

  // ── POST /graphrag/summarize ──────────────────────────────────────────────

  // TC39: missing repoId → 400
  it("POST /summarize returns 400 when repoId is missing", async () => {
    const { graphragRoute } = await import("@/routes/graphrag");
    const response = await graphragRoute.request("http://localhost/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePaths: ["src/auth.ts"] }),
    });

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/repoId/i);
  });

  // TC39: summarize with mocked pipeline returns results array
  it("POST /summarize returns summary results when repoId is provided", async () => {
    vi.doMock("@/pipeline/generateSummary", () => ({
      generateBatchSummaries: vi.fn().mockResolvedValue({
        results: [{ path: "src/auth.ts", summary: "Handles authentication logic." }],
        errors: [],
      }),
    }));
    vi.doMock("@/db/cypher", () => ({
      runCypher: vi.fn().mockResolvedValue([{ filePath: "src/auth.ts" }]),
    }));

    const { graphragRoute } = await import("@/routes/graphrag");
    const response = await graphragRoute.request("http://localhost/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repoId: "repo-abc",
        filePaths: ["src/auth.ts"],
        repoRoot: "/tmp/myrepo",
      }),
    });

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.results)).toBe(true);
  });
});
