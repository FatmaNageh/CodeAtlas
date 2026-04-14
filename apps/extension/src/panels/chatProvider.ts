import * as vscode from "vscode";
import { getNonce } from "./graphPanel";

export function getChatHtml(webview: vscode.Webview, serverUrl: string, repoId: string): string {
  const nonce = getNonce();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline';script-src 'nonce-${nonce}';connect-src http: https:;img-src ${webview.cspSource} data:;">
<title>CodeAtlas Chat</title>
<style>
/* ── Reset & Base ─────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --sp1: 4px; --sp2: 8px; --sp3: 12px; --sp4: 16px;
  --radius-sm: 3px; --radius: 6px; --radius-lg: 10px;
  --transition: 120ms ease;
  --font-mono: var(--vscode-editor-font-family, 'Cascadia Code', 'Consolas', monospace);
  --font-ui: var(--vscode-font-family, system-ui, -apple-system, sans-serif);

  --bg-base:    var(--vscode-sideBar-background, #1e1e1e);
  --bg-elevated: var(--vscode-editorWidget-background, #252526);
  --bg-input:   var(--vscode-input-background, #3c3c3c);
  --bg-hover:   var(--vscode-list-hoverBackground, rgba(255,255,255,.06));
  --bg-active:  var(--vscode-list-activeSelectionBackground, #094771);

  --border:     var(--vscode-panel-border, rgba(128,128,128,.25));
  --border-input: var(--vscode-input-border, rgba(128,128,128,.35));
  --border-focus: var(--vscode-focusBorder, #007acc);

  --fg:         var(--vscode-foreground, #cccccc);
  --fg-muted:   var(--vscode-descriptionForeground, #8c8c8c);
  --fg-input:   var(--vscode-input-foreground, #cccccc);
  --fg-placeholder: var(--vscode-input-placeholderForeground, #6c6c6c);

  --accent:     var(--vscode-button-background, #0e639c);
  --accent-fg:  var(--vscode-button-foreground, #ffffff);
  --accent-hover: var(--vscode-button-hoverBackground, #1177bb);

  --c-purple: var(--vscode-charts-purple, #b180d7);
  --c-blue:   var(--vscode-charts-blue, #75beff);
  --c-green:  var(--vscode-charts-green, #89d185);
  --c-yellow: var(--vscode-charts-yellow, #e9c46a);

  --c-err-bg: var(--vscode-inputValidation-errorBackground, rgba(244,71,71,.12));
  --c-err-border: var(--vscode-inputValidation-errorBorder, rgba(244,71,71,.45));
  --c-err-fg: var(--vscode-editorError-foreground, #f48771);
  --c-warn-bg: rgba(240,164,0,.1);
  --c-warn-border: rgba(240,164,0,.3);
  --c-warn-fg: #f0c27f;
}

body {
  background: var(--bg-base);
  color: var(--fg);
  font-family: var(--font-ui);
  font-size: 12px;
  line-height: 1.5;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── Scrollbars ───────────────────────────────────────────────── */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(128,128,128,.3); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: rgba(128,128,128,.5); }

/* ── Context Bar ──────────────────────────────────────────────── */
#ctx-bar {
  display: flex;
  align-items: center;
  gap: var(--sp2);
  padding: var(--sp2) var(--sp3);
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
  min-height: 36px;
  flex-shrink: 0;
}

#ctx-empty {
  font-size: 11px;
  color: var(--fg-muted);
  font-style: italic;
}

#ctx-node {
  display: none;
  align-items: center;
  gap: var(--sp2);
  flex: 1;
  min-width: 0;
}
#ctx-node.show { display: flex; }

.ctx-icon {
  width: 18px;
  height: 18px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-family: var(--font-mono);
  font-weight: 700;
  flex-shrink: 0;
  letter-spacing: 0;
}

