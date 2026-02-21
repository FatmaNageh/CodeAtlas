import crypto from "node:crypto";
import os from "node:os";

import type { CodeFileIndexEntry } from "../types/scan";
import type { CodeFacts, FactsByFile } from "../types/facts";

import { parseFile } from "./parse";
import { Extractors } from "../extractors";
import { extractTsJsWithTsCompiler } from "../extractors/tsCompiler";
import { uniq } from "../extractors/common";
import { WorkerPool } from "./parallel/workerPool";

function safePreview(text: string, max = 4000): string {
  return text.length <= max ? text : text.slice(0, max);
}

async function parseAndExtractSequential(files: CodeFileIndexEntry[]): Promise<FactsByFile> {
  const out: FactsByFile = {};

  for (const f of files) {
    const parsed = await parseFile(f);
    const text = parsed.text ?? "";
    const lineCount = text ? text.split(/\r\n|\r|\n/).length : 0;
    const textPreview = safePreview(text);
    const textHash = text ? crypto.createHash("sha1").update(text).digest("hex") : undefined;

    const tree: any = parsed.tree as any;
    const root: any = tree?.rootNode;
    const extractor = Extractors[f.language];

    let imports: any[] = [];
    let symbols: any[] = [];
    let callSites: any[] = [];

    // Phase 2 enhancement: prefer TypeScript Compiler API for JS/TS when available.
    if (f.language === "javascript" || f.language === "typescript") {
      const res = await extractTsJsWithTsCompiler({ language: f.language, ext: f.ext, relPath: f.relPath, text });
      if (res) {
        imports = res.imports;
        symbols = res.symbols;
        callSites = res.callSites;
      }
    }

    if (!imports.length && !symbols.length && !callSites.length && root && extractor) {
      const res = extractor(root, { language: f.language, ext: f.ext, relPath: f.relPath, text });
      imports = res.imports;
      symbols = res.symbols;
      callSites = res.callSites;
    }

    // De-dupe (tree-sitter nodes can be reached multiple ways)
    imports = uniq(imports, (i: any) => `${i.kind || ""}:${i.raw}`);
    symbols = uniq(symbols, (s: any) => `${s.kind}:${s.qname || s.name}:${s.range?.startLine || 0}:${s.range?.startCol || 0}`);
    callSites = uniq(callSites, (c: any) => `${c.calleeText}:${c.range?.startLine || 0}:${c.range?.startCol || 0}:${c.enclosingSymbolQname || ""}`);

    out[f.relPath] = {
      kind: "code",
      fileRelPath: f.relPath,
      language: f.language,
      imports,
      symbols,
      callSites,
      parseErrors: parsed.parseErrors,
      lineCount,
      textPreview,
      textHash,
    } satisfies CodeFacts;
  }

  return out;
}

function getWorkerCount(): number {
  // 0/undefined means "auto".
  const raw = process.env.CODEATLAS_PARSE_WORKERS;
  if (raw && raw.trim().length > 0) {
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }

  // Auto: leave 1 core for the server/event loop; cap to avoid thrashing.
  const cpu = os.cpus()?.length ?? 1;
  return Math.max(1, Math.min(cpu - 1, 8));
}

async function parseAndExtractParallel(files: CodeFileIndexEntry[], workers: number): Promise<FactsByFile> {
  const out: FactsByFile = {};
  if (files.length === 0) return out;

  const workerUrl = new URL("./parallel/parseWorker.ts", import.meta.url);
  const pool = new WorkerPool(workerUrl, { size: workers });

  try {
    // Sorting improves determinism and reduces tail-latency if you later switch to size-based scheduling.
    const ordered = [...files].sort((a, b) => a.relPath.localeCompare(b.relPath));
    const results = await Promise.all(ordered.map((f) => pool.run<CodeFacts>({ file: f })));
    for (const fact of results) {
      out[fact.fileRelPath] = fact;
    }
    return out;
  } finally {
    await pool.close();
  }
}

/**
 * Parse + extract code facts for a list of code files.
 *
 * Phase 2 enhancement:
 * - Uses a Worker Thread pool for parallel parsing/extraction when possible.
 * - Falls back to sequential extraction if workers can't start (e.g., loader issues).
 */
export async function parseAndExtract(files: CodeFileIndexEntry[]): Promise<FactsByFile> {
  // Allow disabling parallel parsing explicitly.
  if (process.env.CODEATLAS_DISABLE_PARALLEL_PARSE === "1") {
    return parseAndExtractSequential(files);
  }

  const workers = getWorkerCount();
  if (workers <= 1 || files.length <= 1) {
    return parseAndExtractSequential(files);
  }

  try {
    return await parseAndExtractParallel(files, workers);
  } catch (err) {
    // Safe fallback: correctness over speed.
    console.warn("[CodeAtlas] Parallel parsing failed; falling back to sequential.", err);
    return parseAndExtractSequential(files);
  }
}
