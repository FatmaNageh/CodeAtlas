import * as vscode from "vscode";
import { ServerManager, type ServerState } from "./server/serverManager";
import { getGraphHtml } from "./panels/graphPanel";
import { getChatHtml } from "./panels/chatProvider";

interface IndexRepoResponse {
  ok: boolean;
  repoId?: string | number;
  error?: string;
}

let serverManager: ServerManager;
let chatProvider: ChatViewProvider | undefined;
let statusBarItem: vscode.StatusBarItem;

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
    if (state.status === "running") {
      const cfg = getCfg();
      GraphPanel.currentPanel?.sendSettings({ serverUrl: state.url, repoId: cfg.repoId, neo4jBrowserUrl: cfg.neo4jBrowserUrl });
      chatProvider?.sendSettings({ serverUrl: state.url, repoId: cfg.repoId });
    }
  });

  // ── Commands ─────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand("codeatlas.openGraph", async () => {
      const state = serverManager.state;
      if (state.status === "stopped" || state.status === "error") {
        vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: "CodeAtlas: Starting backend…", cancellable: false },
          () => serverManager.start()
        );
      }
      GraphPanel.createOrShow(context.extensionUri, serverManager);
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
        await cfg.update("repoId", val.trim(), vscode.ConfigurationTarget.Workspace);
        broadcastSettings();
        vscode.window.showInformationMessage(`CodeAtlas: Repo ID set to "${val.trim()}"`);
      } else if (pick.label.includes("Server URL")) {
        const val = await vscode.window.showInputBox({
          prompt: "Backend server URL",
          value: cfg.get<string>("serverUrl") || "http://localhost:3000",
        });
        if (val === undefined) return;
        await cfg.update("serverUrl", val.trim(), vscode.ConfigurationTarget.Workspace);
        broadcastSettings();
      } else if (pick.label.includes("Neo4j")) {
        const val = await vscode.window.showInputBox({
          prompt: "Neo4j Browser URL",
          value: cfg.get<string>("neo4jBrowserUrl") || "http://localhost:7474",
        });
        if (val === undefined) return;
        await cfg.update("neo4jBrowserUrl", val.trim(), vscode.ConfigurationTarget.Workspace);
        broadcastSettings();
      } else if (pick.label.includes("Settings UI")) {
        vscode.commands.executeCommand("workbench.action.openSettings", "codeatlas");
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codeatlas.openNeo4jBrowser", () => {
      const url = vscode.workspace.getConfiguration("codeatlas").get<string>("neo4jBrowserUrl") || "http://localhost:7474";
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
      const projectPath = folder[0].fsPath;
      await ensureServerRunning();
      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `CodeAtlas: Indexing ${projectPath}…`, cancellable: false },
        async () => {
          try {
            const url = getServerUrl();
            const res = await fetch(`${url}/indexRepo`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectPath, mode: "full", saveDebugJson: true }),
            });
            const data = (await res.json()) as IndexRepoResponse;
            if (data.ok) {
              const repoId = String(data.repoId);
              await vscode.workspace.getConfiguration("codeatlas")
                .update("repoId", repoId, vscode.ConfigurationTarget.Workspace);
              broadcastSettings();
              const choice = await vscode.window.showInformationMessage(
                `CodeAtlas: Indexed! Repo ID: ${repoId}`, "Open Graph", "Copy ID"
              );
              if (choice === "Open Graph") vscode.commands.executeCommand("codeatlas.openGraph");
              if (choice === "Copy ID") vscode.env.clipboard.writeText(repoId);
            } else {
              vscode.window.showErrorMessage(`CodeAtlas indexing failed: ${data.error}`);
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`CodeAtlas indexing error: ${msg}`);
          }
        }
      );
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

  // Auto-start
  if (vscode.workspace.getConfiguration("codeatlas").get<boolean>("autoStartServer", true)) {
    autoStartIfAvailable();
  }
}

