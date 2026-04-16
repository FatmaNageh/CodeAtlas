import * as vscode from "vscode";

export function getNonce(): string {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

export function getGraphHtml(
  webview: vscode.Webview,
  serverUrl: string,
  repoId: string,
  neo4jBrowserUrl: string = "http://localhost:7474",
  nodeLimit: number = 500,
  autoRefresh: boolean = false
): string {
  const nonce = getNonce();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline';script-src 'nonce-${nonce}';connect-src http: https:;img-src ${webview.cspSource} data:;">
<title>CodeAtlas Graph</title>
<style>
/* ── Reset & Variables ────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --sp1: 4px; --sp2: 8px; --sp3: 12px; --sp4: 16px; --sp5: 20px;
  --radius-sm: 3px; --radius: 6px;
  --t: 120ms ease;
  --font-mono: var(--vscode-editor-font-family, 'Cascadia Code', 'Consolas', monospace);
  --font-ui: var(--vscode-font-family, system-ui, sans-serif);

  --bg:          var(--vscode-editor-background, #1e1e1e);
  --bg-side:     var(--vscode-sideBar-background, #252526);
  --bg-elevated: var(--vscode-editorWidget-background, #2d2d2d);
  --bg-input:    var(--vscode-input-background, #3c3c3c);
  --bg-hover:    var(--vscode-list-hoverBackground, rgba(255,255,255,.06));
  --bg-sel:      var(--vscode-list-activeSelectionBackground, rgba(9,71,113,.6));
  --bg-tab-header: var(--vscode-editorGroupHeader-tabsBackground, #252526);

  --border:      var(--vscode-panel-border, rgba(128,128,128,.22));
  --border-in:   var(--vscode-input-border, rgba(128,128,128,.3));
  --focus:       var(--vscode-focusBorder, #007acc);

  --fg:          var(--vscode-foreground, #cccccc);
  --fg-muted:    var(--vscode-descriptionForeground, #858585);
  --fg-input:    var(--vscode-input-foreground, #cccccc);
  --fg-ph:       var(--vscode-input-placeholderForeground, #5a5a5a);

  --accent:      var(--vscode-button-background, #0e639c);
  --accent-fg:   var(--vscode-button-foreground, #ffffff);
  --accent-hov:  var(--vscode-button-hoverBackground, #1177bb);
  --accent-line: var(--vscode-tab-activeBorderTop, #007acc);

  --c-purple: var(--vscode-charts-purple, #b180d7);
  --c-blue:   var(--vscode-charts-blue, #75beff);
  --c-green:  var(--vscode-charts-green, #89d185);
  --c-yellow: var(--vscode-charts-yellow, #e9c46a);
  --c-red:    var(--vscode-charts-red, #f48771);
}

body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-ui);
  font-size: 12px;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── Scrollbars ───────────────────────────────────────────────── */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(128,128,128,.25); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: rgba(128,128,128,.45); }

/* ── Toolbar ──────────────────────────────────────────────────── */
#toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 var(--sp2);
  height: 36px;
  background: var(--bg-tab-header);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  overflow: hidden;
}

.tb-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.tb-sep {
  width: 1px;
  height: 16px;
  background: var(--border);
  margin: 0 var(--sp1);
  flex-shrink: 0;
}

.tb-spacer { flex: 1; }

/* Icon buttons */
.tb-btn {
  height: 26px;
  min-width: 26px;
  padding: 0 var(--sp1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--fg-muted);
  font-size: 11px;
  font-family: var(--font-ui);
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--t), color var(--t);
}
.tb-btn:hover { background: var(--bg-hover); color: var(--fg); }
.tb-btn.active { color: var(--fg); background: var(--bg-hover); }
.tb-btn.primary {
  background: var(--accent);
  color: var(--accent-fg);
  padding: 0 var(--sp2);
  min-width: auto;
}
.tb-btn.primary:hover { background: var(--accent-hov); }
.tb-btn.danger { color: var(--c-red); }
.tb-btn.danger:hover { background: rgba(244,71,71,.12); }

/* Connection status pill */
#status-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 var(--sp2);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 20px;
  font-size: 10px;
  color: var(--fg-muted);
  white-space: nowrap;
}
#status-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: rgba(128,128,128,.4);
  flex-shrink: 0;
  transition: background .3s;
}
#status-dot.ok  { background: var(--c-green); box-shadow: 0 0 4px rgba(137,209,133,.5); }
#status-dot.err { background: var(--c-red); }
#status-dot.go  { animation: pulse .9s ease-in-out infinite; background: var(--c-yellow); }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
#status-text { max-width: 90px; overflow: hidden; text-overflow: ellipsis; }

/* Text inputs in toolbar */
.tb-input {
  height: 22px;
  background: var(--bg-input);
  border: 1px solid var(--border-in);
  border-radius: var(--radius-sm);
  color: var(--fg-input);
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 0 var(--sp2);
  outline: none;
  transition: border-color var(--t);
}
.tb-input:focus { border-color: var(--focus); }
.tb-input::placeholder { color: var(--fg-ph); }
#in-server { width: 160px; }
#in-repo   { width: 108px; }

/* ── Status Banner ────────────────────────────────────────────── */
#banner {
  display: none;
  align-items: center;
  justify-content: center;
  gap: var(--sp2);
  padding: 5px var(--sp3);
  font-size: 11px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
#banner.warn { display: flex; background: rgba(240,164,0,.08); color: #f0c27f; }
#banner.err  { display: flex; background: rgba(244,71,71,.08); color: var(--c-red); }
#banner.info { display: flex; background: rgba(128,128,128,.06); color: var(--fg-muted); }
.banner-btn {
  padding: 2px var(--sp2);
  background: none;
  border: 1px solid currentColor;
  border-radius: var(--radius-sm);
  color: inherit;
  font-size: 10px;
  cursor: pointer;
  opacity: .8;
  transition: opacity var(--t);
}
.banner-btn:hover { opacity: 1; }

/* ── Main Layout ──────────────────────────────────────────────── */
#layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ── Left Sidebar ─────────────────────────────────────────────── */
#sidebar {
  width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-side);
  border-right: 1px solid var(--border);
  overflow: hidden;
  transition: width .15s ease;
}
#sidebar.collapsed { width: 0; }

/* Search */
#search-wrap {
  padding: var(--sp2) var(--sp2) var(--sp1);
  border-bottom: 1px solid var(--border);
}
#search-input {
  width: 100%;
  height: 26px;
  background: var(--bg-input);
  border: 1px solid var(--border-in);
  border-radius: var(--radius-sm);
  color: var(--fg-input);
  font-size: 11px;
  padding: 0 var(--sp2) 0 24px;
  outline: none;
  transition: border-color var(--t);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23858585' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 7px 50%;
}
#search-input:focus { border-color: var(--focus); }
#search-input::placeholder { color: var(--fg-ph); }

/* Sidebar sections */
.side-section {
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.side-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px var(--sp2) 4px;
  cursor: pointer;
  user-select: none;
}
.side-header:hover { background: var(--bg-hover); }
.side-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: var(--fg-muted);
}
.side-chevron {
  font-size: 9px;
  color: var(--fg-muted);
  transition: transform var(--t);
}
.side-section.open .side-chevron { transform: rotate(90deg); }
.side-body { display: none; padding: var(--sp1) var(--sp2) var(--sp2); }
.side-section.open .side-body { display: block; }

/* Mode buttons */
.mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
}
.mode-btn {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 5px 4px;
  text-align: center;
  background: transparent;
  color: var(--fg-muted);
  font-size: 10px;
  font-family: var(--font-ui);
  cursor: pointer;
  line-height: 1.3;
  transition: all var(--t);
}
.mode-btn.on {
  background: var(--accent);
  color: var(--accent-fg);
  border-color: transparent;
}
.mode-btn:hover:not(.on) { background: var(--bg-hover); color: var(--fg); }
.mode-sub { font-size: 9px; opacity: .6; display: block; margin-top: 1px; }

/* Filter checkboxes */
.filter-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  cursor: pointer;
  font-size: 11px;
  color: var(--fg);
}
.filter-row input[type=checkbox] {
  width: 12px; height: 12px; margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}
.filter-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.filter-dot.sq { border-radius: 2px; }

/* Tree */
#tree-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 2px 0;
}
.tree-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px var(--sp1);
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--fg-muted);
  cursor: pointer;
  border-radius: 2px;
  margin: 0 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background var(--t), color var(--t);
}
.tree-row:hover { background: var(--bg-hover); color: var(--fg); }
.tree-row.active {
  background: var(--bg-sel);
  color: var(--vscode-list-activeSelectionForeground, var(--fg));
}
.tree-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}
.tree-dot.folder { border-radius: 1px; }

