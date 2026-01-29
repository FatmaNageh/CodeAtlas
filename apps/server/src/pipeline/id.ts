import crypto from "crypto";
import path from "path";

export function sha1(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex");
}

export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

export function repoIdFromPath(repoRoot: string): string {
  return sha1(normalizePath(path.resolve(repoRoot))).slice(0, 12);
}

export function fileId(repoId: string, relPath: string): string {
  return `file:${repoId}:${normalizePath(relPath)}`;
}

export function dirId(repoId: string, relPath: string): string {
  const rp = normalizePath(relPath).replace(/\/$/, "");
  return `dir:${repoId}:${rp || "."}`;
}

export function repoNodeId(repoId: string): string {
  return `repo:${repoId}`;
}

export function symbolId(
  repoId: string,
  fileRelPath: string,
  kind: string,
  qname: string,
  startLine = 0,
  startCol = 0,
): string {
  return `sym:${sha1(`${repoId}|${normalizePath(fileRelPath)}|${kind}|${qname}|${startLine}:${startCol}`)}`;
}

/** Deterministic Import node id (stable across runs). */
export function importId(
  repoId: string,
  fileRelPath: string,
  raw: string,
  kind: string,
  startLine = 0,
  startCol = 0,
): string {
  return `imp:${sha1(`${repoId}|${normalizePath(fileRelPath)}|${kind}|${raw}|${startLine}:${startCol}`)}`;
}

/** Deterministic CallSite node id (stable across runs). */
export function callsiteId(
  repoId: string,
  fileRelPath: string,
  calleeText: string,
  startLine = 0,
  startCol = 0,
): string {
  return `call:${sha1(`${repoId}|${normalizePath(fileRelPath)}|${calleeText}|${startLine}:${startCol}`)}`;
}

/** Deterministic DocChunk node id (stable across runs). */
export function chunkId(
  repoId: string,
  fileRelPath: string,
  chunkType: string,
  startLine = 1,
  endLine = 1,
): string {
  return `chunk:${sha1(`${repoId}|${normalizePath(fileRelPath)}|${chunkType}|${startLine}:${endLine}`)}`;
}

export function externalModuleId(repoId: string, name: string): string {
  return `extmod:${sha1(`${repoId}|${name}`)}`;
}

export function externalSymbolId(repoId: string, name: string): string {
  return `extsym:${sha1(`${repoId}|${name}`)}`;
}

export function edgeId(repoId: string, type: string, from: string, to: string): string {
  return `edge:${sha1(`${repoId}|${type}|${from}|${to}`)}`;
}
