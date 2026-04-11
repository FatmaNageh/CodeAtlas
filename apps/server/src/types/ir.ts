import type {
  AstChildEdgeProps,
  AstNodeProps,
  CodeFileNodeProps,
  ContainsEdgeProps,
  DeclaresEdgeProps,
  DescribesEdgeProps,
  DirectoryNodeProps,
  ExtendsEdgeProps,
  GraphNodeLabel,
  GraphRelationType,
  HasAstRootEdgeProps,
  HasChunkEdgeProps,
  ImportsEdgeProps,
  MentionsEdgeProps,
  NextChunkEdgeProps,
  OverridesEdgeProps,
  ReferencesEdgeProps,
  RepoNodeProps,
  TextChunkNodeProps,
  TextFileNodeProps,
} from "./graphProperties";

export type IRNodeKind = GraphNodeLabel;
export type IREdgeType = GraphRelationType;

export type RepoNode = {
  label: "Repo";
  props: RepoNodeProps;
};

export type DirectoryNode = {
  label: "Directory";
  props: DirectoryNodeProps;
};

export type CodeFileNode = {
  label: "CodeFile";
  props: CodeFileNodeProps;
};

export type TextFileNode = {
  label: "TextFile";
  props: TextFileNodeProps;
};

export type TextChunkNode = {
  label: "TextChunk";
  props: TextChunkNodeProps;
};

export type AstNode = {
  label: "AstNode";
  props: AstNodeProps;
};

export type IRNode =
  | RepoNode
  | DirectoryNode
  | CodeFileNode
  | TextFileNode
  | TextChunkNode
  | AstNode;

export type ContainsEdge = {
  key: string;
  type: "CONTAINS";
  from: string;
  to: string;
  props: ContainsEdgeProps;
};

export type HasChunkEdge = {
  key: string;
  type: "HAS_CHUNK";
  from: string;
  to: string;
  props: HasChunkEdgeProps;
};

export type NextChunkEdge = {
  key: string;
  type: "NEXT_CHUNK";
  from: string;
  to: string;
  props: NextChunkEdgeProps;
};

export type ImportsEdge = {
  key: string;
  type: "IMPORTS";
  from: string;
  to: string;
  props: ImportsEdgeProps;
};

export type ExtendsEdge = {
  key: string;
  type: "EXTENDS";
  from: string;
  to: string;
  props: ExtendsEdgeProps;
};

export type OverridesEdge = {
  key: string;
  type: "OVERRIDES";
  from: string;
  to: string;
  props: OverridesEdgeProps;
};

export type DescribesEdge = {
  key: string;
  type: "DESCRIBES";
  from: string;
  to: string;
  props: DescribesEdgeProps;
};

export type MentionsEdge = {
  key: string;
  type: "MENTIONS";
  from: string;
  to: string;
  props: MentionsEdgeProps;
};

export type ReferencesEdge = {
  key: string;
  type: "REFERENCES";
  from: string;
  to: string;
  props: ReferencesEdgeProps;
};

export type AstChildEdge = {
  key: string;
  type: "AST_CHILD";
  from: string;
  to: string;
  props: AstChildEdgeProps;
};

export type DeclaresEdge = {
  key: string;
  type: "DECLARES";
  from: string;
  to: string;
  props: DeclaresEdgeProps;
};

export type HasAstRootEdge = {
  key: string;
  type: "HAS_AST_ROOT";
  from: string;
  to: string;
  props: HasAstRootEdgeProps;
};

export type IREdge =
  | ContainsEdge
  | HasChunkEdge
  | NextChunkEdge
  | ImportsEdge
  | ExtendsEdge
  | OverridesEdge
  | DescribesEdge
  | MentionsEdge
  | ReferencesEdge
  | AstChildEdge
  | DeclaresEdge
  | HasAstRootEdge;

export type GraphIRStats = {
  files: number;
  dirs: number;
  textChunks: number;
  astNodes: number;
  edges: number;
};


export type GraphIR = {
  repoId: string;
  nodes: IRNode[];
  edges: IREdge[];
  stats: GraphIRStats;
};

export type IRNodeMap = Map<string, IRNode>;
export type IREdgeMap = Map<string, IREdge>;