/* ── Canvas ───────────────────────────────────────────────────── */
#canvas {
  flex: 1;
  position: relative;
  overflow: hidden;
  cursor: grab;
  background: var(--bg);
}
#canvas.panning { cursor: grabbing; }
#graph-svg { width: 100%; height: 100%; display: block; user-select: none; }

/* Loading overlay */
#loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp3);
  background: var(--bg);
  z-index: 20;
}
#loading.hidden { display: none; }

.loader-ring {
  width: 32px; height: 32px;
  border: 2px solid rgba(128,128,128,.15);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.loader-text {
  font-size: 12px;
  color: var(--fg-muted);
  text-align: center;
  max-width: 260px;
  line-height: 1.5;
}
.loader-actions {
  display: flex;
  gap: var(--sp2);
  margin-top: 2px;
}
.loader-btn {
  padding: 5px var(--sp3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--fg);
  font-size: 11px;
  cursor: pointer;
  transition: background var(--t);
}
.loader-btn:hover { background: var(--bg-hover); }
.loader-btn.primary { background: var(--accent); color: var(--accent-fg); border-color: transparent; }
.loader-btn.primary:hover { background: var(--accent-hov); }

/* Graph overlays */
.graph-overlay {
  position: absolute;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--sp2) var(--sp3);
  font-size: 10px;
  color: var(--fg-muted);
  pointer-events: none;
  backdrop-filter: blur(8px);
}
#overlay-stats { top: var(--sp2); left: var(--sp2); }
#overlay-legend { bottom: var(--sp2); left: var(--sp2); }
#overlay-selection { bottom: var(--sp2); right: 46px; }

.ov-title {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: var(--fg-muted);
  margin-bottom: 4px;
  opacity: .7;
}
.ov-row {
  display: flex;
  justify-content: space-between;
  gap: var(--sp3);
  padding: 1px 0;
  font-size: 10px;
}
.ov-val { font-family: var(--font-mono); color: var(--fg); font-size: 10px; }
.legend-row {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 1px 0;
  font-size: 10px;
}
.legend-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.legend-note {
  margin-top: 5px;
  padding-top: 5px;
  border-top: 1px solid var(--border);
  font-size: 9px;
  opacity: .6;
}

/* Zoom controls */
#zoom-controls {
  position: absolute;
  right: var(--sp2);
  top: var(--sp2);
  display: flex;
  flex-direction: column;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
.zoom-btn {
  width: 28px; height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--fg-muted);
  cursor: pointer;
  font-size: 14px;
  transition: background var(--t), color var(--t);
}
.zoom-btn:hover { background: var(--bg-hover); color: var(--fg); }
.zoom-btn:not(:last-child) { border-bottom: 1px solid var(--border); }
.zoom-fit { font-size: 9px; font-weight: 600; font-family: var(--font-ui); }

/* Tooltip */
#tooltip {
  position: fixed;
  display: none;
  pointer-events: none;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 6px var(--sp2);
  font-size: 11px;
  max-width: 200px;
  z-index: 100;
  line-height: 1.5;
  box-shadow: 0 4px 12px rgba(0,0,0,.3);
}
#tooltip.visible { display: block; }
.tip-name { font-weight: 600; color: var(--fg); font-family: var(--font-mono); word-break: break-all; }
.tip-kind { font-size: 9px; color: var(--fg-muted); margin-top: 1px; }
.tip-deg  { font-size: 9px; color: var(--fg-muted); }

/* ── Right Panel ──────────────────────────────────────────────── */
#right-panel {
  width: 248px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-side);
  border-left: 1px solid var(--border);
  overflow: hidden;
}

/* Tabs */
.tab-bar {
  display: flex;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--bg-tab-header);
}
.tab-btn {
  flex: 1;
  padding: 7px 4px;
  text-align: center;
  font-size: 11px;
  color: var(--fg-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color var(--t), border-color var(--t), background var(--t);
  background: none;
  border-top: none;
  border-left: none;
  border-right: none;
  font-family: var(--font-ui);
  white-space: nowrap;
}
.tab-btn:hover:not(.on) { background: var(--bg-hover); color: var(--fg); }
.tab-btn.on { color: var(--fg); border-bottom-color: var(--accent-line); }

.tab-pane { display: none; flex: 1; overflow-y: auto; flex-direction: column; }
.tab-pane.on { display: flex; }

/* ── Detail Tab ───────────────────────────────────────────────── */
#pane-detail { padding: 0; }

.detail-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp2);
  text-align: center;
  padding: var(--sp4);
  color: var(--fg-muted);
}
.detail-empty-icon { font-size: 28px; margin-bottom: var(--sp1); opacity: .5; }
.detail-empty-title { font-size: 11px; }
.detail-empty-sub { font-size: 10px; opacity: .7; line-height: 1.5; }

/* Node header card */
.node-card {
  padding: var(--sp3);
  border-bottom: 1px solid var(--border);
  border-left: 3px solid var(--node-color, var(--c-blue));
}
.node-kind-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 9px;
  font-family: var(--font-mono);
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: uppercase;
  margin-bottom: 6px;
}
.node-name {
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--fg);
  word-break: break-all;
  line-height: 1.4;
  margin-bottom: 2px;
}
.node-path {
  font-size: 9px;
  font-family: var(--font-mono);
  color: var(--fg-muted);
  word-break: break-all;
  line-height: 1.4;
}

/* Detail sections */
.detail-section {
  padding: var(--sp2) var(--sp3);
  border-bottom: 1px solid var(--border);
}
.detail-section:last-child { border-bottom: none; }

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--sp2);
}
.section-title {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: var(--fg-muted);
}

/* Metadata grid */
.meta-grid { display: flex; flex-direction: column; gap: 0; }
.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 3px 0;
  border-bottom: 1px solid rgba(128,128,128,.08);
  font-size: 11px;
  gap: var(--sp2);
}
.meta-row:last-child { border-bottom: none; }
.meta-key { color: var(--fg-muted); flex-shrink: 0; }
.meta-val {
  font-family: var(--font-mono);
  color: var(--fg);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
  font-size: 10px;
}

/* Relationship buttons */
.rel-list { display: flex; flex-direction: column; gap: 2px; }
.rel-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 5px var(--sp2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--fg);
  font-size: 10px;
  font-family: var(--font-ui);
  cursor: pointer;
  text-align: left;
  transition: background var(--t);
}
.rel-btn:hover { background: var(--bg-hover); }
.rel-type-tag {
  font-family: var(--font-mono);
  font-size: 8px;
  padding: 1px 4px;
  border-radius: 2px;
  border: 1px solid rgba(128,128,128,.25);
  flex-shrink: 0;
}
.rel-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  font-size: 10px;
}

/* AI Summary box */
.summary-box {
  background: rgba(128,128,128,.07);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--sp2);
  font-size: 10px;
  line-height: 1.65;
  color: var(--fg);
  min-height: 36px;
  white-space: pre-wrap;
  word-break: break-word;
}
.gen-btn {
  padding: 3px var(--sp2);
  border-radius: var(--radius-sm);
  border: none;
  background: var(--accent);
  color: var(--accent-fg);
  font-size: 10px;
  cursor: pointer;
  transition: background var(--t), opacity var(--t);
}
.gen-btn:hover { background: var(--accent-hov); }
.gen-btn:disabled { opacity: .4; cursor: default; }

/* Properties pre */
.props-pre {
  font-family: var(--font-mono);
  font-size: 9px;
  background: rgba(128,128,128,.07);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--sp2);
  overflow-x: auto;
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
  color: var(--fg-muted);
}

/* Action buttons */
.action-list { display: flex; flex-direction: column; gap: 3px; }
.action-btn {
  display: flex;
  align-items: center;
  gap: var(--sp2);
  width: 100%;
  padding: 6px var(--sp2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--fg);
  font-size: 11px;
  font-family: var(--font-ui);
  cursor: pointer;
  transition: background var(--t);
}
.action-btn:hover { background: var(--bg-hover); }
.action-icon { color: var(--fg-muted); font-size: 12px; }

/* ── Insights Tab ─────────────────────────────────────────────── */
#pane-insights { padding: var(--sp3); }

