import path from "path";
import type { FactsByFile, FileFacts, TextFacts, CodeFacts } from "../types/facts";
import type {
  GraphIR,
  GraphIRStats,
  IRNode,
  IREdge,
} from "../types/ir";
import type {
  ScanResult,
  FileIndexEntry,
  CodeFileIndexEntry,
  TextFileIndexEntry,
} from "../types/scan";
import { isoNow } from "../types/graphProperties";
import {
  repoIdFromPath,
  repoNodeId,
  dirNodeId,
  codeFileNodeId,
  textFileNodeId,
  textChunkNodeId,
  edgeKey,
  normalizePath,
  normalizeRepoRelativePath,
  repoIdentityKey,
  directoryIdentityKey,
  codeFileIdentityKey,
  textFileIdentityKey,
  textChunkIdentityKey,
} from "./id";
import { createTsModuleResolver } from "./tsResolve";

function isCode(entry: FileIndexEntry): entry is CodeFileIndexEntry {
  return entry.kind === "code";
}

function isText(entry: FileIndexEntry): entry is TextFileIndexEntry {
  return entry.kind === "text";
}

function cleanQuotes(value: string): string {
  return value.replace(/^[`'"(]+/, "").replace(/[)`'";]+$/, "").trim();
}

function normalizeImportRaw(language: string, raw: string): string {
  const t = raw.trim();

  if (language === "python") {
    const m1 = t.match(/^import\s+([^\s]+)(?:\s+as\s+\w+)?/);
    if (m1?.[1]) return m1[1];

    const m2 = t.match(/^from\s+([^\s]+)\s+import\s+/);
    if (m2?.[1]) return m2[1];
  }

  if (language === "java") {
    const m = t.match(/^import\s+([^;]+);?/);
    if (m?.[1]) return m[1];
  }

  if (language === "go") {
    const m = t.match(/"([^"]+)"/);
    if (m?.[1]) return m[1];
  }

  if (language === "cpp") {
    const m = t.match(/#\s*include\s*[<"]([^>"]+)[>"]/);
    if (m?.[1]) return m[1];
  }

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

  const importerDir = path.posix.dirname(normalizeRepoRelativePath(importerRel));
  const base = cleaned.startsWith("/")
    ? cleaned.slice(1)
    : path.posix.normalize(path.posix.join(importerDir, cleaned));

  if (allFilesByRel.has(base)) return base;

  const exts = [
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".py", ".java", ".go", ".rb", ".c", ".cpp", ".cc", ".cxx", ".hpp", ".h",
    ".php", ".kt", ".swift",
  ];

  for (const ext of exts) {
    if (allFilesByRel.has(base + ext)) return base + ext;
  }

  for (const ext of exts) {
    const idx = path.posix.join(base, "index" + ext);
    if (allFilesByRel.has(idx)) return idx;
  }

  return null;
}

function resolveDocPath(
  allFilesByRel: Map<string, FileIndexEntry>,
  docRel: string,
  raw: string,
): string | null {
  const cleaned = cleanQuotes(raw).replace(/^\.?\//, "");
  if (!cleaned) return null;

  if (allFilesByRel.has(cleaned)) return cleaned;

  const docDir = path.posix.dirname(normalizeRepoRelativePath(docRel));
  const joined = path.posix.normalize(path.posix.join(docDir, cleaned));
  if (allFilesByRel.has(joined)) return joined;

  return null;
}

function createStats(nodes: IRNode[], edges: IREdge[], files: number, dirs: number): GraphIRStats {
  return {
    files,
    dirs,
    textChunks: nodes.filter((n) => n.label === "TextChunk").length,
    astNodes: nodes.filter((n) => n.label === "AstNode").length,
    edges: edges.length,
  };
}

export function buildIR(scan: ScanResult, facts: FactsByFile): GraphIR {
  const now = isoNow();
  const repoRoot = scan.repoRoot;
  const repoId = repoIdFromPath(repoRoot);

  const nodes: IRNode[] = [];
  const edges: IREdge[] = [];
  const nodeIds = new Set<string>();
  const edgeKeys = new Set<string>();

  function addNode(node: IRNode): void {
    if (nodeIds.has(node.props.id)) return;
    nodeIds.add(node.props.id);
    nodes.push(node);
  }

  function addEdge(edge: IREdge): void {
    if (edgeKeys.has(edge.key)) return;
    edgeKeys.add(edge.key);
    edges.push(edge);
  }

  const repoNode: IRNode = {
    label: "Repo",
    props: {
      id: repoNodeId(repoRoot),
      identityKey: repoIdentityKey(repoRoot),
      kind: "Repo",
      repoId,
      name: path.basename(repoRoot),
      rootPath: normalizePath(repoRoot),
      createdAt: now,
      updatedAt: now,
    },
  };
  addNode(repoNode);

  const filesByRel = new Map<string, FileIndexEntry>();
  for (const entry of scan.entries) {
    filesByRel.set(normalizeRepoRelativePath(entry.relPath), entry);
  }

  const tsResolver = createTsModuleResolver(scan, filesByRel);

  const dirSet = new Set<string>();
  dirSet.add(".");

  for (const entry of scan.entries) {
    const rel = normalizeRepoRelativePath(entry.relPath);
    const parts = rel.split("/");
    for (let i = 0; i < parts.length - 1; i++) {
      dirSet.add(parts.slice(0, i + 1).join("/"));
    }
  }

  for (const relDir of Array.from(dirSet)) {
    if (relDir === ".") continue;

    const id = dirNodeId(repoId, relDir);
    const parentRel = relDir.includes("/") ? relDir.split("/").slice(0, -1).join("/") : ".";
    const parentId = parentRel === "." ? repoNode.props.id : dirNodeId(repoId, parentRel);

    addNode({
      label: "Directory",
      props: {
        id,
        identityKey: directoryIdentityKey(repoId, relDir),
        kind: "Directory",
        repoId,
        path: relDir,
        name: path.posix.basename(relDir),
        parentPath: parentRel,
        createdAt: now,
        updatedAt: now,
      },
    });

    addEdge({
      key: edgeKey("CONTAINS", parentId, id),
      type: "CONTAINS",
      from: parentId,
      to: id,
      props: { repoId },
    });
  }

  for (const entry of scan.entries) {
    const rel = normalizeRepoRelativePath(entry.relPath);
    const parentRel = rel.includes("/") ? rel.split("/").slice(0, -1).join("/") : ".";
    const containerId = parentRel === "." ? repoNode.props.id : dirNodeId(repoId, parentRel);

    if (isCode(entry)) {
      const fileNodeId = codeFileNodeId(repoId, rel);

      addNode({
        label: "CodeFile",
        props: {
          id: fileNodeId,
          identityKey: codeFileIdentityKey(repoId, rel),
          kind: "CodeFile",
          repoId,
          path: rel,
          name: path.posix.basename(rel),
          extension: entry.ext,
          language: entry.language,
          createdAt: now,
          updatedAt: now,
          sizeBytes: entry.size,
          hash: entry.hash ?? null,
          lastModifiedAt: entry.mtimeMs ? new Date(entry.mtimeMs).toISOString() : null,
        },
      });

      addEdge({
        key: edgeKey("CONTAINS", containerId, fileNodeId),
        type: "CONTAINS",
        from: containerId,
        to: fileNodeId,
        props: { repoId },
      });

      const fileFacts: FileFacts | undefined = facts[rel];
      if (!fileFacts || fileFacts.kind !== "code") continue;

      const codeFacts = fileFacts as CodeFacts;

      for (const imp of codeFacts.imports) {
        const normalized = normalizeImportRaw(codeFacts.language, imp.raw);

        const localTarget = resolveLocalImport(filesByRel, rel, normalized);
        if (localTarget) {
          const targetEntry = filesByRel.get(localTarget);
          const toId =
            targetEntry?.kind === "text"
              ? textFileNodeId(repoId, localTarget)
              : codeFileNodeId(repoId, localTarget);

          addEdge({
            key: edgeKey("REFERENCES", fileNodeId, toId, rel),
            type: "REFERENCES",
            from: fileNodeId,
            to: toId,
            props: {
              repoId,
              sourceFilePath: rel,
              extractionMethod: "heuristic",
              confidence: 0.9,
              referenceKind: "local-import",
            },
          });
          continue;
        }

        const tsTarget =
          (codeFacts.language === "javascript" || codeFacts.language === "typescript") && tsResolver
            ? tsResolver.resolveModuleToRelPath(normalized, rel)
            : null;

        if (tsTarget) {
          const targetEntry = filesByRel.get(tsTarget);
          const toId =
            targetEntry?.kind === "text"
              ? textFileNodeId(repoId, tsTarget)
              : codeFileNodeId(repoId, tsTarget);

          addEdge({
            key: edgeKey("REFERENCES", fileNodeId, toId, rel),
            type: "REFERENCES",
            from: fileNodeId,
            to: toId,
            props: {
              repoId,
              sourceFilePath: rel,
              extractionMethod: "ast+ts-enrichment",
              confidence: 0.85,
              referenceKind: "typescript-module-resolution",
            },
          });
        }
      }
    } else if (isText(entry)) {
      const fileNodeId = textFileNodeId(repoId, rel);

      addNode({
        label: "TextFile",
        props: {
          id: fileNodeId,
          identityKey: textFileIdentityKey(repoId, rel),
          kind: "TextFile",
          repoId,
          path: rel,
          name: path.posix.basename(rel),
          extension: entry.ext,
          textType: entry.textKind,
          createdAt: now,
          updatedAt: now,
          sizeBytes: entry.size,
          hash: entry.hash ?? null,
          lastModifiedAt: entry.mtimeMs ? new Date(entry.mtimeMs).toISOString() : null,
        },
      });

      addEdge({
        key: edgeKey("CONTAINS", containerId, fileNodeId),
        type: "CONTAINS",
        from: containerId,
        to: fileNodeId,
        props: { repoId },
      });

      const fileFacts: FileFacts | undefined = facts[rel];
      if (!fileFacts || fileFacts.kind !== "text") continue;

      const textFacts = fileFacts as TextFacts;
      let previousChunkId: string | null = null;

      for (const chunk of textFacts.chunks) {
        const chunkId = textChunkNodeId(repoId, rel, chunk.index, chunk.chunkVersion);

        addNode({
          label: "TextChunk",
          props: {
            id: chunkId,
            identityKey: textChunkIdentityKey(repoId, rel, chunk.index, chunk.chunkVersion),
            kind: "TextChunk",
            repoId,
            fileId: fileNodeId,
            filePath: rel,
            chunkIndex: chunk.index,
            chunkVersion: chunk.chunkVersion,
            content: chunk.text,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            createdAt: now,
            updatedAt: now,
          },
        });

        addEdge({
          key: edgeKey("HAS_CHUNK", fileNodeId, chunkId),
          type: "HAS_CHUNK",
          from: fileNodeId,
          to: chunkId,
          props: { repoId },
        });

        if (previousChunkId) {
          addEdge({
            key: edgeKey("NEXT_CHUNK", previousChunkId, chunkId),
            type: "NEXT_CHUNK",
            from: previousChunkId,
            to: chunkId,
            props: { repoId },
          });
        }

        previousChunkId = chunkId;
      }

      for (const ref of textFacts.references ?? []) {
        const targetRel = resolveDocPath(filesByRel, rel, ref.raw);
        if (!targetRel) continue;

        const targetEntry = filesByRel.get(targetRel);
        const toId =
          targetEntry?.kind === "text"
            ? textFileNodeId(repoId, targetRel)
            : codeFileNodeId(repoId, targetRel);

        addEdge({
          key: edgeKey("REFERENCES", fileNodeId, toId, rel),
          type: "REFERENCES",
          from: fileNodeId,
          to: toId,
          props: {
            repoId,
            sourceFilePath: rel,
            extractionMethod: "text",
            confidence: 0.7,
            referenceKind: "doc-path",
          },
        });
      }
    }
  }

  return {
    repoId,
    nodes,
    edges,
    stats: createStats(nodes, edges, scan.entries.length, dirSet.size),
  };
}