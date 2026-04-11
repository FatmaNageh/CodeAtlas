import type { SupportedLanguage, TextKind } from "./scan";

export type ExtractionMethod = "ast" | "ast+ts-enrichment" | "heuristic" | "text" | "manual";

export type BaseNodeProps = {
  id: string;
  kind: string;
  repoId: string;
  createdAt: string;
  updatedAt: string;
};

export type RepoNodeProps = BaseNodeProps & {
  kind: "Repo";
  name: string;
  rootPath: string;
  defaultBranch?: string | null;
  lastIndexedAt?: string | null;
  commitSha?: string | null;
};

export type DirectoryNodeProps = BaseNodeProps & {
  kind: "Directory";
  path: string;
  name: string;
  parentPath: string | null;
  depth?: number;
};

export type CodeFileNodeProps = BaseNodeProps & {
  kind: "CodeFile";
  path: string;
  name: string;
  extension: string;
  language: SupportedLanguage;
  sizeBytes?: number;
  hash?: string | null;
  lastModifiedAt?: string | null;
  parseStatus?: "parsed" | "partial" | "failed";
};

export type TextFileNodeProps = BaseNodeProps & {
  kind: "TextFile";
  path: string;
  name: string;
  extension: string;
  textType?: TextKind | "unknown";
  sizeBytes?: number;
  hash?: string | null;
  lastModifiedAt?: string | null;
};

export type TextChunkNodeProps = BaseNodeProps & {
  kind: "TextChunk";
  fileId: string;
  filePath: string;
  chunkIndex: number;
  content: string;
  startOffset?: number | null;
  endOffset?: number | null;
  startLine?: number | null;
  endLine?: number | null;
  tokenCount?: number | null;
  charCount?: number | null;
  embeddingModel?: string | null;
  embeddingStatus?: "missing" | "ready" | "failed" | null;
};

export type AstNodeProps = BaseNodeProps & {
  kind: "AstNode";
  fileId: string;
  filePath: string;
  language: SupportedLanguage;
  normalizedKind: string;
  name?: string | null;
  displayName?: string | null;
  nodeType?: string | null;
  signature?: string | null;
  returnType?: string | null;
  visibility?: string | null;
  isExported?: boolean | null;
  isAbstract?: boolean | null;
  isStatic?: boolean | null;
  isAsync?: boolean | null;
  startLine?: number | null;
  startColumn?: number | null;
  endLine?: number | null;
  endColumn?: number | null;
  startOffset?: number | null;
  endOffset?: number | null;
  parser?: string | null;
  extractionMethod?: ExtractionMethod;
  confidence?: number | null;
  hash?: string | null;
};

export type GraphNodeProps =
  | RepoNodeProps
  | DirectoryNodeProps
  | CodeFileNodeProps
  | TextFileNodeProps
  | TextChunkNodeProps
  | AstNodeProps;

export type BaseEdgeProps = {
  repoId: string;
  extractionMethod?: ExtractionMethod;
  confidence?: number | null;
};

export type ContainsEdgeProps = BaseEdgeProps & { orderIndex?: number };
export type HasChunkEdgeProps = BaseEdgeProps;
export type NextChunkEdgeProps = BaseEdgeProps & { fromIndex?: number; toIndex?: number };
export type HasAstRootEdgeProps = BaseEdgeProps;
export type AstChildEdgeProps = BaseEdgeProps & { orderIndex?: number };
export type DeclaresEdgeProps = BaseEdgeProps;
export type ImportsEdgeProps = BaseEdgeProps & {
  importText?: string;
  isResolved?: boolean;
  resolutionKind?: "file" | "module" | "unknown";
};
export type ExtendsEdgeProps = BaseEdgeProps & { isInferred?: boolean };
export type OverridesEdgeProps = BaseEdgeProps & { isInferred?: boolean };
export type ReferencesEdgeProps = BaseEdgeProps & { referenceKind?: string };
export type DescribesEdgeProps = BaseEdgeProps;
export type MentionsEdgeProps = BaseEdgeProps & { matchedText?: string };

export type GraphEdgeProps =
  | ContainsEdgeProps
  | HasChunkEdgeProps
  | NextChunkEdgeProps
  | HasAstRootEdgeProps
  | AstChildEdgeProps
  | DeclaresEdgeProps
  | ImportsEdgeProps
  | ExtendsEdgeProps
  | OverridesEdgeProps
  | ReferencesEdgeProps
  | DescribesEdgeProps
  | MentionsEdgeProps;

export function isoNow(): string {
  return new Date().toISOString();
}
