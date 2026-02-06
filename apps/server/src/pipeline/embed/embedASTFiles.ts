import { runCypher } from "../../db/cypher";
import { generateEmbeddings } from "../../ai/embeddings";
import path from "path";
import fs from "fs/promises";

type SymbolRow = {
  relPath: string;
  symbolName: string;
  startLine: number;
  endLine: number;
};

type ChunkData = {
  text: string;
  metadata: {
    repoId: string;
    relPath: string;
    symbol: string;
    startLine: number;
    endLine: number;
  };
};

/**
 * Embeds AST symbols as CodeChunk nodes in Neo4j with real embeddings.
 * @param repoId - The Neo4j repo ID
 * @param repoRoot - Absolute path to the repo folder (like fzf-master)
 */
export async function embedASTFiles(repoId: string, repoRoot: string) {
  console.log(`[AST-EMBED] Starting embedding for repo: ${repoId}`);
  console.log(`[AST-EMBED] Repo root: ${repoRoot}`);
  
  // Fetch AST symbols from Neo4j
  console.log(`[AST-EMBED] Querying Neo4j for symbols...`);
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

  if (rows.length === 0) {
    console.log(`[AST-EMBED] No symbols found for repo ${repoId}`);
    return { ok: true, files: 0, totalEmbedded: 0 };
  }

  // Group symbols by file
  const byFile = new Map<string, SymbolRow[]>();
  for (const row of rows) {
    if (!byFile.has(row.relPath)) byFile.set(row.relPath, []);
    byFile.get(row.relPath)!.push(row);
  }

  let totalEmbedded = 0;
  const batchSize = 10; // Smaller batch size for faster processing
  const maxFiles = 5; // Process max 5 files for testing
  let filesProcessed = 0;

  console.log(`[AST-EMBED] Processing ${byFile.size} files...`);

  // Process each file
  for (const [relPath, symbols] of byFile.entries()) {
    if (filesProcessed >= maxFiles) {
      console.log(`[AST-EMBED] Reached max files limit (${maxFiles}), stopping...`);
      break;
    }
    
    console.log(`[AST-EMBED] Processing file ${filesProcessed + 1}/${Math.min(byFile.size, maxFiles)}: ${relPath}`);
    
    // Use the repoRoot passed as argument
    const absPath = path.join(repoRoot, relPath);
    console.log(`[AST-EMBED] Reading file: ${absPath}`);
    
    const text = await fs.readFile(absPath, "utf8").catch((err) => {
      console.warn(`[AST-EMBED] Failed to read file ${relPath}:`, err.message);
      return "";
    });

    if (!text) {
      console.warn(`[AST-EMBED] Skipping empty/missing file: ${relPath}`);
      continue;
    }

    const lines = text.split(/\r?\n/);
    const chunks: ChunkData[] = [];

    // Prepare chunks
    console.log(`[AST-EMBED] Preparing ${symbols.length} chunks...`);
    for (const sym of symbols) {
      const chunkText = lines
        .slice(sym.startLine - 1, sym.endLine)
        .join("\n");

      if (!chunkText.trim()) continue;

      chunks.push({
        text: chunkText,
        metadata: {
          repoId,
          relPath,
          symbol: sym.symbolName,
          startLine: Number(sym.startLine),
          endLine: Number(sym.endLine),
        },
      });
    }

    console.log(`[AST-EMBED] Have ${chunks.length} chunks to embed`);

    // Generate real embeddings in batches
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map((c) => c.text);

      console.log(`[AST-EMBED] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunks.length/batchSize)} (${texts.length} texts)...`);

      try {
        const embeddings = await generateEmbeddings(texts);
        console.log(`[AST-EMBED] Generated ${embeddings.length} embeddings`);

        // Store in Neo4j with real embeddings
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const embedding = embeddings[j];

          if (!chunk || !embedding) continue;

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
              repoId: chunk.metadata.repoId,
              relPath: chunk.metadata.relPath,
              symbol: chunk.metadata.symbol,
              startLine: chunk.metadata.startLine,
              endLine: chunk.metadata.endLine,
              text: chunk.text,
              embedding: embedding,
            }
          );
          totalEmbedded++;
        }
        console.log(`[AST-EMBED] ✓ Batch ${Math.floor(i/batchSize) + 1} stored in Neo4j`);
      } catch (err) {
        console.error(
          `[AST-EMBED] Failed to embed batch in ${relPath}:`,
          err
        );
      }
    }

    console.log(`[AST-EMBED] ✓ File ${relPath} complete (${symbols.length} symbols processed)`);
    filesProcessed++;
  }

  console.log(`[AST-EMBED] Total embedded: ${totalEmbedded} symbols from ${filesProcessed} files`);
  return { ok: true, files: filesProcessed, totalEmbedded };
}
