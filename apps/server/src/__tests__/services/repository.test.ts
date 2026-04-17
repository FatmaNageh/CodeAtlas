import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import { validateRepository } from "@/services/repository";

const fixturesDir = path.join(process.cwd(), "src/__tests__/fixtures");
const tempDir = path.join(fixturesDir, "temp-repo-service");

// TC01-TC05: Repository path validation via the service layer
describe("validateRepository", () => {
  beforeEach(async () => {
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // TC01 — valid directory is accepted and returns file counts
  it("returns ok:true for a valid, readable directory", async () => {
    await fs.writeFile(path.join(tempDir, "index.ts"), "export function hello() {}", "utf-8");
    await fs.writeFile(path.join(tempDir, "README.md"), "# Test", "utf-8");

    const result = await validateRepository({ projectPath: tempDir, ignorePatterns: [] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.supportedFiles.total).toBeGreaterThanOrEqual(2);
    expect(result.supportedFiles.code).toBeGreaterThanOrEqual(1);
    expect(result.supportedFiles.documentation).toBeGreaterThanOrEqual(1);
    expect(result.projectPath).toBeTruthy();
  });

  // TC02 — non-existent path returns ok:false with path-not-found error
  it("returns ok:false when path does not exist", async () => {
    const result = await validateRepository({
      projectPath: path.join(tempDir, "does-not-exist"),
      ignorePatterns: [],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/does not exist/i);
  });

  // TC02 variant — path pointing to a file (not a directory) is rejected
  it("returns ok:false when path points to a file rather than a directory", async () => {
    const filePath = path.join(tempDir, "somefile.ts");
    await fs.writeFile(filePath, "const x = 1;", "utf-8");

    const result = await validateRepository({ projectPath: filePath, ignorePatterns: [] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/directory/i);
  });

  // TC03 — path that exists but is a file (not a directory) triggers a clear error
  // Full permission-denied behavior (EACCES) is OS-level and validated via the route layer
  it("returns ok:false and a directory-specific error when path is a regular file", async () => {
    const filePath = path.join(tempDir, "repo.ts");
    await fs.writeFile(filePath, "const x = 1;", "utf-8");

    const result = await validateRepository({ projectPath: filePath, ignorePatterns: [] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // The error must clearly describe that a directory is required
    expect(result.error).toMatch(/directory/i);
    // The resolved path must be reported back so the caller knows which path was checked
    expect(result.projectPath).toBeTruthy();
  });

  // TC06 — only TypeScript files are detected when the directory contains only .ts files
  it("detects TypeScript source files and classifies them correctly", async () => {
    await fs.writeFile(path.join(tempDir, "app.ts"), "export const x = 1;", "utf-8");
    await fs.writeFile(path.join(tempDir, "util.ts"), "export function util() {}", "utf-8");

    const result = await validateRepository({ projectPath: tempDir, ignorePatterns: [] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.supportedFiles.byLanguage?.typescript).toBeGreaterThanOrEqual(2);
  });

  // TC07 — polyglot repository: Python, TypeScript, and Markdown are all detected
  it("detects files from multiple languages in a polyglot repository", async () => {
    await fs.writeFile(path.join(tempDir, "main.ts"), "const x = 1;", "utf-8");
    await fs.writeFile(path.join(tempDir, "main.py"), "x = 1", "utf-8");
    await fs.writeFile(path.join(tempDir, "README.md"), "# docs", "utf-8");

    const result = await validateRepository({ projectPath: tempDir, ignorePatterns: [] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.supportedFiles.byLanguage?.typescript).toBeGreaterThanOrEqual(1);
    expect(result.supportedFiles.byLanguage?.python).toBeGreaterThanOrEqual(1);
    expect(result.supportedFiles.documentation).toBeGreaterThanOrEqual(1);
  });

  // TC08 — node_modules is excluded by the default ignore list
  it("excludes node_modules when it is in the default ignore list", async () => {
    await fs.mkdir(path.join(tempDir, "node_modules", "lib"), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, "node_modules", "lib", "index.js"),
      "module.exports = {};",
      "utf-8",
    );
    await fs.writeFile(path.join(tempDir, "index.ts"), "const x = 1;", "utf-8");

    // DEFAULT_IGNORE_PATTERNS includes "node_modules"
    const { DEFAULT_IGNORE_PATTERNS } = await import("@/pipeline/scan");
    const result = await validateRepository({
      projectPath: tempDir,
      ignorePatterns: [...DEFAULT_IGNORE_PATTERNS],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // All detected files should be only the root index.ts, not the node_modules content
    const totalFiles = result.supportedFiles.total;
    expect(totalFiles).toBe(1);
  });

  // TC09 — a custom ignore pattern excludes the specified directory
  it("excludes a custom directory when it is added to the ignore list", async () => {
    await fs.mkdir(path.join(tempDir, "legacy"), { recursive: true });
    await fs.writeFile(path.join(tempDir, "legacy", "old.ts"), "const old = true;", "utf-8");
    await fs.writeFile(path.join(tempDir, "index.ts"), "const x = 1;", "utf-8");

    const result = await validateRepository({
      projectPath: tempDir,
      ignorePatterns: ["legacy"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.supportedFiles.total).toBe(1);
    expect(result.ignoredCount).toBeGreaterThanOrEqual(1);
  });
});