.ctx-label {
  font-size: 11px;
  color: var(--fg);
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.ctx-clear {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--fg-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  font-size: 14px;
  line-height: 1;
  transition: color var(--transition), background var(--transition);
}
.ctx-clear:hover { color: var(--fg); background: var(--bg-hover); }

/* ── Messages ─────────────────────────────────────────────────── */
#msgs {
  flex: 1;
  overflow-y: auto;
  padding: var(--sp3) var(--sp3) var(--sp2);
  display: flex;
  flex-direction: column;
  gap: var(--sp2);
}

/* Empty state */
#empty {
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

.empty-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(128,128,128,.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  margin-bottom: var(--sp1);
}

.empty-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--fg);
}

.empty-sub {
  font-size: 11px;
  color: var(--fg-muted);
  line-height: 1.6;
  max-width: 180px;
}

/* Message bubbles */
.msg {
  display: flex;
  flex-direction: column;
  max-width: 100%;
  animation: msgIn 120ms ease;
}

@keyframes msgIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.msg-bubble {
  border-radius: var(--radius);
  padding: var(--sp2) var(--sp3);
  font-size: 11px;
  line-height: 1.65;
  word-break: break-word;
}

.msg.user { align-self: flex-end; align-items: flex-end; max-width: 90%; }
.msg.user .msg-bubble {
  background: var(--accent);
  color: var(--accent-fg);
  border-radius: var(--radius) var(--radius) var(--radius-sm) var(--radius);
  white-space: pre-wrap;
}

.msg.bot { align-self: flex-start; align-items: flex-start; max-width: 100%; }
.msg.bot .msg-bubble {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm) var(--radius) var(--radius) var(--radius);
}

.msg.err .msg-bubble {
  background: var(--c-err-bg);
  border: 1px solid var(--c-err-border);
  color: var(--c-err-fg);
  border-radius: var(--radius);
}

.msg.sys {
  align-self: center;
}
.msg.sys .msg-bubble {
  background: transparent;
  color: var(--fg-muted);
  font-size: 10px;
  padding: 2px var(--sp2);
  border: 1px solid var(--border);
  border-radius: 20px;
}

/* Markdown inside bot bubbles */
.msg-bubble p { margin-bottom: 6px; }
.msg-bubble p:last-child { margin-bottom: 0; }
.msg-bubble code {
  font-family: var(--font-mono);
  font-size: 10px;
  background: rgba(128,128,128,.18);
  padding: 1px 5px;
  border-radius: 3px;
}
.msg-bubble pre {
  background: rgba(0,0,0,.25);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--sp2);
  margin: var(--sp2) 0;
  overflow-x: auto;
}
.msg-bubble pre code { background: none; padding: 0; font-size: 10px; }
.msg-bubble strong { font-weight: 600; color: var(--fg); }
.msg-bubble ul, .msg-bubble ol { padding-left: 16px; margin: 4px 0; }
.msg-bubble li { margin-bottom: 2px; }
.msg-bubble a { color: var(--c-blue); text-decoration: none; }
.msg-bubble a:hover { text-decoration: underline; }
.msg-bubble h3 { font-size: 11px; font-weight: 600; margin-bottom: 4px; margin-top: 8px; }

/* Context files footer */
.ctx-files {
  margin-top: var(--sp2);
  padding-top: var(--sp2);
  border-top: 1px solid var(--border);
}
.cf-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--fg-muted);
  margin-bottom: 3px;
}
.cf-item {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--fg-muted);
  line-height: 1.6;
  display: flex;
  align-items: center;
  gap: 4px;
}
.cf-item::before {
  content: '';
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--c-blue);
  flex-shrink: 0;
}

