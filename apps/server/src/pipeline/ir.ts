import path from "path";
import type { FactsByFile, FileFacts, CodeFacts, TextFacts } from "../types/facts";
import type { ScanResult, FileIndexEntry, CodeFileIndexEntry, TextFileIndexEntry } from "../types/scan";
import type { IR, IRNode, IREdge } from "../types/ir";
import {
  dirId,
  edgeId,
  fileId,
  repoIdFromPath,
  repoNodeId,
  symbolId,
  normalizePath,
  importId,
  callsiteId,
  chunkId,
  externalModuleId,
  externalSymbolId,
} from "./id";
import { createTsModuleResolver } from "./tsResolve";
import { enrichIrWithTsProgram } from "./tsProgramEnrich";

function isCode(e: FileIndexEntry): e is CodeFileIndexEntry {
  return (e as any).kind === "code";
}

function isText(e: FileIndexEntry): e is TextFileIndexEntry {
  return (e as any).kind === "text";
}

function cleanQuotes(s: string): string {
  return s.replace(/^[`'"(]+/, "").replace(/[)`'";]+$/, "").trim();
}

function normalizeImportRaw(language: string, raw: string): string {
  const t = raw.trim();
  if (language === "python") {
    // e.g. "import a.b as c" or "from a.b import x"
    const m1 = t.match(/^import\s+([^\s]+)(?:\s+as\s+\w+)?/);
    if (m1) return m1[1];
    const m2 = t.match(/^from\s+([^\s]+)\s+import\s+/);
    if (m2) return m2[1];
  }
  if (language === "java") {
    // e.g. "import foo.bar.Baz;"
    const m = t.match(/^import\s+([^;]+);?/);
    if (m) return m[1];
  }
  if (language === "go") {
    // e.g. import "fmt" or import (
    // "fmt"
    // )
    const m = t.match(/"([^"]+)"/);
    if (m) return m[1];
  }
  if (language === "cpp") {
    const m = t.match(/#\s*include\s*[<"]([^>"]+)[>"]/);
    if (m) return m[1];
  }
  // js/ts often comes as "./x" already, but fall back to stripping quotes
  return cleanQuotes(t);
}

function resolveLocalImport(
  allFilesByRel: Map<string, FileIndexEntry>,
  importerRel: string,
  raw: string,
): string | null {
  const cleaned = cleanQuotes(raw);
  if (!cleaned) return null;
  if (!cleaned.startsWith(".") && !cleaned.startsWith("/")) return null;

  const importerDir = path.posix.dirname(normalizePath(importerRel));
  const base = cleaned.startsWith("/") ? cleaned.slice(1) : path.posix.normalize(path.posix.join(importerDir, cleaned));

  // Try direct match
  if (allFilesByRel.has(base)) return base;

  const exts = [".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".go", ".rb", ".cpp", ".cc", ".cxx", ".hpp", ".h"];
  for (const ext of exts) {
    if (allFilesByRel.has(base + ext)) return base + ext;
  }
  // index.*
  for (const ext of exts) {
    const idx = path.posix.join(base, "index" + ext);
    if (allFilesByRel.has(idx)) return idx;
  }
  return null;
}

function resolveDocPath(allFilesByRel: Map<string, FileIndexEntry>, docRel: string, raw: string): string | null {
  const cleaned = cleanQuotes(raw).replace(/^\.?\//, "");
  if (!cleaned) return null;
  // If already a repo-relative path
  if (allFilesByRel.has(cleaned)) return cleaned;

  const docDir = path.posix.dirname(normalizePath(docRel));
  const joined = path.posix.normalize(path.posix.join(docDir, cleaned));
  if (allFilesByRel.has(joined)) return joined;

  return null;
}

export function buildIR(scan: ScanResult, facts: FactsByFile): IR {
  const repoRoot = scan.repoRoot;
  const repoId = repoIdFromPath(repoRoot);

  const nodes: IRNode[] = [];
  const edges: IREdge[] = [];

  const repoNode: IRNode = {
    id: repoNodeId(repoId),
    kind: "Repo",
    repoId,
    props: {
      repoId,
      rootPath: normalizePath(repoRoot),
      name: path.basename(repoRoot),
    },
  };
  nodes.push(repoNode);

  // Index file entries by relPath for resolution.
  const filesByRel = new Map<string, FileIndexEntry>();
  for (const e of scan.entries) filesByRel.set(normalizePath(e.relPath), e);

  // Phase 2 enhancement: use TypeScript's module resolution for TS/JS imports
  // to improve cross-file import edges (paths, extensions, tsconfig paths).
  const tsResolver = createTsModuleResolver(scan, filesByRel);

  // Directories set
  const dirSet = new Set<string>();
  dirSet.add(""); // root
  for (const e of scan.entries) {
    const rel = normalizePath(e.relPath);
    const parts = rel.split("/");
    for (let i = 0; i < parts.length - 1; i++) {
      dirSet.add(parts.slice(0, i + 1).join("/"));
    }
  }

  // Directory nodes + edges
  for (const relDir of Array.from(dirSet)) {
    const id = dirId(repoId, relDir);
    const name = relDir === "" ? path.basename(repoRoot) : path.basename(relDir);

    nodes.push({
      id,
      kind: "Directory",
      repoId,
      props: { repoId, relPath: relDir === "" ? "." : relDir, name },
    });

    const from = relDir === "" ? repoNode.id : dirId(repoId, relDir.split("/").slice(0, -1).join("/"));
    edges.push({ id: edgeId(repoId, "CONTAINS", from, id), type: "CONTAINS", from, to: id, repoId });
  }

  let symbolsCount = 0;
  let importsRawCount = 0;

  // Per-file symbol maps (used for within-file resolution)
  const symbolsByFileRel = new Map<string, Map<string, string>>();

  // 1) Create Directory/File nodes + CONTAINS edges. Also create file-derived nodes for processed files.
  for (const e of scan.entries) {
    const rel = normalizePath(e.relPath);
    const fId = fileId(repoId, rel);

    if (isCode(e)) {
      nodes.push({
        id: fId,
        kind: "CodeFile",
        repoId,
        props: {
          repoId,
          relPath: rel,
          path: normalizePath(e.absPath),
          language: e.language,
          ext: e.ext,
          size: e.size,
          mtimeMs: e.mtimeMs,
          hash: e.hash ?? null,
        },
      });
    } else if (isText(e)) {
      nodes.push({
        id: fId,
        kind: "TextFile",
        repoId,
        props: {
          repoId,
          relPath: rel,
          path: normalizePath(e.absPath),
          ext: e.ext,
          textKind: e.textKind,
          size: e.size,
          mtimeMs: e.mtimeMs,
          hash: e.hash ?? null,
        },
      });
    }

    const parentRel = rel.split("/").slice(0, -1).join("/");
    const parentDirId = dirId(repoId, parentRel);
    edges.push({ id: edgeId(repoId, "CONTAINS", parentDirId, fId), type: "CONTAINS", from: parentDirId, to: fId, repoId });

    const fFacts: FileFacts | undefined = facts[rel];
    if (!fFacts) continue;

    // Minimal DocChunk per file (safe preview + hash + line count)
    const lc = fFacts.lineCount ?? 0;
    const chId = chunkId(repoId, rel, "file", 1, lc || 1);
    nodes.push({
      id: chId,
      kind: "DocChunk",
      repoId,
      props: {
        repoId,
        fileRelPath: rel,
        chunkType: "file",
        startLine: 1,
        endLine: lc || 1,
        textPreview: fFacts.textPreview ?? "",
        textHash: fFacts.textHash ?? null,
      },
    });
    edges.push({ id: edgeId(repoId, "HAS_CHUNK", fId, chId), type: "HAS_CHUNK", from: fId, to: chId, repoId });

    if (fFacts.kind === "code") {
      const cf = fFacts as CodeFacts;

      // Import nodes (raw)
      for (const imp of cf.imports) {
        importsRawCount++;
        const impId = importId(repoId, rel, imp.raw, imp.kind ?? "static", imp.range?.startLine ?? 0, imp.range?.startCol ?? 0);
        nodes.push({
          id: impId,
          kind: "Import",
          repoId,
          props: {
            repoId,
            raw: imp.raw,
            normalized: normalizeImportRaw(cf.language, imp.raw),
            fileRelPath: rel,
            kind: imp.kind ?? "static",
            startLine: imp.range?.startLine ?? null,
            startCol: imp.range?.startCol ?? null,
            endLine: imp.range?.endLine ?? null,
            endCol: imp.range?.endCol ?? null,
          },
        });
        edges.push({ id: edgeId(repoId, "IMPORTS_RAW", fId, impId), type: "IMPORTS_RAW", from: fId, to: impId, repoId });
      }

      // CallSite nodes + CONTAINS edges
      for (const cs of cf.callSites ?? []) {
        const csId = callsiteId(repoId, rel, cs.calleeText, cs.range?.startLine ?? 0, cs.range?.startCol ?? 0);
        nodes.push({
          id: csId,
          kind: "CallSite",
          repoId,
          props: { 
            repoId, 
            fileRelPath: rel, 
            calleeText: cs.calleeText, 
            enclosingSymbolQname: cs.enclosingSymbolQname ?? null,
            startLine: cs.range?.startLine ?? null,
            startCol: cs.range?.startCol ?? null,
            endLine: cs.range?.endLine ?? null,
            endCol: cs.range?.endCol ?? null,
          },
        });
        edges.push({ id: edgeId(repoId, "CONTAINS", fId, csId), type: "CONTAINS", from: fId, to: csId, repoId });
      }

      // Symbol nodes + DECLARES edges
      const symMap = new Map<string, string>();
      for (const s of cf.symbols) {
        symbolsCount++;
        const qname = s.qname ?? s.name;
        const sid = symbolId(repoId, rel, s.kind, qname, s.range?.startLine ?? 0, s.range?.startCol ?? 0);
        symMap.set(qname, sid);
        symMap.set(s.name, sid);
        nodes.push({
          id: sid,
          kind: "Symbol",
          repoId,
          props: {
            repoId,
            fileRelPath: rel,
            name: s.name,
            qname,
            symbolKind: s.kind,
            parentName: s.parentName ?? null,
            extendsNames: s.extendsNames ?? [],
            implementsNames: s.implementsNames ?? [],
            startLine: s.range?.startLine ?? null,
            startCol: s.range?.startCol ?? null,
            endLine: s.range?.endLine ?? null,
            endCol: s.range?.endCol ?? null,
            //range: s.range ?? null, //-__-
          },
        });
        edges.push({ id: edgeId(repoId, "DECLARES", fId, sid), type: "DECLARES", from: fId, to: sid, repoId });
      }
      symbolsByFileRel.set(rel, symMap);

      // Symbol nesting edges (PARENT)
      for (const s of cf.symbols) {
        if (!s.parentName) continue;
        const childQ = s.qname ?? s.name;
        const childId = symMap.get(childQ);
        const parentId = symMap.get(s.parentName);
        if (childId && parentId) {
          edges.push({ id: edgeId(repoId, "PARENT", parentId, childId), type: "PARENT", from: parentId, to: childId, repoId });
        }
      }
    } else {
      const tf = fFacts as TextFacts;
      // Text->file references & docs
      for (const ref of tf.references ?? []) {
        const targetRel = resolveDocPath(filesByRel, rel, ref.raw);
        if (targetRel) {
          const toId = fileId(repoId, targetRel);
          edges.push({ id: edgeId(repoId, "REFERENCES", fId, toId), type: "REFERENCES", from: fId, to: toId, repoId, props: { raw: ref.raw, confidence: 0.7 } });
        } else {
          // Unknown reference -> external symbol node
          const exId = externalSymbolId(repoId, ref.raw);
          nodes.push({ id: exId, kind: "ExternalSymbol", repoId, props: { repoId, name: ref.raw, kind: "doc_ref" } });
          edges.push({ id: edgeId(repoId, "REFERENCES", fId, exId), type: "REFERENCES", from: fId, to: exId, repoId, props: { raw: ref.raw, confidence: 0.2 } });
        }
      }

      for (const m of tf.symbolMentions ?? []) {
        const exId = externalSymbolId(repoId, m.name);
        nodes.push({ id: exId, kind: "ExternalSymbol", repoId, props: { repoId, name: m.name, kind: "symbol_mention" } });
        edges.push({ id: edgeId(repoId, "DOCUMENTS", fId, exId), type: "DOCUMENTS", from: fId, to: exId, repoId, props: { confidence: 0.3 } });
      }
    }
  }

  // 2) Resolve imports (local vs external) + RESOLVES_TO.
  for (const e of scan.entries) {
    if (!isCode(e)) continue;
    const rel = normalizePath(e.relPath);
    const fFacts = facts[rel];
    if (!fFacts || fFacts.kind !== "code") continue;
    const cf = fFacts as CodeFacts;
    const fId = fileId(repoId, rel);

    for (const imp of cf.imports) {
      const impId = importId(repoId, rel, imp.raw, imp.kind ?? "static", imp.range?.startLine ?? 0, imp.range?.startCol ?? 0);
      const normalized = normalizeImportRaw(cf.language, imp.raw);

      // Try local resolution for relative paths
      const localTarget = resolveLocalImport(filesByRel, rel, normalized);
      if (localTarget) {
        const toId = fileId(repoId, localTarget);
        edges.push({ id: edgeId(repoId, "IMPORTS", fId, toId), type: "IMPORTS", from: fId, to: toId, repoId, props: { raw: imp.raw, normalized, confidence: 0.9 } });
        edges.push({ id: edgeId(repoId, "RESOLVES_TO", impId, toId), type: "RESOLVES_TO", from: impId, to: toId, repoId, props: { confidence: 0.9 } });
      } else {
        // Phase 2 enhancement: use TS module resolver for JS/TS even when
        // the specifier isn't a simple relative path (e.g. tsconfig paths, extensions).
        const tsTarget =
          (cf.language === "javascript" || cf.language === "typescript") && tsResolver
            ? tsResolver.resolveModuleToRelPath(normalized, rel)
            : null;

        if (tsTarget) {
          const toId = fileId(repoId, tsTarget);
          edges.push({
            id: edgeId(repoId, "IMPORTS", fId, toId),
            type: "IMPORTS",
            from: fId,
            to: toId,
            repoId,
            props: { raw: imp.raw, normalized, resolver: "typescript", confidence: 0.85 },
          });
          edges.push({
            id: edgeId(repoId, "RESOLVES_TO", impId, toId),
            type: "RESOLVES_TO",
            from: impId,
            to: toId,
            repoId,
            props: { resolver: "typescript", confidence: 0.85 },
          });
        } else {
          // External module
          const modId = externalModuleId(repoId, normalized);
          nodes.push({ id: modId, kind: "ExternalModule", repoId, props: { repoId, name: normalized } });
          edges.push({
            id: edgeId(repoId, "IMPORTS_EXTERNAL", fId, modId),
            type: "IMPORTS_EXTERNAL",
            from: fId,
            to: modId,
            repoId,
            props: { raw: imp.raw, normalized, confidence: 0.6 },
          });
          edges.push({ id: edgeId(repoId, "RESOLVES_TO", impId, modId), type: "RESOLVES_TO", from: impId, to: modId, repoId, props: { confidence: 0.6 } });
        }
      }
    }
  }

  // Phase 2 Step 7+: Enrich TS/JS edges using TypeScript Program (imports->symbols, calls->symbols).
  // Optimization: only enrich files we actually processed this run (facts keys).
  const tsJsProcessed = Object.keys(facts)
    .map((p) => p.replace(/\\/g, "/"))
    .filter((p) => /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(p));
  enrichIrWithTsProgram({ scan, repoId, nodes, edges, onlyFiles: tsJsProcessed });

  // 3) Symbol relationships: EXTENDS/IMPLEMENTS.
  for (const [rel, symMap] of symbolsByFileRel.entries()) {
    const fFacts = facts[rel];
    if (!fFacts || fFacts.kind !== "code") continue;
    const cf = fFacts as CodeFacts;
    for (const s of cf.symbols) {
      const q = s.qname ?? s.name;
      const fromId = symMap.get(q);
      if (!fromId) continue;

      for (const base of s.extendsNames ?? []) {
        const baseName = cleanQuotes(base);
        if (!baseName) continue;
        const local = symMap.get(baseName);
        if (local) {
          edges.push({ id: edgeId(repoId, "EXTENDS", fromId, local), type: "EXTENDS", from: fromId, to: local, repoId, props: { confidence: 0.7 } });
        } else {
          const exId = externalSymbolId(repoId, baseName);
          nodes.push({ id: exId, kind: "ExternalSymbol", repoId, props: { repoId, name: baseName, kind: "type" } });
          edges.push({ id: edgeId(repoId, "EXTENDS", fromId, exId), type: "EXTENDS", from: fromId, to: exId, repoId, props: { confidence: 0.3 } });
        }
      }

      for (const iface of s.implementsNames ?? []) {
        const ifaceName = cleanQuotes(iface);
        if (!ifaceName) continue;
        const local = symMap.get(ifaceName);
        if (local) {
          edges.push({ id: edgeId(repoId, "IMPLEMENTS", fromId, local), type: "IMPLEMENTS", from: fromId, to: local, repoId, props: { confidence: 0.7 } });
        } else {
          const exId = externalSymbolId(repoId, ifaceName);
          nodes.push({ id: exId, kind: "ExternalSymbol", repoId, props: { repoId, name: ifaceName, kind: "interface" } });
          edges.push({ id: edgeId(repoId, "IMPLEMENTS", fromId, exId), type: "IMPLEMENTS", from: fromId, to: exId, repoId, props: { confidence: 0.3 } });
        }
      }
    }
  }

  // 4) Best-effort CALLS: within-file resolution + fallback REFERENCES.
  for (const [rel, symMap] of symbolsByFileRel.entries()) {
    const fFacts = facts[rel];
    if (!fFacts || fFacts.kind !== "code") continue;
    const cf = fFacts as CodeFacts;
    for (const cs of cf.callSites ?? []) {
      const fromQ = cs.enclosingSymbolQname;
      if (!fromQ) continue;
      const fromId = symMap.get(fromQ);
      if (!fromId) continue;

      const csId = callsiteId(repoId, rel, cs.calleeText, cs.range?.startLine ?? 0, cs.range?.startCol ?? 0);
      edges.push({ id: edgeId(repoId, "CALLS_RAW", fromId, csId), type: "CALLS_RAW", from: fromId, to: csId, repoId, props: { calleeText: cs.calleeText } });

      // Try resolve to local symbol by simple name.
      const simple = cs.calleeText.split(/[.:(\[]/)[0].trim();
      const target = symMap.get(simple);
      if (target) {
        edges.push({ id: edgeId(repoId, "CALLS", fromId, target), type: "CALLS", from: fromId, to: target, repoId, props: { confidence: 0.8 } });
      } else {
        const exId = externalSymbolId(repoId, simple || cs.calleeText);
        nodes.push({ id: exId, kind: "ExternalSymbol", repoId, props: { repoId, name: simple || cs.calleeText, kind: "callee" } });
        edges.push({ id: edgeId(repoId, "REFERENCES", fromId, exId), type: "REFERENCES", from: fromId, to: exId, repoId, props: { confidence: 0.2 } });
      }
    }
  }

  return {
    repoId,
    nodes,
    edges,
    stats: {
      files: scan.entries.length,
      dirs: dirSet.size,
      symbols: symbolsCount,
      importsRaw: importsRawCount,
    },
  };
}