export function deactivate() {
  serverManager?.stop();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function getCfg() {
  const cfg = vscode.workspace.getConfiguration("codeatlas");
  return {
    repoId: cfg.get<string>("repoId") || "",
    serverUrl: getServerUrl(),
    neo4jBrowserUrl: cfg.get<string>("neo4jBrowserUrl") || "http://localhost:7474",
    nodeLimit: cfg.get<number>("graphNodeLimit") || 500,
    autoRefresh: cfg.get<boolean>("autoRefreshGraph") || false,
  };
}

function getServerUrl(): string {
  if (serverManager?.state.status === "running") return serverManager.state.url;
  return vscode.workspace.getConfiguration("codeatlas").get<string>("serverUrl") || "http://localhost:3000";
}

function broadcastSettings() {
  const cfg = getCfg();
  GraphPanel.currentPanel?.sendSettings({ serverUrl: cfg.serverUrl, repoId: cfg.repoId, neo4jBrowserUrl: cfg.neo4jBrowserUrl, nodeLimit: cfg.nodeLimit, autoRefresh: cfg.autoRefresh });
  chatProvider?.sendSettings({ serverUrl: cfg.serverUrl, repoId: cfg.repoId });
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
  const candidates = [
    pth.join(wsRoot, "apps", "server", "package.json"),
    pth.join(wsRoot, "server", "package.json"),
  ];
  if (candidates.some(c => fs.existsSync(c))) {
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
    const cfg = getCfg();
    this._panel.webview.html = getGraphHtml(this._panel.webview, cfg.serverUrl, cfg.repoId, cfg.neo4jBrowserUrl, cfg.nodeLimit, cfg.autoRefresh);

    this._panel.webview.onDidReceiveMessage(async (msg) => {
      switch (msg?.type) {
        case "settings/save": {
          const { serverUrl, repoId } = msg.payload || {};
          const c = vscode.workspace.getConfiguration("codeatlas");
          if (serverUrl) await c.update("serverUrl", serverUrl, vscode.ConfigurationTarget.Workspace);
          if (repoId)    await c.update("repoId",    repoId,    vscode.ConfigurationTarget.Workspace);
          chatProvider?.sendSettings({ serverUrl: serverUrl || getServerUrl(), repoId: repoId || getCfg().repoId });
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
        case "openNeo4jBrowser":
          vscode.commands.executeCommand("codeatlas.openNeo4jBrowser");
          break;
      }
    }, null, this._disposables);

    this._disposables.push(
      this._manager.onStatusChange((state) => {
        this._panel.webview.postMessage({ type: "server/status", payload: state });
        if (state.status === "running") {
          const cfg = getCfg();
          this._panel.webview.postMessage({
            type: "settings/update",
            payload: { serverUrl: state.url, repoId: cfg.repoId, neo4jBrowserUrl: cfg.neo4jBrowserUrl, nodeLimit: cfg.nodeLimit, autoRefresh: cfg.autoRefresh },
          });
        }
      })
    );

    setTimeout(() => {
      const s = this._manager.state;
      this._panel.webview.postMessage({ type: "server/status", payload: s });
      if (s.status === "running") {
        const cfg = getCfg();
        this._panel.webview.postMessage({ type: "settings/update", payload: { serverUrl: s.url, repoId: cfg.repoId, neo4jBrowserUrl: cfg.neo4jBrowserUrl, nodeLimit: cfg.nodeLimit, autoRefresh: cfg.autoRefresh } });
      }
    }, 600);

    this._panel.onDidDispose(() => this._dispose(), null, this._disposables);
  }

  public sendSettings(s: { serverUrl: string; repoId: string; neo4jBrowserUrl?: string; nodeLimit?: number; autoRefresh?: boolean }) {
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
    const cfg = getCfg();
    webviewView.webview.html = getChatHtml(webviewView.webview, cfg.serverUrl, cfg.repoId);

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg?.type === "settings/save") {
        const { serverUrl, repoId } = msg.payload || {};
        const c = vscode.workspace.getConfiguration("codeatlas");
        if (serverUrl) await c.update("serverUrl", serverUrl, vscode.ConfigurationTarget.Workspace);
        if (repoId)    await c.update("repoId",    repoId,    vscode.ConfigurationTarget.Workspace);
        GraphPanel.currentPanel?.sendSettings({ serverUrl: serverUrl || getServerUrl(), repoId: repoId || getCfg().repoId });
      }
      if (msg?.type === "openGraph") {
        vscode.commands.executeCommand("codeatlas.openGraph");
      }
      if (msg?.type === "indexRepo") {
        vscode.commands.executeCommand("codeatlas.indexRepo");
      }
    });

    this._disposables.push(
      serverManager.onStatusChange((state) => {
        webviewView.webview.postMessage({ type: "server/status", payload: state });
        if (state.status === "running") {
          const cfg = getCfg();
          webviewView.webview.postMessage({ type: "settings/update", payload: { serverUrl: state.url, repoId: cfg.repoId } });
        }
      })
    );

    setTimeout(() => {
      const s = serverManager.state;
      webviewView.webview.postMessage({ type: "server/status", payload: s });
      if (s.status === "running") {
        const cfg = getCfg();
        webviewView.webview.postMessage({ type: "settings/update", payload: { serverUrl: s.url, repoId: cfg.repoId } });
      }
    }, 300);
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

  sendSettings(s: { serverUrl: string; repoId: string }) {
    this._view?.webview.postMessage({ type: "settings/update", payload: s });
  }

  dispose() {
    for (const d of this._disposables) d.dispose();
  }
}