/* Typing indicator */
.typing-wrap {
  display: flex;
  align-items: center;
  gap: var(--sp2);
  padding: var(--sp2) var(--sp3);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm) var(--radius) var(--radius) var(--radius);
  width: fit-content;
}
.typing-dots {
  display: flex;
  gap: 3px;
  align-items: center;
}
.typing-dots span {
  width: 5px;
  height: 5px;
  background: var(--accent);
  border-radius: 50%;
  animation: typingBounce 1.2s ease-in-out infinite;
  opacity: .5;
}
.typing-dots span:nth-child(2) { animation-delay: .15s; }
.typing-dots span:nth-child(3) { animation-delay: .3s; }
@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: .4; }
  30% { transform: translateY(-4px); opacity: 1; }
}
.typing-label { font-size: 10px; color: var(--fg-muted); }

/* ── Embed Notice ─────────────────────────────────────────────── */
#embed-notice {
  display: none;
  margin: 0 var(--sp3) var(--sp2);
  background: var(--c-warn-bg);
  border: 1px solid var(--c-warn-border);
  border-radius: var(--radius);
  padding: var(--sp2) var(--sp3);
  font-size: 10px;
  color: var(--c-warn-fg);
  line-height: 1.6;
}
#embed-notice strong { font-weight: 600; display: block; margin-bottom: 2px; }
.embed-btn {
  margin-top: var(--sp2);
  padding: 4px var(--sp3);
  background: var(--accent);
  color: var(--accent-fg);
  border: none;
  border-radius: var(--radius-sm);
  font-size: 10px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: background var(--transition);
}
.embed-btn:hover { background: var(--accent-hover); }

/* ── Quick Prompts ────────────────────────────────────────────── */
#quick {
  padding: var(--sp1) var(--sp3) var(--sp2);
  display: flex;
  gap: var(--sp1);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.qb {
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 3px var(--sp2);
  font-size: 10px;
  color: var(--fg-muted);
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition);
  font-family: var(--font-ui);
}
.qb:hover {
  background: var(--bg-hover);
  color: var(--fg);
  border-color: rgba(128,128,128,.5);
}

/* ── Input Area ───────────────────────────────────────────────── */
#input-area {
  padding: var(--sp2) var(--sp3) var(--sp3);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  position: relative;
  background: var(--bg-base);
}

.input-box {
  display: flex;
  align-items: flex-end;
  gap: var(--sp2);
  background: var(--bg-input);
  border: 1px solid var(--border-input);
  border-radius: var(--radius);
  padding: var(--sp2);
  transition: border-color var(--transition);
}
.input-box:focus-within {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 1px var(--border-focus);
}

#chat-ta {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--fg-input);
  font-size: 12px;
  font-family: var(--font-ui);
  line-height: 1.5;
  resize: none;
  height: 48px;
  max-height: 120px;
  overflow-y: auto;
  padding: 2px 0;
}
#chat-ta::placeholder { color: var(--fg-placeholder); }

#btn-send {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--accent);
  color: var(--accent-fg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background var(--transition), opacity var(--transition);
  font-size: 13px;
}
#btn-send:hover:not(:disabled) { background: var(--accent-hover); }
#btn-send:disabled { opacity: .35; cursor: default; }

/* Mention dropdown */
#mention-dd {
  display: none;
  position: absolute;
  bottom: calc(100% + 4px);
  left: var(--sp3);
  right: var(--sp3);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 -4px 16px rgba(0,0,0,.3);
  max-height: 160px;
  overflow-y: auto;
  z-index: 10;
}
#mention-dd.show { display: block; }

