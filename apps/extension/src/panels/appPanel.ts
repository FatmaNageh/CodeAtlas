import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
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
  const assetsDir = path.join(extensionUri.fsPath, "media", "app", "assets");
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
  const normalizedHtml = replaceBuiltAssetReferences(html, assetsDir);
  const withWebviewUris = normalizedHtml.replace(
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

function replaceBuiltAssetReferences(html: string, assetsDir: string): string {
  if (!fs.existsSync(assetsDir)) return html;

  const files = fs
    .readdirSync(assetsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => ({
      name: entry.name,
      mtimeMs: fs.statSync(path.join(assetsDir, entry.name)).mtimeMs,
    }));

  const jsFile = selectAsset(files, ".js");
  const cssFile = selectAsset(files, ".css");

  let nextHtml = html;
  if (jsFile) {
    nextHtml = nextHtml.replace(
      /(<script[^>]*\bsrc=")[^"]*(assets\/index(?:-[^"/]+)?\.js)("[^>]*><\/script>)/,
      `$1./assets/${jsFile}$3`,
    );
  }

  if (cssFile) {
    nextHtml = nextHtml.replace(
      /(<link[^>]*\bhref=")[^"]*(assets\/index(?:-[^"/]+)?\.css)("[^>]*>)/,
      `$1./assets/${cssFile}$3`,
    );
  }

  return nextHtml;
}

function selectAsset(
  entries: Array<{ name: string; mtimeMs: number }>,
  extension: ".js" | ".css",
): string | undefined {
  const exactName = `index${extension}`;
  if (entries.some((entry) => entry.name === exactName)) return exactName;

  const hashedCandidates = entries
    .filter((entry) => entry.name.startsWith("index-") && entry.name.endsWith(extension))
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  return hashedCandidates[0]?.name;
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
  const bytes = getSecureRandomBytes(length);
  let value = "";

  for (let index = 0; index < length; index += 1) {
    value += alphabet.charAt(bytes[index] % alphabet.length);
  }

  return value;
}

function getSecureRandomBytes(length: number): Uint8Array {
  if (typeof globalThis.crypto !== "undefined") {
    const bytes = new Uint8Array(length);
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }

  return Uint8Array.from(randomBytes(length));
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
