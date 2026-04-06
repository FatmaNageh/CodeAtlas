import crypto from "node:crypto";
import fs from "node:fs/promises";
import { parentPort } from "node:worker_threads";

import type { CodeFileIndexEntry } from "../../types/scan";
import type { CodeFacts } from "../../types/facts";

import { Extractors } from "../../extractors";
import { extractTsJsWithTsCompiler } from "../../extractors/tsCompiler";
import { uniq } from "../../extractors/common";

type JobMsg = { id: number; payload: { file: CodeFileIndexEntry } };

function safePreview(text: string, max = 4000): string {
  return text.length <= max ? text : text.slice(0, max);
}

// --- Tree-sitter loader with memoization (per worker) ---

let ParserMod: any | null | undefined;
const LangMemo = new Map<string, any | null>();
const ParserMemo = new Map<string, any>();

async function tryLoadTreeSitter(): Promise<any | null> {
  if (ParserMod !== undefined) return ParserMod;
  try {
    const mod = await import("tree-sitter");
    ParserMod = mod.default ?? mod;
  } catch {
    ParserMod = null;
  }
  return ParserMod;
}

async function tryLoadLanguage(language: string): Promise<any | null> {
  if (LangMemo.has(language)) return LangMemo.get(language) ?? null;

  let lang: any | null = null;
  try {
    switch (language) {
      case "javascript": {
        const mod = await import("tree-sitter-javascript");
        lang = mod.default ?? mod;
        break;
      }
      case "typescript": {
        const mod = await import("tree-sitter-typescript");
        const pkg = mod.default ?? mod;
        lang = pkg.typescript ?? pkg.tsx ?? pkg;
        break;
      }
      case "python": {
        const mod = await import("tree-sitter-python");
        lang = mod.default ?? mod;
        break;
      }
      case "java": {
        const mod = await import("tree-sitter-java");
        lang = mod.default ?? mod;
        break;
      }
      case "go": {
        const mod = await import("tree-sitter-go");
        lang = mod.default ?? mod;
        break;
      }
      case "cpp": {
        const mod = await import("tree-sitter-cpp");
        lang = mod.default ?? mod;
        break;
      }
      case "c": {
        const mod = await import("tree-sitter-c");
        lang = mod.default ?? mod;
        break;
      }
      case "ruby": {
        const mod = await import("tree-sitter-ruby");
        lang = mod.default ?? mod;
        break;
      }
      default:
        lang = null;
    }
  } catch {
    lang = null;
  }

  LangMemo.set(language, lang);
  return lang;
}

async function parseBestEffort(file: CodeFileIndexEntry, text: string): Promise<{ parseErrors: number; root: any | null }> {
  let parseErrors = 0;
  let root: any | null = null;

  const Parser = await tryLoadTreeSitter();
  if (!Parser) return { parseErrors: 0, root: null };

  const Lang = await tryLoadLanguage(file.language);
  if (!Lang) return { parseErrors: 0, root: null };

  try {
    // Reuse one parser per language per worker.
    let parser = ParserMemo.get(file.language);
    if (!parser) {
      parser = new Parser();
      parser.setLanguage(Lang);
      ParserMemo.set(file.language, parser);
    }

    const tree = parser.parse(text);
    const rn = (tree as any)?.rootNode;
    root = rn ?? null;
    const hasErr =
      typeof rn?.hasError === "function" ? rn.hasError() : Boolean(rn?.hasError);
    parseErrors = hasErr ? 1 : 0;
  } catch {
    parseErrors = 1;
    root = null;
  }

  return { parseErrors, root };
}

async function handleFile(file: CodeFileIndexEntry): Promise<CodeFacts> {
  const text = await fs.readFile(file.absPath, "utf8");
  const lineCount = text ? text.split(/\r\n|\r|\n/).length : 0;
  const textPreview = safePreview(text);
  const textHash = text ? crypto.createHash("sha1").update(text).digest("hex") : undefined;

  const { parseErrors, root } = await parseBestEffort(file, text);
  const extractor = Extractors[file.language];

  let imports: any[] = [];
  let symbols: any[] = [];
  let callSites: any[] = [];

  // Phase 2 enhancement: prefer TypeScript Compiler API for JS/TS when available.
  if (file.language === "javascript" || file.language === "typescript") {
    const res = await extractTsJsWithTsCompiler({ language: file.language, ext: file.ext, relPath: file.relPath, text });
    if (res) {
      imports = res.imports;
      symbols = res.symbols;
      callSites = res.callSites;
    }
  }

  if (!imports.length && !symbols.length && !callSites.length && root && extractor) {
    const res = extractor(root, { language: file.language, ext: file.ext, relPath: file.relPath, text });
    imports = res.imports;
    symbols = res.symbols;
    callSites = res.callSites;
  }

  // De-dupe (tree-sitter nodes can be reached multiple ways)
  imports = uniq(imports, (i: any) => `${i.kind || ""}:${i.raw}`);
  symbols = uniq(symbols, (s: any) => `${s.kind}:${s.qname || s.name}:${s.range?.startLine || 0}:${s.range?.startCol || 0}`);
  callSites = uniq(callSites, (c: any) => `${c.calleeText}:${c.range?.startLine || 0}:${c.range?.startCol || 0}:${c.enclosingSymbolQname || ""}`);

  return {
    kind: "code",
    fileRelPath: file.relPath,
    language: file.language,
    imports,
    symbols,
    callSites,
    parseErrors,
    lineCount,
    textPreview,
    textHash,
  };
}

if (!parentPort) {
  throw new Error("parseWorker must run as a worker thread");
}

parentPort.on("message", async (msg: JobMsg) => {
  const { id, payload } = msg;
  try {
    const result = await handleFile(payload.file);
    parentPort!.postMessage({ id, ok: true, result });
  } catch (e: any) {
    parentPort!.postMessage({ id, ok: false, error: e?.message ?? String(e) });
  }
});
