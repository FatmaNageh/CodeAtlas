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
  normalizePath,
  astNodeId,
  fileRootAstNodeId,
  txtChunkId,
} from "./id";
import { createTsModuleResolver } from "./tsResolve";
import { enrichIrWithTsProgram } from "./tsProgramEnrich";

type ASTNodeRecord = {
  id: string;
  fileRelPath: string;
  name: string;
  qname: string;
  nodeType: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
};

type PendingTextFile = {
  fileId: string;
  relPath: string;
  facts: TextFacts;
};

function isCode(e: FileIndexEntry): e is CodeFileIndexEntry {
  return e.kind === "code";
}

function isText(e: FileIndexEntry): e is TextFileIndexEntry {
  return e.kind === "text";
}

function cleanQuotes(s: string): string {
  return s.replace(/^[`'"(]+/, "").replace(/[)`'";]+$/, "").trim();
}

function normalizeImportRaw(language: string, raw: string): string {
  const t = raw.trim();
  if (language === "python") {
    // e.g. "import a.b as c" or "from a.b import x"
    const m1 = t.match(/^import\s+([^\s]+)(?:\s+as\s+\w+)?/);
    const pythonImport = m1?.[1];
    if (pythonImport) return pythonImport;
    const m2 = t.match(/^from\s+([^\s]+)\s+import\s+/);
    const pythonFromImport = m2?.[1];
    if (pythonFromImport) return pythonFromImport;
  }
  if (language === "java") {
    // e.g. "import foo.bar.Baz;"
    const m = t.match(/^import\s+([^;]+);?/);
    const javaImport = m?.[1];
    if (javaImport) return javaImport;
  }
  if (language === "go") {
    // e.g. import "fmt" or import (
    // "fmt"
    // )
    const m = t.match(/"([^"]+)"/);
    const goImport = m?.[1];
    if (goImport) return goImport;
  }
  if (language === "cpp") {
    const m = t.match(/#\s*include\s*[<"]([^>"]+)[>"]/);
    const cppImport = m?.[1];
    if (cppImport) return cppImport;
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
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  const addNode = (node: IRNode) => {
    if (nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(node);
  };

  const addEdge = (edge: IREdge) => {
    if (edgeIds.has(edge.id)) return;
    edgeIds.add(edge.id);
    edges.push(edge);
  };

  const astNodesByFile = new Map<string, Map<string, ASTNodeRecord>>();
  const astNodesByFileName = new Map<string, Map<string, ASTNodeRecord[]>>();
  const astNodesByName = new Map<string, ASTNodeRecord[]>();
  const astNodesByQname = new Map<string, ASTNodeRecord[]>();
  const filesWithAstRoot = new Set<string>();
  const pendingTextFiles: PendingTextFile[] = [];
  const repoNode: IRNode = {
    id: repoNodeId(repoId),
    kind: "RepoRoot",
    repoId,
    props: {
      repoId,
      rootPath: normalizePath(repoRoot),
      name: path.basename(repoRoot),
      level: 0,
    },
  };
  addNode(repoNode);

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

    addNode({
      id,
      kind: "Directory",
      repoId,
      props: { repoId, relPath: relDir === "" ? "." : relDir, name },
    });

    const from = relDir === "" ? repoNode.id : dirId(repoId, relDir.split("/").slice(0, -1).join("/"));
    addEdge({ id: edgeId(repoId, "CONTAINS", from, id), type: "CONTAINS", from, to: id, repoId });
  }

  // 1) Create Directory/File nodes + CONTAINS edges. Also create file-derived nodes for processed files.
  for (const e of scan.entries) {
    const rel = normalizePath(e.relPath);
    const fId = fileId(repoId, rel);

    if (isCode(e)) {
      addNode({
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
      addNode({
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
    const containerId = parentRel === "" ? repoNode.id : dirId(repoId, parentRel);
    addEdge({ id: edgeId(repoId, "CONTAINS", containerId, fId), type: "CONTAINS", from: containerId, to: fId, repoId });

    const fFacts: FileFacts | undefined = facts[rel];
    if (!fFacts) continue;

    if (fFacts.kind === "code") {
      const cf = fFacts as CodeFacts;
      const fileRootId = fileRootAstNodeId(repoId, rel);
      addNode({
        id: fileRootId,
        kind: "ASTNode",
        repoId,
        props: {
          repoId,
          fileRelPath: rel,
          name: path.posix.basename(rel),
          qname: rel,
          nodeType: "file_root",
          startLine: 1,
          startCol: 1,
          endLine: cf.lineCount ?? 1,
          endCol: 1,
          isRoot: true,
        },
      });
      addEdge({ id: edgeId(repoId, "HAS_AST_ROOT", fId, fileRootId), type: "HAS_AST_ROOT", from: fId, to: fileRootId, repoId });
      filesWithAstRoot.add(rel);

      const astMap = new Map<string, ASTNodeRecord>();
      const nameMap = new Map<string, ASTNodeRecord[]>();
      for (const s of cf.symbols) {
        const qname = s.qname ?? s.name;
        const astId = astNodeId(repoId, rel, s.kind, qname, s.range?.startLine ?? 0, s.range?.startCol ?? 0);
        const record: ASTNodeRecord = {
          id: astId,
          fileRelPath: rel,
          name: s.name,
          qname,
          nodeType: s.kind,
          startLine: s.range?.startLine ?? 0,
          startCol: s.range?.startCol ?? 0,
          endLine: s.range?.endLine ?? 0,
          endCol: s.range?.endCol ?? 0,
        };
        astMap.set(astId, record);

        const recordsForName = nameMap.get(s.name) ?? [];
        recordsForName.push(record);
        nameMap.set(s.name, recordsForName);

        const byName = astNodesByName.get(s.name) ?? [];
        byName.push(record);
        astNodesByName.set(s.name, byName);
        const byQname = astNodesByQname.get(qname) ?? [];
        byQname.push(record);
        astNodesByQname.set(qname, byQname);
        addNode({
          id: astId,
          kind: "ASTNode",
          repoId,
          props: {
            repoId,
            fileRelPath: rel,
            name: s.name,
            qname,
            nodeType: s.kind,
            parentName: s.parentName ?? null,
            extendsNames: [...(s.extendsNames ?? []), ...(s.implementsNames ?? [])],
            startLine: s.range?.startLine ?? null,
            startCol: s.range?.startCol ?? null,
            endLine: s.range?.endLine ?? null,
            endCol: s.range?.endCol ?? null,
            isRoot: false,
          },
        });
        addEdge({ id: edgeId(repoId, "DECLARES", fId, astId), type: "DECLARES", from: fId, to: astId, repoId });
      }
      astNodesByFile.set(rel, astMap);
      astNodesByFileName.set(rel, nameMap);

      for (const s of cf.symbols) {
        const qname = s.qname ?? s.name;
        const astId = astNodeId(repoId, rel, s.kind, qname, s.range?.startLine ?? 0, s.range?.startCol ?? 0);
        const child = astMap.get(astId);
        if (!child) continue;

        let parents: ASTNodeRecord[] = [];
        if (s.parentName) {
          // Look up parent by matching qname in nameMap
          parents = nameMap.get(s.parentName) ?? [];
        }

        if (parents.length > 0) {
          for (const parent of parents) {
            addEdge({ id: edgeId(repoId, "AST_CHILD", parent.id, child.id), type: "AST_CHILD", from: parent.id, to: child.id, repoId });
          }
        } else {
          addEdge({ id: edgeId(repoId, "AST_CHILD", fileRootId, child.id), type: "AST_CHILD", from: fileRootId, to: child.id, repoId });
        }
      }
    } else {
      const tf = fFacts as TextFacts;
      pendingTextFiles.push({ fileId: fId, relPath: rel, facts: tf });
      let previousChunkId: string | null = null;
      for (const chunk of tf.chunks) {
        const chunkId = txtChunkId(repoId, rel, chunk.index, chunk.startLine, chunk.endLine);
        addNode({
          id: chunkId,
          kind: "TXTChunk",
          repoId,
          props: {
            repoId,
            fileRelPath: rel,
            index: chunk.index,
            text: chunk.text,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
          },
        });
        addEdge({ id: edgeId(repoId, "HAS_CHUNK", fId, chunkId), type: "HAS_CHUNK", from: fId, to: chunkId, repoId });
        if (previousChunkId) {
          addEdge({ id: edgeId(repoId, "NEXT_CHUNK", previousChunkId, chunkId), type: "NEXT_CHUNK", from: previousChunkId, to: chunkId, repoId });
        }
        previousChunkId = chunkId;
      }

      for (const ref of tf.references ?? []) {
        const targetRel = resolveDocPath(filesByRel, rel, ref.raw);
        if (targetRel) {
          const toId = fileId(repoId, targetRel);
          addEdge({ id: edgeId(repoId, "REFERENCES", fId, toId), type: "REFERENCES", from: fId, to: toId, repoId, props: { raw: ref.raw, confidence: 0.7 } });
        }
      }
    }
  }

  // 2) Resolve code file references and local inheritance.
  for (const e of scan.entries) {
    if (!isCode(e)) continue;
    const rel = normalizePath(e.relPath);
    const fFacts = facts[rel];
    if (!fFacts || fFacts.kind !== "code") continue;
    const cf = fFacts as CodeFacts;
    const fId = fileId(repoId, rel);
    const astMap = astNodesByFile.get(rel);

    for (const imp of cf.imports) {
      const normalized = normalizeImportRaw(cf.language, imp.raw);
      const sourceAstRootId = fileRootAstNodeId(repoId, rel);

      const localTarget = resolveLocalImport(filesByRel, rel, normalized);
      if (localTarget) {
        const toId = fileId(repoId, localTarget);
        addEdge({ id: edgeId(repoId, "REFERENCES", fId, toId), type: "REFERENCES", from: fId, to: toId, repoId, props: { raw: imp.raw, normalized, confidence: 0.9 } });
        if (filesWithAstRoot.has(localTarget)) {
          addEdge({
            id: edgeId(repoId, "IMPORTS", sourceAstRootId, fileRootAstNodeId(repoId, localTarget)),
            type: "IMPORTS",
            from: sourceAstRootId,
            to: fileRootAstNodeId(repoId, localTarget),
            repoId,
            props: { raw: imp.raw, normalized, confidence: 0.75 },
          });
        }
      } else {
        const tsTarget =
          (cf.language === "javascript" || cf.language === "typescript") && tsResolver
            ? tsResolver.resolveModuleToRelPath(normalized, rel)
            : null;

        if (tsTarget) {
          const toId = fileId(repoId, tsTarget);
          addEdge({
            id: edgeId(repoId, "REFERENCES", fId, toId),
            type: "REFERENCES",
            from: fId,
            to: toId,
            repoId,
            props: { raw: imp.raw, normalized, resolver: "typescript", confidence: 0.85 },
          });
          if (filesWithAstRoot.has(tsTarget)) {
            addEdge({
              id: edgeId(repoId, "IMPORTS", sourceAstRootId, fileRootAstNodeId(repoId, tsTarget)),
              type: "IMPORTS",
              from: sourceAstRootId,
              to: fileRootAstNodeId(repoId, tsTarget),
              repoId,
              props: { raw: imp.raw, normalized, resolver: "typescript", confidence: 0.75 },
            });
          }
        }
      }
    }

    if (!astMap) continue;
    for (const s of cf.symbols) {
      const qname = s.qname ?? s.name;
      const astId = astNodeId(repoId, rel, s.kind, qname, s.range?.startLine ?? 0, s.range?.startCol ?? 0);
      const from = astMap.get(astId);
      if (!from) continue;
      for (const base of [...(s.extendsNames ?? []), ...(s.implementsNames ?? [])]) {
        const baseName = cleanQuotes(base);
        if (!baseName) continue;
        for (const target of astNodesByName.get(baseName) ?? []) {
          addEdge({ id: edgeId(repoId, "EXTENDS", from.id, target.id), type: "EXTENDS", from: from.id, to: target.id, repoId, props: { confidence: 0.6 } });
        }
      }
    }

    for (const s of cf.symbols) {
      if (s.kind !== "method" || !s.parentName) continue;
      const qname = s.qname ?? s.name;
      const astId = astNodeId(repoId, rel, s.kind, qname, s.range?.startLine ?? 0, s.range?.startCol ?? 0);
      const from = astMap.get(astId);
      if (!from) continue;
      const parentSymbol = cf.symbols.find((candidate) => (candidate.qname ?? candidate.name) === s.parentName);
      if (!parentSymbol) continue;
      const baseNames = [...(parentSymbol.extendsNames ?? []), ...(parentSymbol.implementsNames ?? [])];
      for (const baseName of baseNames) {
        const normalizedBaseName = cleanQuotes(baseName);
        if (!normalizedBaseName) continue;
        for (const target of astNodesByQname.get(`${normalizedBaseName}.${s.name}`) ?? []) {
          addEdge({
            id: edgeId(repoId, "OVERRIDES", from.id, target.id),
            type: "OVERRIDES",
            from: from.id,
            to: target.id,
            repoId,
            props: { confidence: 0.6 },
          });
        }
      }
    }
  }

  for (const pending of pendingTextFiles) {
    for (const mention of pending.facts.symbolMentions ?? []) {
      for (const target of astNodesByName.get(mention.name) ?? []) {
        addEdge({
          id: edgeId(repoId, "MENTIONS", pending.fileId, target.id),
          type: "MENTIONS",
          from: pending.fileId,
          to: target.id,
          repoId,
          props: { name: mention.name, confidence: 0.5 },
        });
      }
    }

    for (const chunk of pending.facts.chunks) {
      const chunkId = txtChunkId(repoId, pending.relPath, chunk.index, chunk.startLine, chunk.endLine);
      for (const mention of pending.facts.symbolMentions) {
        if (!chunk.text.includes(mention.name)) continue;
        for (const target of astNodesByName.get(mention.name) ?? []) {
          addEdge({
            id: edgeId(repoId, "DESCRIBES", chunkId, target.id),
            type: "DESCRIBES",
            from: chunkId,
            to: target.id,
            repoId,
            props: { name: mention.name, confidence: 0.4 },
          });
        }
      }
    }
  }

  const tsJsProcessed = Object.keys(facts)
    .map((filePath) => filePath.replace(/\\/g, "/"))
    .filter((filePath) => /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(filePath));
  enrichIrWithTsProgram({
    scan,
    repoId,
    nodes,
    edges,
    onlyFiles: tsJsProcessed,
  });

  return {
    repoId,
    nodes,
    edges,
    stats: {
      files: scan.entries.length,
      dirs: dirSet.size,
      astNodes: nodes.filter((node) => node.kind === "ASTNode").length,
      textChunks: nodes.filter((node) => node.kind === "TXTChunk").length,
      references: edges.filter((edge) => edge.type === "REFERENCES").length,
    },
  };
}