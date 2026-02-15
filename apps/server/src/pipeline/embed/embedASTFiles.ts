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
 * @param batchSize - Number of embeddings to process at once (default: 10)
 * @param maxFiles - Maximum number of files to process (default: Infinity for no limit)
 */
export async function embedASTFiles(
  repoId: string, 
  repoRoot: string,
  batchSize: number = 10,
  maxFiles: number = Infinity
) {
  if (batchSize < 1) {
    throw new Error(`batchSize must be >= 1, got ${batchSize}`);
  }
  if (maxFiles < 1) {
    throw new Error(`maxFiles must be >= 1, got ${maxFiles}`);
  }

  console.log(`[AST-EMBED] Starting embedding for repo: ${repoId}`);
  console.log(`[AST-EMBED] Starting embedding for repo: ${repoId}`);
  console.log(`[AST-EMBED] Repo root: ${repoRoot}`);
  console.log(`[AST-EMBED] Batch size: ${batchSize}, Max files: ${maxFiles === Infinity ? 'unlimited' : maxFiles}`);
  
  // Resolve and canonicalize repo root for path traversal checks
  const repoRootResolved = path.resolve(repoRoot);
  
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
    return { ok: true, files: 0, totalEmbedded: 0, failedBatches: 0 };
  }

  // Group symbols by file
  const byFile = new Map<string, SymbolRow[]>();
  for (const row of rows) {
    if (!byFile.has(row.relPath)) byFile.set(row.relPath, []);
    byFile.get(row.relPath)!.push(row);
  }

  let totalEmbedded = 0;
  let filesProcessed = 0;
  let failedBatches = 0;
  const failedBatchDetails: string[] = [];

  console.log(`[AST-EMBED] Processing ${byFile.size} files...`);

  // Process each file
  for (const [relPath, symbols] of byFile.entries()) {
    if (filesProcessed >= maxFiles) {
      console.log(`[AST-EMBED] Reached max files limit (${maxFiles}), stopping...`);
      break;
    }
    
    console.log(`[AST-EMBED] Processing file ${filesProcessed + 1}/${Math.min(byFile.size, maxFiles)}: ${relPath}`);
    
    // Validate path to prevent traversal attacks
    const absPath = path.resolve(repoRoot, relPath);
    if (!absPath.startsWith(repoRootResolved + path.sep) && absPath !== repoRootResolved) {
      console.warn(`[AST-EMBED] ⚠ Path traversal detected for ${relPath}, skipping...`);
      continue;
    }
    
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

        // Store in Neo4j with real embeddings, filtering out null embeddings
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const embedding = embeddings[j];

          if (!chunk || !embedding) {
            if (!embedding) {
              console.warn(`[AST-EMBED] Skipping chunk ${j} in batch due to failed embedding`);
            }
            continue;
          }

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
        failedBatches++;
        const batchNum = Math.floor(i/batchSize) + 1;
        const errorMsg = `Batch ${batchNum} in ${relPath}: ${err instanceof Error ? err.message : String(err)}`;
        failedBatchDetails.push(errorMsg);
        console.error(
          `[AST-EMBED] Failed to embed batch in ${relPath}:`,
          err
        );
      }
    }

    console.log(`[AST-EMBED] ✓ File ${relPath} complete (${symbols.length} symbols processed)`);
    filesProcessed++;
  }

  console.log(`[AST-EMBED] Total embedded: ${totalEmbedded} symbols from ${filesProcessed} files, ${failedBatches} failed batches`);
  return { 
    ok: failedBatches === 0, 
    files: filesProcessed, 
    totalEmbedded,
    failedBatches,
    failedBatchDetails: failedBatches > 0 ? failedBatchDetails : undefined
  };
}
