export type SupportedLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "java"
  | "cpp"
  | "go"
  | "ruby";

export type FileIndexEntry = {
  relPath: string;
  absPath: string;
  language: SupportedLanguage;
  ext: string;
  size: number;
  mtimeMs: number;
  hash?: string;
};

export type ScanResult = {
  repoRoot: string;
  entries: FileIndexEntry[];
  ignoredCount: number;
  scannedAt: string;
};

export type ScanDiff = {
  added: FileIndexEntry[];
  changed: FileIndexEntry[];
  removed: { relPath: string }[];
  unchanged: FileIndexEntry[];
};

export type IndexMode = "full" | "incremental";
