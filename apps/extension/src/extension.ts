import * as vscode from "vscode";
import * as path from "path";
import { ServerManager, type ServerState } from "./server/serverManager";
import { getChatHtml } from "./panels/chatProvider";
import {
  getAppWebviewHtml,
  parseWebviewToHostMessage,
  type AppHostMessage,
  type AppServerStatus,
  type AppWebviewInitialState,
} from "./panels/appPanel";

interface IndexRepoResponse {
  ok: boolean;
  repoId?: string | number;
  error?: string;
}

interface CodeAtlasSettings {
  serverUrl: string;
  repoId: string;
  repoRoot: string;
  neo4jBrowserUrl: string;
  autoRefresh: boolean;
}

type WritableCodeAtlasSetting = "serverUrl" | "repoId" | "repoRoot" | "neo4jBrowserUrl";

let serverManager: ServerManager;
let chatProvider: ChatViewProvider | undefined;
let statusBarItem: vscode.StatusBarItem;

function getConfigurationTarget(): vscode.ConfigurationTarget {
  return vscode.workspace.workspaceFolders?.length
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
}

function normalizeUrl(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "null") return fallback;
  try {
    return new URL(trimmed).toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

async function updateCodeAtlasSetting(key: WritableCodeAtlasSetting, value: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration("codeatlas");
  await cfg.update(key, value, getConfigurationTarget());
}

// ─────────────────────────────────────────────────────────────────────────────
// Activate
// ─────────────────────────────────────────────────────────────────────────────
export async function activate(context: vscode.ExtensionContext) {
  serverManager = new ServerManager(context);
  context.subscriptions.push(serverManager);

  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
  statusBarItem.command = "codeatlas.serverMenu";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
  updateStatusBar({ status: "stopped", port: 0, url: "" });

  serverManager.onStatusChange((state) => {
    updateStatusBar(state);
    AppPanel.currentPanel?.sendServerStatus(toAppServerStatus(state));
    if (state.status === "running") {
      const cfg = getCfg();
      chatProvider?.sendSettings({ ...cfg, serverUrl: state.url });
      AppPanel.currentPanel?.sendInitialState(getAppInitialState());
    }
  });

  // ── Commands ─────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand("codeatlas.openApp", async () => {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "CodeAtlas: Starting backend…", cancellable: false },
        () => ensureServerRunning(),
      );
      AppPanel.createOrShow(context.extensionUri, { focusGraph: true });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codeatlas.openGraph", async () => {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "CodeAtlas: Starting backend…", cancellable: false },
        () => ensureServerRunning(),
      );
      AppPanel.createOrShow(context.extensionUri, { focusGraph: true });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codeatlas.serverMenu", async () => {
      const state = serverManager.state;
      const items: vscode.QuickPickItem[] = [
        state.status === "running"
          ? { label: "$(debug-stop) Stop Server", description: `Running on ${state.url}` }
          : { label: "$(play) Start Server", description: "Launch CodeAtlas backend" },
        { label: "$(sync) Restart Server" },
        { label: "$(output) Show Server Log" },
        { label: "$(settings-gear) Configure…" },
        { label: "$(browser) Open Neo4j Browser" },
      ];
      const pick = await vscode.window.showQuickPick(items, { placeHolder: "CodeAtlas Server" });
      if (!pick) return;
      if (pick.label.includes("Stop"))    serverManager.stop();
      if (pick.label.includes("Start"))   serverManager.start();
      if (pick.label.includes("Restart")) serverManager.restart();
      if (pick.label.includes("Log"))     serverManager.showLog();
      if (pick.label.includes("Configure")) vscode.commands.executeCommand("codeatlas.configure");
      if (pick.label.includes("Neo4j"))   vscode.commands.executeCommand("codeatlas.openNeo4jBrowser");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codeatlas.configure", async () => {
      const cfg = vscode.workspace.getConfiguration("codeatlas");
      const items = [
        { label: "$(key) Set Repo ID", description: cfg.get<string>("repoId") || "(not set)" },
        { label: "$(folder) Set Repo Root", description: cfg.get<string>("repoRoot") || "(not set)" },
        { label: "$(server) Set Server URL", description: cfg.get<string>("serverUrl") || "http://localhost:3000" },
        { label: "$(database) Set Neo4j Browser URL", description: cfg.get<string>("neo4jBrowserUrl") || "http://localhost:7474" },
        { label: "$(gear) Open Settings UI" },
      ];
      const pick = await vscode.window.showQuickPick(items, { placeHolder: "CodeAtlas Settings" });
      if (!pick) return;

      if (pick.label.includes("Repo ID")) {
        const val = await vscode.window.showInputBox({
          prompt: "Repository ID (shown after indexing)",
          value: cfg.get<string>("repoId") || "",
          placeHolder: "e.g. a3f9b2c1d4e5",
        });
        if (val === undefined) return;
        await updateCodeAtlasSetting("repoId", val.trim());
        broadcastSettings();
        vscode.window.showInformationMessage(`CodeAtlas: Repo ID set to "${val.trim()}"`);
      } else if (pick.label.includes("Repo Root")) {
        const folder = await vscode.window.showOpenDialog({
          canSelectFolders: true,
          canSelectFiles: false,
          openLabel: "Use this folder",
          title: "Select indexed repository root",
        });
        if (!folder?.[0]) return;
        await updateCodeAtlasSetting("repoRoot", folder[0].fsPath);
        broadcastSettings();
      } else if (pick.label.includes("Server URL")) {
        const val = await vscode.window.showInputBox({
          prompt: "Backend server URL",
          value: cfg.get<string>("serverUrl") || "http://localhost:3000",
        });
        if (val === undefined) return;
        await updateCodeAtlasSetting("serverUrl", normalizeUrl(val, "http://localhost:3000"));
        broadcastSettings();
      } else if (pick.label.includes("Neo4j")) {
        const val = await vscode.window.showInputBox({
          prompt: "Neo4j Browser URL",
          value: cfg.get<string>("neo4jBrowserUrl") || "http://localhost:7474",
        });
        if (val === undefined) return;
        await updateCodeAtlasSetting("neo4jBrowserUrl", normalizeUrl(val, "http://localhost:7474"));
        broadcastSettings();
      } else if (pick.label.includes("Settings UI")) {
        vscode.commands.executeCommand("workbench.action.openSettings", "codeatlas");
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codeatlas.openNeo4jBrowser", () => {
      const configured = vscode.workspace.getConfiguration("codeatlas").get<string>("neo4jBrowserUrl");
      const url = normalizeUrl(configured, "http://localhost:7474");
      vscode.env.openExternal(vscode.Uri.parse(url));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codeatlas.clearHistory", () => {
      chatProvider?.clearHistory();
      vscode.window.showInformationMessage("CodeAtlas: Chat history cleared.");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codeatlas.indexRepo", async () => {
      const folder = await vscode.window.showOpenDialog({
        canSelectFolders: true, canSelectFiles: false,
        openLabel: "Index this folder", title: "Select repository to index",
      });
      if (!folder?.[0]) return;
      await indexRepository(folder[0].fsPath, { promptForGraph: true });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codeatlas.indexCurrentProject", async () => {
      const wsRoot = getWorkspaceRoot();
      if (!wsRoot) {
        vscode.window.showErrorMessage("CodeAtlas: No workspace folder is open. Open a project folder first.");
        return;
      }
      await indexRepository(wsRoot, { promptForGraph: true });
    })
  );

  // Chat sidebar
  chatProvider = new ChatViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("codeatlas.chatView", chatProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // Config change listener
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("codeatlas")) broadcastSettings();
    })
  );

  // Active editor tracking — keeps the graph in sync with the open file
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      const filePath = editor?.document.uri.fsPath ?? null;
      AppPanel.currentPanel?.sendActiveFileChanged(filePath);
      chatProvider?.sendActiveFile(filePath);
    })
  );

  // Workspace folder change — update state when the user opens/closes folders
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      const wsRoot = getWorkspaceRoot();
      AppPanel.currentPanel?.sendWorkspaceChanged(wsRoot);
      broadcastSettings();
    })
  );

  // Auto-set repoRoot from workspace on first activation if not configured
  const cfg0 = vscode.workspace.getConfiguration("codeatlas");
  if (!cfg0.get<string>("repoRoot") && getWorkspaceRoot()) {
    await updateCodeAtlasSetting("repoRoot", getWorkspaceRoot());
    broadcastSettings();
  }

  // Auto-start or sync with an already-running server
  const configuredUrl = normalizeUrl(
    vscode.workspace.getConfiguration("codeatlas").get<string>("serverUrl"),
    "http://localhost:3000",
  );
  canReachServer(configuredUrl).then((reachable) => {
    if (reachable) {
      serverManager.notifyExternallyRunning(configuredUrl);
    } else if (vscode.workspace.getConfiguration("codeatlas").get<boolean>("autoStartServer", true)) {
      autoStartIfAvailable();
    }
  });
}

