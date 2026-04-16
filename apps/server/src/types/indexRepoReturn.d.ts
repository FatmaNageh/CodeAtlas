export type IRStats = {
  files: number;
  dirs: number;
  astNodes: number;
  textChunks: number;
  references: number;
};

import type { FileIndexEntry } from "./scan";

export type IndexRepoReturn = {
  repoId: string;
  repoRoot: string;
  mode: "full" | "incremental";
  scanned: {
    totalFiles: number;
    ignoredCount: number;
    processedFiles: number;
    diff: {
      added: FileIndexEntry[];
      changed: FileIndexEntry[];
      removed: { relPath: string }[];
      unchanged: FileIndexEntry[];
    };
  };
  stats: IRStats;
  debugDir: string | null;
};
