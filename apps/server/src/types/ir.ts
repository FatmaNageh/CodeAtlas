import type {
  RepoNodeProps,
  DirectoryNodeProps,
  CodeFileNodeProps,
  TextFileNodeProps,
  TextChunkNodeProps,
  AstNodeProps,
  ContainsEdgeProps,
  HasChunkEdgeProps,
  NextChunkEdgeProps,
  ImportsEdgeProps,
  ExtendsEdgeProps,
  OverridesEdgeProps,
  DescribesEdgeProps,
  MentionsEdgeProps,
  ReferencesEdgeProps,
  AstChildEdgeProps,
  DeclaresEdgeProps,
  HasAstRootEdgeProps,
} from "./graphProperties";

export type IRNodeKind =
  | "Repo"
  | "Directory"
  | "CodeFile"
  | "TextFile"
  | "TextChunk"
  | "AstNode";

export type IREdgeType =
  | "CONTAINS"
  | "HAS_CHUNK"
  | "NEXT_CHUNK"
  | "IMPORTS"
  | "EXTENDS"
  | "OVERRIDES"
  | "DESCRIBES"
  | "MENTIONS"
  | "REFERENCES"
  | "AST_CHILD"
  | "DECLARES"
  | "HAS_AST_ROOT";

export type Range = {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
};

export type IRNode =
  | { id: string; kind: "Repo"; repoId: string; props: RepoNodeProps }
  | { id: string; kind: "Directory"; repoId: string; props: DirectoryNodeProps }
  | { id: string; kind: "CodeFile"; repoId: string; props: CodeFileNodeProps }
  | { id: string; kind: "TextFile"; repoId: string; props: TextFileNodeProps }
  | { id: string; kind: "TextChunk"; repoId: string; props: TextChunkNodeProps }
  | { id: string; kind: "AstNode"; repoId: string; props: AstNodeProps };

export type IREdge =
  | { id: string; type: "CONTAINS"; from: string; to: string; repoId: string; props?: ContainsEdgeProps }
  | { id: string; type: "HAS_CHUNK"; from: string; to: string; repoId: string; props?: HasChunkEdgeProps }
  | { id: string; type: "NEXT_CHUNK"; from: string; to: string; repoId: string; props?: NextChunkEdgeProps }
  | { id: string; type: "IMPORTS"; from: string; to: string; repoId: string; props?: ImportsEdgeProps }
  | { id: string; type: "EXTENDS"; from: string; to: string; repoId: string; props?: ExtendsEdgeProps }
  | { id: string; type: "OVERRIDES"; from: string; to: string; repoId: string; props?: OverridesEdgeProps }
  | { id: string; type: "DESCRIBES"; from: string; to: string; repoId: string; props?: DescribesEdgeProps }
  | { id: string; type: "MENTIONS"; from: string; to: string; repoId: string; props?: MentionsEdgeProps }
  | { id: string; type: "REFERENCES"; from: string; to: string; repoId: string; props?: ReferencesEdgeProps }
  | { id: string; type: "AST_CHILD"; from: string; to: string; repoId: string; props?: AstChildEdgeProps }
  | { id: string; type: "DECLARES"; from: string; to: string; repoId: string; props?: DeclaresEdgeProps }
  | { id: string; type: "HAS_AST_ROOT"; from: string; to: string; repoId: string; props?: HasAstRootEdgeProps };

export type IR = {
  repoId: string;
  nodes: IRNode[];
  edges: IREdge[];
  stats: {
    files: number;
    dirs: number;
    textChunks: number;
    astNodes: number;
    edges: number;
  };
};