import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

import { runCypher } from "@/db/cypher";
import { getNeo4jClient } from "@/db/neo4j/client";
import { indexRepository } from "@/pipeline/indexRepo";

async function main(): Promise<void> {
  try {
    const root = path.join(process.cwd(), "src/__tests__/fixtures/temp-live-verify");
    await fs.rm(root, { recursive: true, force: true });
    await fs.mkdir(root, { recursive: true });

    await fs.writeFile(
      path.join(root, "app.ts"),
      [
        "export class Box {",
        "  open() {",
        "    return 1;",
        "  }",
        "}",
        "",
        "export function helper() {",
        "  return 2;",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );

    await fs.writeFile(
      path.join(root, "README.md"),
      "# Demo\n\nThis is a text file for chunk verification.\n",
      "utf8",
    );

    const indexed = await indexRepository({
      projectPath: root,
      mode: "full",
      saveDebugJson: false,
      dryRun: false,
    });

    const hasAst = await runCypher<{ count: number }>(
      `/*cypher*/
       MATCH (:CodeFile {repoId: $repoId})-[r:HAS_AST]->(:AstNode {repoId: $repoId})
       RETURN count(r) AS count`,
      { repoId: indexed.repoId },
    );

    const nextAst = await runCypher<{ count: number }>(
      `/*cypher*/
       MATCH (:AstNode {repoId: $repoId})-[r:NEXT_AST]->(:AstNode {repoId: $repoId})
       RETURN count(r) AS count`,
      { repoId: indexed.repoId },
    );

    const astNodes = await runCypher<{ unitKind: string; label: string; segmentIndex: number }>(
      `/*cypher*/
       MATCH (a:AstNode {repoId: $repoId})
       RETURN a.unitKind AS unitKind, a.label AS label, a.segmentIndex AS segmentIndex
       ORDER BY a.segmentIndex ASC`,
      { repoId: indexed.repoId },
    );

    const textChunks = await runCypher<{ rels: number; nodes: number }>(
      `/*cypher*/
       MATCH (:TextFile {repoId: $repoId})-[r:HAS_CHUNK]->(c:TextChunk {repoId: $repoId})
       RETURN count(r) AS rels, count(c) AS nodes`,
      { repoId: indexed.repoId },
    );

    const fileCounts = await runCypher<{
      labels: string[];
      relPath: string;
      astNodeCount: number | null;
      chunkCount: number | null;
    }>(
      `/*cypher*/
       MATCH (f {repoId: $repoId})
       WHERE f:CodeFile OR f:TextFile
       RETURN labels(f) AS labels, f.relPath AS relPath, f.astNodeCount AS astNodeCount, f.chunkCount AS chunkCount
       ORDER BY relPath ASC`,
      { repoId: indexed.repoId },
    );

    process.stdout.write(
      `${JSON.stringify(
        {
          repoId: indexed.repoId,
          stats: indexed.stats,
          hasAst: hasAst[0] ?? null,
          nextAst: nextAst[0] ?? null,
          astNodes,
          textChunks: textChunks[0] ?? null,
          fileCounts,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await getNeo4jClient().close();
  }
}

void main();
