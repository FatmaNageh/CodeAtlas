import * as vscode from "vscode";

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codeatlas.chatView";

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);
  }

  private getHtml(webview: vscode.Webview) {
    // Simple placeholder UI (we can replace with your React chat-ui later)
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>CodeAtlas Chat</title>
    <style>
      body { font-family: system-ui; padding: 12px; }
      textarea { width: 100%; height: 80px; }
      button { margin-top: 8px; }
      #log { margin-top: 12px; white-space: pre-wrap; opacity: 0.9; }
    </style>
  </head>
  <body>
    <h3>CodeAtlas Chat</h3>
    <p>Ask about the graph (placeholder UI for now).</p>
    <textarea id="q" placeholder="Ask something..."></textarea>
    <button id="send">Send</button>
    <div id="log"></div>

    <script>
      const vscode = acquireVsCodeApi();
      const log = document.getElementById("log");
      document.getElementById("send").addEventListener("click", () => {
        const text = document.getElementById("q").value;
        vscode.postMessage({ type: "ask", text });
        log.textContent = "You: " + text + "\\n(backend will answer next...)";
      });
    </script>
  </body>
</html>`;
  }
}
