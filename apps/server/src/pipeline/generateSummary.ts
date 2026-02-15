import fs from 'fs/promises';
import path from 'path';
import { assembleFileContext } from '../retrieval/context';
import { generateTextWithContext } from '../ai/generation';
import { buildSummaryPrompt } from '../prompts/summary';
import { runCypher } from '../db/cypher';
import { repoRoots } from '../state/repoRoots';

// Pure function to generate file summary
export async function generateFileSummary(filePath: string, repoId: string) {
  console.log(`[SUMMARY] Generating for ${filePath}`);

  // Assemble context
  const context = await assembleFileContext(filePath, repoId);
  
  // Extract data from chunks
  let code = context.fileChunks.map((c: any) => c.text).join('\n\n');
  
  // If no chunks found in database, read file directly from disk
  if (!code || code.trim().length === 0) {
    console.log(`[SUMMARY] No chunks in DB for ${filePath}, reading from disk...`);
    const repoRoot = repoRoots.get(repoId);
    if (repoRoot) {
      try {
        const absPath = path.join(repoRoot, filePath);
        code = await fs.readFile(absPath, 'utf8');
        console.log(`[SUMMARY] ✓ Read ${code.length} chars from disk for ${filePath}`);
      } catch (err: any) {
        console.error(`[SUMMARY] ✗ Failed to read ${filePath} from disk:`, err.message);
      }
    } else {
      console.warn(`[SUMMARY] No repoRoot found for ${repoId}, cannot read from disk`);
    }
  }
  
  const symbols = context.relatedSymbols.map((s: any) => s.symbol).filter(Boolean);
  
  // Check if we have code available, fail if both DB and disk reads failed
  if (!code || code.trim().length === 0) {
    throw new Error(
      `[SUMMARY] No code available for ${filePath} in repo ${repoId}: ` +
      `not found in database chunks and unable to read from disk. Cannot generate summary without code.`
    );
  }
  
  // Build prompt
  const prompt = buildSummaryPrompt({
    filePath,
    code: code.slice(0, 3000),
    symbols,
    imports: context.imports,
  });
  
  // Generate summary
  const summary = await generateTextWithContext(prompt, {
    temperature: 0.1,
    maxTokens: 800,
  });
  
  // Store in Neo4j - use MERGE to create node if it doesn't exist
  const result = await runCypher(
    `MERGE (f:CodeFile {repoId: $repoId, relPath: $filePath})
     SET f.summary = $summary,
         f.summaryAt = datetime(),
         f.summaryModel = 'meta-llama/llama-3.1-8b-instruct'
     RETURN f`,
    { repoId, filePath, summary }
  );
  
  if (result.length === 0) {
    throw new Error(`[SUMMARY] Failed to persist summary for ${filePath} - no node matched or created`);
  }

  return { filePath, summary };
}

// Pure function for batch processing
export async function generateBatchSummaries(filePaths: string[], repoId: string) {
  const results: Array<{ filePath: string; summary: string }> = [];
  const errors: string[] = [];
  
  const repoRoot = repoRoots.get(repoId);
  console.log(`[SUMMARY-BATCH] Processing ${filePaths.length} files for repo ${repoId}`);
  console.log(`[SUMMARY-BATCH] Repo root: ${repoRoot || 'NOT SET - will try DB only'}`);

  for (const filePath of filePaths) {
    try {
      const result = await generateFileSummary(filePath, repoId);
      results.push(result);
      console.log(`[SUMMARY-BATCH] ✓ ${filePath}`);
    } catch (error) {
      const errorMsg = `Failed ${filePath}: ${error}`;
      errors.push(errorMsg);
      console.error(`[SUMMARY-BATCH] ✗ ${errorMsg}`);
    }
  }
  
  console.log(`[SUMMARY-BATCH] Complete: ${results.length} succeeded, ${errors.length} failed`);

  return { results, errors };
}
