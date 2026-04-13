import type { SupportedLanguage, TextKind } from "./scan";


export const IR_SCHEMA_VERSION = "v1";
export const NEO4J_SCHEMA_VERSION = "v1";
export const NORMALIZED_KIND_VERSION = "v1";
export const CHUNK_VERSION = "v1";

export const GRAPH_NODE_LABELS = [
  "Repo",
  "Directory",
  "CodeFile",
  "TextFile",
  "TextChunk",
  "AstNode",
] as const;

export type GraphNodeLabel = (typeof GRAPH_NODE_LABELS)[number];

export const GRAPH_RELATION_TYPES = [
  "CONTAINS",
  "HAS_CHUNK",
  "NEXT_CHUNK",
  "IMPORTS",
  "EXTENDS",
  "OVERRIDES",
  "DESCRIBES",
  "MENTIONS",
  "REFERENCES",
  "AST_CHILD",
  "DECLARES",
  "HAS_AST_ROOT",
] as const;

export type GraphRelationType = (typeof GRAPH_RELATION_TYPES)[number];


export const NORMALIZED_KINDS = [
  "module",
  "namespace",
  "package",
  "class",
  "interface",
  "struct",
  "enum",
  "function",
  "method",
  "constructor",
  "field",
  "property",
  "variable",
  "constant",
  "parameter",
  "typeAlias",
  "trait",
  "protocol",
  "macro",
  "annotation",
  "comment",
  "unknown",
] as const;

export type NormalizedKind = (typeof NORMALIZED_KINDS)[number];

export type ExtractionMethod =
  | "ast"
  | "ast+ts-enrichment"
  | "heuristic"
  | "text"
  | "manual";

export type ParseStatus = "parsed" | "partial" | "failed";
export type EmbeddingStatus = "missing" | "ready" | "failed";

export type BaseNodeProps = {
  id: string;
  identityKey: string;
  kind: GraphNodeLabel;
  repoId: string;
  createdAt: string;
  updatedAt: string;
};

export type RepoNodeProps = BaseNodeProps & {
  kind: "Repo";
  name: string;
  path?: string;
  rootPath: string;
  defaultBranch?: string | null;
  lastIndexedAt?: string | null;
  commitSha?: string | null;
};

export type DirectoryNodeProps = BaseNodeProps & {
  kind: "Directory";
  path: string;
  relPath?: string;
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
  parseStatus?: ParseStatus;
  summary?: string | null;
  summaryAt?: string | null;
  summaryModel?: string | null;
  embeddings?: number[] | null;
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
  summary?: string | null;
  summaryAt?: string | null;
  summaryModel?: string | null;
  embeddings?: number[] | null;
};

export type TextChunkNodeProps = BaseNodeProps & {
  kind: "TextChunk";
  fileId: string;
  filePath: string;
  chunkIndex: number;
  chunkVersion: string;
  content: string;
  hash?: string | null;
  startOffset?: number | null;
  endOffset?: number | null;
  startLine?: number | null;
  endLine?: number | null;
  tokenCount?: number | null;
  charCount?: number | null;
  embeddings?: number[] | null;
  embeddingModel?: string | null;
  embeddingStatus?: EmbeddingStatus | null;
};

export type AstNodeProps = BaseNodeProps & {
  kind: "AstNode";
  fileId: string;
  filePath: string;
  language: SupportedLanguage;
  normalizedKind: NormalizedKind;
  name?: string | null;
  qname?: string | null;
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
  text?: string | null;
  embeddings?: number[] | null;
  embeddingUpdatedAt?: string | null;
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
  sourceFilePath?: string;
  extractionMethod?: ExtractionMethod;
  confidence?: number | null;
  isInferred?: boolean;
};

export type ContainsEdgeProps = BaseEdgeProps & {
  orderIndex?: number;
};

export type HasChunkEdgeProps = BaseEdgeProps;

export type NextChunkEdgeProps = BaseEdgeProps & {
  fromIndex?: number;
  toIndex?: number;
};

export type HasAstRootEdgeProps = BaseEdgeProps;

export type AstChildEdgeProps = BaseEdgeProps & {
  orderIndex?: number;
};

export type DeclaresEdgeProps = BaseEdgeProps;

export type ImportsEdgeProps = BaseEdgeProps & {
  importText?: string;
  isResolved?: boolean;
  resolutionKind?: "file" | "module" | "unknown";
};

export type ExtendsEdgeProps = BaseEdgeProps;

export type OverridesEdgeProps = BaseEdgeProps;

export type ReferencesEdgeProps = BaseEdgeProps & {
  referenceKind?: string;
};

export type DescribesEdgeProps = BaseEdgeProps;

export type MentionsEdgeProps = BaseEdgeProps & {
  matchedText?: string;
};

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

export const REQUIRED_NODE_PROPERTIES: Record<GraphNodeLabel, readonly string[]> = {
  Repo: ["id", "identityKey", "kind", "repoId", "name", "rootPath", "createdAt", "updatedAt"],
  Directory: ["id", "identityKey", "kind", "repoId", "path", "name", "createdAt", "updatedAt"],
  CodeFile: [
    "id",
    "identityKey",
    "kind",
    "repoId",
    "path",
    "name",
    "extension",
    "language",
    "createdAt",
    "updatedAt",
  ],
  TextFile: [
    "id",
    "identityKey",
    "kind",
    "repoId",
    "path",
    "name",
    "extension",
    "createdAt",
    "updatedAt",
  ],
  TextChunk: [
    "id",
    "identityKey",
    "kind",
    "repoId",
    "fileId",
    "filePath",
    "chunkIndex",
    "chunkVersion",
    "content",
    "createdAt",
    "updatedAt",
  ],
  AstNode: [
    "id",
    "identityKey",
    "kind",
    "repoId",
    "fileId",
    "filePath",
    "language",
    "normalizedKind",
    "createdAt",
    "updatedAt",
  ],
};

export const REQUIRED_EDGE_PROPERTIES: Record<GraphRelationType, readonly string[]> = {
  CONTAINS: ["repoId"],
  HAS_CHUNK: ["repoId"],
  NEXT_CHUNK: ["repoId"],
  IMPORTS: ["repoId"],
  EXTENDS: ["repoId"],
  OVERRIDES: ["repoId"],
  DESCRIBES: ["repoId"],
  MENTIONS: ["repoId"],
  REFERENCES: ["repoId"],
  AST_CHILD: ["repoId"],
  DECLARES: ["repoId"],
  HAS_AST_ROOT: ["repoId"],
};

export const FILE_OWNED_RELATION_TYPES: readonly GraphRelationType[] = [
  "IMPORTS",
  "EXTENDS",
  "OVERRIDES",
  "DESCRIBES",
  "MENTIONS",
  "REFERENCES",
  "DECLARES",
] as const;

export function isAllowedNodeLabel(value: string): value is GraphNodeLabel {
  return (GRAPH_NODE_LABELS as readonly string[]).includes(value);
}

export function isAllowedRelationType(value: string): value is GraphRelationType {
  return (GRAPH_RELATION_TYPES as readonly string[]).includes(value);
}

export function isNormalizedKind(value: string): value is NormalizedKind {
  return (NORMALIZED_KINDS as readonly string[]).includes(value);
}

export function isoNow(): string {
  return new Date().toISOString();
}
