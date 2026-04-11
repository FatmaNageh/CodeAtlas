import type { GraphIR, IRNode, IREdge } from "@/types/ir";
import { getNeo4jClient } from "./client";

type Primitive = boolean | number | string | null;
type PropertyValue = Primitive | Primitive[];
type PropertyRecord = Record<string, PropertyValue>;

async function runWithRetry(
  session: ReturnType<typeof getNeo4jClient>["session"] extends () => infer T ? T : never,
  query: string,
  params: Record<
    string,
    PropertyValue | PropertyRecord | Array<Record<string, PropertyValue | PropertyRecord>> | null
  >,
  maxRetries = 5,
) {
  let attempt = 0;

  while (true) {
    try {
      return await session.run(query, params);
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String(error.code ?? "") : "";
      const retryable =
        error instanceof Error && "retryable" in error
          ? Boolean(error.retryable)
          : error instanceof Error && "retriable" in error
            ? Boolean(error.retriable)
            : false;

      const isDeadlock =
        code.includes("DeadlockDetected") ||
        code === "Neo.TransientError.Transaction.DeadlockDetected";

      if (attempt >= maxRetries || !(retryable || isDeadlock)) {
        throw error;
      }

      const delayMs =
        Math.min(2000, 50 * Math.pow(2, attempt)) + Math.floor(Math.random() * 50);

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      attempt++;
    }
  }
}

function isPrimitive(
  value: Primitive | Primitive[] | undefined,
): value is Primitive {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function sanitizeValue(value: Primitive | Primitive[] | undefined): PropertyValue {
  if (value === undefined) return null;
  if (isPrimitive(value)) return value;
  return value.filter(isPrimitive);
}

function sanitizeProps(
  props: IRNode["props"] | IREdge["props"] | undefined,
): PropertyRecord {
  const out: PropertyRecord = {};
  if (!props) return out;

  for (const [key, value] of Object.entries(props)) {
    out[key] = sanitizeValue(value as Primitive | Primitive[] | undefined);
  }

  return out;
}

async function ingestNodes(nodes: IRNode[], runId: string | null): Promise<void> {
  const neo4j = getNeo4jClient();
  const session = neo4j.session();

  try {
    const groups = new Map<string, IRNode[]>();

    for (const node of nodes) {
      const label = node.label;
      const arr = groups.get(label) ?? [];
      arr.push(node);
      groups.set(label, arr);
    }

    for (const [label, group] of groups.entries()) {
      const batchSize = 1000;

      for (let i = 0; i < group.length; i += batchSize) {
        const batch = group.slice(i, i + batchSize).map((node) => ({
          id: node.props.id,
          repoId: node.props.repoId,
          runId,
          props: sanitizeProps(node.props),
        }));

        const query = `
          UNWIND $rows AS row
          MERGE (n:${label} {id: row.id})
          SET n.repoId = row.repoId
          SET n.runId = row.runId
          SET n += row.props
        `;

        await runWithRetry(session, query, { rows: batch });
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

    for (const edge of edges) {
      const arr = groups.get(edge.type) ?? [];
      arr.push(edge);
      groups.set(edge.type, arr);
    }

    const batchSize = 2000;

    for (const [type, group] of groups.entries()) {
      for (let i = 0; i < group.length; i += batchSize) {
        const batch = group.slice(i, i + batchSize).map((edge) => ({
          id: edge.key,
          repoId: edge.props.repoId,
          runId,
          from: edge.from,
          to: edge.to,
          props: sanitizeProps(edge.props),
        }));

        const query = `
          UNWIND $rows AS row
          MATCH (a {id: row.from})
          MATCH (b {id: row.to})
          MERGE (a)-[r:${type} {id: row.id}]->(b)
          SET r.repoId = row.repoId
          SET r.runId = row.runId
          SET r += row.props
        `;

        await runWithRetry(session, query, { rows: batch });
      }
    }
  } finally {
    await session.close();
  }
}

export async function ingestIR(ir: GraphIR, opts?: { runId?: string }): Promise<void> {
  const runId = opts?.runId ?? null;
  await ingestNodes(ir.nodes, runId);
  await ingestEdges(ir.edges, runId);
}