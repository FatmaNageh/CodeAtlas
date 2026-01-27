import { dirId, repoNodeId } from "../pipeline/id";
import { Queries } from "./queries";
import { runCypher } from "./runCypher";

export async function getRepoSummary(repoId: string) {
  const rows = await runCypher<{ r: any; directories: any; files: any }>(
    Queries.repoSummary,
    { repoNodeId: repoNodeId(repoId) },
  );
  const row = rows[0];
  return {
    repo: row?.r ?? null,
    directories: Number(row?.directories ?? 0),
    files: Number(row?.files ?? 0),
  };
}

export async function getTreeRoot(repoId: string) {
  const rows = await runCypher<{ r: any; d: any }>(
    Queries.treeRoot,
    { repoNodeId: repoNodeId(repoId) },
  );
  return rows[0] ?? { r: null, d: null };
}

export async function listDirectory(repoId: string, relDirPath: string) {
  const rows = await runCypher<{ d: any; children: any[] }>(
    Queries.listDirectory,
    { dirId: dirId(repoId, relDirPath) },
  );
  return rows[0] ?? { d: null, children: [] };
}
