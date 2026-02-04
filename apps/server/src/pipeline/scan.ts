import fs from "fs/promises";
import path from "path";
import type {
  FileIndexEntry,
  ScanResult,
  SupportedLanguage,
  TextKind,
} from "../types/scan";
import { normalizePath } from "./id";

const CODE_EXT: Record<string, SupportedLanguage> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
  ".java": "java",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
  ".h": "cpp",
  ".hh": "cpp",
  ".hxx": "cpp",
  ".go": "go",
  ".rb": "ruby",
  ".c": "cpp",
};

const TEXT_EXT: Record<string, TextKind> = {
  ".md": "markdown",
  ".markdown": "markdown",
  ".txt": "plaintext",
  ".rst": "rst",
  ".adoc": "adoc",
  ".asciidoc": "adoc",
  ".tex": "latex",
};

const DEFAULT_IGNORES = [
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  ".next",
  ".turbo",
  ".cache",
  "coverage",
  "target",
  "vendor",
  ".idea",
  ".vscode",
  ".codeatlas",
];

function shouldIgnore(rel: string, ignoreNames: string[]): boolean {
  const parts = normalizePath(rel).split("/");
  return parts.some((p) => ignoreNames.includes(p));
}

export async function scanRepo(
  repoRoot: string,
  opts?: { ignoreNames?: string[]; computeHash?: boolean },
): Promise<ScanResult> {
  const root = path.resolve(repoRoot);
  const ignoreNames = opts?.ignoreNames ?? DEFAULT_IGNORES;
  const computeHash = opts?.computeHash ?? false;

  let ignoredCount = 0;
  const entries: FileIndexEntry[] = [];

  async function walk(absDir: string, relDir: string) {
    const dirents = await fs.readdir(absDir, { withFileTypes: true }).catch(() => []);
    for (const d of dirents) {
      const abs = path.join(absDir, d.name);
      const rel = relDir ? path.join(relDir, d.name) : d.name;

      if (shouldIgnore(rel, ignoreNames)) {
        ignoredCount++;
        continue;
      }

      if (d.isDirectory()) {
        await walk(abs, rel);
        continue;
      }

      const ext = path.extname(d.name).toLowerCase();
      const language = CODE_EXT[ext];
      const textKind = TEXT_EXT[ext];

      console.log("[SCAN]", rel, "=>", language ?? textKind, ext);  // <-- TEMP LOG

      if (!language && !textKind) continue;

      console.log("[SCAN]", rel, language ?? textKind);

      const stat = await fs.stat(abs).catch(() => null);
      if (!stat) continue;

      const entry: FileIndexEntry = language
        ? {
            kind: "code",
            relPath: normalizePath(rel),
            absPath: abs,
            language,
            ext,
            size: stat.size,
            mtimeMs: stat.mtimeMs,
          }
        : {
            kind: "text",
            relPath: normalizePath(rel),
            absPath: abs,
            ext,
            size: stat.size,
            mtimeMs: stat.mtimeMs,
            textKind: textKind!,
          };

      if (computeHash) {
        const buf = await fs.readFile(abs).catch(() => null);
        if (buf) {
          const crypto = await import("crypto");
          entry.hash = crypto.createHash("sha1").update(buf).digest("hex");
        }
      }

      entries.push(entry);
    }
  }

  await walk(root, "");

  return {
    repoRoot: root,
    entries,
    ignoredCount,
    scannedAt: new Date().toISOString(),
  };
}
