import { getNeo4jClient } from "./neo4j/client";

type CypherScalar = boolean | number | string | null;
type CypherValue = CypherScalar | object | CypherValue[];

/**
 * Lightweight Cypher runner that returns each record as a plain JS object.
 *
 * Note: Neo4j integers may come back as Neo4j Integer objects depending on driver config.
 */
export async function runCypher<T extends object = Record<string, CypherValue>>(
  cypher: string,
  params: Record<string, CypherValue> = {},
): Promise<T[]> {
  const session = getNeo4jClient().session();
  try {
    const res = await session.run(cypher, params);
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
