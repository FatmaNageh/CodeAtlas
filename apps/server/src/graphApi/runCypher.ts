import { getNeo4jClient } from "../neo4j/client";

/**
 * Lightweight Cypher runner that returns each record as a plain JS object.
 *
 * Note: Neo4j integers may come back as Neo4j Integer objects depending on driver config.
 */
export async function runCypher<T extends Record<string, any> = Record<string, any>>(
  cypher: string,
  params: Record<string, any> = {},
): Promise<T[]> {
  const session = getNeo4jClient().session();
  try {
    const res = await session.run(cypher, params);
    return res.records.map((r) => {
      const obj: Record<string, any> = {};
      for (const k of r.keys) obj[k] = r.get(k);
      return obj as T;
    });
  } finally {
    await session.close();
  }
}
