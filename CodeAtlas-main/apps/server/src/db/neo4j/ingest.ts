import type { IR, IRNode, IREdge } from "../../types/ir";
import { getNeo4jClient } from "./client";

async function runWithRetry(session: any, query: string, params: any, maxRetries = 5) {
  let attempt = 0;
  // Simple exponential backoff for transient Neo4j errors (e.g., deadlocks)
  while (true) {
    try {
      return await session.run(query, params);
    } catch (e: any) {
      const code = String(e?.code ?? "");
      const retryable = Boolean(e?.retryable ?? e?.retriable ?? false);
      const isDeadlock = code.includes("DeadlockDetected") || code === "Neo.TransientError.Transaction.DeadlockDetected";

      if (attempt >= maxRetries || !(retryable || isDeadlock)) throw e;

      const delayMs = Math.min(2000, 50 * Math.pow(2, attempt)) + Math.floor(Math.random() * 50);
      await new Promise((r) => setTimeout(r, delayMs));
      attempt++;
    }
  }
}

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
    case "CodeFile":
    case "TextFile":
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

async function ingestNodes(nodes: IRNode[], runId: string | null): Promise<void> {
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
          runId,
          props: sanitizeProps(n.props),
        }));

        const q = `
          UNWIND $rows AS row
          MERGE (n:${label} {id: row.id})
          SET n.repoId = row.repoId
          SET n.runId = row.runId
          SET n += row.props
        `;
        await runWithRetry(session, q, { rows: batch });
      }
    }
  } finally {
    await session.close();
  }
}

async function ingestEdges(edges: IREdge[], runId: string | null): Promise<void> {
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
          runId,
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
          SET r.runId = row.runId
          SET r += row.props
        `;
        await runWithRetry(session, q, { rows: batch });
      }
    }
  } finally {
    await session.close();
  }
}

export async function ingestIR(ir: IR, opts?: { runId?: string }): Promise<void> {
  const runId = opts?.runId ?? null;
  await ingestNodes(ir.nodes, runId);
    await ingestEdges(ir.edges, runId);
}
