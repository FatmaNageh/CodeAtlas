export type GraphPropertyValue = string | number | boolean | null;

export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, GraphPropertyValue>;
}

export interface GraphEdge {
  id: string;
  type: string;
  from: string;
  to: string;
  properties?: Record<string, GraphPropertyValue>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type GraphKind = "repo" | "folder" | "file" | "class" | "fn" | "callsite" | "import";

export interface GraphSummary {
  nodes: number;
  edges: number;
  files: number;
  symbols: number;
}
