import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs/promises";
import path from "path";

const fixturesDir = path.join(process.cwd(), "src/__tests__/fixtures");
const tempDir = path.join(fixturesDir, "temp-route-repo");

// TC01-TC05 (route layer) + TC18: HTTP tests for /repository/validate and /repository/delete
describe("repositoryRoute", () => {
  beforeEach(async () => {
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    vi.resetModules();
    vi.clearAllMocks();
  });

  // ── /repository/validate ──────────────────────────────────────────────────

  // TC01: valid existing directory → 200 ok:true
  it("POST /repository/validate returns 200 for a valid existing directory", async () => {
    await fs.writeFile(path.join(tempDir, "index.ts"), "export const x = 1;", "utf-8");

    const { repositoryRoute } = await import("@/routes/repository");
    const response = await repositoryRoute.request("http://localhost/repository/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath: tempDir }),
    });

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.supportedFiles).toBeDefined();
    expect(body.projectPath).toBeTruthy();
  });

  // TC02: non-existent path → 400 ok:false
  it("POST /repository/validate returns 400 when path does not exist", async () => {
    const { repositoryRoute } = await import("@/routes/repository");
    const response = await repositoryRoute.request("http://localhost/repository/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath: path.join(tempDir, "no-such-dir") }),
    });

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/does not exist/i);
  });

  // Malformed request body → 400 Zod validation error
  it("POST /repository/validate returns 400 when projectPath is missing", async () => {
    const { repositoryRoute } = await import("@/routes/repository");
    const response = await repositoryRoute.request("http://localhost/repository/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  // TC02 variant: path pointing to a file → 400
  it("POST /repository/validate returns 400 when path points to a file", async () => {
    const filePath = path.join(tempDir, "notadir.ts");
    await fs.writeFile(filePath, "const x = 1;", "utf-8");

    const { repositoryRoute } = await import("@/routes/repository");
    const response = await repositoryRoute.request("http://localhost/repository/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath: filePath }),
    });

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/directory/i);
  });

  // TC07: polyglot repo detected via route
  it("POST /repository/validate detects multiple languages in a polyglot repository", async () => {
    await fs.writeFile(path.join(tempDir, "main.ts"), "const x = 1;", "utf-8");
    await fs.writeFile(path.join(tempDir, "main.py"), "x = 1", "utf-8");
    await fs.writeFile(path.join(tempDir, "README.md"), "# docs", "utf-8");

    const { repositoryRoute } = await import("@/routes/repository");
    const response = await repositoryRoute.request("http://localhost/repository/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath: tempDir }),
    });

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.supportedFiles.byLanguage?.typescript).toBeGreaterThanOrEqual(1);
    expect(body.supportedFiles.byLanguage?.python).toBeGreaterThanOrEqual(1);
  });

  // ── /repository/delete ────────────────────────────────────────────────────

  // TC18: delete with missing repoId → 400
  it("POST /repository/delete returns 400 when repoId is missing", async () => {
    const { repositoryRoute } = await import("@/routes/repository");
    const response = await repositoryRoute.request("http://localhost/repository/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  // TC18: delete with non-existent repoId → 404 (graph not found in Neo4j)
  it("POST /repository/delete returns 404 when repoId is not found in the graph", async () => {
    vi.doMock("@/db/cypher", () => ({
      runCypher: vi.fn().mockResolvedValue([]),
    }));

    const { repositoryRoute } = await import("@/routes/repository");
    const response = await repositoryRoute.request("http://localhost/repository/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoId: "repo-that-does-not-exist" }),
    });

    const body = await response.json();
    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/not found/i);
  });
});