export function deactivate() {
  serverManager?.stop();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function getCfg(): CodeAtlasSettings {
  const cfg = vscode.workspace.getConfiguration("codeatlas");
  return {
    repoId: cfg.get<string>("repoId") || "",
    repoRoot: cfg.get<string>("repoRoot") || "",
    serverUrl: getServerUrl(),
    neo4jBrowserUrl: normalizeUrl(cfg.get<string>("neo4jBrowserUrl"), "http://localhost:7474"),
    autoRefresh: cfg.get<boolean>("autoRefreshGraph") || false,
  };
}

function getServerUrl(): string {
  if (serverManager?.state.status === "running") return serverManager.state.url;
  return normalizeUrl(vscode.workspace.getConfiguration("codeatlas").get<string>("serverUrl"), "http://localhost:3000");
}

function broadcastSettings() {
  const cfg = getCfg();
  chatProvider?.sendSettings(cfg);
  AppPanel.currentPanel?.sendInitialState(getAppInitialState());
}

function getWorkspaceRoot(): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
}

function getAppInitialState(): AppWebviewInitialState {
  const cfg = getCfg();
  return {
    ...cfg,
    workspaceRoot: getWorkspaceRoot(),
    serverStatus: toAppServerStatus(serverManager.state),
  };
}

function toAppServerStatus(state: ServerState): AppServerStatus {
  switch (state.status) {
    case "stopped":
      return { status: "stopped", port: 0, url: "" };
    case "starting":
      return { status: "starting", port: state.port, url: state.url };
    case "running":
      return { status: "running", port: state.port, url: state.url };
    case "error":
      return { status: "error", port: state.port, url: state.url, error: state.error };
  }
}

