import fs from "fs/promises";
import path from "path";
import type {
  FileIndexEntry,
  ScanResult,
  ScanHashMode,
  SupportedLanguage,
  TextKind,
} from "../types/scan";
import { normalizePath } from "./id";

const CODE_EXT: Record<string, SupportedLanguage> = {
  ".c": "c",
  ".cs": "csharp",
  ".js": "javascript",
  ".jsx": "javascript",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
  ".hh": "cpp",
  ".hxx": "cpp",
  ".go": "go",
  ".h": "c",
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".php": "php",
  ".py": "python",
  ".rb": "ruby",
  ".rs": "rust",
  ".swift": "swift",
  ".ts": "typescript",
  ".tsx": "typescript",
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

export const DEFAULT_IGNORE_PATTERNS = [
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
 ] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globToRegExp(pattern: string): RegExp {
  let source = "";

  for (let index = 0; index < pattern.length; index += 1) {
    const current = pattern[index] ?? "";
    const next = pattern[index + 1];

    if (current === "*") {
      if (next === "*") {
        source += ".*";
        index += 1;
      } else {
        source += "[^/]*";
      }
      continue;
    }

    source += escapeRegExp(current);
  }

  return new RegExp(`^${source}$`);
}

function normalizeIgnorePattern(pattern: string): string {
  return normalizePath(pattern.trim())
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function matchesIgnorePattern(relPath: string, pattern: string): boolean {
  const normalizedPattern = normalizeIgnorePattern(pattern);
  if (!normalizedPattern) return false;

  const normalizedRelPath = normalizePath(relPath).replace(/^\/+/, "");
  const segments = normalizedRelPath.split("/");

  if (!normalizedPattern.includes("*")) {
    return (
      normalizedRelPath === normalizedPattern ||
      normalizedRelPath.startsWith(`${normalizedPattern}/`) ||
      segments.includes(normalizedPattern)
    );
  }

  const glob = globToRegExp(normalizedPattern);
  return (
    glob.test(normalizedRelPath) ||
    normalizedRelPath.split("/").some((_, index) =>
      glob.test(normalizedRelPath.split("/").slice(index).join("/")),
    )
  );
}

function shouldIgnore(rel: string, ignorePatterns: readonly string[]): boolean {
  return ignorePatterns.some((pattern) => matchesIgnorePattern(rel, pattern));
}

function resolveHashMode(
  hashMode: ScanHashMode | undefined,
  computeHash: boolean | undefined,
): ScanHashMode {
  if (hashMode) return hashMode;
  if (computeHash === true) return "all";
  if (computeHash === false) return "none";
  return "code";
}

function shouldHashEntry(entry: FileIndexEntry, hashMode: ScanHashMode): boolean {
  if (hashMode === "all") return true;
  if (hashMode === "none") return false;
  return entry.kind === "code";
}

export async function scanRepo(
  repoRoot: string,
  opts?: { ignorePatterns?: string[]; computeHash?: boolean; hashMode?: ScanHashMode },
): Promise<ScanResult> {
  const root = path.resolve(repoRoot);
  const ignorePatterns = opts?.ignorePatterns ?? [...DEFAULT_IGNORE_PATTERNS];
  const hashMode = resolveHashMode(opts?.hashMode, opts?.computeHash);

  let ignoredCount = 0;
  const entries: FileIndexEntry[] = [];

  async function walk(absDir: string, relDir: string) {
    const dirents = (await fs.readdir(absDir, { withFileTypes: true }).catch(() => []))
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const d of dirents) {
      const abs = path.join(absDir, d.name);
      const rel = relDir ? path.join(relDir, d.name) : d.name;

      if (shouldIgnore(rel, ignorePatterns)) {
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

      if (!language && !textKind) continue;

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

      if (shouldHashEntry(entry, hashMode)) {
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
    hashMode,
  };
}