.mention-item {
  display: flex;
  align-items: center;
  gap: var(--sp2);
  padding: 6px var(--sp3);
  font-size: 11px;
  cursor: pointer;
  transition: background var(--transition);
}
.mention-item:hover, .mention-item.sel { background: var(--bg-active); }
.mention-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.mention-name {
  font-family: var(--font-mono);
  color: var(--fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.mention-path {
  font-size: 9px;
  color: var(--fg-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 70px;
}

/* ── Config / Bottom Bar ──────────────────────────────────────── */
#bottom-bar {
  display: flex;
  align-items: center;
  gap: var(--sp1);
  padding: var(--sp1) var(--sp3) 0;
  margin-top: var(--sp1);
}

.cfg-field {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}
.cfg-label {
  font-size: 9px;
  color: var(--fg-muted);
  white-space: nowrap;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.cfg-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(128,128,128,.2);
  color: var(--fg-muted);
  font-size: 10px;
  font-family: var(--font-mono);
  outline: none;
  padding: 1px 2px;
  transition: border-color var(--transition), color var(--transition);
}
.cfg-input:focus {
  border-bottom-color: var(--border-focus);
  color: var(--fg);
}

.bar-sep { width: 1px; height: 12px; background: var(--border); flex-shrink: 0; margin: 0 2px; }

.bar-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--fg-muted);
  cursor: pointer;
  font-size: 12px;
  transition: background var(--transition), color var(--transition);
  flex-shrink: 0;
}
.bar-btn:hover { background: var(--bg-hover); color: var(--fg); }
</style>
</head>
<body>

<!-- Context Bar -->
<div id="ctx-bar">
  <div id="ctx-node">
    <div class="ctx-icon" id="ctx-icon"></div>
    <span class="ctx-label" id="ctx-label"></span>
    <button class="ctx-clear" id="ctx-clear" title="Clear context">×</button>
  </div>
  <span id="ctx-empty">Click a graph node to add context</span>
</div>

<!-- Messages -->
<div id="msgs">
  <div id="empty">
    <div class="empty-icon">💬</div>
    <div class="empty-title">AI Codebase Chat</div>
    <div class="empty-sub">Ask anything about your code. Select a node in the graph to add context.</div>
  </div>
</div>

<!-- Embed Notice -->
<div id="embed-notice">
  <strong>⚠ Embeddings required</strong>
  The AI needs code embeddings to answer questions accurately.
  <button class="embed-btn" id="btn-embed-fix">↑ Generate Embeddings</button>
</div>

<!-- Quick Prompts -->
<div id="quick">
  <button class="qb" data-p="What does this node do?">What does this do?</button>
  <button class="qb" data-p="Why is this highly connected?">Why connected?</button>
  <button class="qb" data-p="Suggest a refactor for this.">Suggest refactor</button>
  <button class="qb" data-p="What are the main entry points?">Entry points</button>
  <button class="qb" data-p="Show the key dependencies.">Dependencies</button>
</div>

<!-- Input -->
<div id="input-area">
  <div id="mention-dd"></div>
  <div class="input-box">
    <textarea id="chat-ta" placeholder="Ask about your code… (@mention a node)"></textarea>
    <button id="btn-send" title="Send (Enter)">↑</button>
  </div>
  <div id="bottom-bar">
    <div class="cfg-field">
      <span class="cfg-label">SRV</span>
      <input class="cfg-input" id="cfg-s" value="${serverUrl}" placeholder="http://localhost:3000">
    </div>
    <div class="bar-sep"></div>
    <div class="cfg-field">
      <span class="cfg-label">REPO</span>
      <input class="cfg-input" id="cfg-r" value="${repoId}" placeholder="repo-id">
    </div>
    <div class="bar-sep"></div>
    <button class="bar-btn" id="btn-graph" title="Open Graph">⬡</button>
    <button class="bar-btn" id="btn-index" title="Index Repository">⊕</button>
    <button class="bar-btn" id="btn-clear" title="Clear History">⊘</button>
  </div>
</div>