.hotspot-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--sp2);
  margin-bottom: 4px;
  cursor: pointer;
  transition: background var(--t);
}
.hotspot-card:hover { background: var(--bg-hover); border-color: rgba(128,128,128,.4); }
.hotspot-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.hotspot-name { font-family: var(--font-mono); font-size: 10px; color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.hotspot-count { font-size: 9px; font-family: var(--font-mono); color: var(--fg-muted); background: rgba(128,128,128,.12); padding: 1px 5px; border-radius: 10px; flex-shrink: 0; }
.hotspot-bar { height: 2px; background: rgba(128,128,128,.12); border-radius: 1px; margin-top: 2px; }
.hotspot-fill { height: 100%; background: var(--accent); border-radius: 1px; transition: width .3s ease; }
.hotspot-kind { font-size: 9px; color: var(--fg-muted); margin-top: 2px; }

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp2);
  margin-top: var(--sp3);
}
.stat-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--sp2) var(--sp3);
  text-align: center;
}
.stat-val { font-size: 18px; font-weight: 700; font-family: var(--font-mono); color: var(--fg); line-height: 1.2; }
.stat-label { font-size: 9px; color: var(--fg-muted); text-transform: uppercase; letter-spacing: .06em; margin-top: 2px; }

/* ── AI Tab ───────────────────────────────────────────────────── */
#pane-ai { padding: var(--sp3); }
.ai-note {
  background: rgba(128,128,128,.07);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--sp2) var(--sp3);
  font-size: 11px;
  color: var(--fg-muted);
  line-height: 1.6;
  margin-bottom: var(--sp3);
}
.ai-note strong { color: var(--fg); }
</style>
</head>
<body>

<!-- Toolbar -->
<div id="toolbar">
  <div class="tb-group">
    <button class="tb-btn" id="btn-sidebar" title="Toggle sidebar">☰</button>
  </div>
  <div class="tb-sep"></div>
  <div class="tb-group">
    <div id="status-pill">
      <span id="status-dot"></span>
      <span id="status-text">Not connected</span>
    </div>
    <input class="tb-input" id="in-server" value="${serverUrl}" placeholder="http://localhost:3000" title="Backend server URL">
    <input class="tb-input" id="in-repo"   value="${repoId}"    placeholder="Repo ID" title="Repository ID">
    <button class="tb-btn" id="btn-sync" title="Reload graph">⟳</button>
  </div>
  <div class="tb-sep"></div>
  <div class="tb-group">
    <button class="tb-btn" id="btn-embed" title="Generate embeddings">↑ Embed</button>
    <button class="tb-btn" id="btn-neo4j" title="Open Neo4j Browser">Neo4j ↗</button>
  </div>
  <div class="tb-spacer"></div>
  <button class="tb-btn primary" id="btn-ai">💬 Ask AI</button>
</div>

<!-- Status Banner -->
<div id="banner"></div>

<!-- Main Layout -->
<div id="layout">

  <!-- Sidebar -->
  <div id="sidebar">
    <div id="search-wrap">
      <input id="search-input" placeholder="Search nodes…" autocomplete="off">
    </div>

    <!-- Mode section -->
    <div class="side-section open">
      <div class="side-header">
        <span class="side-title">Interaction Mode</span>
        <span class="side-chevron">›</span>
      </div>
      <div class="side-body">
        <div class="mode-grid">
          <button class="mode-btn on" data-m="select">Select<span class="mode-sub">inspect</span></button>
          <button class="mode-btn" data-m="neighbour">Neighbours<span class="mode-sub">explore</span></button>
          <button class="mode-btn" data-m="path">Path<span class="mode-sub">shortest</span></button>
          <button class="mode-btn" data-m="insight">Insights<span class="mode-sub">hotspots</span></button>
        </div>
      </div>
    </div>

    <!-- Edges section -->
    <div class="side-section open">
      <div class="side-header">
        <span class="side-title">Edge Types</span>
        <span class="side-chevron">›</span>
      </div>
      <div class="side-body">
        <label class="filter-row"><input type="checkbox" checked data-e="CONTAINS"><span class="filter-dot sq" style="background:var(--c-purple)"></span>CONTAINS</label>
        <label class="filter-row"><input type="checkbox" checked data-e="IMPORTS"><span class="filter-dot sq" style="background:var(--c-blue)"></span>IMPORTS</label>
        <label class="filter-row"><input type="checkbox" checked data-e="CALLS"><span class="filter-dot sq" style="background:var(--c-green)"></span>CALLS</label>
      </div>
    </div>

    <!-- Node types section -->
    <div class="side-section open">
      <div class="side-header">
        <span class="side-title">Node Types</span>
        <span class="side-chevron">›</span>
      </div>
      <div class="side-body">
        <label class="filter-row"><input type="checkbox" checked data-k="folder"><span class="filter-dot" style="background:var(--c-purple)"></span>Folder</label>
        <label class="filter-row"><input type="checkbox" checked data-k="file"><span class="filter-dot" style="background:var(--c-blue)"></span>File</label>
        <label class="filter-row"><input type="checkbox" checked data-k="class"><span class="filter-dot" style="background:var(--c-yellow)"></span>Class</label>
        <label class="filter-row"><input type="checkbox" checked data-k="fn"><span class="filter-dot" style="background:var(--c-green)"></span>Function</label>
      </div>
    </div>

    <!-- Tree section -->
    <div class="side-section open" style="flex:1;display:flex;flex-direction:column;overflow:hidden">
      <div class="side-header">
        <span class="side-title">Repository Tree</span>
        <span class="side-chevron">›</span>
      </div>
      <div id="tree-wrap" class="side-body" style="display:flex;flex-direction:column;flex:1;padding:4px 0;overflow-y:auto;border-bottom:none"></div>
    </div>
  </div>

  <!-- Canvas -->
  <div id="canvas">
    <!-- Loading -->
    <div id="loading">
      <div class="loader-ring" id="loader-ring"></div>
      <div class="loader-text" id="loader-text">Initialising…</div>
      <div class="loader-actions" id="loader-actions"></div>
    </div>

    <svg id="graph-svg">
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3z" fill="rgba(128,128,128,.35)"/>
        </marker>
      </defs>
      <g id="viewport">
        <g id="edge-layer"></g>
        <g id="node-layer"></g>
      </g>
    </svg>

    <!-- Overlays -->
    <div class="graph-overlay" id="overlay-stats">
      <div class="ov-title" id="ov-mode-label">Graph</div>
      <div class="ov-row"><span>Nodes</span><span class="ov-val" id="ov-nodes">0</span></div>
      <div class="ov-row"><span>Edges</span><span class="ov-val" id="ov-edges">0</span></div>
    </div>

    <div class="graph-overlay" id="overlay-legend">
      <div class="ov-title">Legend</div>
      <div class="legend-row"><span class="legend-dot" style="background:var(--c-purple)"></span>Folder</div>
      <div class="legend-row"><span class="legend-dot" style="background:var(--c-blue)"></span>File</div>
      <div class="legend-row"><span class="legend-dot" style="background:var(--c-yellow)"></span>Class</div>
      <div class="legend-row"><span class="legend-dot" style="background:var(--c-green)"></span>Function</div>
      <div class="legend-note">Size = connections</div>
    </div>

    <div class="graph-overlay" id="overlay-selection" style="display:none">
      <div class="ov-title">Selected</div>
      <div class="ov-val" id="ov-selected" style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px"></div>
    </div>

    <!-- Zoom -->
    <div id="zoom-controls">
      <button class="zoom-btn" id="btn-zoom-in" title="Zoom in">+</button>
      <button class="zoom-btn" id="btn-zoom-out" title="Zoom out">−</button>
      <button class="zoom-btn zoom-fit" id="btn-zoom-fit" title="Fit to screen">FIT</button>
    </div>
  </div>

  <!-- Right Panel -->
  <div id="right-panel">
    <div class="tab-bar">
      <button class="tab-btn on" data-tab="detail">Detail</button>
      <button class="tab-btn" data-tab="insights">Insights</button>
      <button class="tab-btn" data-tab="ai">AI</button>
    </div>

    <div class="tab-pane on" id="pane-detail">
      <div class="detail-empty" id="detail-empty">
        <div class="detail-empty-icon">⬡</div>
        <div class="detail-empty-title">No node selected</div>
        <div class="detail-empty-sub">Click any node in the graph to inspect its properties and relationships</div>
      </div>
      <div id="detail-content" style="display:none;flex-direction:column"></div>
    </div>

    <div class="tab-pane" id="pane-insights"></div>

    <div class="tab-pane" id="pane-ai">
      <div class="ai-note">
        Use the <strong>AI Chat</strong> sidebar panel for natural-language Q&amp;A.<br>
        Selecting a node here auto-sends it as context.
      </div>
      <div class="action-list">
        <button class="action-btn" id="btn-open-chat"><span class="action-icon">💬</span>Open Chat Panel</button>
        <button class="action-btn" id="btn-index-repo"><span class="action-icon">⊕</span>Index a Repository</button>
        <button class="action-btn" id="btn-open-neo4j"><span class="action-icon">🔗</span>Open Neo4j Browser</button>
      </div>
    </div>
  </div>
