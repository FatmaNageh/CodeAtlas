import { generateBatchSummaries } from '../generateSummary';
import { runCypher } from '../../db/cypher';

export interface SummarizeResult {
  ok: boolean;
  count: number;
  results: Array<{ filePath: string; summary: string }>;
  errors: string[];
}

// Pure functional pipeline - replaces fake implementation
export async function summarizeFiles(repoId: string): Promise<SummarizeResult> {
  console.log(`[SUMMARIZE] Starting for repo: ${repoId}`);

  try {
    // Get files
    const files = await runCypher(
      `MATCH (f:CodeFile {repoId: $repoId})
       RETURN f.relPath as filePath
       ORDER BY f.relPath`,
      { repoId }
    );

    console.log(`[SUMMARIZE] Found ${files.length} files`);

    // Generate summaries
    const filePaths = files.map((f: any) => f.filePath);
    const { results, errors } = await generateBatchSummaries(filePaths, repoId);

    return {
      ok: true,
      count: results.length,
      results,
      errors,
    };
  } catch (error) {
    console.error(`[SUMMARIZE] Failed:`, error);
    return {
      ok: false,
      count: 0,
      results: [],
      errors: [String(error)],
    };
  }
}