<script nonce="${nonce}">
(function () {
'use strict';
const vsc = acquireVsCodeApi();
const $ = id => document.getElementById(id);

/* ── Kind colours ─────────────────────────────────────────────── */
const KC = {
  folder: { bg: 'rgba(177,128,215,.18)', fg: '#b180d7', label: 'DIR' },
  file:   { bg: 'rgba(117,190,255,.18)', fg: '#75beff', label: 'FILE' },
  class:  { bg: 'rgba(233,196,106,.18)', fg: '#e9c46a', label: 'CLS' },
  fn:     { bg: 'rgba(137,209,133,.18)', fg: '#89d185', label: 'FN' },
};
function kc(k) { return KC[k] || KC.file; }

/* ── State ────────────────────────────────────────────────────── */
const ST = {
  msgs: [],
  ctxNode: null,
  loading: false,
  gNodes: [],
  mentionSearch: null,
  mentionIdx: 0,
  get serverUrl() { return $('cfg-s').value.trim(); },
  get repoId()    { return $('cfg-r').value.trim(); },
};

/* ── Markdown renderer ────────────────────────────────────────── */
function renderMd(raw) {
  let s = escHtml(raw);
  // fenced code blocks — use RegExp to avoid template-literal backtick conflicts
  s = s.replace(new RegExp('\`\`\`[\\w]*\\n([\\s\\S]*?)\`\`\`','g'), (_, c) => '<pre><code>' + c.trim() + '</code></pre>');
  // inline code
  s = s.replace(new RegExp('\`([^\`]+)\`','g'), '<code>$1</code>');
  // bold
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  // headings (h3 max)
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  // unordered list items
  s = s.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  s = s.replace(/(<li>.*?<\/li>(\n)?)+/gs, m => '<ul>' + m + '</ul>');
  // links
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  // paragraphs
  const blocks = s.split(/\n\n+/);
  return blocks.map(b => {
    if (/^<(pre|ul|ol|h[1-6])/.test(b.trim())) return b;
    return '<p>' + b.replace(/\n/g, '<br>') + '</p>';
  }).join('');
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ── Context Node ─────────────────────────────────────────────── */
function setCtx(node) {
  ST.ctxNode = node;
  const el = $('ctx-node'), em = $('ctx-empty');
  if (node) {
    el.classList.add('show'); em.style.display = 'none';
    const c = kc(node._k || 'file');
    const icon = $('ctx-icon');
    icon.style.background = c.bg;
    icon.style.color = c.fg;
    icon.textContent = c.label;
    $('ctx-label').textContent = node._lbl || node.id || '';
  } else {
    el.classList.remove('show'); em.style.display = '';
  }
}
$('ctx-clear').addEventListener('click', () => setCtx(null));

/* ── Render Messages ──────────────────────────────────────────── */
function renderMsgs() {
  const el = $('msgs');
  const empty = $('empty');

  if (!ST.msgs.length && !ST.loading) {
    empty.style.display = '';
    el.querySelectorAll('.msg, .msg-typing').forEach(n => n.remove());
    return;
  }
  empty.style.display = 'none';
  el.querySelectorAll('.msg, .msg-typing').forEach(n => n.remove());

  for (const m of ST.msgs) {
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + (m.role === 'user' ? 'user' : m.role === 'sys' ? 'sys' : m.error ? 'err' : 'bot');

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    if (m.role === 'bot' && !m.error) {
      bubble.innerHTML = renderMd(m.text);
      if (m.files && m.files.length) {
        const cf = document.createElement('div');
        cf.className = 'ctx-files';
        cf.innerHTML = '<div class="cf-label">Sources</div>' +
          m.files.map(f => '<div class="cf-item">' + escHtml(f) + '</div>').join('');
        bubble.appendChild(cf);
      }
    } else {
      bubble.textContent = m.text;
    }

    wrap.appendChild(bubble);
    el.appendChild(wrap);
  }

  if (ST.loading) {
    const t = document.createElement('div');
    t.className = 'msg bot msg-typing';
    t.innerHTML = '<div class="typing-wrap"><div class="typing-dots"><span></span><span></span><span></span></div><span class="typing-label">Thinking…</span></div>';
    el.appendChild(t);
  }
  el.scrollTop = el.scrollHeight;
}

function addMsg(m) { ST.msgs.push({ id: Date.now() + Math.random(), ...m }); renderMsgs(); }

/* ── Send ─────────────────────────────────────────────────────── */
async function send(rawText) {
  rawText = (rawText || $('chat-ta').value).trim();
  if (!rawText || ST.loading) return;

  if (!ST.repoId) {
    addMsg({ role: 'err', text: '⚠ Set a Repo ID below — or run "Index a Repository" first.', error: true });
    return;
  }

  $('chat-ta').value = '';
  hideMention();
  $('embed-notice').style.display = 'none';

  const { clean, mentioned } = parseMentions(rawText);
  addMsg({ role: 'user', text: rawText });
  ST.loading = true;
  $('btn-send').disabled = true;
  renderMsgs();

  const body = {
    repoId: ST.repoId,
    question: clean,
    ...(ST.ctxNode ? { contextNodeId: ST.ctxNode.id, contextNodeLabel: ST.ctxNode._lbl } : {}),
    ...(mentioned.length ? { mentionedNodes: mentioned } : {}),
  };

  try {
    const res = await fetch(ST.serverUrl + '/graphrag/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      const errMsg = data.error || 'HTTP ' + res.status;
      if (/chunk|embed|summar/i.test(errMsg)) $('embed-notice').style.display = '';
      throw new Error(errMsg);
    }
    const files = [...new Set((data.sources || []).map(s => s.file).filter(Boolean))];
    addMsg({ role: 'bot', text: data.answer || 'No answer returned.', files });
  } catch (err) {
    const msg = err.message || String(err);
    const friendly = /fetch|refused|network/i.test(msg)
      ? '**Cannot reach the backend server.**\nMake sure it is running and the Server URL is correct.'
      : msg;
    addMsg({ role: 'bot', text: friendly, error: true });
  } finally {
    ST.loading = false;
    $('btn-send').disabled = false;
    renderMsgs();
  }
}

/* ── Mentions ─────────────────────────────────────────────────── */
function parseMentions(text) {
  const mentioned = [];
  const clean = text.replace(/@(\w+)/g, (match, name) => {
    const found = ST.gNodes.find(n =>
      (n._lbl || '').replace(/\s+/g, '_') === name || (n._path || '').includes(name));
    if (found) { mentioned.push({ id: found.id, name: found._lbl, path: found._path || '' }); return '[Node: ' + found._lbl + ']'; }
    return match;
  });
  return { clean, mentioned };
}

function getMatches(q) {
  const lo = (q || '').toLowerCase();
  return ST.gNodes.filter(n =>
    (n._lbl || '').toLowerCase().includes(lo) || (n._path || '').toLowerCase().includes(lo)
  ).slice(0, 8);
}

function showMention(matches) {
  if (!matches.length) { hideMention(); return; }
  const dd = $('mention-dd');
  dd.innerHTML = matches.map((n, i) => {
    const c = kc(n._k || 'file');
    return '<div class="mention-item' + (i === ST.mentionIdx ? ' sel' : '') + '" data-i="' + i + '">' +
      '<span class="mention-dot" style="background:' + c.fg + '"></span>' +
      '<span class="mention-name">' + escHtml(n._lbl || n.id || '') + '</span>' +
      '<span class="mention-path">' + escHtml(n._path || '') + '</span>' +
      '</div>';
  }).join('');
  dd.classList.add('show');
  dd.querySelectorAll('.mention-item').forEach(m =>
    m.addEventListener('click', () => insertMention(matches[parseInt(m.dataset.i)]))
  );
}

function hideMention() { ST.mentionSearch = null; ST.mentionIdx = 0; $('mention-dd').classList.remove('show'); }

function insertMention(n) {
  const ta = $('chat-ta'), val = ta.value, at = val.lastIndexOf('@');
  if (at === -1) return;
  ta.value = val.slice(0, at) + '@' + (n._lbl || n.id || '').replace(/\s+/g, '_') + ' ';
  hideMention(); ta.focus();
}

$('chat-ta').addEventListener('input', ev => {
  const val = ev.target.value;
  const before = val.slice(0, ev.target.selectionStart || val.length);
  const m = before.match(/@(\w*)$/);
  if (m) { ST.mentionSearch = m[1]; showMention(getMatches(m[1])); }
  else hideMention();
});

$('chat-ta').addEventListener('keydown', ev => {
  if ($('mention-dd').classList.contains('show')) {
    const matches = getMatches(ST.mentionSearch || '');
    if (ev.key === 'ArrowDown') { ev.preventDefault(); ST.mentionIdx = Math.min(ST.mentionIdx + 1, matches.length - 1); showMention(matches); return; }
    if (ev.key === 'ArrowUp')   { ev.preventDefault(); ST.mentionIdx = Math.max(ST.mentionIdx - 1, 0); showMention(matches); return; }
    if (ev.key === 'Enter' || ev.key === 'Tab') { ev.preventDefault(); insertMention(matches[ST.mentionIdx]); return; }
    if (ev.key === 'Escape') { hideMention(); return; }
  }
  if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); send(); }
});
$('btn-send').addEventListener('click', () => send());
document.querySelectorAll('.qb').forEach(b => b.addEventListener('click', () => {
  $('chat-ta').value = b.dataset.p || ''; $('chat-ta').focus();
}));

$('btn-embed-fix').addEventListener('click', async () => {
  const btn = $('btn-embed-fix'); btn.textContent = '⏳ Embedding…'; btn.disabled = true;
  addMsg({ role: 'bot', text: 'Generating embeddings — this may take a few minutes…' });
  try {
    const res = await fetch(ST.serverUrl + '/graphrag/embedRepo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoId: ST.repoId, Repo: '' }),
    });
    const d = await res.json();
    if (d.ok !== false) { $('embed-notice').style.display = 'none'; addMsg({ role: 'bot', text: '✓ Embeddings generated! Try your question again.' }); }
    else addMsg({ role: 'bot', text: 'Embedding failed: ' + d.error, error: true });
  } catch (e) { addMsg({ role: 'bot', text: 'Embedding error: ' + e.message, error: true }); }
  btn.textContent = '↑ Generate Embeddings'; btn.disabled = false;
});

