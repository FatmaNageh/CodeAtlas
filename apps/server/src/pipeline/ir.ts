import path from "path";
import type { FactsByFile } from "../types/facts";
import type { ScanResult } from "../types/scan";
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
} from "./id";

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

  // Directories set
  const dirSet = new Set<string>();
  dirSet.add(""); // root

  // Discover directories
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
      props: {
        repoId,
        relPath: relDir === "" ? "." : relDir,
        name,
      },
    });

    if (relDir === "") {
      edges.push({
        id: edgeId(repoId, "CONTAINS", repoNode.id, id),
        type: "CONTAINS",
        from: repoNode.id,
        to: id,
        repoId,
      });
    } else {
      const parentRel = relDir.split("/").slice(0, -1).join("/");
      const parentId = dirId(repoId, parentRel);
      edges.push({
        id: edgeId(repoId, "CONTAINS", parentId, id),
        type: "CONTAINS",
        from: parentId,
        to: id,
        repoId,
      });
    }
  }

  let symbolsCount = 0;
  let callSitesCount = 0;
  let chunksCount = 0;

  for (const e of scan.entries) {
    const rel = normalizePath(e.relPath);
    const fId = fileId(repoId, rel);

    nodes.push({
      id: fId,
      kind: "File",
      repoId,
      props: {
        repoId,
        relPath: rel,
        path: normalizePath(e.absPath),
        language: e.language,
        ext: e.ext,
        size: e.size,
        mtimeMs: e.mtimeMs,
      },
    });

    const parentRel = rel.split("/").slice(0, -1).join("/");
    edges.push({
      id: edgeId(repoId, "CONTAINS", dirId(repoId, parentRel), fId),
      type: "CONTAINS",
      from: dirId(repoId, parentRel),
      to: fId,
      repoId,
    });

    const fFacts = facts[rel];
    if (!fFacts) continue;

    for (const imp of fFacts.imports) {
      const impId = importId(
        repoId,
        rel,
        imp.raw,
        imp.kind ?? "static",
        imp.range?.startLine ?? 0,
        imp.range?.startCol ?? 0,
      );
      nodes.push({
        id: impId,
        kind: "Import",
        repoId,
        props: {
          repoId,
          raw: imp.raw,
          fileRelPath: rel,
          kind: imp.kind ?? "static",
          range: imp.range ?? null,
        },
      });
      edges.push({
        id: edgeId(repoId, "IMPORTS_RAW", fId, impId),
        type: "IMPORTS_RAW",
        from: fId,
        to: impId,
        repoId,
      });
    }

    // CallSite nodes (Phase 1: keep them as facts and connect to file)
    for (const cs of fFacts.callSites ?? []) {
      callSitesCount++;
      const csId = callsiteId(
        repoId,
        rel,
        cs.calleeText,
        cs.range?.startLine ?? 0,
        cs.range?.startCol ?? 0,
      );
      nodes.push({
        id: csId,
        kind: "CallSite",
        repoId,
        props: {
          repoId,
          fileRelPath: rel,
          calleeText: cs.calleeText,
          range: cs.range ?? null,
        },
      });
      edges.push({
        id: edgeId(repoId, "CONTAINS", fId, csId),
        type: "CONTAINS",
        from: fId,
        to: csId,
        repoId,
      });
    }

    // Minimal DocChunk per file (Phase 1: a safe preview + hash + line count)
    // Full chunking strategy comes later, but this satisfies stable IDs + citations plumbing.
    const lc = fFacts.lineCount ?? 0;
    const chId = chunkId(repoId, rel, "file", 1, lc || 1);
    chunksCount++;
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
    edges.push({
      id: edgeId(repoId, "HAS_CHUNK", fId, chId),
      type: "HAS_CHUNK",
      from: fId,
      to: chId,
      repoId,
    });

    for (const s of fFacts.symbols) {
      symbolsCount++;
      const qname = s.qname ?? s.name;
      const sid = symbolId(repoId, rel, s.kind, qname, s.range?.startLine ?? 0, s.range?.startCol ?? 0);

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
          range: s.range ?? null,
        },
      });

      edges.push({
        id: edgeId(repoId, "DECLARES", fId, sid),
        type: "DECLARES",
        from: fId,
        to: sid,
        repoId,
      });
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
      importsRaw: Object.values(facts).reduce((acc, f) => acc + (f.imports?.length ?? 0), 0),
    },
  };
}
