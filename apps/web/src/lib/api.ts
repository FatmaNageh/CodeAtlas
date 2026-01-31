export type IndexMode = "full" | "incremental";

export type IndexRepoRequest = {
  projectPath: string;
  mode: IndexMode;
  saveDebugJson?: boolean;
  computeHash?: boolean;
  dryRun?: boolean;
};

export async function healthCheck(baseUrl = ""): Promise<any> {
  const res = await fetch(`${baseUrl}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function indexRepo(
  body: IndexRepoRequest,
  baseUrl = ""
): Promise<any> {
  const res = await fetch(`${baseUrl}/indexRepo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Index failed: ${res.status} ${res.statusText}${text ? `\n${text}` : ""}`);
  }
  return res.json();
}

export async function fetchIr(repoId: string, baseUrl = ""): Promise<any> {
  const res = await fetch(`${baseUrl}/debug/ir?repoId=${encodeURIComponent(repoId)}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Fetch IR failed: ${res.status} ${res.statusText}${text ? `\n${text}` : ""}`);
  }
  return res.json();
}

export async function fetchNeo4jSubgraph(repoId: string, baseUrl = "", limit = 500): Promise<any> {
  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0)) || 500;
  const res = await fetch(
    `${baseUrl}/debug/subgraph?repoId=${encodeURIComponent(repoId)}&limit=${encodeURIComponent(String(safeLimit))}`,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Fetch subgraph failed: ${res.status} ${res.statusText}${text ? `\n${text}` : ""}`);
  }
  return res.json();
}
