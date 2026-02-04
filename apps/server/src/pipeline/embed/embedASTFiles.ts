import { runCypher } from "../../db/cypher";
import path from "path";
import fs from "fs/promises";

type SymbolRow = {
  relPath: string;
  symbolName: string;
  startLine: number;
  endLine: number;
};

/**
 * Embeds AST symbols as CodeChunk nodes in Neo4j.
 * @param repoId - The Neo4j repo ID
 * @param repoRoot - Absolute path to the repo folder (like fzf-master)
 */
export async function embedASTFiles(repoId: string, repoRoot: string) {
  // Fetch AST symbols from Neo4j
  const rows = await runCypher<SymbolRow>(
    `
    MATCH (f:CodeFile {repoId: $repoId})-[:DECLARES|:DEFINED_IN]->(s:Symbol)
    WHERE s.startLine IS NOT NULL AND s.endLine IS NOT NULL
    RETURN
      f.relPath AS relPath,
      coalesce(s.qname, s.name) AS symbolName,
      s.startLine AS startLine,
      s.endLine AS endLine
    ORDER BY relPath, startLine
    `,
    { repoId }
  );

  console.log(`[AST-EMBED] Found ${rows.length} symbols`);

  // Group symbols by file
  const byFile = new Map<string, SymbolRow[]>();
  for (const row of rows) {
    if (!byFile.has(row.relPath)) byFile.set(row.relPath, []);
    byFile.get(row.relPath)!.push(row);
  }

  let totalEmbedded = 0;

  // Process each file
  for (const [relPath, symbols] of byFile.entries()) {
    // Use the repoRoot passed as argument
    const absPath = path.join(repoRoot, relPath);
    const text = await fs.readFile(absPath, "utf8").catch(() => "");

    if (!text) {
      console.warn(`[AST-EMBED] Skipping empty/missing file: ${relPath}`);
      continue;
    }

    const lines = text.split(/\r?\n/);

    for (const sym of symbols) {
      // Extract the code chunk
      const chunkText = lines
        .slice(sym.startLine - 1, sym.endLine)
        .join("\n");

      if (!chunkText.trim()) continue;

      // Fake embedding array
      const fakeEmbedding = Array(768).fill(0.01);

      // MERGE node by unique key (repoId + relPath + symbol)
      try {
        await runCypher(
          `
          MERGE (c:CodeChunk { repoId: $repoId, relPath: $relPath, symbol: $symbol })
          SET
            c.startLine = $startLine,
            c.endLine = $endLine,
            c.text = $text,
            c.embedding = $embedding,
            c.generatedAt = datetime()
          `,
          {
            repoId,
            relPath,
            symbol: sym.symbolName,
            startLine: Number(sym.startLine),
            endLine: Number(sym.endLine),
            text: chunkText,
            embedding: fakeEmbedding,
          }
        );
        totalEmbedded++;
      } catch (err) {
        console.error(
          `[AST-EMBED] Failed to embed symbol ${sym.symbolName} in ${relPath}:`,
          err
        );
      }
    }

    console.log(`[AST-EMBED] Processed ${symbols.length} symbols from ${relPath}`);
  }

  console.log(`[AST-EMBED] Total embedded symbols: ${totalEmbedded}`);
  return { ok: true, files: byFile.size, totalEmbedded };
}
