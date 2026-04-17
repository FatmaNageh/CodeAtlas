import fs, { constants as fsConstants } from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { runCypher } from "@/db/cypher";
import { deleteRepo } from "@/db/neo4j/delete";
import { deleteIndexState } from "@/pipeline/indexState";
import { DEFAULT_IGNORE_PATTERNS, scanRepo } from "@/pipeline/scan";
import type { SupportedLanguage } from "@/types/scan";

import { normalizeProjectPath } from "./indexing";

export const validateRepositoryInputSchema = z.object({
  projectPath: z.string().min(1),
  ignorePatterns: z.array(z.string().min(1)).optional().default([...DEFAULT_IGNORE_PATTERNS]),
});

export const deleteRepositoryInputSchema = z.object({
  repoId: z.string().min(1),
});

type RepoRootRow = {
  rootPath: string | null;
};

type ValidationLanguageSummary = Partial<Record<SupportedLanguage, number>>;

function createLanguageSummary(): ValidationLanguageSummary {
  return {};
}

export async function validateRepository(input: z.infer<typeof validateRepositoryInputSchema>) {
  const projectPath = normalizeProjectPath(input.projectPath);
  const resolvedPath = path.resolve(projectPath);
  const ignorePatterns = input.ignorePatterns.map((pattern) => pattern.trim()).filter(Boolean);

  let stat;
  try {
    stat = await fsPromises.stat(resolvedPath);
  } catch {
    return {
      ok: false as const,
      projectPath: resolvedPath,
      error: "Repository path does not exist.",
    };
  }

  if (!stat.isDirectory()) {
    return {
      ok: false as const,
      projectPath: resolvedPath,
      error: "Repository path must point to a directory.",
    };
  }

  try {
    await fsPromises.access(resolvedPath, fsConstants.R_OK);
  } catch {
    return {
      ok: false as const,
      projectPath: resolvedPath,
      error: "Repository path is not accessible with read permissions.",
    };
  }

  const scan = await scanRepo(resolvedPath, { ignorePatterns, computeHash: false });
  const languageSummary = createLanguageSummary();
  let codeFiles = 0;
  let textFiles = 0;

  for (const entry of scan.entries) {
    if (entry.kind === "code") {
      codeFiles += 1;
      languageSummary[entry.language] = (languageSummary[entry.language] ?? 0) + 1;
    } else {
      textFiles += 1;
    }
  }

  return {
    ok: true as const,
    projectPath: resolvedPath,
    supportedFiles: {
      total: scan.entries.length,
      code: codeFiles,
      documentation: textFiles,
      byLanguage: languageSummary,
    },
    ignoredCount: scan.ignoredCount,
    ignorePatterns,
  };
}

async function getRepoRoot(repoId: string): Promise<string | null> {
  const rows = await runCypher<RepoRootRow>(
    `/*cypher*/
    MATCH (r:Repo {repoId: $repoId})
    RETURN r.rootPath AS rootPath
    LIMIT 1`,
    { repoId },
  );

  return rows[0]?.rootPath ?? null;
}

export async function deleteRepositoryGraph(input: z.infer<typeof deleteRepositoryInputSchema>) {
  const repoRoot = await getRepoRoot(input.repoId);
  if (!repoRoot) {
    return {
      ok: false as const,
      repoId: input.repoId,
      error: "Repository graph was not found.",
    };
  }

  await deleteRepo(input.repoId, repoRoot);

  if (fs.existsSync(repoRoot)) {
    await deleteIndexState(repoRoot);
  }

  return {
    ok: true as const,
    repoId: input.repoId,
    repoRoot,
  };
}
