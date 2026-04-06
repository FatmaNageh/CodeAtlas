import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import crypto from "node:crypto";

import type { ScanResult } from "../types/scan";
import type { IRNode, IREdge } from "../types/ir";
import { edgeId, fileId, importId, normalizePath, symbolId, callsiteId } from "./id";

/**
 * Phase 2 Step 7: Repo-aware TS/JS symbol & call resolution using TypeScript Program + TypeChecker.
 *
 * This enriches the IR with:
 * - RESOLVES_TO edges from Import -> Symbol for named/default/namespace imports
 * - CALLS edges from CallSite -> Symbol for resolved call expressions (best-effort)
 *
 * It is designed to be safe:
 * - If TypeScript is unavailable, it no-ops.
 * - If a symbol cannot be mapped into our graph, it falls back to creating a minimal Symbol node.
 */
type Ts = any;

// Cache to avoid rebuilding a TypeScript Program repeatedly for the same repo within a process.
// This is most helpful for full indexing or when multiple enrichment passes are added later.
type TsProgramContext = {
  repoRoot: string;
  tsconfigPath: string | null;
  compilerOptionsSig: string;
  program: any;
  checker: any;
};

const programCache = new Map<string, TsProgramContext>();

function sha1(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex");
}

function findTsConfig(repoRoot: string): string | null {
  const p = path.join(repoRoot, "tsconfig.json");
  return fs.existsSync(p) ? p : null;
}

function toPosixRel(repoRoot: string, absFile: string): string | null {
  const rel = path.relative(repoRoot, absFile);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join("/");
}

function isTsJsRel(rel: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(rel);
}

function kindFromDeclaration(ts: Ts, decl: any): string {
  if (!decl) return "function";
  switch (decl.kind) {
    case ts.SyntaxKind.ClassDeclaration:
    case ts.SyntaxKind.ClassExpression:
      return "class";
    case ts.SyntaxKind.InterfaceDeclaration:
      return "interface";
    case ts.SyntaxKind.MethodDeclaration:
    case ts.SyntaxKind.MethodSignature:
      return "method";
    case ts.SyntaxKind.FunctionDeclaration:
    case ts.SyntaxKind.FunctionExpression:
    case ts.SyntaxKind.ArrowFunction:
      return "function";
    case ts.SyntaxKind.ModuleDeclaration:
      return "module";
    default:
      return "function";
  }
}

function nodeHasId(nodes: IRNode[], id: string): boolean {
  return nodes.some((n) => n.id === id);
}

function findExistingSymbolId(params: {
  nodes: IRNode[];
  repoId: string;
  fileRelPath: string;
  kind: string;
  name: string;
  startLine: number;
  startCol: number;
}): string | null {
  const { nodes, repoId, fileRelPath, kind, name, startLine, startCol } = params;

  for (const n of nodes) {
    if (n.kind !== "Symbol") continue;
    if (n.repoId !== repoId) continue;
    const p: any = n.props ?? {};
    if (p.fileRelPath !== fileRelPath && p.fileRelPath !== fileRelPath) continue;
    if (p.kind && p.kind !== kind) continue;

    const nName = p.qname ?? p.name;
    if (nName !== name) continue;

    const r = p.range ?? {};
    const sLine = r.startLine ?? 0;
    const sCol = r.startCol ?? 0;

    // Allow tiny drift due to parser differences
    if (sLine === startLine && Math.abs(sCol - startCol) <= 2) return n.id;
  }

  return null;
}


function ensureSymbolNode(params: {
  ts: Ts;
  repoId: string;
  repoRoot: string;
  absDeclFile: string;
  decl: any;
  name: string;
  nodes: IRNode[];
  edges: IREdge[];
}) {
  const { ts, repoId, repoRoot, absDeclFile, decl, name, nodes, edges } = params;
  const rel = toPosixRel(repoRoot, absDeclFile);
  if (!rel) return null;

  const sf = decl.getSourceFile ? decl.getSourceFile() : null;
  const pos = sf ? sf.getLineAndCharacterOfPosition(decl.getStart(sf, false)) : { line: 0, character: 0 };
  const startLine = (pos.line ?? 0) + 1;
  const startCol = (pos.character ?? 0) + 1;
  const kind = kindFromDeclaration(ts, decl);
  const qname = name;
  const sid = symbolId(repoId, rel, kind, qname, startLine, startCol);

  // Prefer reusing an existing extracted Symbol node if it matches.
  const existing = findExistingSymbolId({ nodes, repoId, fileRelPath: rel, kind, name: qname, startLine, startCol });
  if (existing) return existing;

  if (!nodeHasId(nodes, sid)) {
    nodes.push({
      id: sid,
      kind: "Symbol",
      repoId,
      props: {
        repoId,
        fileRelPath: rel,
        kind,
        name,
        qname,
        range: { startLine, startCol, endLine: startLine, endCol: startCol },
        inferred: true,
      },
    });
    // Ensure file node exists in graph (it should, but keep safe).
    const fid = fileId(repoId, rel);
    edges.push({ id: edgeId(repoId, "DECLARES", fid, sid), type: "DECLARES", from: fid, to: sid, repoId, props: { inferred: true } });
  }

  return sid;
}

