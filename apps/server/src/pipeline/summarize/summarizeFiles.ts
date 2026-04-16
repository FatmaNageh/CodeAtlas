import { generateBatchSummaries } from '../generateSummary';
import { runCypher } from '../../db/cypher';

export interface SummarizeResult {
  ok: boolean;
  count: number;
  results: Array<{ filePath: string; summary: string }>;
  errors: string[];
}

export async function summarizeFiles(repoId: string): Promise<SummarizeResult> {
  console.log(`[SUMMARIZE] Starting for repo: ${repoId}`);

  try {
    const files = await runCypher(
      `MATCH (f:CodeFile {repoId: $repoId})
       RETURN f.relPath as filePath
       ORDER BY f.relPath`,
      { repoId }
    );

    console.log(`[SUMMARIZE] Found ${files.length} files`);

    const filePaths = files
      .map((file) => file.filePath)
      .filter((filePath): filePath is string => typeof filePath === "string" && filePath.length > 0);
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
