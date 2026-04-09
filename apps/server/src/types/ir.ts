export type IRNodeKind =
  | "RepoRoot"
  | "Directory"
  | "CodeFile"
  | "TextFile"
  | "ASTNode"
  | "TXTChunk";

export type IREdgeType =
  | "CONTAINS"
  | "DECLARES"
  | "IMPORTS"
  | "REFERENCES"
  | "EXTENDS"
  | "HAS_CHUNK"
  | "HAS_AST_ROOT"
  | "AST_CHILD"
  | "NEXT_CHUNK"
  | "DESCRIBES"
  | "MENTIONS"
  | "OVERRIDES";

export type Range = {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
};

export type IRNode = {
  id: string;
  kind: IRNodeKind;
  repoId: string;
  props: Record<string, boolean | number | string | null | string[]>;
};

export type IREdge = {
  id: string;
  type: IREdgeType;
  from: string;
  to: string;
  repoId: string;
  props?: Record<string, boolean | number | string | null | string[]>;
};

export type IR = {
  repoId: string;
  nodes: IRNode[];
  edges: IREdge[];
  stats: {
    files: number;
    dirs: number;
    astNodes: number;
    textChunks: number;
    references: number;
  };
};
