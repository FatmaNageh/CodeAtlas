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

export type EvaluatorRunRecord = {
  id: string;
  evaluationType: "ask" | "summarize" | "tour";
  repoId: string;
  threadId: string | null;
  sourcePayloadJson: string | null;
  question: string;
  response: string;
  referenceAnswer: string | null;
  retrievedContext: string | null;
  retrievalCount: number;
  correctnessScore: number | null;
  correctnessRationale: string | null;
  groundednessScore: number | null;
  groundednessRationale: string | null;
  relevanceScore: number | null;
  relevanceRationale: string | null;
  retrievalRelevanceScore: number | null;
  retrievalRelevanceRationale: string | null;
  latencyMs: number;
  model: string;
  createdAt: string;
};

export type IndexRepoRequest = {
  projectPath: string;
  mode: IndexMode;
  saveDebugJson?: boolean;
  computeHash?: boolean;
  dryRun?: boolean;
  ignorePatterns?: string[];
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

export type RepositoryValidationResponse =
  | {
      ok: true;
      projectPath: string;
      supportedFiles: {
        total: number;
        code: number;
        documentation: number;
        byLanguage: Partial<Record<string, number>>;
      };
      ignoredCount: number;
      ignorePatterns: string[];
    }
  | {
      ok: false;
      projectPath?: string;
      error: string;
    };

export async function validateRepository(
  body: { projectPath: string; ignorePatterns?: string[] },
  baseUrl = "",
): Promise<RepositoryValidationResponse> {
  const res = await fetch(`${baseUrl}/repository/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<RepositoryValidationResponse>;
}

export type DeleteRepositoryGraphResponse =
  | {
      ok: true;
      repoId: string;
      repoRoot: string;
    }
  | {
      ok: false;
      repoId?: string;
      error: string;
    };

export async function deleteRepositoryGraph(
  body: { repoId: string },
  baseUrl = "",
): Promise<DeleteRepositoryGraphResponse> {
  const res = await fetch(`${baseUrl}/repository/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`Delete failed: ${res.status} ${res.statusText} — server returned an empty response`);
  }
  try {
    return JSON.parse(text) as DeleteRepositoryGraphResponse;
  } catch {
    throw new Error(`Delete failed: ${res.status} ${res.statusText}\n${text.slice(0, 300)}`);
  }
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

export type RepoRecord = {
  repoId: string;
  rootPath: string;
  indexedAt?: string;
  [key: string]: unknown;
};

export type ChatThreadRecord = {
  id: string;
  repoId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
};

export type ChatThreadMessageRecord = {
  id: string;
  threadId: string;
  repoId: string;
  role: "user" | "assistant" | "system";
  content: string;
  contextFiles: string[];
  createdAt: string;
  sequence: number;
};

export async function fetchRepos(baseUrl = ""): Promise<RepoRecord[]> {
  const res = await fetch(`${baseUrl}/diagnostics/repos`);
  if (!res.ok) throw new Error(`Fetch repos failed: ${res.status} ${res.statusText}`);
  const data = await res.json() as { ok: boolean; repos: RepoRecord[] };
  return data.repos ?? [];
}

export async function fetchChatThreads(
  repoId: string,
  baseUrl = "",
): Promise<ChatThreadRecord[]> {
  const res = await fetch(
    `${baseUrl}/chat/threads?repoId=${encodeURIComponent(repoId)}`,
  );
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    threads?: ChatThreadRecord[];
  };

  if (!res.ok || data.ok !== true) {
    throw new Error(data.error ?? `Fetch chat threads failed: ${res.status} ${res.statusText}`);
  }

  return data.threads ?? [];
}