</div>

<!-- Tooltip -->
<div id="tooltip">
  <div class="tip-name" id="tip-name"></div>
  <div class="tip-kind" id="tip-kind"></div>
  <div class="tip-deg"  id="tip-deg"></div>
</div>

<script nonce="${nonce}">
window.onerror = function(msg,_,line) {
  var el = document.getElementById('loader-text');
  if(el) el.textContent = '⚠ Error: ' + msg + ' (line ' + line + ')';
};
(function(){
'use strict';
const vsc = acquireVsCodeApi();
const NS  = 'http://www.w3.org/2000/svg';
const $   = id => document.getElementById(id);

/* ── Config ───────────────────────────────────────────────────── */
const CFG = {
  neo4jBrowserUrl: '${neo4jBrowserUrl}',
  nodeLimit: ${nodeLimit},
  autoRefresh: ${autoRefresh},
};
let _arTimer = null;

/* ── Node/Edge Classification ─────────────────────────────────── */
function classify(n) {
  const L = n.labels || [], id = String(n.id || '');
  if (L.some(l => ['Repository','Repo','Folder','Directory'].includes(l)) || /^(repo|dir):/.test(id)) return 'folder';
  if (L.some(l => ['Class','Interface','Enum'].includes(l))) return 'class';
  if (L.some(l => ['CallSite','CallSiteSummary'].includes(l)) || id.startsWith('call:')) return 'callsite';
  if (L.some(l => ['Function','Method','Chunk','Symbol'].includes(l)) || id.startsWith('sym:')) return 'fn';
  if (L.some(l => ['Import','ExternalModule','ExternalSymbol'].includes(l)) || /^(imp:|extmod:)/.test(id)) return 'import';
  return 'file';
}

function getLabel(n) {
  const p = n.properties || {}, id = String(n.id || '');
  for (const k of ['name','displayName','symbol','callee','raw','qname']) {
    const v = p[k];
    if (typeof v === 'string' && v.trim() && v.length < 80) {
      const s = v.replace(/\\/g,'/').split('/').filter(Boolean).pop() || v;
      return s.length > 28 ? s.slice(0,27) + '…' : s;
    }
  }
  for (const k of ['relPath','filePath','path','fileRelPath','relativePath','rootPath']) {
    const v = p[k];
    if (typeof v === 'string' && v.trim()) {
      const s = v.replace(/\\/g,'/').split('/').filter(Boolean).pop() || v;
      return s.length > 28 ? s.slice(0,27) + '…' : s;
    }
  }
  const m = id.match(/^(repo|dir|file|sym|imp|call|chunk|extmod|extsym|edge):(.+)$/);
  if (m) {
    const [,kind,rest] = m;
    if (kind === 'file' || kind === 'dir') {
      const parts = rest.split(':'), rel = parts.slice(1).join(':');
      const s = rel.replace(/\\/g,'/').split('/').filter(Boolean).pop() || rel;
      return s.length > 28 ? s.slice(0,27) + '…' : s;
    }
    return {imp:'import',call:'call',sym:'symbol',chunk:'chunk',repo:'root',extmod:'external'}[kind] || kind;
  }
  return id.slice(0,14) + (id.length > 14 ? '…' : '');
}

function getPath(n) {
  const p = n.properties || {};
  for (const k of ['relPath','filePath','path','fileRelPath','relativePath','rootPath'])
    if (typeof p[k] === 'string' && p[k].trim()) return p[k];
  return '';
}

/* Kind styling */
const KS = {
  folder:   { color: 'var(--c-purple,#b180d7)', hex: '#b180d7' },
  file:     { color: 'var(--c-blue,#75beff)',   hex: '#75beff' },
  class:    { color: 'var(--c-yellow,#e9c46a)', hex: '#e9c46a' },
  fn:       { color: 'var(--c-green,#89d185)',  hex: '#89d185' },
  callsite: { color: 'rgba(128,128,128,.45)',   hex: '#888' },
  import:   { color: 'rgba(128,128,128,.3)',    hex: '#666' },
};
function ks(k) { return KS[k] || KS.file; }

/* Edge styling */
function edgeColor(t) {
  const u = String(t).toUpperCase();
  if (u.includes('CALL'))   return 'var(--c-green,#89d185)';
  if (u.includes('IMPORT')) return 'var(--c-blue,#75beff)';
  return 'var(--c-purple,#b180d7)';
}
function edgeDash(t) {
  const u = String(t).toUpperCase();
  if (u.includes('CALL'))   return '2 4';
  if (u.includes('IMPORT')) return '4 3';
  return null;
}
function edgeCat(t) {
  const u = String(t).toUpperCase();
  if (u.includes('CALL'))   return 'CALLS';
  if (u.includes('IMPORT')) return 'IMPORTS';
  return 'CONTAINS';
}

function sid(v) { return String(v || ''); }

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function trunc(s, n=18) { s = String(s||''); return s.length > n ? s.slice(0, n-1) + '…' : s; }

/* ── Node Sizing ──────────────────────────────────────────────── */
const BASE_R = { folder:14, file:10, class:12, fn:8, callsite:5, import:4 };
function baseR(k) { return BASE_R[k] || 10; }
function degR(k, deg) {
  const b = baseR(k);
  if (deg === 0) return Math.max(5, b * .7);
  if (deg >= 10) return b * 2.4;
  if (deg >= 6)  return b * 2.0;
  if (deg >= 3)  return b * 1.5;
  return b * 1.2;
}
function degOpacity(deg) {
  if (deg === 0) return .4;
  if (deg >= 6)  return 1;
  if (deg >= 2)  return .85;
  return .7;
}

/* ── State ────────────────────────────────────────────────────── */
const ST = {
  all: [], allE: [], filt: [], filtE: [],
  simN: [], degMap: new Map(),
  sel: null, mode: 'select', search: '',
  visE: { CONTAINS:true, IMPORTS:true, CALLS:true },
  visK: { folder:true, file:true, class:true, fn:true, callsite:false, import:false },
  tx: { x:0, y:0, k:1 }, pan: null,
  sidebarOpen: true,
  get serverUrl() { return $('in-server').value.trim(); },
  get repoId()    { return $('in-repo').value.trim(); },
};

/* ── Filter ───────────────────────────────────────────────────── */
function rebuild() {
  const lo = ST.search.toLowerCase();
  ST.filt = ST.all.filter(n => {
    if (!ST.visK[n._k]) return false;
    if (!lo) return true;
    return (n._lbl + getPath(n) + JSON.stringify(n.properties||{})).toLowerCase().includes(lo);
  });
  const ids = new Set(ST.filt.map(n => sid(n.id)));
  ST.filtE = ST.allE.filter(e => {
    const cat = edgeCat(e.type);
    return ST.visE[cat] && ids.has(sid(e.from)) && ids.has(sid(e.to));
  });
  ST.degMap = new Map();
  ST.filt.forEach(n => ST.degMap.set(sid(n.id), 0));
  ST.filtE.forEach(e => {
    ST.degMap.set(sid(e.from), (ST.degMap.get(sid(e.from))||0) + 1);
    ST.degMap.set(sid(e.to),   (ST.degMap.get(sid(e.to))||0)   + 1);
  });
}

/* ── Layout Simulation ────────────────────────────────────────── */
const RINGS = { folder:0, file:1, class:1, fn:2, callsite:3, import:3 };

function initSim() {
  const svg = $('graph-svg');
  const W = svg.clientWidth || 900, H = svg.clientHeight || 600;
  const prev = new Map(ST.simN.map(n => [sid(n.id), n]));
  const sorted = [...ST.filt].sort((a,b) => (ST.degMap.get(sid(b.id))||0) - (ST.degMap.get(sid(a.id))||0));
  const maxR = Math.min(W,H) * .44;
  const ringR = [maxR*.15, maxR*.55, maxR*.9];
  const placed = new Map();
  sorted.forEach(n => {
    const ring = RINGS[n._k] || 1;
    const r = ringR[ring] || ringR[1];
    const ringNodes = sorted.filter(x => (RINGS[x._k]||1) === ring);
    const i = ringNodes.indexOf(n), total = ringNodes.length || 1;
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    const jitter = r * .22 * (Math.random() - .5);
    placed.set(sid(n.id), {
      x: W/2 + Math.cos(angle) * (r + jitter),
      y: H/2 + Math.sin(angle) * (r + jitter),
    });
  });
  ST.simN = ST.filt.map(n => {
    const p = prev.get(sid(n.id));
    const pl = placed.get(sid(n.id)) || { x: W/2, y: H/2 };
    return { ...n, x: p ? p.x : pl.x, y: p ? p.y : pl.y, vx: 0, vy: 0 };
  });
}

function simTick(a) {
  const nodes = ST.simN, edges = ST.filtE;
  if (!nodes.length) return;
  const svg = $('graph-svg');
  const W = svg.clientWidth || 900, H = svg.clientHeight || 600;
  const nmap = new Map(nodes.map(n => [sid(n.id), n]));
  const LIM = Math.min(nodes.length, 280);
  for (let i = 0; i < LIM; i++) {
    for (let j = i+1; j < LIM; j++) {
      const A = nodes[i], B = nodes[j];
      let dx = B.x - A.x || (Math.random()-.5)*.3;
      let dy = B.y - A.y || (Math.random()-.5)*.3;
      const d2 = dx*dx + dy*dy || .001, d = Math.sqrt(d2);
      const rA = degR(A._k, ST.degMap.get(sid(A.id))||0);
      const rB = degR(B._k, ST.degMap.get(sid(B.id))||0);
      const minD = (rA + rB) * 3.5;
      const f = (d < minD ? -6000/d2 : -3200/d2) * a;
      A.vx += f*dx/d; A.vy += f*dy/d;
      B.vx -= f*dx/d; B.vy -= f*dy/d;
    }
  }
  for (const e of edges) {
    const s = nmap.get(sid(e.from)), t = nmap.get(sid(e.to));
    if (!s || !t) continue;
    const dx = t.x - s.x, dy = t.y - s.y, d = Math.sqrt(dx*dx + dy*dy) || .001;
    const rs = degR(s._k, ST.degMap.get(sid(s.id))||0);
    const rt = degR(t._k, ST.degMap.get(sid(t.id))||0);
    const rest = Math.max(rs + rt + 40, s._k === 'folder' || t._k === 'folder' ? 180 : 130);
    const f = (d - rest) * .18 * a;
    s.vx += f*dx/d; s.vy += f*dy/d;
    t.vx -= f*dx/d; t.vy -= f*dy/d;
  }
  for (const nd of nodes) {
    nd.vx += (W/2 - nd.x) * .005 * a;
    nd.vy += (H/2 - nd.y) * .005 * a;
    nd.vx *= .78; nd.vy *= .78;
    nd.x += nd.vx; nd.y += nd.vy;
    nd.x = Math.max(22, Math.min(W-22, nd.x));
    nd.y = Math.max(22, Math.min(H-22, nd.y));
  }
}

function computeLayout() {
  let a = 1.0;
  for (let i = 0; i < 450; i++) {
    a *= .982;
    if (a < .003) break;
    simTick(a);
  }
  autoFit();
}

function autoFit() {
  if (!ST.simN.length) return;
  const svg = $('graph-svg');
  const W = svg.clientWidth || 900, H = svg.clientHeight || 600;
  const xs = ST.simN.map(n => n.x), ys = ST.simN.map(n => n.y);
  const mnX = Math.min(...xs) - 30, mxX = Math.max(...xs) + 30;
  const mnY = Math.min(...ys) - 30, mxY = Math.max(...ys) + 30;
  const k = Math.min(W/(mxX-mnX||1), H/(mxY-mnY||1), .96);
  ST.tx = {
    x: (W - (mxX+mnX)*k) / 2,
    y: (H - (mxY+mnY)*k) / 2,
    k: Math.max(.05, Math.min(k, 5)),
  };
}

/* ── Render (static, no animation loop) ──────────────────────── */
const eEls = new Map(), nEls = new Map();

function render() {
  const nodes = ST.simN, edges = ST.filtE;
  const nmap  = new Map(nodes.map(n => [sid(n.id), n]));
  const selId = ST.sel;

  // Highlight set
  const hi = new Set();
  if (selId) {
    hi.add(selId);
    if (ST.mode === 'neighbour' || ST.mode === 'select')
      edges.forEach(e => { if(sid(e.from)===selId)hi.add(sid(e.to)); if(sid(e.to)===selId)hi.add(sid(e.from)); });
    if (ST.mode === 'insight')
      [...ST.degMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([id])=>hi.add(id));
  }
  const dim = !!selId && ST.mode !== 'insight';

  // ── Edges ──────────────────────────────────────────────────
  const el = $('edge-layer'), nl = $('node-layer');
  const eIds = new Set(edges.map(e => sid(e.id)||(sid(e.from)+':'+sid(e.to))));
  for (const [k,v] of eEls) if (!eIds.has(k)) { v.remove(); eEls.delete(k); }

  for (const e of edges) {
    const s = nmap.get(sid(e.from)), t = nmap.get(sid(e.to));
    if (!s || !t) continue;
    const eid = sid(e.id) || (sid(e.from)+':'+sid(e.to));
    let ln = eEls.get(eid);
    if (!ln) { ln = document.createElementNS(NS,'line'); el.appendChild(ln); eEls.set(eid,ln); }
    const dx = t.x-s.x, dy = t.y-s.y, d = Math.sqrt(dx*dx+dy*dy) || 1;
    const r = degR(t._k, ST.degMap.get(sid(t.id))||0);
    const isHi = selId && (sid(e.from)===selId || sid(e.to)===selId);
    ln.setAttribute('x1', s.x); ln.setAttribute('y1', s.y);
    ln.setAttribute('x2', t.x - dx/d*r); ln.setAttribute('y2', t.y - dy/d*r);
    ln.setAttribute('stroke', edgeColor(e.type));
    ln.setAttribute('stroke-dasharray', edgeDash(e.type) || '');
    ln.setAttribute('stroke-width', isHi ? 1.8 : .7);
    ln.setAttribute('stroke-opacity', dim && !isHi ? .03 : isHi ? .8 : .18);
    ln.setAttribute('marker-end', 'url(#arrow)');
  }

  // ── Nodes ──────────────────────────────────────────────────
  const nIds = new Set(nodes.map(n => sid(n.id)));
  for (const [k,v] of nEls) if (!nIds.has(k)) { v.remove(); nEls.delete(k); }

  for (const node of nodes) {
    const nid = sid(node.id);
    let g = nEls.get(nid);
    if (!g) {
      g = document.createElementNS(NS, 'g');
      g.style.cursor = 'pointer';
      const ci = document.createElementNS(NS, 'circle');
      const rb = document.createElementNS(NS, 'rect'); rb.setAttribute('rx', '2');
      const tx = document.createElementNS(NS, 'text');
      tx.setAttribute('pointer-events', 'none');
      tx.setAttribute('font-family', 'var(--vscode-editor-font-family,monospace)');
      g.appendChild(ci); g.appendChild(rb); g.appendChild(tx);
      nl.appendChild(g); nEls.set(nid, g);

      // Click → select
      g.addEventListener('click', ev => {
        ev.stopPropagation();
        ST.sel = nid;
        if (ST.mode === 'select') switchTab('detail');
        renderDetail(node);
        vsc.postMessage({ type:'nodeSelected', payload:{
          node: { id:node.id, labels:node.labels, properties:node.properties, _k:node._k, _lbl:node._lbl },
          allNodes: ST.all.slice(0, 200),
        }});
        $('ov-selected').textContent = node._lbl || node.id;
        $('overlay-selection').style.display = '';
        $('btn-ai').textContent = '💬 ' + trunc(node._lbl, 12);
        buildTree();
        render();
      });

      // Hover tooltip
      g.addEventListener('mouseenter', ev => {
        const deg = ST.degMap.get(nid) || 0;
        $('tip-name').textContent = node._lbl || node.id;
        $('tip-kind').textContent = (node.labels || []).join(', ') || node._k;
        $('tip-deg').textContent  = 'Connections: ' + deg;
        const tip = $('tooltip');
        tip.classList.add('visible');
        tip.style.left = (ev.clientX + 14) + 'px';
        tip.style.top  = (ev.clientY + 10) + 'px';
      });
      g.addEventListener('mousemove', ev => {
        $('tooltip').style.left = (ev.clientX + 14) + 'px';
        $('tooltip').style.top  = (ev.clientY + 10) + 'px';
      });
      g.addEventListener('mouseleave', () => $('tooltip').classList.remove('visible'));

      // Drag (no physics restart — smooth)
      let dragging=false, dx0=0, dy0=0, nx0=0, ny0=0;
      g.addEventListener('mousedown', ev => {
        ev.stopPropagation(); ev.preventDefault();
        dragging = true; dx0 = ev.clientX; dy0 = ev.clientY; nx0 = node.x; ny0 = node.y;
        function mv(ev) {
          if (!dragging) return;
          node.x = nx0 + (ev.clientX-dx0)/ST.tx.k;
          node.y = ny0 + (ev.clientY-dy0)/ST.tx.k;
          render();
        }
        function up() { dragging=false; window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up); }
        window.addEventListener('mousemove', mv);
        window.addEventListener('mouseup', up);
      });
    }

    const isSel = nid === selId;
    const isHi  = hi.has(nid);
    const isDim  = dim && !isHi;
    const deg    = ST.degMap.get(nid) || 0;
    const r      = degR(node._k, deg) + (isSel ? 3 : 0);
    const op     = degOpacity(deg);
    const style  = ks(node._k);

    const ci = g.children[0], rb = g.children[1], tx = g.children[2];

    ci.setAttribute('cx', node.x); ci.setAttribute('cy', node.y); ci.setAttribute('r', r);
    ci.setAttribute('fill', style.color);
    ci.setAttribute('stroke', isSel ? 'var(--focus,#007acc)' : style.color);
    ci.setAttribute('stroke-width', isSel ? 2.5 : 1);
    ci.setAttribute('fill-opacity',   isDim ? .08 : op);
    ci.setAttribute('stroke-opacity', isDim ? .08 : op);

    const showLbl = ['folder','file','class'].includes(node._k) || isSel ||
                    (node._k==='fn' && deg >= 3) || (node._k==='fn' && nodes.length < 50);
    const lbl = showLbl ? trunc(node._lbl, 20) : '';
    const fs  = Math.max(7, Math.min(11, r * .75 + (isSel ? 1 : 0)));
    const lx  = node.x + r + 3, ly = node.y + fs * .38;

    tx.textContent = lbl;
    tx.setAttribute('x', lx); tx.setAttribute('y', ly);
    tx.setAttribute('fill', isDim ? 'rgba(128,128,128,.2)' : isSel ? 'var(--focus,#007acc)' : 'var(--fg,#ccc)');
    tx.setAttribute('fill-opacity', isDim ? .2 : isSel ? 1 : op);
    tx.setAttribute('font-size', fs);
    tx.setAttribute('font-weight', isSel || deg >= 5 ? '600' : '400');

    if (lbl) {
      const lw = lbl.length * fs * .58 + 6;
      rb.setAttribute('x', lx-2); rb.setAttribute('y', ly-fs);
      rb.setAttribute('width', lw); rb.setAttribute('height', fs+3);
      rb.setAttribute('fill', 'var(--bg,#1e1e1e)');
      rb.setAttribute('fill-opacity', isDim ? .04 : .75);
    } else {
      rb.setAttribute('width', 0);
    }
  }

  $('ov-nodes').textContent = nodes.length;
  $('ov-edges').textContent = edges.length;
  $('viewport').setAttribute('transform', 'translate('+ST.tx.x+','+ST.tx.y+') scale('+ST.tx.k+')');
}

/* ── Load ─────────────────────────────────────────────────────── */
async function load() {
  const url = ST.serverUrl, rid = ST.repoId;
  if (!rid) {
    showLoader(null, 'Enter a Repo ID or index a repository first.', [
      { label:'⊕ Index Repo', primary:true, action:()=>vsc.postMessage({type:'indexRepo'}) },
    ]);
    return;
  }
  showLoader('spinner', 'Connecting to ' + url + '…');
  try {
    const res = await fetch(url + '/debug/subgraph?repoId=' + encodeURIComponent(rid) + '&limit=' + (CFG.nodeLimit||500) + '&_=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status + ' — check the server URL and Repo ID');
    const data = await res.json();
    if (data.ok === false) throw new Error(data.error || 'Server returned an error');
    if (!(data.nodes||[]).length) throw new Error('No nodes found — index the repository first');
    ST.all  = (data.nodes||[]).map(n => ({ ...n, _k:classify(n), _lbl:getLabel(n) }));
    ST.allE = data.edges || [];
    rebuild();
    showLoader('spinner', 'Computing layout…');
    setTimeout(() => {
      initSim(); computeLayout();
      buildTree(); buildInsights();
      setStatus('ok', url);
      hideLoader();
      render();
      vsc.postMessage({ type:'graph/nodes',    payload:{ nodes:ST.all } });
      vsc.postMessage({ type:'settings/save',  payload:{ serverUrl:url, repoId:rid } });
      startAutoRefresh();
    }, 40);
  } catch (err) {
    setStatus('err', '');
    const msg = err.message || String(err);
    const isNet = /fetch|refused|network|ERR_/i.test(msg);
    const actions = isNet
      ? [{ label:'Retry', action:load }, { label:'Open Neo4j', action:()=>vsc.postMessage({type:'openNeo4jBrowser'}) }]
      : [{ label:'Retry', action:load }, { label:'⊕ Index Repo', primary:true, action:()=>vsc.postMessage({type:'indexRepo'}) }];
    showLoader(null, '⚠ ' + msg, actions);
  }
}

/* ── Auto-refresh ─────────────────────────────────────────────── */
function startAutoRefresh() {
  if (_arTimer) clearInterval(_arTimer);
  if (!CFG.autoRefresh) return;
  _arTimer = setInterval(async () => {
    if (!ST.all.length) return;
    try {
      const res = await fetch(ST.serverUrl+'/debug/subgraph?repoId='+encodeURIComponent(ST.repoId)+'&limit='+(CFG.nodeLimit||500)+'&_='+Date.now());
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok===false || !(data.nodes||[]).length) return;
      ST.all  = (data.nodes||[]).map(n => ({ ...n, _k:classify(n), _lbl:getLabel(n) }));
      ST.allE = data.edges || [];
      rebuild(); initSim(); computeLayout();
      buildTree(); buildInsights(); render();
    } catch {/* silent */}
  }, 30000);
}

/* ── Loader helpers ───────────────────────────────────────────── */
function showLoader(type, text, actions) {
  $('loading').classList.remove('hidden');
  $('loader-ring').style.display = type === 'spinner' ? '' : 'none';
  $('loader-text').textContent = text || '';
  const act = $('loader-actions'); act.innerHTML = '';
  (actions || []).forEach(a => {
    const b = document.createElement('button');
    b.className = 'loader-btn' + (a.primary ? ' primary' : '');
    b.textContent = a.label;
    b.addEventListener('click', a.action);
    act.appendChild(b);
  });
}
function hideLoader() { $('loading').classList.add('hidden'); }

function setStatus(state, url) {
  const dot = $('status-dot'), txt = $('status-text');
  dot.className = state; // 'ok' | 'err' | 'go' | ''
  txt.textContent = state === 'ok' ? url.replace('http://127.0.0.1','localhost') : state === 'err' ? 'Error' : state === 'go' ? 'Starting…' : 'Stopped';
}

/* ── relayout ─────────────────────────────────────────────────── */
function relayout() {
  showLoader('spinner', 'Computing layout…');
  setTimeout(() => { initSim(); computeLayout(); hideLoader(); render(); buildTree(); buildInsights(); }, 40);
}

/* ── Detail Panel ─────────────────────────────────────────────── */
function renderDetail(node) {
  $('detail-empty').style.display = 'none';
  const dc = $('detail-content'); dc.style.display = 'flex';
  const k = node._k || 'file';
  const style = ks(k);
  const nid   = sid(node.id);
  let inD = 0, outD = 0;
  ST.filtE.forEach(e => { if(sid(e.to)===nid)inD++; if(sid(e.from)===nid)outD++; });
  const path_    = getPath(node);
  const fullName = path_.split(/[/\\]/).pop() || path_;
  const ext      = fullName.includes('.') ? fullName.split('.').pop().toLowerCase() : '';
  const LANG = {ts:'TypeScript',tsx:'TypeScript',js:'JavaScript',jsx:'JavaScript',py:'Python',java:'Java',cs:'C#',go:'Go',rb:'Ruby',cpp:'C++',rs:'Rust',kt:'Kotlin',html:'HTML',css:'CSS',json:'JSON',md:'Markdown'};
  const lang = (node.properties||{}).language || (ext && LANG[ext]) || (ext && ext.length<=6 ? ext.toUpperCase() : '—');
  const rels = ST.filtE.filter(e => sid(e.from)===nid || sid(e.to)===nid).slice(0,14).map(e => {
    const tid = sid(e.from)===nid ? sid(e.to) : sid(e.from);
    const t   = ST.simN.find(n => sid(n.id)===tid);
    return { e, t, cat:edgeCat(e.type) };
  }).filter(r => r.t);
  const RELCOLOR = { CONTAINS:style.hex, IMPORTS:'#75beff', CALLS:'#89d185' };
  const props = { ...(node.properties||{}) }; delete props.embedding;

  dc.innerHTML =
  // ── Node card ──
  '<div class="node-card" style="--node-color:'+style.hex+'">'+
    '<div class="node-kind-badge" style="background:'+style.hex+'1a;color:'+style.hex+'">'+k.toUpperCase()+'</div>'+
    '<div class="node-name">'+ esc(node._lbl || node.id) +'</div>'+
    (path_ ? '<div class="node-path">'+ esc(path_) +'</div>' : '')+
  '</div>'+
  // ── Metadata ──
  '<div class="detail-section">'+
    '<div class="section-header"><div class="section-title">Metadata</div></div>'+
    '<div class="meta-grid">'+
      '<div class="meta-row"><span class="meta-key">Type</span><span class="meta-val">'+k+'</span></div>'+
      '<div class="meta-row"><span class="meta-key">Language</span><span class="meta-val">'+esc(lang)+'</span></div>'+
      '<div class="meta-row"><span class="meta-key">In / Out</span><span class="meta-val">'+inD+' → '+outD+'</span></div>'+
      '<div class="meta-row"><span class="meta-key">Labels</span><span class="meta-val" title="'+ esc((node.labels||[]).join(', ')) +'">'+ esc((node.labels||[]).slice(0,3).join(', ')) +'</span></div>'+
    '</div>'+
  '</div>'+
  // ── AI Summary ──
  '<div class="detail-section">'+
    '<div class="section-header">'+
      '<div class="section-title">AI Summary</div>'+
      '<button class="gen-btn" id="btn-gen-sum">Generate</button>'+
    '</div>'+
    '<div class="summary-box" id="summary-box">Click Generate to get an AI summary of this node.</div>'+
  '</div>'+
  // ── Relationships ──
  '<div class="detail-section">'+
    '<div class="section-header"><div class="section-title">Relationships ('+ rels.length +')</div></div>'+
    '<div class="rel-list">'+
    rels.map(r =>
      '<button class="rel-btn" data-tid="'+sid(r.t.id)+'">'+
        '<span class="rel-type-tag" style="color:'+RELCOLOR[r.cat]+'">'+r.cat+'</span>'+
        '<span class="rel-name">'+esc(trunc(r.t._lbl||'',24))+'</span>'+
      '</button>'
    ).join('') +
    (!rels.length ? '<div style="font-size:10px;color:var(--fg-muted)">No visible relationships</div>' : '') +
    '</div>'+
  '</div>'+
  // ── Properties ──
  '<div class="detail-section">'+
    '<div class="section-header"><div class="section-title">Properties</div></div>'+
    '<pre class="props-pre">'+ esc(JSON.stringify(props,null,2)) +'</pre>'+
  '</div>'+
  // ── Actions ──
  '<div class="detail-section">'+
    '<div class="section-header"><div class="section-title">Actions</div></div>'+
    '<div class="action-list">'+
      '<button class="action-btn" id="btn-add-ctx"><span class="action-icon">✨</span>Add to AI Context</button>'+
      '<button class="action-btn" id="btn-neighbours"><span class="action-icon">⬡</span>Explore Neighbours</button>'+
      '<button class="action-btn" id="btn-trace-path"><span class="action-icon">⤳</span>Trace Path</button>'+
    '</div>'+
  '</div>';

  dc.querySelectorAll('[data-tid]').forEach(b => b.addEventListener('click', () => {
    const t = ST.simN.find(n => sid(n.id) === b.dataset.tid);
    if (t) { ST.sel = sid(t.id); renderDetail(t); render(); }
  }));
  $('btn-gen-sum')?.addEventListener('click', () => doSummary(node));
  $('btn-add-ctx')?.addEventListener('click', () => {
    switchTab('ai');
    vsc.postMessage({ type:'nodeSelected', payload:{ node:{id:node.id,labels:node.labels,properties:node.properties,_k:node._k,_lbl:node._lbl} } });
  });
  $('btn-neighbours')?.addEventListener('click', () => setMode('neighbour'));
  $('btn-trace-path')?.addEventListener('click', () => setMode('path'));
}

async function doSummary(node) {
  const box=$('summary-box'), btn=$('btn-gen-sum');
  if (!box||!btn) return;
  btn.textContent='…'; btn.disabled=true; box.textContent='Generating…';
  try {
    const p = getPath(node) || node._lbl || '';
    const r = await fetch(ST.serverUrl+'/graphrag/summarize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({repoId:ST.repoId,filePaths:[p],repoRoot:''})});
    const d = await r.json();
    box.textContent = d.results?.length > 0 ? d.results.map(x => x.summary||x.text||'').join('\n\n') : 'No summary returned.';
  } catch(e) { box.textContent = 'Error: ' + e.message; }
  btn.textContent='Generate'; btn.disabled=false;
}

/* ── Insights ─────────────────────────────────────────────────── */
function buildInsights() {
  const tab = $('pane-insights'); tab.innerHTML='';
  const hot = [...ST.filt].map(n=>({n,d:ST.degMap.get(sid(n.id))||0})).sort((a,b)=>b.d-a.d).slice(0,7);
  const maxD = Math.max(1, ...hot.map(h=>h.d));
  const orphans = ST.filt.filter(n=>(ST.degMap.get(sid(n.id))||0)===0).slice(0,4);
  const avgDeg = ST.filt.length ? (ST.filtE.length*2/ST.filt.length).toFixed(1) : '0';

  const wrap = document.createElement('div');
  wrap.style.cssText='padding:var(--sp3);display:flex;flex-direction:column;gap:var(--sp3)';

  // Stats
  const statsEl = document.createElement('div');
  statsEl.innerHTML =
    '<div class="section-title" style="margin-bottom:var(--sp2)">Overview</div>'+
    '<div class="stats-grid">'+
      '<div class="stat-card"><div class="stat-val">'+ST.filt.length+'</div><div class="stat-label">Nodes</div></div>'+
      '<div class="stat-card"><div class="stat-val">'+ST.filtE.length+'</div><div class="stat-label">Edges</div></div>'+
      '<div class="stat-card"><div class="stat-val">'+avgDeg+'</div><div class="stat-label">Avg Degree</div></div>'+
      '<div class="stat-card"><div class="stat-val">'+orphans.length+'</div><div class="stat-label">Orphans</div></div>'+
    '</div>';
  wrap.appendChild(statsEl);

  // Hotspots
  const hotEl = document.createElement('div');
  hotEl.innerHTML = '<div class="section-title" style="margin-bottom:var(--sp2)">Hotspot Nodes</div>';
  hot.forEach(h => {
    const card = document.createElement('div');
    card.className = 'hotspot-card';
    card.dataset.hi = sid(h.n.id);
    card.innerHTML =
      '<div class="hotspot-row">'+
        '<span class="hotspot-name">'+esc(h.n._lbl||'')+'</span>'+
        '<span class="hotspot-count">'+h.d+' links</span>'+
      '</div>'+
      '<div class="hotspot-bar"><div class="hotspot-fill" style="width:'+Math.round(h.d/maxD*100)+'%"></div></div>'+
      '<div class="hotspot-kind">'+esc(h.n._k)+'</div>';
    card.addEventListener('click', () => {
      const n = ST.simN.find(n=>sid(n.id)===card.dataset.hi);
      if (n) { ST.sel=sid(n.id); switchTab('detail'); renderDetail(n); render(); }
    });
    hotEl.appendChild(card);
  });
  wrap.appendChild(hotEl);

  tab.appendChild(wrap);
}

/* ── Repository Tree ──────────────────────────────────────────── */
function buildTree() {
  const con = $('tree-wrap'); con.innerHTML = '';
  const items = [], seen = new Set();
  const paths = ST.filt.filter(n => ['folder','file','class'].includes(n._k))
    .sort((a,b) => (ST.degMap.get(sid(b.id))||0) - (ST.degMap.get(sid(a.id))||0))
    .map(n => ({ nid:sid(n.id), path:getPath(n)||n._lbl||'', lbl:n._lbl }));

  for (const it of paths) {
    const clean = it.path.replace(/^[/\\]+/,'');
    const segs  = clean.split(/[/\\]/).filter(Boolean);
    if (!segs.length) {
      if (!seen.has(it.nid)) { items.push({key:it.nid,lbl:it.lbl,d:0,nid:it.nid}); seen.add(it.nid); }
      continue;
    }
    let pfx = '';
    segs.forEach((seg,i) => {
      pfx = pfx ? pfx+'/'+seg : seg;
      const isLeaf = i === segs.length-1;
      if (!seen.has(pfx)) { items.push({key:pfx,lbl:isLeaf?it.lbl:seg+'/',d:i,nid:isLeaf?it.nid:null}); seen.add(pfx); }
    });
  }

  items.slice(0,130).forEach(it => {
    const row = document.createElement('div');
    row.className = 'tree-row' + (it.nid && it.nid===ST.sel ? ' active' : '');
    row.dataset.nid = it.nid || '';
    row.style.paddingLeft = (6 + it.d*9) + 'px';
    const isFolder = it.lbl.endsWith('/');
    const color = isFolder ? 'var(--c-purple,#b180d7)' : 'var(--c-blue,#75beff)';
    const dot = document.createElement('span');
    dot.className = 'tree-dot' + (isFolder ? ' folder' : '');
    dot.style.background = color;
    row.appendChild(dot);
    row.appendChild(document.createTextNode(it.lbl));
    if (it.nid) {
      row.addEventListener('click', () => {
        const n = ST.simN.find(n => sid(n.id)===it.nid);
        if (n) { ST.sel=sid(n.id); switchTab('detail'); renderDetail(n); render(); }
      });
    }
    con.appendChild(row);
  });
}

/* ── Pan/Zoom ─────────────────────────────────────────────────── */
const cv = $('canvas');
cv.addEventListener('mousedown', ev => {
  if (ev.target.closest('g[style*=cursor]')) return;
  ST.pan = {sx:ev.clientX-ST.tx.x, sy:ev.clientY-ST.tx.y};
  cv.classList.add('panning');
});
window.addEventListener('mousemove', ev => {
  if (!ST.pan) return;
  ST.tx.x = ev.clientX - ST.pan.sx;
  ST.tx.y = ev.clientY - ST.pan.sy;
  render();
});
window.addEventListener('mouseup', () => { ST.pan=null; cv.classList.remove('panning'); });

cv.addEventListener('wheel', ev => {
  ev.preventDefault();
  const k = Math.max(.05, Math.min(8, ST.tx.k * (ev.deltaY > 0 ? .9 : 1.11)));
  const rect = cv.getBoundingClientRect();
  const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
  ST.tx.x = mx - (mx-ST.tx.x)*(k/ST.tx.k);
  ST.tx.y = my - (my-ST.tx.y)*(k/ST.tx.k);
  ST.tx.k = k;
  render();
}, { passive:false });

$('btn-zoom-in').addEventListener('click',  () => { ST.tx.k=Math.min(8,ST.tx.k*1.3); render(); });
$('btn-zoom-out').addEventListener('click', () => { ST.tx.k=Math.max(.05,ST.tx.k/1.3); render(); });
$('btn-zoom-fit').addEventListener('click', () => { autoFit(); render(); });

$('graph-svg').addEventListener('click', ev => {
  if (['svg','g'].includes(ev.target.tagName.toLowerCase())) {
    ST.sel = null;
    $('detail-empty').style.display='';
    $('detail-content').style.display='none';
    $('overlay-selection').style.display='none';
    $('btn-ai').textContent='💬 Ask AI';
    render(); buildTree();
  }
});

new ResizeObserver(() => { if (ST.simN.length) { autoFit(); render(); } }).observe(cv);

/* ── Tabs ─────────────────────────────────────────────────────── */
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(t => t.classList.toggle('on', t.dataset.tab===name));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('on', p.id==='pane-'+name));
}
document.querySelectorAll('.tab-btn').forEach(t => t.addEventListener('click', ()=>switchTab(t.dataset.tab)));

