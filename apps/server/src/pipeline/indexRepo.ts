import path from "path";
import type { IndexMode, CodeFileIndexEntry, TextFileIndexEntry } from "../types/scan";
import { scanRepo } from "./scan";
import { loadIndexState, saveIndexState, diffScan } from "./indexState";
import { parseAndExtract } from "./parseExtract";
import { extractTextFacts } from "./textExtract";
import { buildIR } from "./ir";
import { ensureSchema } from "../db/neo4j/schema";
import { ingestIR } from "../db/neo4j/ingest";
import { cleanupStaleByRunId } from "../db/neo4j/cleanup";
import { deleteFile, deleteFileDerived } from "../db/neo4j/delete";
import { repoIdFromPath } from "./id";
import { saveDebug } from "./debug";
import { findImportDependents } from "./invalidate";

export async function indexRepository(input: {
  projectPath: string;
  mode: IndexMode;
  saveDebugJson: boolean;
  computeHash?: boolean;
  /**
   * If true, run scan/parse/extract/buildIR (and optionally write debug/state),
   * but skip ALL Neo4j side effects (schema, deletes, ingest, cleanup).
   * This makes the pipeline testable without a running database.
   */
  dryRun?: boolean;
}) {
  const repoRoot = path.resolve(input.projectPath);
  const repoId = repoIdFromPath(repoRoot);
  const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

  const scan = await scanRepo(repoRoot, { computeHash: input.computeHash ?? false });
  const prev = await loadIndexState(repoRoot);
  const diff = diffScan(prev, scan);

  const mode: IndexMode = input.mode ?? "incremental";
  const isFirstRun = !prev;
  const effectiveMode: IndexMode = isFirstRun ? "full" : mode;
  
// Phase 2: dependency-aware incremental invalidation.
// In incremental mode, re-process changed/added files PLUS dependents that import changed/removed files.
let filesToProcess =
  effectiveMode === "full" ? scan.entries : [...diff.added, ...diff.changed];

let impactedDependents: string[] = [];
if (effectiveMode !== "full" && !input.dryRun) {
  const targets = [
    ...diff.changed.map((e) => e.relPath),
    ...diff.removed.map((e) => e.relPath),
  ];

  try {
    impactedDependents = await findImportDependents({ repoId, targetRelPaths: targets });
  } catch {
    // If Neo4j isn't reachable, we still can proceed with basic incremental.
    impactedDependents = [];
  }

  const byRel = new Map(scan.entries.map((e) => [e.relPath, e] as const));

  for (const relPath of impactedDependents) {
    const entry = byRel.get(relPath);
    if (!entry) continue;
    // Skip if already scheduled or if it was removed in this scan
    const already = filesToProcess.some((f) => f.relPath === relPath);
    if (!already) filesToProcess.push(entry);
  }
}

  const codeFilesToProcess = filesToProcess.filter((e): e is CodeFileIndexEntry => e.kind === "code");
  const textFilesToProcess = filesToProcess.filter((e): e is TextFileIndexEntry => e.kind === "text");

  const codeFacts = await parseAndExtract(codeFilesToProcess);
  const textFacts = await extractTextFacts(textFilesToProcess);
  const facts = { ...codeFacts, ...textFacts };
  const ir = buildIR(scan, facts);

  if (!input.dryRun) {
    await ensureSchema();

    if (effectiveMode === "full") {
      // Phase 2: Full rebuild using runId tagging + stale cleanup (no hard delete needed).
      await ingestIR(ir, { runId });

      // Remove any nodes/relationships from older runs for this repo.
      await cleanupStaleByRunId({ repoId, runId });
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
      await ingestIR(ir, { runId });
    }
  }

  await saveIndexState(repoRoot, scan);

  let debugDir: string | null = null;
  if (input.saveDebugJson) debugDir = await saveDebug(repoRoot, repoId, facts, ir);

  return {
    repoId,
    runId,
    repoRoot,
    mode: effectiveMode,
    dryRun: input.dryRun ?? false,
    scanned: {
      totalFiles: scan.entries.length,
      ignoredCount: scan.ignoredCount,
      processedFiles: filesToProcess.length,
      impactedDependents,
      diff,
    },
    stats: ir.stats,
    debugDir,
  };
}
