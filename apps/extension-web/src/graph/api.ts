import type { GraphData, GraphEdge, GraphNode, GraphPropertyValue } from "@/graph/types";

interface RawGraphResponse {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  ok?: boolean;
  error?: string;
}

function isPropertyRecord(value: object | null): value is Record<string, GraphPropertyValue> {
  if (!value) return false;
  return Object.values(value).every((entry) => {
    return (
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean" ||
      entry === null
    );
  });
}

function normalizeProperties(value: object | null): Record<string, GraphPropertyValue> {
  if (!isPropertyRecord(value)) return {};
  return value;
}

function normalizeNode(node: GraphNode): GraphNode {
  return {
    id: String(node.id),
    labels: Array.isArray(node.labels) ? node.labels.map(String) : [],
    properties: normalizeProperties(
      typeof node.properties === "object" && node.properties !== null ? node.properties : null,
    ),
  };
}

function normalizeEdge(edge: GraphEdge, index: number): GraphEdge {
  const id = edge.id ? String(edge.id) : `${edge.from}:${edge.to}:${edge.type}:${index}`;
  return {
    id,
    type: String(edge.type || "RELATED"),
    from: String(edge.from),
    to: String(edge.to),
    properties: normalizeProperties(
      typeof edge.properties === "object" && edge.properties !== null ? edge.properties : null,
    ),
  };
}

export async function fetchGraphData(serverUrl: string, repoId: string): Promise<GraphData> {
  const requestUrl = `${serverUrl}/debug/subgraph?repoId=${encodeURIComponent(repoId)}&_=${Date.now()}`;
  let response: Response;
  try {
    response = await fetch(requestUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Graph request could not reach ${requestUrl}: ${message}`);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Graph request failed: ${response.status} ${response.statusText}${text ? ` ${text}` : ""}`);
  }

  const data = JSON.parse(text) as RawGraphResponse;
  if (data.ok === false) {
    throw new Error(data.error || "The server rejected the graph request.");
  }

  return {
    nodes: (data.nodes ?? []).map(normalizeNode),
    edges: (data.edges ?? []).map(normalizeEdge),
  };
}