/* ── Mode ─────────────────────────────────────────────────────── */
function setMode(m) {
  ST.mode = m;
  document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  $('ov-mode-label').textContent = {select:'Graph',neighbour:'Neighbour mode',path:'Path trace',insight:'Insight mode'}[m]||m;
  render();
}
document.querySelectorAll('.mode-btn').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.m)));

/* ── Sidebar sections collapsing ─────────────────────────────── */
document.querySelectorAll('.side-header').forEach(h => h.addEventListener('click', ()=>{
  h.parentElement.classList.toggle('open');
}));

/* ── Filters ──────────────────────────────────────────────────── */
document.querySelectorAll('[data-e]').forEach(cb=>cb.addEventListener('change',()=>{
  ST.visE[cb.dataset.e]=cb.checked; rebuild(); buildInsights(); render();
}));
document.querySelectorAll('[data-k]').forEach(cb=>cb.addEventListener('change',()=>{
  ST.visK[cb.dataset.k]=cb.checked; rebuild(); relayout();
}));

let searchTimer;
$('search-input').addEventListener('input', ev=>{
  clearTimeout(searchTimer);
  searchTimer = setTimeout(()=>{ ST.search=ev.target.value; rebuild(); relayout(); }, 240);
});

/* ── Toolbar actions ──────────────────────────────────────────── */
$('btn-sidebar').addEventListener('click',()=>{
  ST.sidebarOpen=!ST.sidebarOpen;
  $('sidebar').classList.toggle('collapsed',!ST.sidebarOpen);
});
$('btn-sync').addEventListener('click', load);
$('btn-ai').addEventListener('click', ()=>vsc.postMessage({type:'openChat'}));
$('btn-open-chat').addEventListener('click',()=>vsc.postMessage({type:'openChat'}));
$('btn-index-repo').addEventListener('click',()=>vsc.postMessage({type:'indexRepo'}));
$('btn-open-neo4j').addEventListener('click',()=>vsc.postMessage({type:'openNeo4jBrowser'}));
$('btn-neo4j').addEventListener('click',()=>vsc.postMessage({type:'openNeo4jBrowser'}));