export function enrichIrWithTsProgram(opts: {
  scan: ScanResult;
  repoId: string;
  nodes: IRNode[];
  edges: IREdge[];
  /**
   * Optional list of repo-relative (posix) files to enrich.
   * When provided, we will:
   * 1) build the TS Program with these as roots (TypeScript will still pull imports), and
   * 2) only walk/enrich these files.
   */
  onlyFiles?: string[];
}) {
  const { scan, repoId, nodes, edges, onlyFiles } = opts;
  const require = createRequire(import.meta.url);
  let ts: Ts;
  try {
    ts = require("typescript") as Ts;
  } catch {
    return; // no-op if typescript not installed
  }

  const repoRoot = path.resolve(scan.repoRoot);
  const tsconfigPath = findTsConfig(repoRoot);

  let basePath = repoRoot;
  let compilerOptions: any = {
    allowJs: true,
    checkJs: false,
    jsx: ts.JsxEmit.Preserve,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
    resolveJsonModule: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true,
    noEmit: true,
  };

  // If we have tsconfig, we can optionally use its resolved file list as program roots.
  // This tends to improve resolution for path mappings and project references.
  let parsedFileNames: string[] | null = null;

  if (tsconfigPath) {
    try {
      basePath = path.dirname(tsconfigPath);
      const cfg = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
      if (!cfg.error) {
        const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, basePath);
        compilerOptions = { ...compilerOptions, ...(parsed.options ?? {}) };
        parsedFileNames = Array.isArray(parsed.fileNames) ? parsed.fileNames : null;
      }
    } catch {
      // ignore
    }
  }

  // Signature for cache validation (options may change with tsconfig).
  const compilerOptionsSig = sha1(JSON.stringify(compilerOptions));

  const onlySet = Array.isArray(onlyFiles) && onlyFiles.length > 0
    ? new Set(onlyFiles.map((p) => normalizePath(p)))
    : null;

  // Root files:
  // - If onlyFiles is provided, use them as roots (TypeScript will still include their imports).
  // - Otherwise, include all TS/JS inside the scanned repo.
  const rootNames: string[] = [];
  if (onlySet) {
    for (const rel of onlySet) {
      if (!isTsJsRel(rel)) continue;
      const abs = path.join(repoRoot, rel);
      if (fs.existsSync(abs)) rootNames.push(abs);
    }
  } else {
    // Prefer tsconfig-derived file list when available; otherwise fall back to scan list.
    if (parsedFileNames && parsedFileNames.length > 0) {
      for (const abs of parsedFileNames) {
        const rel = toPosixRel(repoRoot, abs);
        if (!rel) continue;
        const norm = normalizePath(rel);
        if (!isTsJsRel(norm)) continue;
        if (fs.existsSync(abs)) rootNames.push(abs);
      }
    } else {
      for (const e of scan.entries) {
        const rel = normalizePath(e.relPath);
        if (!isTsJsRel(rel)) continue;
        const abs = path.join(repoRoot, rel);
        // Only include existing files (scan might include deleted if stale).
        if (fs.existsSync(abs)) rootNames.push(abs);
      }
    }
  }
  if (rootNames.length === 0) return;

  // Build (or reuse) a TS Program.
  // - If onlyFiles is provided, we skip caching to avoid uncontrolled growth.
  // - Otherwise we reuse a cached program for this repo/config/options.
  const cacheKey = !onlySet
    ? `${repoRoot}::${tsconfigPath ?? ""}::${compilerOptionsSig}`
    : null;

  let program: any;
  let checker: any;

  if (cacheKey && programCache.has(cacheKey)) {
    const ctx = programCache.get(cacheKey)!;
    program = ctx.program;
    checker = ctx.checker;
  } else {
    const host = ts.createCompilerHost(compilerOptions, true);
    program = ts.createProgram({ rootNames, options: compilerOptions, host });
    checker = program.getTypeChecker();
    if (cacheKey) {
      programCache.set(cacheKey, { repoRoot, tsconfigPath, compilerOptionsSig, program, checker });
    }
  }

  // Helpers for mapping import nodes & callsite nodes
  const getRange = (sf: any, node: any) => {
    const s = sf.getLineAndCharacterOfPosition(node.getStart(sf, false));
    const e = sf.getLineAndCharacterOfPosition(node.getEnd());
    return { startLine: s.line + 1, startCol: s.character + 1, endLine: e.line + 1, endCol: e.character + 1 };
  };

  const ensureImportNode = (fileRel: string, raw: string, kind: string, range: any) => {
    const iid = importId(repoId, fileRel, raw, kind, range?.startLine ?? 0, range?.startCol ?? 0);
    if (!nodeHasId(nodes, iid)) {
      nodes.push({
        id: iid,
        kind: "Import",
        repoId,
        props: { repoId, raw, normalized: raw, fileRelPath: fileRel, kind, range },
      });
      const fid = fileId(repoId, fileRel);
      edges.push({ id: edgeId(repoId, "IMPORTS_RAW", fid, iid), type: "IMPORTS_RAW", from: fid, to: iid, repoId });
    }
    return iid;
  };

  const ensureCallSiteNode = (fileRel: string, calleeText: string, range: any) => {
    const cid = callsiteId(repoId, fileRel, calleeText, range?.startLine ?? 0, range?.startCol ?? 0);
    if (!nodeHasId(nodes, cid)) {
      nodes.push({ id: cid, kind: "CallSite", repoId, props: { repoId, fileRelPath: fileRel, calleeText, range } });
      const fid = fileId(repoId, fileRel);
      edges.push({ id: edgeId(repoId, "CONTAINS", fid, cid), type: "CONTAINS", from: fid, to: cid, repoId });
    }
    return cid;
  };

  // Walk each source file and enrich edges.
  for (const sf of program.getSourceFiles()) {
    const abs = sf.fileName;
    const rel = toPosixRel(repoRoot, abs);
    if (!rel) continue;
    if (!isTsJsRel(rel)) continue;
    if (onlySet && !onlySet.has(normalizePath(rel))) continue;
    if (onlySet && !onlySet.has(rel)) continue;

    const visit = (node: any) => {
      // Imports: link imported identifiers to their resolved declarations.
      if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const raw = node.moduleSpecifier.text;
        const range = getRange(sf, node.moduleSpecifier);
        const iid = ensureImportNode(rel, raw, "static", range);

        const importClause = node.importClause;
        if (importClause) {
          // Default import: import X from "m";
          if (importClause.name) {
            const sym = checker.getSymbolAtLocation(importClause.name);
            if (sym) {
              const aliased = (sym.flags & ts.SymbolFlags.Alias) ? checker.getAliasedSymbol(sym) : sym;
              const decl = aliased?.declarations?.[0];
              if (decl) {
                const sid = ensureSymbolNode({ ts, repoId, repoRoot, absDeclFile: decl.getSourceFile().fileName, decl, name: aliased.getName(), nodes, edges });
                if (sid) {
                  edges.push({
                    id: edgeId(repoId, "RESOLVES_TO", iid, sid),
                    type: "RESOLVES_TO",
                    from: iid,
                    to: sid,
                    repoId,
                    props: { resolver: "tsProgram", kind: "importedDefault", confidence: 0.9 },
                  });
                }
              }
            }
          }

          // Named / namespace imports
          const nb = importClause.namedBindings;
          if (nb && ts.isNamespaceImport(nb)) {
            const sym = checker.getSymbolAtLocation(nb.name);
            if (sym) {
              const aliased = (sym.flags & ts.SymbolFlags.Alias) ? checker.getAliasedSymbol(sym) : sym;
              const decl = aliased?.declarations?.[0];
              if (decl) {
                const sid = ensureSymbolNode({ ts, repoId, repoRoot, absDeclFile: decl.getSourceFile().fileName, decl, name: aliased.getName(), nodes, edges });
                if (sid) {
                  edges.push({
                    id: edgeId(repoId, "RESOLVES_TO", iid, sid),
                    type: "RESOLVES_TO",
                    from: iid,
                    to: sid,
                    repoId,
                    props: { resolver: "tsProgram", kind: "importedNamespace", confidence: 0.85 },
                  });
                }
              }
            }
          } else if (nb && ts.isNamedImports(nb)) {
            for (const spec of nb.elements) {
              const local = spec.name;
              const sym = checker.getSymbolAtLocation(local);
              if (!sym) continue;
              const aliased = (sym.flags & ts.SymbolFlags.Alias) ? checker.getAliasedSymbol(sym) : sym;
              const decl = aliased?.declarations?.[0];
              if (!decl) continue;
              const sid = ensureSymbolNode({ ts, repoId, repoRoot, absDeclFile: decl.getSourceFile().fileName, decl, name: aliased.getName(), nodes, edges });
              if (!sid) continue;
              edges.push({
                id: edgeId(repoId, "RESOLVES_TO", iid, sid),
                type: "RESOLVES_TO",
                from: iid,
                to: sid,
                repoId,
                props: { resolver: "tsProgram", kind: "importedNamed", importedAs: local.text, confidence: 0.9 },
              });
            }
          }
        }
      }

      // Calls: resolve call expression to a declaration symbol and link.
      if (ts.isCallExpression(node)) {
        const expr = node.expression;
        const calleeText = expr.getText(sf);
        const range = getRange(sf, expr);
        const cid = ensureCallSiteNode(rel, calleeText, range);

        const sym = checker.getSymbolAtLocation(expr);
        if (sym) {
          const aliased = (sym.flags & ts.SymbolFlags.Alias) ? checker.getAliasedSymbol(sym) : sym;
          const decl = aliased?.declarations?.[0];
          if (decl) {
            const sid = ensureSymbolNode({ ts, repoId, repoRoot, absDeclFile: decl.getSourceFile().fileName, decl, name: aliased.getName(), nodes, edges });
            if (sid) {
              edges.push({
                id: edgeId(repoId, "CALLS", cid, sid),
                type: "CALLS",
                from: cid,
                to: sid,
                repoId,
                props: { resolver: "tsProgram", confidence: 0.9 },
              });
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sf, visit);
  }
}
