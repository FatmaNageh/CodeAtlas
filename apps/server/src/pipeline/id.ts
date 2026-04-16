import crypto from "crypto";
import path from "path";
import { CHUNK_VERSION, type AstUnitKind, type GraphRelationType, type NormalizedKind } from "../types/graphProperties";

export function sha1(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex");
}


export function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/");
}


export function normalizeRepoRelativePath(relPath: string): string {
  const normalized = normalizePath(relPath)
    .replace(/^\.\//, "")
    .replace(/\/$/, "");
  return normalized || ".";
}


export function normalizeAbsolutePath(absPath: string): string {
  return normalizePath(path.resolve(absPath));
}


export function repoIdentityKey(repoRoot: string): string {
  return `repo|${normalizeAbsolutePath(repoRoot)}`;
}

export function directoryIdentityKey(repoId: string, relPath: string): string {
  return `directory|${repoId}|${normalizeRepoRelativePath(relPath)}`;
}

export function codeFileIdentityKey(repoId: string, relPath: string): string {
  return `codefile|${repoId}|${normalizeRepoRelativePath(relPath)}`;
}

export function textFileIdentityKey(repoId: string, relPath: string): string {
  return `textfile|${repoId}|${normalizeRepoRelativePath(relPath)}`;
}

export function textChunkIdentityKey(
  repoId: string,
  fileRelPath: string,
  chunkIndex: number,
  chunkVersion: string = CHUNK_VERSION,
): string {
  return `textchunk|${repoId}|${normalizeRepoRelativePath(fileRelPath)}|${chunkIndex}|${chunkVersion}`;
}

export function astNodeIdentityKey(
  repoId: string,
  fileRelPath: string,
  normalizedKind: NormalizedKind,
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
): string {
  return [
    "ast",
    repoId,
    normalizeRepoRelativePath(fileRelPath),
    normalizedKind,
    `${startLine}:${startColumn}-${endLine}:${endColumn}`,
  ].join("|");
}

export function astSegmentIdentityKey(
  repoId: string,
  fileRelPath: string,
  unitKind: AstUnitKind,
  segmentIndex: number,
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
): string {
  return [
    "ast-segment",
    repoId,
    normalizeRepoRelativePath(fileRelPath),
    unitKind,
    segmentIndex,
    `${startLine}:${startColumn}-${endLine}:${endColumn}`,
  ].join("|");
}

export function relationKey(
  type: GraphRelationType,
  from: string,
  to: string,
  sourceFilePath?: string,
): string {
  const ownerSuffix = sourceFilePath
    ? `|${normalizeRepoRelativePath(sourceFilePath)}`
    : "";
  return `${type}|${from}|${to}${ownerSuffix}`;
}


export function stableIdFromIdentityKey(identityKey: string): string {
  return sha1(identityKey);
}


export function repoIdFromPath(repoRoot: string): string {
  return stableIdFromIdentityKey(repoIdentityKey(repoRoot)).slice(0, 12);
}


export function repoNodeId(repoRoot: string): string {
  return stableIdFromIdentityKey(repoIdentityKey(repoRoot));
}

export function dirNodeId(repoId: string, relPath: string): string {
  return stableIdFromIdentityKey(directoryIdentityKey(repoId, relPath));
}

export function codeFileNodeId(repoId: string, relPath: string): string {
  return stableIdFromIdentityKey(codeFileIdentityKey(repoId, relPath));
}

export function textFileNodeId(repoId: string, relPath: string): string {
  return stableIdFromIdentityKey(textFileIdentityKey(repoId, relPath));
}

export function textChunkNodeId(
  repoId: string,
  fileRelPath: string,
  chunkIndex: number,
  chunkVersion: string = CHUNK_VERSION,
): string {
  return stableIdFromIdentityKey(
    textChunkIdentityKey(repoId, fileRelPath, chunkIndex, chunkVersion),
  );
}

export function astNodeId(
  repoId: string,
  fileRelPath: string,
  normalizedKind: NormalizedKind,
  startLine = 0,
  startColumn = 0,
  endLine = 0,
  endColumn = 0,
): string {
  return stableIdFromIdentityKey(
    astNodeIdentityKey(
      repoId,
      fileRelPath,
      normalizedKind,
      startLine,
      startColumn,
      endLine,
      endColumn,
    ),
  );
}

export function fileRootAstNodeId(repoId: string, fileRelPath: string): string {
  return astNodeId(repoId, fileRelPath, "module", 0, 0, 0, 0);
}

export function astSegmentId(
  repoId: string,
  fileRelPath: string,
  unitKind: AstUnitKind,
  segmentIndex: number,
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
): string {
  return stableIdFromIdentityKey(
    astSegmentIdentityKey(
      repoId,
      fileRelPath,
      unitKind,
      segmentIndex,
      startLine,
      startColumn,
      endLine,
      endColumn,
    ),
  );
}


export function edgeKey(
  type: GraphRelationType,
  from: string,
  to: string,
  sourceFilePath?: string,
): string {
  return relationKey(type, from, to, sourceFilePath);
}
