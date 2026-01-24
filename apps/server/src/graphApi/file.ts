import { fileId } from "../pipeline/id";
import { Queries } from "./queries";
import { runCypher } from "./runCypher";

export async function getFileByRelPath(repoId: string, relPath: string) {
  const rows = await runCypher<{ f: any }>(
    `MATCH (f:File {repoId: $repoId, relPath: $relPath}) RETURN f LIMIT 1`,
    { repoId, relPath },
  );
  return rows[0]?.f ?? null;
}

export async function getFileDetails(repoId: string, relPath: string) {
  const rows = await runCypher<{ f: any; symbols: any[]; imports: any[] }>(
    Queries.fileDetails,
    { fileId: fileId(repoId, relPath) },
  );
  return rows[0] ?? { f: null, symbols: [], imports: [] };
}

/** Impact baseline: which files import this file? (Requires resolved IMPORTS edges if available.) */
export async function getFileImpact(repoId: string, relPath: string) {
  const rows = await runCypher<{ target: any; importers: any[] }>(
    Queries.fileImpact,
    { fileId: fileId(repoId, relPath) },
  );
  return rows[0] ?? { target: null, importers: [] };
}

export async function expandNeighborhood(nodeId: string) {
  const rows = await runCypher<{ n: any; out: any[]; in: any[] }>(
    Queries.expandNeighborhood,
    { nodeId },
  );
  return rows[0] ?? { n: null, out: [], in: [] };
}