$('btn-embed').addEventListener('click', async()=>{
  const b=$('btn-embed'); b.textContent='⏳'; b.disabled=true;
  try{
    const r=await fetch(ST.serverUrl+'/graphrag/embedRepo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({repoId:ST.repoId,repoRoot:''})});
    const d=await r.json(); b.textContent=d.ok!==false?'✓ Done':'✗ Fail';
  }catch{ b.textContent='✗ Error'; }
  setTimeout(()=>{ b.textContent='↑ Embed'; b.disabled=false; },2500);
});

['in-server','in-repo'].forEach(id=>document.getElementById(id).addEventListener('change',()=>{
  vsc.postMessage({type:'settings/save',payload:{serverUrl:$('in-server').value.trim(),repoId:$('in-repo').value.trim()}});
}));

/* ── Extension messages ───────────────────────────────────────── */
function setBanner(type, html, btns) {
  const ban=$('banner');
  ban.className=type||''; ban.innerHTML='';
  if(!type){return;}
  const span=document.createElement('span'); span.innerHTML=html||''; ban.appendChild(span);
  (btns||[]).forEach(b=>{
    const el=document.createElement('button'); el.className='banner-btn'; el.textContent=b.label;
    el.addEventListener('click',b.action); ban.appendChild(el);
  });
}

window.addEventListener('message', ev=>{
  const msg=ev.data;
  if(msg.type==='settings/update'){
    const{serverUrl:su,repoId:ri,neo4jBrowserUrl:nb,nodeLimit:nl,autoRefresh:ar}=msg.payload||{};
    if(su) $('in-server').value=su;
    if(ri) $('in-repo').value=ri;
    if(nb) CFG.neo4jBrowserUrl=nb;
    if(nl) CFG.nodeLimit=nl;
    if(ar!==undefined){ CFG.autoRefresh=ar; startAutoRefresh(); }
    load();
  }
  if(msg.type==='server/status'){
    const s=msg.payload||{};
    if(s.status==='running'){
      setStatus('ok',s.url||'');
      setBanner(null);
      if(s.url && $('in-server').value!==s.url){ $('in-server').value=s.url; if(ST.repoId)load(); }
    } else if(s.status==='starting'){
      setStatus('go','');
      setBanner('warn','⏳ Backend starting…');
    } else if(s.status==='error'){
      setStatus('err','');
      setBanner('err','⚠ Backend error — '+(s.error||''), [
        { label:'Retry', action:()=>vsc.postMessage({type:'server/start'}) },
      ]);
    } else {
      setStatus('','');
      setBanner('info','Server stopped', [
        { label:'Start', action:()=>vsc.postMessage({type:'server/start'}) },
      ]);
    }
  }
});

/* ── Init ─────────────────────────────────────────────────────── */
load().catch(e => showLoader(null, '⚠ Init error: ' + e.message, [{label:'Retry',action:load}]));

})();
</script>
</body>
</html>`;
}