async function selectRepositoryForApp(): Promise<void> {
  const folder = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    openLabel: "Use this repository",
    title: "Select repository for CodeAtlas",
  });
  if (!folder?.[0]) return;
  await updateCodeAtlasSetting("repoRoot", folder[0].fsPath);
  broadcastSettings();
}

async function indexRepository(
  projectPath: string,
  options: { promptForGraph: boolean },
): Promise<void> {
  const trimmedProjectPath = projectPath.trim();
  if (!trimmedProjectPath) {
    vscode.window.showErrorMessage("CodeAtlas: Open a workspace or select a repository before indexing.");
    return;
  }

  await ensureServerRunning();
  AppPanel.currentPanel?.sendIndexingStarted(trimmedProjectPath);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `CodeAtlas: Indexing ${trimmedProjectPath}...`,
      cancellable: false,
    },
    async () => {
      try {
        const url = getServerUrl();
        const res = await fetch(`${url}/indexRepo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectPath: trimmedProjectPath, mode: "full", saveDebugJson: true }),
        });
        const data = (await res.json()) as IndexRepoResponse;
        if (data.ok) {
          if (!data.repoId || (typeof data.repoId !== "string" && typeof data.repoId !== "number")) {
            throw new Error("Server returned success but no valid repoId");
          }
          const repoId = String(data.repoId);
          await updateCodeAtlasSetting("repoId", repoId);
          await updateCodeAtlasSetting("repoRoot", trimmedProjectPath);
          broadcastSettings();
          AppPanel.currentPanel?.sendIndexingCompleted(repoId, trimmedProjectPath);
          const actions = options.promptForGraph ? ["Open Graph", "Copy ID"] : ["Copy ID"];
          const choice = await vscode.window.showInformationMessage(
            `CodeAtlas: Indexed! Repo ID: ${repoId}`,
            ...actions,
          );
          if (choice === "Open Graph") await vscode.commands.executeCommand("codeatlas.openGraph");
          if (choice === "Copy ID") await vscode.env.clipboard.writeText(repoId);
        } else {
          const error = data.error ?? "Indexing failed without a server error message.";
          AppPanel.currentPanel?.sendIndexingFailed(trimmedProjectPath, error);
          vscode.window.showErrorMessage(`CodeAtlas indexing failed: ${error}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        AppPanel.currentPanel?.sendIndexingFailed(trimmedProjectPath, msg);
        vscode.window.showErrorMessage(`CodeAtlas indexing error: ${msg}`);
      }
    },
  );
}

