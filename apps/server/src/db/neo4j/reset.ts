import { pathToFileURL } from "node:url";

import { getNeo4jClient } from "./client";

function escapeIdentifier(name: string): string {
  return `\`${name.replace(/`/g, "``")}\``;
}

export async function resetGraphDatabase(): Promise<void> {
  const neo4j = getNeo4jClient();
  const session = neo4j.session();

  try {
    const constraintRows = await session.run("SHOW CONSTRAINTS YIELD name RETURN name");
    for (const record of constraintRows.records) {
      const name = record.get("name");
      if (typeof name !== "string" || name.length === 0) continue;
      await session.run(`DROP CONSTRAINT ${escapeIdentifier(name)} IF EXISTS`);
    }

    const indexRows = await session.run("SHOW INDEXES YIELD name RETURN name");
    for (const record of indexRows.records) {
      const name = record.get("name");
      if (typeof name !== "string" || name.length === 0) continue;
      await session.run(`DROP INDEX ${escapeIdentifier(name)} IF EXISTS`);
    }

    await session.run("MATCH (n) DETACH DELETE n");
  } finally {
    await session.close();
  }
}

async function main(): Promise<void> {
  await resetGraphDatabase();
  await getNeo4jClient().close();
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (entryUrl === import.meta.url) {
  main().catch((error: Error) => {
    console.error("[neo4j-reset] failed:", error.message);
    process.exitCode = 1;
  });
}
