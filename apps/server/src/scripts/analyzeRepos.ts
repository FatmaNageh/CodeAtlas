import {
  analyzeRepos,
  analyzeReposInputSchema,
  SUPPORTED_LANGUAGES,
} from "@/services/repoAnalysis";

async function main(): Promise<void> {
  const rawPaths = process.argv.slice(2).map((value) => value.trim()).filter((value) => value.length > 0);
  const parsed = analyzeReposInputSchema.safeParse({ repoPaths: rawPaths });
  if (!parsed.success) {
    throw new Error("Usage: pnpm --filter server run analyze-repos:json -- <repoPath> [moreRepoPaths...]");
  }
  const results = await analyzeRepos(parsed.data);
  process.stdout.write(`${JSON.stringify({ ok: true, repos: results, supportedLanguages: SUPPORTED_LANGUAGES }, null, 2)}\n`);
}

void main();
