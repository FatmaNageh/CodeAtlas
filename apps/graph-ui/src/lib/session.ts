const KEY = "codeatlas_showcase";

export type ShowcaseSession = {
  baseUrl?: string;
  lastRepoId?: string;
  lastProjectPath?: string;
};

export function loadSession(): ShowcaseSession {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ShowcaseSession;
  } catch {
    return {};
  }
}

export function saveSession(patch: Partial<ShowcaseSession>) {
  const cur = loadSession();
  const next = { ...cur, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
