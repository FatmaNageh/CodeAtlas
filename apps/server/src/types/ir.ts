export type IRNodeKind =
  | "Repo"
  | "Directory"
  | "File"
  | "Symbol"
  | "Import"
  | "CallSite"
  | "DocChunk"
  | "ExternalModule"
  | "ExternalSymbol";

export type IREdgeType =
  | "CONTAINS"
  | "DECLARES"
  | "PARENT"
  | "IMPORTS_RAW"
  | "IMPORTS"
  | "CALLS"
  | "EXTENDS"
  | "IMPLEMENTS"
  | "HAS_CHUNK"
  | "REFERS_TO";

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
  props: Record<string, any>;
};

export type IREdge = {
  id: string;
  type: IREdgeType;
  from: string;
  to: string;
  repoId: string;
  props?: Record<string, any>;
};

export type IR = {
  repoId: string;
  nodes: IRNode[];
  edges: IREdge[];
  stats: {
    files: number;
    dirs: number;
    symbols: number;
    importsRaw: number;
  };
};
