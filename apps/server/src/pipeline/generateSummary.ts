import fs from 'fs/promises';
import path from 'path';
import { assembleFileContext } from '../retrieval/context';
import { generateTextWithContext } from '../ai/generation';
import { buildSummaryPrompt } from '../prompts/summary';
import { runCypher } from '../db/cypher';
import { repoRoots } from '../state/repoRoots';

type FileNodeLabel = 'CodeFile' | 'TextFile';

type FileNodeKindRow = {
  label: FileNodeLabel;
};

async function getFileNodeLabel(filePath: string, repoId: string): Promise<FileNodeLabel> {
  const rows = await runCypher<FileNodeKindRow>(
    `/*cypher*/
    MATCH (f {repoId: $repoId, path: $filePath})
    WHERE f:CodeFile OR f:TextFile
    RETURN CASE WHEN f:CodeFile THEN 'CodeFile' ELSE 'TextFile' END AS label
    LIMIT 1`,
    { repoId, filePath },
  );

  const label = rows[0]?.label;
  if (label === 'CodeFile' || label === 'TextFile') {
    return label;
  }

  throw new Error(`[SUMMARY] Could not find file node for ${filePath} in repo ${repoId}`);
}

// Pure function to generate file summary
export async function generateFileSummary(filePath: string, repoId: string) {
  console.log(`[SUMMARY] Generating for ${filePath}`);

  const context = await assembleFileContext(filePath, repoId);
  const fileLabel = await getFileNodeLabel(filePath, repoId);
  
  let code = context.fileChunks
    .map((chunk) => chunk.text ?? "")
    .filter((text) => text.length > 0)
    .join('\n\n');
  
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
  
  const symbols = context.relatedASTNodes.map((node) => node.symbol).filter(Boolean);
  
  if (!code || code.trim().length === 0) {
    throw new Error(
      `[SUMMARY] No code available for ${filePath} in repo ${repoId}: ` +
      `not found in database chunks and unable to read from disk. Cannot generate summary without code.`
    );
  }
  
  const prompt = buildSummaryPrompt({
    filePath,
    code: code.slice(0, 3000),
    symbols,
    imports: context.references,
  });
  
  const summary = await generateTextWithContext(prompt, {
    temperature: 0.1,
    maxTokens: 800,
  });
  
  const result = await runCypher(
    `/*cypher*/
     MATCH (f:${fileLabel} {repoId: $repoId, path: $filePath})
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
