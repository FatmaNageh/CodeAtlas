import type { GraphData, GraphKind, GraphNode, GraphSummary } from "@/graph/types";

const pathKeys = ["relPath", "filePath", "path", "fileRelPath", "relativePath", "rootPath"] as const;
const nameKeys = ["name", "displayName", "symbol", "callee", "raw", "qname"] as const;

function stringProperty(node: GraphNode, keys: readonly string[]): string {
  for (const key of keys) {
    const value = node.properties[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

export function getNodeKind(node: GraphNode): GraphKind {
  const labels = node.labels;
  const id = String(node.id);
  if (labels.some((label) => label === "Repo") || id.startsWith("repo:")) return "repo";
  if (labels.some((label) => label === "Directory") || id.startsWith("dir:")) return "folder";
  if (labels.some((label) => label === "Class" || label === "Interface" || label === "Type")) return "class";
  if (labels.some((label) => label === "CallSite" || label === "CallSiteSummary") || id.startsWith("call:")) {
    return "callsite";
  }
  if (
    labels.some((label) => label === "Function" || label === "Method" || label === "Chunk" || label === "Symbol") ||
    id.startsWith("sym:")
  ) {
    return "fn";
  }
  if (
    labels.some((label) => label === "Import" || label === "ExternalModule" || label === "ExternalSymbol") ||
    id.startsWith("imp:") ||
    id.startsWith("extmod:")
  ) {
    return "import";
  }
  return "file";
}

export function getNodePath(node: GraphNode): string {
  return stringProperty(node, pathKeys);
}

export function getNodeLabel(node: GraphNode): string {
  const named = stringProperty(node, nameKeys);
  const path = stringProperty(node, pathKeys);
  const value = named || path || node.id;
  const segment = value.replace(/\\/g, "/").split("/").filter(Boolean).at(-1) || value;
  return segment.length > 30 ? `${segment.slice(0, 29)}...` : segment;
}

export function getGraphSummary(graph: GraphData): GraphSummary {
  let files = 0;
  let symbols = 0;

  for (const node of graph.nodes) {
    const kind = getNodeKind(node);
    if (kind === "file") files += 1;
    if (kind === "class" || kind === "fn") symbols += 1;
  }

  return {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    files,
    symbols,
  };
}
