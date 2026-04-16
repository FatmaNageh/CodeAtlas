export type SupportedLanguage =
  | "c"
  | "csharp"
  | "cpp"
  | "go"
  | "java"
  | "javascript"
  | "kotlin"
  | "php"
  | "python"
  | "ruby"
  | "rust"
  | "swift"
  | "typescript";

export type TextKind = "markdown" | "plaintext" | "rst" | "adoc" | "latex";

export type CodeFileIndexEntry = {
  kind: "code";
  relPath: string;
  absPath: string;
  language: SupportedLanguage;
  ext: string;
  size: number;
  mtimeMs: number;
  hash?: string;
};

export type TextFileIndexEntry = {
  kind: "text";
  relPath: string;
  absPath: string;
  ext: string;
  size: number;
  mtimeMs: number;
  hash?: string;
  textKind: TextKind;
};

export type FileIndexEntry = CodeFileIndexEntry | TextFileIndexEntry;

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
