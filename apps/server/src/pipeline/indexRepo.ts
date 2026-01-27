import path from "path";
import type { IndexMode } from "../types/scan";
import { scanRepo } from "./scan";
import { loadIndexState, saveIndexState, diffScan } from "./indexState";
import { parseAndExtract } from "./parseExtract";
import { buildIR } from "./ir";
import { ensureSchema } from "../neo4j/schema";
import { ingestIR } from "../neo4j/ingest";
import { deleteRepo, deleteFile, deleteFileDerived } from "../neo4j/delete";
import { repoIdFromPath } from "./id";
import { saveDebug } from "./debug";

export async function indexRepository(input: {
  projectPath: string;
  mode: IndexMode;
  saveDebugJson: boolean;
  computeHash?: boolean;
}) {
  const repoRoot = path.resolve(input.projectPath);
  const repoId = repoIdFromPath(repoRoot);

  const scan = await scanRepo(repoRoot, { computeHash: input.computeHash ?? false });
  const prev = await loadIndexState(repoRoot);
  const diff = diffScan(prev, scan);

  const mode: IndexMode = input.mode ?? "incremental";
  const isFirstRun = !prev;
  const effectiveMode: IndexMode = isFirstRun ? "full" : mode;
  const filesToProcess = effectiveMode === "full" ? scan.entries : [...diff.added, ...diff.changed];

  const facts = await parseAndExtract(filesToProcess);
  const ir = buildIR(scan, facts);

  await ensureSchema();

  if (effectiveMode === "full") {
    // Full rebuild: wipe repo subgraph then ingest everything.
    await deleteRepo(repoId);
    await ingestIR(ir);
  } else {
    // Incremental (Phase 1 requirement):
    // - delete removed file nodes
    // - delete & replace derived subgraphs for added/changed files
    for (const rm of diff.removed) {
      await deleteFile(repoId, rm.relPath);
    }

    for (const f of filesToProcess) {
      await deleteFileDerived(repoId, f.relPath);
    }

    // Ingest structure for current scan + derived facts for processed files.
    // Unchanged file-derived nodes remain in the DB.
    await ingestIR(ir);
  }

  await saveIndexState(repoRoot, scan);

  let debugDir: string | null = null;
  if (input.saveDebugJson) debugDir = await saveDebug(repoRoot, repoId, facts, ir);

  return {
    repoId,
    repoRoot,
    mode: effectiveMode,
    scanned: {
      totalFiles: scan.entries.length,
      ignoredCount: scan.ignoredCount,
      processedFiles: filesToProcess.length,
      diff,
    },
    stats: ir.stats,
    debugDir,
  };
}