async function openWorkspaceFile(filePath: string, line?: number, column?: number): Promise<void> {
  const cfg = getCfg();
  const baseRoot = cfg.repoRoot || getWorkspaceRoot();
  const resolvedPath = path.isAbsolute(filePath) || !baseRoot
    ? filePath
    : path.join(baseRoot, filePath);
  const normalizedPath = path.normalize(resolvedPath);

  const allowedRoots = [
    cfg.repoRoot,
    getWorkspaceRoot(),
    ...(vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) ?? []),
  ].filter(Boolean).map((r) => path.normalize(r));

  const isAllowed = allowedRoots.some(
    (root) => normalizedPath.startsWith(root + path.sep) || normalizedPath === root,
  );
  if (!isAllowed) {
    vscode.window.showErrorMessage("CodeAtlas: Access denied — path is outside the workspace.");
    return;
  }

  const document = await vscode.workspace.openTextDocument(normalizedPath);
  const editor = await vscode.window.showTextDocument(document);
  if (line === undefined) return;
  const position = new vscode.Position(Math.max(line - 1, 0), Math.max((column ?? 1) - 1, 0));
  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
}

async function ensureServerRunning(): Promise<void> {
  if (serverManager.state.status === "running") return;
  const configuredUrl = getServerUrl();
  if (await canReachServer(configuredUrl)) {
    serverManager.notifyExternallyRunning(configuredUrl);
    return;
  }
  await serverManager.start();
  if (serverManager.state.status !== "starting") return;
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 30_000);
    const unsub = serverManager.onStatusChange((s) => {
      if (s.status === "running" || s.status === "error") {
        clearTimeout(t); unsub.dispose(); resolve();
      }
    });
  });
}

async function canReachServer(serverUrl: string): Promise<boolean> {
  try {
    const parsed = new URL(serverUrl);
    if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") return false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${serverUrl}/`, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response.ok;
    } catch (err) {
      clearTimeout(timeoutId);
      return false;
    }
  } catch {
    return false;
  }
}

function autoStartIfAvailable() {
  serverManager.start().catch(() => {/* shown in status bar */});
}

