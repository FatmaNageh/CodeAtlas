import { getNeo4jClient } from "./client";
import { toNeo4jNumber, type Neo4jIntegerLike } from "./value";

export async function cleanupStaleByRunId(input: {
  repoId: string;
  runId: string;
}): Promise<{
  deletedRelationships: number;
  deletedNodes: number;
}> {
  const neo4j = getNeo4jClient();
  const session = neo4j.session();

  try {
    const relRes = await session.run(
      `
      MATCH ()-[r]->()
      WHERE r.repoId = $repoId
        AND coalesce(r.runId, "") <> $runId
      DELETE r
      RETURN count(r) AS deleted
      `,
      { repoId: input.repoId, runId: input.runId },
    );

    const deletedRelationships = toNeo4jNumber(
      relRes.records[0]?.get("deleted") as number | Neo4jIntegerLike | null | undefined,
      0,
    );

    const nodeRes = await session.run(
      `
      MATCH (n)
      WHERE n.repoId = $repoId
        AND coalesce(n.runId, "") <> $runId
        AND NOT n:Repo
      DETACH DELETE n
      RETURN count(n) AS deleted
      `,
      { repoId: input.repoId, runId: input.runId },
    );

    const deletedNodes = toNeo4jNumber(
      nodeRes.records[0]?.get("deleted") as number | Neo4jIntegerLike | null | undefined,
      0,
    );

    return { deletedRelationships, deletedNodes };
  } finally {
    await session.close();
  }
}

export async function pruneEmptyDirectories(repoId: string): Promise<number> {
  const neo4j = getNeo4jClient();
  const session = neo4j.session();
  let totalDeleted = 0;

  try {
    while (true) {
      const result = await session.executeWrite((tx) =>
        tx.run(
          `/*cypher*/
          MATCH (d:Directory {repoId: $repoId})
          WHERE NOT EXISTS {
            MATCH (d)-[:CONTAINS]->()
          }
          DETACH DELETE d
          RETURN count(d) AS deleted
          `,
          { repoId },
        ),
      );

      const deletedThisPass = toNeo4jNumber(
        result.records[0]?.get("deleted") as number | Neo4jIntegerLike | null | undefined,
        0,
      );

      totalDeleted += deletedThisPass;
      if (deletedThisPass === 0) break;
    }

    return totalDeleted;
  } finally {
    await session.close();
  }
}
