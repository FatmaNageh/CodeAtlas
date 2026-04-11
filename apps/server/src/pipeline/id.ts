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

export function astNodeId(
  repoId: string,
  fileRelPath: string,
  nodeType: string,
  qname: string,
  startLine = 0,
  startCol = 0,
): string {
  return `ast:${sha1(`${repoId}|${normalizePath(fileRelPath)}|${nodeType}|${qname}|${startLine}:${startCol}`)}`;
}

export function fileRootAstNodeId(repoId: string, fileRelPath: string): string {
  return astNodeId(repoId, fileRelPath, "file_root", normalizePath(fileRelPath), 0, 0);
}

export function textChunkId(
  repoId: string,
  fileRelPath: string,
  chunkIndex: number,
  startLine = 1,
  endLine = 1,
): string {
  return `textchunk:${sha1(`${repoId}|${normalizePath(fileRelPath)}|${chunkIndex}|${startLine}:${endLine}`)}`;
}

export function edgeId(repoId: string, type: string, from: string, to: string): string {
  return `edge:${sha1(`${repoId}|${type}|${from}|${to}`)}`;
}
