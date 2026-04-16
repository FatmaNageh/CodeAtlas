import { getNeo4jClient } from "./neo4j/client";

type CypherScalar = boolean | number | string | null;
type CypherValue = CypherScalar | object | CypherValue[];
type CypherMode = "read" | "write";

async function executeCypher<T extends object>(
  mode: CypherMode,
  cypher: string,
  params: Record<string, CypherValue>,
): Promise<T[]> {
  const session = getNeo4jClient().session();
  try {
    const res =
      mode === "write"
        ? await session.executeWrite((tx) => tx.run(cypher, params))
        : await session.executeRead((tx) => tx.run(cypher, params));

    return res.records.map((r) => {
      const obj: Record<string, CypherValue> = {};
      for (const key of r.keys.filter((value): value is string => typeof value === "string")) {
        obj[key] = r.get(key) as CypherValue;
      }
      return obj as T;
    });
  } finally {
    await session.close();
  }
}

/**
 * Lightweight Cypher runner that returns each record as a plain JS object.
 * Read-only queries only: do not use for SET/MERGE/CREATE/DELETE/REMOVE.
 *
 * Note: Neo4j integers may come back as Neo4j Integer objects depending on driver config.
 */
export async function runCypher<T extends object = Record<string, CypherValue>>(
  cypher: string,
  params: Record<string, CypherValue> = {},
): Promise<T[]> {
  return executeCypher<T>("read", cypher, params);
}

/**
 * Cypher runner for any query that mutates Neo4j state.
 */
export async function writeCypher<T extends object = Record<string, CypherValue>>(
  cypher: string,
  params: Record<string, CypherValue> = {},
): Promise<T[]> {
  return executeCypher<T>("write", cypher, params);
}
