import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
// import { ChatViewProvider } from "./chatView";

export function activate(context: vscode.ExtensionContext) {
  // Command: Open Graph tab
  context.subscriptions.push(
    vscode.commands.registerCommand("codeatlas.openGraph", () => {
      GraphPanel.createOrShow(context.extensionUri);
    })
  );

  // Sidebar view: Chat
  const chatProvider = new ChatViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("codeatlas.chatView", chatProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );
}

export function deactivate() {}

class GraphPanel {
  public static currentPanel: GraphPanel | undefined;
  private readonly panel: vscode.WebviewPanel;

  static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (GraphPanel.currentPanel) {
      GraphPanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "codeatlas.graph",
      "CodeAtlas Graph",
      column,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "..", "graph-ui", "dist"),
          vscode.Uri.joinPath(extensionUri, "..", "chat-ui", "dist")
        ]
      }
    );

    GraphPanel.currentPanel = new GraphPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;

    this.panel.webview.html = loadViteDistHtml(
      this.panel.webview,
      extensionUri,
      "../graph-ui/dist"
    );

    this.panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg?.type === "graph/request") {
        // TODO: Replace with real backend call to apps/server
        const payload = {
          nodes: [
            { id: "Repo", label: "Repo" },
            { id: "apps/server", label: "apps/server" },
            { id: "apps/web", label: "apps/web" }
          ],
          edges: [
            { from: "Repo", to: "apps/server" },
            { from: "Repo", to: "apps/web" }
          ]
        };

        this.panel.webview.postMessage({ type: "graph/data", payload });
      }
    });

    this.panel.onDidDispose(() => {
      GraphPanel.currentPanel = undefined;
    });
  }
}

class ChatViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "..", "chat-ui", "dist")]
    };

    webviewView.webview.html = loadViteDistHtml(
      webviewView.webview,
      this.extensionUri,
      "../chat-ui/dist"
    );

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg?.type === "chat/ask") {
        const text = String(msg.payload?.text ?? "");
        // TODO: Replace with GraphRAG backend call
        webviewView.webview.postMessage({
          type: "chat/assistant",
          payload: { text: `Echo: ${text}` }
        });
      }
    });
  }
}

/**
 * Loads Vite's dist/index.html and rewrites asset URLs to VS Code webview URIs.
 */
function loadViteDistHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  distRelativePath: string
): string {
  const distDir = vscode.Uri.joinPath(extensionUri, distRelativePath);
  const indexPath = vscode.Uri.joinPath(distDir, "index.html");

  const html = fs.readFileSync(indexPath.fsPath, "utf8");

  // Replace "/assets/..." or "./assets/..." with webview URIs
  const assetsDir = vscode.Uri.joinPath(distDir, "assets");
  const assetsWebUri = webview.asWebviewUri(assetsDir);

  const fixed = html
    .replaceAll('src="/assets/', `src="${assetsWebUri}/`)
    .replaceAll('href="/assets/', `href="${assetsWebUri}/`)
    .replaceAll('src="./assets/', `src="${assetsWebUri}/`)
    .replaceAll('href="./assets/', `href="${assetsWebUri}/`);

  // Minimal CSP (Vite build scripts are local)
  const csp = `
    <meta http-equiv="Content-Security-Policy"
      content="
        default-src 'none';
        img-src ${webview.cspSource} https: data:;
        style-src ${webview.cspSource} 'unsafe-inline';
        script-src ${webview.cspSource};
        font-src ${webview.cspSource} data:;
        connect-src ${webview.cspSource} http: https:;
      ">
  `;

  return fixed.replace("</head>", `${csp}</head>`);
}
