import type { IR, IRNode, IREdge } from "../types/ir";
import { getNeo4jClient } from "./client";

function isPrimitive(v: any): boolean {
  return v === null || ["string", "number", "boolean"].includes(typeof v);
}

function sanitizeValue(v: any): any {
  if (v === undefined) return null;
  if (isPrimitive(v)) return v;
  if (Array.isArray(v)) {
    // Neo4j supports arrays of primitive values only.
    if (v.every(isPrimitive)) return v;
    return JSON.stringify(v);
  }
  // Objects / maps (e.g., range) are not allowed as properties -> stringify.
  return JSON.stringify(v);
}

function sanitizeProps(props: Record<string, any> | undefined): Record<string, any> {
  const out: Record<string, any> = {};
  if (!props) return out;
  for (const [k, v] of Object.entries(props)) out[k] = sanitizeValue(v);
  return out;
}

function labelForKind(kind: string): string {
  switch (kind) {
    case "Repo":
    case "Directory":
    case "File":
    case "Symbol":
    case "Import":
    case "CallSite":
    case "DocChunk":
    case "ExternalModule":
    case "ExternalSymbol":
      return kind;
    default:
      return "Entity";
  }
}

async function ingestNodes(nodes: IRNode[]): Promise<void> {
  const neo4j = getNeo4jClient();
  const session = neo4j.session();
  try {
    const groups = new Map<string, IRNode[]>();
    for (const n of nodes) {
      const label = labelForKind(n.kind);
      const arr = groups.get(label) ?? [];
      arr.push(n);
      groups.set(label, arr);
    }

    for (const [label, group] of groups.entries()) {
      const batchSize = 1000;
      for (let i = 0; i < group.length; i += batchSize) {
        const batch = group.slice(i, i + batchSize).map((n) => ({
          id: n.id,
          repoId: n.repoId,
          props: sanitizeProps(n.props),
        }));

        const q = `
          UNWIND $rows AS row
          MERGE (n:${label} {id: row.id})
          SET n.repoId = row.repoId
          SET n += row.props
        `;
        await session.run(q, { rows: batch });
      }
    }
  } finally {
    await session.close();
  }
}

async function ingestEdges(edges: IREdge[]): Promise<void> {
  const neo4j = getNeo4jClient();
  const session = neo4j.session();
  try {
    const groups = new Map<string, IREdge[]>();
    for (const e of edges) {
      const arr = groups.get(e.type) ?? [];
      arr.push(e);
      groups.set(e.type, arr);
    }

    const batchSize = 2000;

    for (const [type, group] of groups.entries()) {
      for (let i = 0; i < group.length; i += batchSize) {
        const batch = group.slice(i, i + batchSize).map((e) => ({
          id: e.id,
          repoId: e.repoId,
          from: e.from,
          to: e.to,
          props: sanitizeProps(e.props),
        }));

        const q = `
          UNWIND $rows AS row
          MATCH (a {id: row.from})
          MATCH (b {id: row.to})
          MERGE (a)-[r:${type} {id: row.id}]->(b)
          SET r.repoId = row.repoId
          SET r += row.props
        `;
        await session.run(q, { rows: batch });
      }
    }
  } finally {
    await session.close();
  }
}

export async function ingestIR(ir: IR): Promise<void> {
  await ingestNodes(ir.nodes);
  await ingestEdges(ir.edges);
}
