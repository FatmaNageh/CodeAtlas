import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { DEFAULT_IGNORE_PATTERNS, scanRepo } from "@/pipeline/scan";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, "../fixtures");
const tempDir = path.join(fixturesDir, "temp-scan-advanced");
const languagesDir = path.join(fixturesDir, "languages");

describe("scanRepo — multi-language detection (TC07)", () => {
  // TC07: all language fixtures are detected with correct language labels
  it("detects every supported language present in the languages fixture directory", async () => {
    const result = await scanRepo(languagesDir, { ignorePatterns: [], computeHash: false });
    const codeEntries = result.entries.filter((e) => e.kind === "code");
    const detectedLanguages = new Set(codeEntries.map((e) => (e.kind === "code" ? e.language : "")));

    // The fixture directory contains files for each of these languages
    const expectedLanguages = [
      "typescript",
      "javascript",
      "python",
      "java",
      "go",
      "rust",
      "c",
      "cpp",
      "csharp",
      "kotlin",
      "php",
      "ruby",
    ];

    for (const lang of expectedLanguages) {
      expect(detectedLanguages, `Expected language "${lang}" to be detected`).toContain(lang);
    }
  });

  it("assigns a language property to every code entry", async () => {
    const result = await scanRepo(languagesDir, { ignorePatterns: [], computeHash: false });
    const codeEntries = result.entries.filter((e) => e.kind === "code");
    for (const entry of codeEntries) {
      expect(entry.kind).toBe("code");
      if (entry.kind === "code") {
        expect(typeof entry.language).toBe("string");
        expect(entry.language.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("scanRepo — DEFAULT_IGNORE_PATTERNS (TC08)", () => {
  beforeEach(async () => {
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // TC08: node_modules is in DEFAULT_IGNORE_PATTERNS and must be excluded
  it("excludes node_modules when using DEFAULT_IGNORE_PATTERNS", async () => {
    await fs.mkdir(path.join(tempDir, "node_modules", "lodash"), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, "node_modules", "lodash", "index.js"),
      "module.exports = {};",
      "utf-8",
    );
    await fs.writeFile(path.join(tempDir, "app.ts"), "const x = 1;", "utf-8");

    const result = await scanRepo(tempDir, {
      ignorePatterns: [...DEFAULT_IGNORE_PATTERNS],
      computeHash: false,
    });

    const paths = result.entries.map((e) => e.relPath);
    const hasNodeModules = paths.some((p) => p.includes("node_modules"));
    expect(hasNodeModules).toBe(false);
    expect(result.ignoredCount).toBeGreaterThanOrEqual(1);
  });

  // TC08: dist, build, and .git are excluded by default patterns
  it("excludes dist, build, and .git directories via DEFAULT_IGNORE_PATTERNS", async () => {
    for (const dir of ["dist", "build", ".git"]) {
      await fs.mkdir(path.join(tempDir, dir), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, dir, "output.js"),
        "var x = 1;",
        "utf-8",
      );
    }
    await fs.writeFile(path.join(tempDir, "index.ts"), "const x = 1;", "utf-8");

    const result = await scanRepo(tempDir, {
      ignorePatterns: [...DEFAULT_IGNORE_PATTERNS],
      computeHash: false,
    });

    const paths = result.entries.map((e) => e.relPath);
    expect(paths.some((p) => p.startsWith("dist/"))).toBe(false);
    expect(paths.some((p) => p.startsWith("build/"))).toBe(false);
    expect(paths.some((p) => p.startsWith(".git/"))).toBe(false);
    // Only the root index.ts should be present
    expect(result.entries).toHaveLength(1);
  });

  // TC09: custom ignore pattern excludes the specified directory
  it("excludes a custom directory added to ignorePatterns", async () => {
    await fs.mkdir(path.join(tempDir, "legacy"), { recursive: true });
    await fs.writeFile(path.join(tempDir, "legacy", "old.ts"), "const old = true;", "utf-8");
    await fs.writeFile(path.join(tempDir, "legacy", "util.js"), "function u() {}", "utf-8");
    await fs.writeFile(path.join(tempDir, "index.ts"), "const x = 1;", "utf-8");

    const result = await scanRepo(tempDir, {
      ignorePatterns: ["legacy"],
      computeHash: false,
    });

    const paths = result.entries.map((e) => e.relPath);
    expect(paths.some((p) => p.startsWith("legacy/"))).toBe(false);
    expect(result.entries).toHaveLength(1);
    // ignoredCount counts the legacy directory itself (1), not individual files within it
    expect(result.ignoredCount).toBeGreaterThanOrEqual(1);
  });

  // TC09: multiple custom patterns can be combined
  it("applies multiple custom ignore patterns simultaneously", async () => {
    for (const dir of ["legacy", "experiments", "archive"]) {
      await fs.mkdir(path.join(tempDir, dir), { recursive: true });
      await fs.writeFile(path.join(tempDir, dir, "code.ts"), "const x = 1;", "utf-8");
    }
    await fs.writeFile(path.join(tempDir, "main.ts"), "const main = true;", "utf-8");

    const result = await scanRepo(tempDir, {
      ignorePatterns: ["legacy", "experiments", "archive"],
      computeHash: false,
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.relPath).toBe("main.ts");
  });
});

describe("DEFAULT_IGNORE_PATTERNS — content check", () => {
  it("includes node_modules, dist, build, .git, and .codeatlas", () => {
    expect(DEFAULT_IGNORE_PATTERNS).toContain("node_modules");
    expect(DEFAULT_IGNORE_PATTERNS).toContain("dist");
    expect(DEFAULT_IGNORE_PATTERNS).toContain("build");
    expect(DEFAULT_IGNORE_PATTERNS).toContain(".git");
    expect(DEFAULT_IGNORE_PATTERNS).toContain(".codeatlas");
  });
});
