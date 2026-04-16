import { runCypher } from "@/db/cypher";
import { normalizeRepoRelativePath } from "./id";

/**
 * Find code files that (directly OR transitively) reference the given target files
 * via incoming REFERENCES edges.
 * This uses the graph from the *previous* indexing run to decide which files
 * should be re-processed when a file changes or is removed.
 *
 * NOTE: We intentionally keep the traversal depth bounded to avoid runaway
 * traversals on very large repos. Increase if needed.
 */
export async function findImportDependents(input: {
  repoId: string;
  targetRelPaths: string[];
  maxDepth?: number;
}): Promise<string[]> {
  const targets = Array.from(
    new Set(
      input.targetRelPaths
        .filter((relPath): relPath is string => typeof relPath === "string" && relPath.length > 0)
        .map((relPath) => normalizeRepoRelativePath(relPath)),
    ),
  );
  if (targets.length === 0) return [];

  const maxDepth = Math.max(1, Math.min(Number(input.maxDepth ?? 10), 25));

  const rows = await runCypher<{ relPath: string }>(
    // IMPORTANT: Neo4j does not reliably support parameterizing the upper
    // bound of a variable-length relationship pattern in all versions.
    // We safely inject a bounded integer here.
    `/*cypher*/
    MATCH (t:CodeFile { repoId: $repoId })
    WHERE coalesce(t.path, t.relPath) IN $targets
    MATCH (dep:CodeFile { repoId: $repoId })-[:REFERENCES*1..${maxDepth}]->(t)
    WHERE NOT coalesce(dep.path, dep.relPath) IN $targets
    RETURN DISTINCT coalesce(dep.path, dep.relPath) AS relPath
    `,
    { repoId: input.repoId, targets },
  );

  // Defensive: filter null/undefined and return sorted for determinism
  return rows
    .map((r) => r.relPath)
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .map((relPath) => normalizeRepoRelativePath(relPath))
    .sort();
}
