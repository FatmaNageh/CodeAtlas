import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type {
  CodeAtlasInitialState,
  HostToWebviewMessage,
  ServerStatus,
} from "@CodeAtlas/extension-bridge";
import { parseWebviewToHostMessage } from "@CodeAtlas/extension-bridge";

export type AppWebviewInitialState = CodeAtlasInitialState;
export type AppServerStatus = ServerStatus;
export type AppHostMessage = HostToWebviewMessage;
export { parseWebviewToHostMessage };

export function getAppWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const appRoot = vscode.Uri.joinPath(extensionUri, "media", "app");
  const indexPath = path.join(extensionUri.fsPath, "media", "app", "index.html");

  if (!fs.existsSync(indexPath)) {
    return getMissingBuildHtml();
  }

  const nonce = createNonce();
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} data:`,
    `font-src ${webview.cspSource}`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    "connect-src http://127.0.0.1:* http://localhost:*",
  ].join("; ");

  const html = fs.readFileSync(indexPath, "utf8");
  const withWebviewUris = html.replace(
    /(src|href)="\.?\/?([^"]+)"/g,
    (_match: string, attribute: string, assetPath: string) => {
      if (assetPath.startsWith("http:") || assetPath.startsWith("https:") || assetPath.startsWith("data:")) {
        return `${attribute}="${assetPath}"`;
      }

      const webviewUri = webview.asWebviewUri(vscode.Uri.joinPath(appRoot, ...assetPath.split("/")));
      return `${attribute}="${webviewUri.toString()}"`;
    },
  );

  const withNonce = withWebviewUris.replace(/<script /g, `<script nonce="${nonce}" `);
  return withNonce.replace(
    "<head>",
    `<head><meta http-equiv="Content-Security-Policy" content="${escapeAttribute(csp)}">`,
  );
}

function getMissingBuildHtml(): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    "<title>CodeAtlas</title>",
    "</head>",
    '<body style="font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); padding: 24px;">',
    "<h1>CodeAtlas webview build not found</h1>",
    "<p>Run <code>pnpm --filter extension-web build</code>, then reopen this panel.</p>",
    "</body>",
    "</html>",
  ].join("");
}

function createNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const length = 32;
  const bytes = crypto.randomBytes(length);
  let value = "";

  for (let index = 0; index < length; index += 1) {
    value += alphabet.charAt(bytes[index] % alphabet.length);
  }

  return value;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
