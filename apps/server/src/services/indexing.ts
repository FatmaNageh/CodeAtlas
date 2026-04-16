import { z } from "zod";

import { indexRepository } from "@/pipeline/indexRepo";
import { repoRoots } from "@/state/repoRoots";

export const indexRepoInputSchema = z.object({
  projectPath: z.string().min(1),
  mode: z.enum(["full", "incremental"]).optional().default("incremental"),
  saveDebugJson: z.boolean().optional().default(true),
  computeHash: z.boolean().optional().default(true),
});

export type IndexRepoInput = z.infer<typeof indexRepoInputSchema>;

let indexingInProgress = false;

export function isIndexingInProgress(): boolean {
  return indexingInProgress;
}

export function normalizeProjectPath(projectPath: string): string {
  const trimmedPath = projectPath.replace(/^file:\/\/\//i, "").trim();
  const isWindowsPath = /^[a-zA-Z]:/.test(trimmedPath);
  return isWindowsPath ? trimmedPath.replace(/\//g, "\\") : trimmedPath;
}

export async function startIndexing(input: IndexRepoInput) {
  const projectPath = normalizeProjectPath(input.projectPath);

  try {
    indexingInProgress = true;

    const result = await indexRepository({
      ...input,
      projectPath,
    });

    repoRoots.set(result.repoId, projectPath);
    return result;
  } finally {
    indexingInProgress = false;
  }
}
