import fs from "fs/promises";
import path from "path";
import type { ScanResult, ScanDiff, ScanHashMode } from "@/types/scan";
import { normalizePath } from "./id";

export type { ScanResult } from "@/types/scan";

export type IndexStateFileMeta = {
  kind: "code" | "text";
  mtimeMs: number;
  size: number;
  hash?: string;
};

export type IndexState = {
  version: 1 | 2;
  repoRoot: string;
  scannedAt: string;
  scanHashMode?: ScanHashMode;
  files: Record<string, IndexStateFileMeta>;
};

const STATE_DIR = ".codeatlas";
const STATE_FILE = "index-state.json";

function isValidHashMode(value: unknown): value is ScanHashMode {
  return value === "none" || value === "code" || value === "all";
}

export async function loadIndexState(repoRoot: string): Promise<IndexState | null> {
  const p = path.join(repoRoot, STATE_DIR, STATE_FILE);
  const txt = await fs.readFile(p, "utf-8").catch(() => null);
  if (!txt) return null;

  try {
    const obj = JSON.parse(txt) as Partial<IndexState> | null;
    if (!obj || (obj.version !== 1 && obj.version !== 2)) return null;

    const scanHashMode = isValidHashMode(obj.scanHashMode) ? obj.scanHashMode : undefined;
    return {
      version: obj.version,
      repoRoot: typeof obj.repoRoot === "string" ? obj.repoRoot : repoRoot,
      scannedAt: typeof obj.scannedAt === "string" ? obj.scannedAt : new Date(0).toISOString(),
      scanHashMode,
      files: typeof obj.files === "object" && obj.files ? obj.files : {},
    };
  } catch {
    return null;
  }
}

export async function saveIndexState(repoRoot: string, scan: ScanResult): Promise<IndexState> {
  const state: IndexState = {
    version: 2,
    repoRoot,
    scannedAt: scan.scannedAt,
    scanHashMode: scan.hashMode,
    files: {},
  };

  for (const e of scan.entries) {
    state.files[normalizePath(e.relPath)] = {
      kind: e.kind,
      mtimeMs: e.mtimeMs,
      size: e.size,
      hash: e.hash,
    };
  }

  const dir = path.join(repoRoot, STATE_DIR);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, STATE_FILE),
    JSON.stringify(state, null, 2),
    "utf-8",
  );

  return state;
}

export async function deleteIndexState(repoRoot: string): Promise<void> {
  const dir = path.join(repoRoot, STATE_DIR);
  await fs.rm(dir, { recursive: true, force: true });
}

function shouldCompareByHash(
  kind: IndexStateFileMeta["kind"],
  prev: IndexState,
  curr: ScanResult,
  prevHash: string | undefined,
  currHash: string | undefined,
): boolean {
  if (!prevHash || !currHash) return false;

  const prevMode = prev.scanHashMode ?? "none";
  const currMode = curr.hashMode;
  const modes = [prevMode, currMode];

  if (kind === "code") {
    return modes.every((mode) => mode === "code" || mode === "all");
  }

  return modes.every((mode) => mode === "all");
}

export function diffScan(prev: IndexState | null, curr: ScanResult): ScanDiff {
  const prevFiles = prev?.files ?? {};
  const currFiles: Record<string, IndexStateFileMeta> = {};

  for (const e of curr.entries) {
    currFiles[normalizePath(e.relPath)] = {
      kind: e.kind,
      mtimeMs: e.mtimeMs,
      size: e.size,
      hash: e.hash,
    };
  }

  const added: ScanDiff["added"] = [];
  const changed: ScanDiff["changed"] = [];
  const unchanged: ScanDiff["unchanged"] = [];
  const removed: ScanDiff["removed"] = [];

  for (const e of curr.entries) {
    const key = normalizePath(e.relPath);
    const prevMeta = prevFiles[key];

    if (!prevMeta) {
      added.push(e);
    } else {
      const sameKind = prevMeta.kind === e.kind;
      const same =
        sameKind &&
        (
          prev && shouldCompareByHash(prevMeta.kind, prev, curr, prevMeta.hash, e.hash)
            ? prevMeta.hash === e.hash
            : prevMeta.mtimeMs === e.mtimeMs && prevMeta.size === e.size
        );

      (same ? unchanged : changed).push(e);
    }
  }

  for (const key of Object.keys(prevFiles)) {
    if (!currFiles[key]) {
      removed.push({ relPath: key });
    }
  }

  return { added, changed, removed, unchanged };
}
