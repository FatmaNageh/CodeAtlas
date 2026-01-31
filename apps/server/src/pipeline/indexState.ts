import fs from "fs/promises";
import path from "path";
import type { ScanResult, ScanDiff } from "../types/scan";
import { normalizePath } from "./id";

export type IndexState = {
  version: 1;
  repoRoot: string;
  scannedAt: string;
  files: Record<string, { mtimeMs: number; size: number; hash?: string }>;
};

const STATE_DIR = ".codeatlas";
const STATE_FILE = "index-state.json";

export async function loadIndexState(repoRoot: string): Promise<IndexState | null> {
  const p = path.join(repoRoot, STATE_DIR, STATE_FILE);
  const txt = await fs.readFile(p, "utf-8").catch(() => null);
  if (!txt) return null;
  try {
    const obj = JSON.parse(txt);
    if (obj?.version !== 1) return null;
    return obj as IndexState;
  } catch {
    return null;
  }
}

export async function saveIndexState(repoRoot: string, scan: ScanResult): Promise<IndexState> {
  const state: IndexState = {
    version: 1,
    repoRoot,
    scannedAt: scan.scannedAt,
    files: {},
  };

  for (const e of scan.entries) {
    state.files[normalizePath(e.relPath)] = { mtimeMs: e.mtimeMs, size: e.size, hash: e.hash };
  }

  const dir = path.join(repoRoot, STATE_DIR);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, STATE_FILE), JSON.stringify(state, null, 2), "utf-8");
  return state;
}

export function diffScan(prev: IndexState | null, curr: ScanResult): ScanDiff {
  const prevFiles = prev?.files ?? {};
  const currFiles: Record<string, { mtimeMs: number; size: number; hash?: string }> = {};
  for (const e of curr.entries) currFiles[normalizePath(e.relPath)] = { mtimeMs: e.mtimeMs, size: e.size, hash: e.hash };

  const added = [];
  const changed = [];
  const unchanged = [];
  const removed = [];

  for (const e of curr.entries) {
    const key = normalizePath(e.relPath);
    const prevMeta = prevFiles[key];
    if (!prevMeta) {
      added.push(e);
    } else {
      const same = prevMeta.mtimeMs === e.mtimeMs && prevMeta.size === e.size && (prevMeta.hash ? prevMeta.hash === e.hash : true);
      (same ? unchanged : changed).push(e);
    }
  }

  for (const key of Object.keys(prevFiles)) {
    if (!currFiles[key]) removed.push({ relPath: key });
  }

  return { added, changed, removed, unchanged };
}
