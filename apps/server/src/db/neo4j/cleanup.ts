import { getNeo4jClient } from "./client";

export async function cleanupStaleByRunId(input: { repoId: string; runId: string }): Promise<{
  deletedRelationships: number;
  deletedNodes: number;
}> {
  const neo4j = getNeo4jClient();
  const session = neo4j.session();

  try {
    const relRes = await session.run(
      `
      MATCH ()-[r]->()
      WHERE r.repoId = $repoId AND coalesce(r.runId, "") <> $runId
      DELETE r
      RETURN count(r) AS deleted
      `,
      { repoId: input.repoId, runId: input.runId }
    );

    const deletedRelationships = Number(relRes.records[0]?.get("deleted") ?? 0);

    const nodeRes = await session.run(
      `
      MATCH (n)
      WHERE n.repoId = $repoId AND coalesce(n.runId, "") <> $runId AND NOT n:Repo
      DELETE n
      RETURN count(n) AS deleted
      `,
      { repoId: input.repoId, runId: input.runId }
    );

    const deletedNodes = Number(nodeRes.records[0]?.get("deleted") ?? 0);

    return { deletedRelationships, deletedNodes };
  } finally {
    await session.close();
  }
}