function updateStatusBar(state: ServerState) {
  switch (state.status) {
    case "stopped":
      statusBarItem.text = "$(graph-line) CodeAtlas";
      statusBarItem.tooltip = "CodeAtlas server stopped — click to start";
      statusBarItem.backgroundColor = undefined;
      break;
    case "starting":
      statusBarItem.text = "$(loading~spin) CodeAtlas: Starting…";
      statusBarItem.tooltip = "CodeAtlas backend is booting";
      statusBarItem.backgroundColor = undefined;
      break;
    case "running":
      statusBarItem.text = `$(check) CodeAtlas`;
      statusBarItem.tooltip = `Server running on ${state.url} — click for options`;
      statusBarItem.backgroundColor = undefined;
      break;
    case "error":
      statusBarItem.text = "$(error) CodeAtlas";
      statusBarItem.tooltip = `Server error: ${state.error ?? "unknown"} — click to retry`;
      statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// App Panel / Chat View Provider
// ─────────────────────────────────────────────────────────────────────────────
class AppPanel {
  public static currentPanel: AppPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _pendingFocusGraph = false;

  public static createOrShow(extensionUri: vscode.Uri, options: { focusGraph?: boolean } = {}) {
    const col = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
    if (AppPanel.currentPanel) {
      AppPanel.currentPanel._panel.reveal(col);
      if (options.focusGraph) AppPanel.currentPanel.sendFocusGraph();
      return;
    }

    const panel = vscode.window.createWebviewPanel("codeatlas.app", "CodeAtlas", col, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media", "app")],
    });

    const instance = new AppPanel(panel, extensionUri);
    AppPanel.currentPanel = instance;
    if (options.focusGraph) instance._pendingFocusGraph = true;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._panel.webview.html = getAppWebviewHtml(this._panel.webview, extensionUri);

    this._panel.webview.onDidReceiveMessage(async (message) => {
      const value = parseWebviewToHostMessage(typeof message === "object" && message !== null ? message : null);
      if (!value) return;

      switch (value.type) {
        case "app/ready":
        case "app/getInitialState":
          this.sendInitialState(getAppInitialState());
          if (this._pendingFocusGraph) {
            this._pendingFocusGraph = false;
            this.sendFocusGraph();
          }
          break;
        case "app/openGraph":
          this.sendFocusGraph();
          break;
        case "app/indexWorkspace":
          await indexRepository(getWorkspaceRoot(), { promptForGraph: false });
          break;
        case "app/selectRepository":
          await selectRepositoryForApp();
          break;
        case "app/indexRepository":
          await indexRepository(value.payload?.repoRoot ?? getWorkspaceRoot(), { promptForGraph: false });
          break;
        case "app/openFile":
          await openWorkspaceFile(value.payload.path, value.payload.line, value.payload.column);
          break;
        case "app/openSettings":
          await vscode.commands.executeCommand("codeatlas.configure");
          break;
        case "app/showError":
          vscode.window.showErrorMessage(value.payload.message);
          break;
        case "app/showInfo":
          vscode.window.showInformationMessage(value.payload.message);
          break;
        case "app/openNeo4jBrowser":
          await vscode.commands.executeCommand("codeatlas.openNeo4jBrowser");
          break;
      }
    }, null, this._disposables);

    this._panel.onDidDispose(() => this._dispose(), null, this._disposables);
  }

  public sendInitialState(state: AppWebviewInitialState): void {
    this.postMessage({ type: "app/initialState", payload: state });
  }

  public sendServerStatus(state: AppServerStatus): void {
    this.postMessage({ type: "app/serverStatusChanged", payload: state });
  }

  public sendFocusGraph(): void {
    this.postMessage({ type: "app/focusGraph" });
  }

  public sendIndexingStarted(repoRoot: string): void {
    this.postMessage({ type: "app/indexingStarted", payload: { repoRoot } });
  }

  public sendIndexingCompleted(repoId: string, repoRoot: string): void {
    this.postMessage({ type: "app/indexingCompleted", payload: { repoId, repoRoot } });
  }

  public sendIndexingFailed(repoRoot: string, error: string): void {
    this.postMessage({ type: "app/indexingFailed", payload: { repoRoot, error } });
  }

  public sendActiveFileChanged(filePath: string | null): void {
    this.postMessage({ type: "app/activeFileChanged", payload: { path: filePath } });
  }

  public sendWorkspaceChanged(workspaceRoot: string): void {
    this.postMessage({ type: "app/workspaceChanged", payload: { workspaceRoot } });
  }

  private postMessage(message: AppHostMessage): void {
    this._panel.webview.postMessage(message);
  }

  private _dispose() {
    AppPanel.currentPanel = undefined;
    this._panel.dispose();
    for (const d of this._disposables) d.dispose();
    this._disposables = [];
  }
}

class ChatViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true, localResourceRoots: [this._extensionUri],
    };
    const cfg = getCfg();
    webviewView.webview.html = getChatHtml(webviewView.webview, cfg.serverUrl, cfg.repoId, cfg.repoRoot);

    this._disposables.push(
      webviewView.webview.onDidReceiveMessage(async (msg) => {
        if (msg?.type === "settings/save") {
          const { serverUrl, repoId, repoRoot } = msg.payload || {};
          if (serverUrl) await updateCodeAtlasSetting("serverUrl", normalizeUrl(serverUrl, "http://localhost:3000"));
          if (repoId)    await updateCodeAtlasSetting("repoId", repoId);
          if (repoRoot)  await updateCodeAtlasSetting("repoRoot", repoRoot);
          broadcastSettings();
        }
        if (msg?.type === "openGraph") {
          vscode.commands.executeCommand("codeatlas.openGraph");
        }
        if (msg?.type === "indexRepo") {
          vscode.commands.executeCommand("codeatlas.indexRepo");
        }
        if (msg?.type === "chat/ready") {
          const s = serverManager.state;
          const cfg = getCfg();
          webviewView.webview.postMessage({ type: "server/status", payload: s });
          webviewView.webview.postMessage({
            type: "settings/update",
            payload: s.status === "running" ? { ...cfg, serverUrl: s.url } : cfg,
          });
        }
      })
    );

    this._disposables.push(
      serverManager.onStatusChange((state) => {
        webviewView.webview.postMessage({ type: "server/status", payload: state });
        if (state.status === "running") {
          const cfg = getCfg();
          webviewView.webview.postMessage({ type: "settings/update", payload: { ...cfg, serverUrl: state.url } });
        }
      })
    );
  }

  clearHistory() {
    this._view?.webview.postMessage({ type: "clearHistory" });
  }

  sendContextNode(node: object, allNodes?: object[]) {
    this._view?.webview.postMessage({ type: "contextNode", payload: { node, allNodes } });
  }

  sendGraphNodes(nodes: object[]) {
    this._view?.webview.postMessage({ type: "graphNodes", payload: { nodes } });
  }

  sendActiveFile(filePath: string | null) {
    this._view?.webview.postMessage({ type: "activeFile", payload: { path: filePath } });
  }

  sendSettings(s: CodeAtlasSettings) {
    this._view?.webview.postMessage({ type: "settings/update", payload: s });
  }

  dispose() {
    for (const d of this._disposables) d.dispose();
  }
}
