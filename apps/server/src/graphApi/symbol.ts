import { Queries } from "./queries";
import { runCypher } from "./runCypher";

export async function searchSymbols(repoId: string, query: string, limit: number = 25) {
  const q = query.trim();
  if (!q) return [];
  const rows = await runCypher<{ s: any }>(Queries.searchSymbols, { repoId, q, limit });
  return rows.map((r) => r.s);
}
