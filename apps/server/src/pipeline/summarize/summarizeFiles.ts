import { runCypher } from "../../db/cypher";

export async function summarizeFiles(repoId: string) {
  // Fetch all file nodes for this repo
  const files = await runCypher<{ f: any }>(
    `MATCH (f:CodeFile {repoId: $repoId}) RETURN f`,
    { repoId }
  );

  for (const { f } of files) {
    const relPath = f.properties.relPath;

    // Generate a fake summary
    const summary = "This is a sample summary";

    // Update the node with the summary
    await runCypher(
      `
      MATCH (f:CodeFile {repoId: $repoId, relPath: $relPath})
      SET f.summary = $summary,
          f.summaryAt = datetime(),
          f.summaryModel = $model
      RETURN f
      `,
      {
        repoId,
        relPath,
        summary,
        model: "fake-summary",
      }
    );

    console.log(`Summarized ${relPath}`);
  }

  return { ok: true, count: files.length };
}