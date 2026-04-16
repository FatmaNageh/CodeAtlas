export type IndexMode = "full" | "incremental";

export type TourMode = "graph";

export type TourStep = {
  rank: number;
  filePath: string;
  score: number;
  scoreBreakdown: {
    graphScore: number;
  };
  metrics: {
    inDegree: number;
    outDegree: number;
    totalDegree: number;
    depth: number;
  };
  summary: string;
};

export type TourResponse = {
  ok: true;
  repoId: string;
  mode: TourMode;
  generatedAt: string;
  steps: TourStep[];
};

export type IndexRepoRequest = {
  projectPath: string;
  mode: IndexMode;
  saveDebugJson?: boolean;
  computeHash?: boolean;
  dryRun?: boolean;
};

export type IndexRepoResponse = {
  ok: true;
  repoId: string;
  runId: string;
  repoRoot: string;
  mode: IndexMode;
  dryRun: boolean;
  scanned: {
    totalFiles: number;
    ignoredCount: number;
    processedFiles: number;
    impactedDependents: string[];
    diff: {
      added: Array<{ relPath: string }>;
      changed: Array<{ relPath: string }>;
      removed: Array<{ relPath: string }>;
      unchanged: Array<{ relPath: string }>;
    };
  };
  stats: {
    files: number;
    dirs: number;
    textChunks: number;
    astNodes: number;
    edges: number;
  };
  debugDir: string | null;
};

export async function healthCheck(baseUrl = ""): Promise<any> {
  const res = await fetch(`${baseUrl}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function indexRepo(
  body: IndexRepoRequest,
  baseUrl = ""
): Promise<IndexRepoResponse> {
  const res = await fetch(`${baseUrl}/indexRepo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Index failed: ${res.status} ${res.statusText}${text ? `\n${text}` : ""}`);
  }
  return res.json() as Promise<IndexRepoResponse>;
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

export async function fetchTour(repoId: string, baseUrl = "", limit = 12): Promise<TourResponse> {
  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0)) || 12;
  const res = await fetch(
    `${baseUrl}/graphrag/tour?repoId=${encodeURIComponent(repoId)}&limit=${encodeURIComponent(String(safeLimit))}`,
  );
  const data = (await res.json().catch(() => ({}))) as Partial<TourResponse> & { error?: string; ok?: boolean };

  if (!res.ok || data.ok !== true) {
    throw new Error(data.error ?? `Fetch tour failed: ${res.status} ${res.statusText}`);
  }

  return data as TourResponse;
}
