export type StoredProject = {
  repoId: string;
  name: string;
  rootPath: string;
  indexedAt?: string;
  lastOpenedAt: string;
  chatUpdatedAt?: string;
  chatMessageCount?: number;
};

export type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  contextFiles?: string[];
};

type ProjectHistoryState = {
  projects: StoredProject[];
  chats: Record<string, StoredChatMessage[]>;
};

const KEY = "codeatlas_project_history";

function loadState(): ProjectHistoryState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { projects: [], chats: {} };

    const parsed = JSON.parse(raw) as Partial<ProjectHistoryState>;
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      chats:
        typeof parsed.chats === "object" && parsed.chats !== null
          ? (parsed.chats as Record<string, StoredChatMessage[]>)
          : {},
    };
  } catch {
    return { projects: [], chats: {} };
  }
}

function saveState(state: ProjectHistoryState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore storage failures
  }
}

export function getStoredProjects(): StoredProject[] {
  return loadState().projects
    .slice()
    .sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt));
}

export function upsertStoredProject(project: StoredProject): void {
  const state = loadState();
  const projects = state.projects.filter((entry) => entry.repoId !== project.repoId);
  projects.push(project);
  saveState({ ...state, projects });
}

export function removeStoredProject(repoId: string): void {
  const state = loadState();
  const { [repoId]: _removedChat, ...remainingChats } = state.chats;
  saveState({
    projects: state.projects.filter((project) => project.repoId !== repoId),
    chats: remainingChats,
  });
}

export function getStoredChatHistory(repoId: string): StoredChatMessage[] {
  const state = loadState();
  const messages = state.chats[repoId];
  return Array.isArray(messages) ? messages : [];
}

export function saveStoredChatHistory(
  repoId: string,
  messages: StoredChatMessage[],
): void {
  const state = loadState();
  const nextChats = { ...state.chats, [repoId]: messages };
  const nextProjects = state.projects.map((project) =>
    project.repoId === repoId
      ? {
          ...project,
          chatUpdatedAt: new Date().toISOString(),
          chatMessageCount: messages.length,
          lastOpenedAt: new Date().toISOString(),
        }
      : project,
  );

  saveState({
    projects: nextProjects,
    chats: nextChats,
  });
}

export function clearStoredChatHistory(repoId: string): void {
  saveStoredChatHistory(repoId, []);
}