$('btn-graph').addEventListener('click', () => vsc.postMessage({ type: 'openGraph' }));
$('btn-index').addEventListener('click', () => vsc.postMessage({ type: 'indexRepo' }));
$('btn-clear').addEventListener('click', () => { ST.msgs = []; renderMsgs(); });

['cfg-s', 'cfg-r'].forEach(id =>
  document.getElementById(id).addEventListener('change', () =>
    vsc.postMessage({ type: 'settings/save', payload: { serverUrl: $('cfg-s').value, repoId: $('cfg-r').value } })
  )
);

/* ── Extension messages ───────────────────────────────────────── */
window.addEventListener('message', ev => {
  const msg = ev.data;
  if (msg.type === 'contextNode') {
    setCtx(msg.payload?.node);
    if (msg.payload?.allNodes) {
      ST.gNodes = msg.payload.allNodes.map(n => ({
        ...n, _path: n.properties?.relPath || n.properties?.filePath || n.properties?.path || ''
      }));
    }
  }
  if (msg.type === 'graphNodes') {
    ST.gNodes = (msg.payload?.nodes || []).map(n => ({
      ...n, _path: n.properties?.relPath || n.properties?.filePath || n.properties?.path || ''
    }));
  }
  if (msg.type === 'settings/update') {
    const { serverUrl, repoId } = msg.payload || {};
    if (serverUrl) $('cfg-s').value = serverUrl;
    if (repoId)    $('cfg-r').value = repoId;
  }
  if (msg.type === 'server/status') {
    const s = msg.payload || {};
    if (s.status === 'error')   addMsg({ role: 'sys', text: '⚠ Backend error: ' + (s.error || 'unknown') });
    if (s.status === 'stopped') addMsg({ role: 'sys', text: 'Server stopped' });
  }
  if (msg.type === 'clearHistory') { ST.msgs = []; renderMsgs(); }
});

})();
</script>
</body>
</html>`;
}