export async function createChatThread(
  body: { repoId: string; title?: string },
  baseUrl = "",
): Promise<ChatThreadRecord> {
  const res = await fetch(`${baseUrl}/chat/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    thread?: ChatThreadRecord;
  };

  if (!res.ok || data.ok !== true || !data.thread) {
    throw new Error(data.error ?? `Create chat thread failed: ${res.status} ${res.statusText}`);
  }

  return data.thread;
}

export async function fetchThreadMessages(
  repoId: string,
  threadId: string,
  baseUrl = "",
): Promise<{ thread: ChatThreadRecord; messages: ChatThreadMessageRecord[] }> {
  const res = await fetch(
    `${baseUrl}/chat/threads/${encodeURIComponent(threadId)}/messages?repoId=${encodeURIComponent(repoId)}`,
  );
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    thread?: ChatThreadRecord;
    messages?: ChatThreadMessageRecord[];
  };

  if (!res.ok || data.ok !== true || !data.thread) {
    throw new Error(data.error ?? `Fetch thread messages failed: ${res.status} ${res.statusText}`);
  }

  return {
    thread: data.thread,
    messages: data.messages ?? [],
  };
}

export async function clearThreadMessages(
  body: { repoId: string; threadId: string },
  baseUrl = "",
): Promise<void> {
  const res = await fetch(
    `${baseUrl}/chat/threads/${encodeURIComponent(body.threadId)}/clear`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoId: body.repoId }),
    },
  );

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };

  if (!res.ok || data.ok !== true) {
    throw new Error(data.error ?? `Clear thread failed: ${res.status} ${res.statusText}`);
  }
}

export async function deleteChatThread(
  body: { repoId: string; threadId: string },
  baseUrl = "",
): Promise<void> {
  const res = await fetch(
    `${baseUrl}/chat/threads/${encodeURIComponent(body.threadId)}/delete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoId: body.repoId }),
    },
  );

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };

  if (!res.ok || data.ok !== true) {
    throw new Error(data.error ?? `Delete thread failed: ${res.status} ${res.statusText}`);
  }
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

export async function fetchEvaluatorRuns(
  repoId: string,
  baseUrl = "",
  limit = 25,
): Promise<EvaluatorRunRecord[]> {
  const safeLimit = Math.max(1, Math.floor(Number(limit) || 25));
  const res = await fetch(
    `${baseUrl}/graphrag/evaluators/runs?repoId=${encodeURIComponent(repoId)}&limit=${encodeURIComponent(String(safeLimit))}`,
  );
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    runs?: EvaluatorRunRecord[];
  };

  if (!res.ok || data.ok !== true) {
    throw new Error(data.error ?? `Fetch evaluator runs failed: ${res.status} ${res.statusText}`);
  }

  return data.runs ?? [];
}

export async function createEvaluatorRun(
  body: {
    evaluationType?: "ask" | "summarize" | "tour";
    repoId: string;
    threadId?: string | null;
    question: string;
    response: string;
    referenceAnswer?: string | null;
    retrievedContext?: string;
    retrievalCount?: number;
    latencyMs?: number;
    sourcePayloadJson?: string | null;
  },
  baseUrl = "",
): Promise<EvaluatorRunRecord> {
  const res = await fetch(`${baseUrl}/graphrag/evaluators/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    run?: EvaluatorRunRecord;
  };

  if (!res.ok || data.ok !== true || !data.run) {
    throw new Error(data.error ?? `Create evaluator run failed: ${res.status} ${res.statusText}`);
  }

  return data.run;
}

export async function createEvaluatorDatasetRuns(
  body: {
    evaluationType?: "ask" | "summarize" | "tour";
    repoId: string;
    entries: Array<{
      question: string;
      response: string;
      referenceAnswer: string;
      retrievedContext?: string;
      retrievalCount?: number;
      latencyMs?: number;
    }>;
  },
  baseUrl = "",
): Promise<{ created: number; runs: EvaluatorRunRecord[] }> {
  const res = await fetch(`${baseUrl}/graphrag/evaluators/dataset-run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    created?: number;
    runs?: EvaluatorRunRecord[];
  };

  if (!res.ok || data.ok !== true) {
    throw new Error(data.error ?? `Dataset evaluator run failed: ${res.status} ${res.statusText}`);
  }

  return { created: data.created ?? 0, runs: data.runs ?? [] };
}
