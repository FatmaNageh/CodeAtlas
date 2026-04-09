import * as vscode from "vscode";
import { ServerManager, type ServerState } from "./server/serverManager";
import { getGraphHtml } from "./panels/graphPanel";
import { getChatHtml } from "./panels/chatProvider";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface IndexRepoResponse {
  ok: boolean;
  repoId?: string | number;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level singletons
// ─────────────────────────────────────────────────────────────────────────────
let serverManager: ServerManager;
let chatProvider: ChatViewProvider | undefined;
let statusBarItem: vscode.StatusBarItem;

// ─────────────────────────────────────────────────────────────────────────────
// Activate
// ─────────────────────────────────────────────────────────────────────────────
export async function activate(context: vscode.ExtensionContext) {
  // ── Server Manager ──────────────────────────────────────────────────────
  serverManager = new ServerManager(context);
  context.subscriptions.push(serverManager);

  // ── Status Bar ──────────────────────────────────────────────────────────
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
  statusBarItem.command = "codeatlas.serverMenu";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
  updateStatusBar({ status: "stopped", port: 0, url: "" });

  serverManager.onStatusChange((state) => {
    updateStatusBar(state);
    if (state.status === "running") {
      GraphPanel.currentPanel?.sendSettings({ serverUrl: state.url, repoId: getRepoId() });
      chatProvider?.sendSettings({ serverUrl: state.url, repoId: getRepoId() });
    }
  });

  // ── Commands ─────────────────────────────────────────────────────────────

  // Open Graph
  context.subscriptions.push(
    vscode.commands.registerCommand("codeatlas.openGraph", async () => {
      if (serverManager.state.status === "stopped" || serverManager.state.status === "error") {
        vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: "CodeAtlas: Starting backend…", cancellable: false },
          () => serverManager.start()
        );
      }
      GraphPanel.createOrShow(context.extensionUri, serverManager);
    })
  );

  // Server menu
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
      ];
      const pick = await vscode.window.showQuickPick(items, { placeHolder: "CodeAtlas Server" });
      if (!pick) return;
      if (pick.label.includes("Stop"))    serverManager.stop();
      if (pick.label.includes("Start"))   serverManager.start();
      if (pick.label.includes("Restart")) serverManager.restart();
      if (pick.label.includes("Log"))     serverManager.showLog();
      if (pick.label.includes("Configure")) vscode.commands.executeCommand("codeatlas.configure");
    })
  );

  // Configure
  context.subscriptions.push(
    vscode.commands.registerCommand("codeatlas.configure", async () => {
      const cfg = vscode.workspace.getConfiguration("codeatlas");
      const newRepoId = await vscode.window.showInputBox({
        prompt: "Repository ID (shown after indexing — see /diagnostics/repos)",
        value: cfg.get<string>("repoId") || "",
        placeHolder: "e.g. a3f9b2c1d4e5",
      });
      if (newRepoId === undefined) return;
      await cfg.update("repoId", newRepoId.trim(), vscode.ConfigurationTarget.Workspace);
      const url = getServerUrl();
      GraphPanel.currentPanel?.sendSettings({ serverUrl: url, repoId: newRepoId.trim() });
      chatProvider?.sendSettings({ serverUrl: url, repoId: newRepoId.trim() });
      vscode.window.showInformationMessage(`CodeAtlas: Repo ID set to "${newRepoId.trim()}"`);
    })
  );

  // Index repo
  context.subscriptions.push(
    vscode.commands.registerCommand("codeatlas.indexRepo", async () => {
      const folder = await vscode.window.showOpenDialog({
        canSelectFolders: true, canSelectFiles: false,
        openLabel: "Index this folder", title: "Select repository to index",
      });
      if (!folder?.[0]) return;
      const projectPath = folder[0].fsPath;
      await ensureServerRunning();
      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Indexing ${projectPath}…`, cancellable: false },
        async () => {
          try {
            const res = await fetch(`${serverManager.state.url}/indexRepo`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectPath, mode: "full", saveDebugJson: true }),
            });
            const data = (await res.json()) as IndexRepoResponse;
            if (data.ok) {
              const repoId = String(data.repoId);
              await vscode.workspace.getConfiguration("codeatlas")
                .update("repoId", repoId, vscode.ConfigurationTarget.Workspace);
              const url = getServerUrl();
              GraphPanel.currentPanel?.sendSettings({ serverUrl: url, repoId });
              chatProvider?.sendSettings({ serverUrl: url, repoId });
              vscode.window.showInformationMessage(`CodeAtlas: Indexed! Repo ID: ${repoId}`, "Open Graph")
                .then(c => { if (c === "Open Graph") vscode.commands.executeCommand("codeatlas.openGraph"); });
            } else {
              vscode.window.showErrorMessage(`CodeAtlas indexing failed: ${data.error}`);
            }
          } catch (err: any) {
            vscode.window.showErrorMessage(`CodeAtlas indexing error: ${err?.message}`);
          }
        }
      );
    })
  );

  // ── Chat Sidebar ────────────────────────────────────────────────────────
  chatProvider = new ChatViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("codeatlas.chatView", chatProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // React to VS Code config changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("codeatlas")) {
        const url = getServerUrl();
        const repoId = getRepoId();
        GraphPanel.currentPanel?.sendSettings({ serverUrl: url, repoId });
        chatProvider?.sendSettings({ serverUrl: url, repoId });
      }
    })
  );

  // Auto-start if apps/server is present in workspace
  autoStartIfAvailable();
}

export function deactivate() {
  serverManager?.stop();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function getRepoId(): string {
  return vscode.workspace.getConfiguration("codeatlas").get<string>("repoId") || "";
}

function getServerUrl(): string {
  if (serverManager?.state.status === "running") return serverManager.state.url;
  return vscode.workspace.getConfiguration("codeatlas").get<string>("serverUrl") || "http://localhost:3000";
}

async function ensureServerRunning(): Promise<void> {
  if (serverManager.state.status === "running") return;
  await serverManager.start();
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 30_000);
    const unsub = serverManager.onStatusChange((s) => {
      if (s.status === "running" || s.status === "error") {
        clearTimeout(t); unsub.dispose(); resolve();
      }
    });
  });
}

function autoStartIfAvailable() {
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!wsRoot) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs  = require("fs")   as typeof import("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pth = require("path") as typeof import("path");
  if (fs.existsSync(pth.join(wsRoot, "apps", "server", "package.json"))) {
    serverManager.start().catch(() => {/* shown in status bar */});
  }
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
      statusBarItem.text = `$(check) CodeAtlas ${state.url}`;
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
// Graph Panel
// ─────────────────────────────────────────────────────────────────────────────
class GraphPanel {
  public static currentPanel: GraphPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, manager: ServerManager) {
    const col = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
    if (GraphPanel.currentPanel) { GraphPanel.currentPanel._panel.reveal(col); return; }
    const panel = vscode.window.createWebviewPanel("codeatlas.graph", "CodeAtlas Graph", col, {
      enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [extensionUri],
    });
    GraphPanel.currentPanel = new GraphPanel(panel, extensionUri, manager);
  }

  private constructor(panel: vscode.WebviewPanel, _uri: vscode.Uri, private _manager: ServerManager) {
    this._panel = panel;
    this._panel.webview.html = getGraphHtml(this._panel.webview, getServerUrl(), getRepoId());

    this._panel.webview.onDidReceiveMessage(async (msg) => {
      switch (msg?.type) {
        case "settings/save": {
          const { serverUrl, repoId } = msg.payload || {};
          const cfg = vscode.workspace.getConfiguration("codeatlas");
          if (serverUrl) await cfg.update("serverUrl", serverUrl, vscode.ConfigurationTarget.Workspace);
          if (repoId)    await cfg.update("repoId",    repoId,    vscode.ConfigurationTarget.Workspace);
          chatProvider?.sendSettings({ serverUrl: serverUrl || getServerUrl(), repoId: repoId || getRepoId() });
          break;
        }
        case "nodeSelected":
          chatProvider?.sendContextNode(msg.payload?.node, msg.payload?.allNodes);
          break;
        case "graph/nodes":
          chatProvider?.sendGraphNodes(msg.payload?.nodes ?? []);
          break;
        case "openChat":
          await vscode.commands.executeCommand("codeatlas.chatView.focus");
          break;
        case "indexRepo":
          vscode.commands.executeCommand("codeatlas.indexRepo");
          break;
        case "server/start":
          serverManager.start();
          break;
      }
    }, null, this._disposables);

    // Forward server state to graph webview
    this._disposables.push(
      this._manager.onStatusChange((state) => {
        this._panel.webview.postMessage({ type: "server/status", payload: state });
        if (state.status === "running") {
          this._panel.webview.postMessage({
            type: "settings/update",
            payload: { serverUrl: state.url, repoId: getRepoId() },
          });
        }
      })
    );

    // Send current state shortly after load
    setTimeout(() => {
      const s = this._manager.state;
      this._panel.webview.postMessage({ type: "server/status", payload: s });
      if (s.status === "running") {
        this._panel.webview.postMessage({ type: "settings/update", payload: { serverUrl: s.url, repoId: getRepoId() } });
      }
    }, 600);

    this._panel.onDidDispose(() => this._dispose(), null, this._disposables);
  }

  public sendSettings(s: { serverUrl: string; repoId: string }) {
    this._panel.webview.postMessage({ type: "settings/update", payload: s });
  }

  private _dispose() {
    GraphPanel.currentPanel = undefined;
    this._panel.dispose();
    for (const d of this._disposables) d.dispose();
    this._disposables = [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat View Provider
// ─────────────────────────────────────────────────────────────────────────────
class ChatViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true, localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = getChatHtml(webviewView.webview, getServerUrl(), getRepoId());

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg?.type === "settings/save") {
        const { serverUrl, repoId } = msg.payload || {};
        const cfg = vscode.workspace.getConfiguration("codeatlas");
        if (serverUrl) await cfg.update("serverUrl", serverUrl, vscode.ConfigurationTarget.Workspace);
        if (repoId)    await cfg.update("repoId",    repoId,    vscode.ConfigurationTarget.Workspace);
        GraphPanel.currentPanel?.sendSettings({ serverUrl: serverUrl || getServerUrl(), repoId: repoId || getRepoId() });
      }
    });

    this._disposables.push(
      serverManager.onStatusChange((state) => {
        webviewView.webview.postMessage({ type: "server/status", payload: state });
        if (state.status === "running") {
          webviewView.webview.postMessage({ type: "settings/update", payload: { serverUrl: state.url, repoId: getRepoId() } });
        }
      })
    );

    setTimeout(() => {
      const s = serverManager.state;
      webviewView.webview.postMessage({ type: "server/status", payload: s });
      if (s.status === "running") {
        webviewView.webview.postMessage({ type: "settings/update", payload: { serverUrl: s.url, repoId: getRepoId() } });
      }
    }, 300);
  }

  sendContextNode(node: object, allNodes?: object[]) {
    this._view?.webview.postMessage({ type: "contextNode", payload: { node, allNodes } });
  }

  sendGraphNodes(nodes: object[]) {
    this._view?.webview.postMessage({ type: "graphNodes", payload: { nodes } });
  }

  sendSettings(s: { serverUrl: string; repoId: string }) {
    this._view?.webview.postMessage({ type: "settings/update", payload: s });
  }

  dispose() {
    for (const d of this._disposables) d.dispose();
  }
}