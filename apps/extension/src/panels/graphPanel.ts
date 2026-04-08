import * as vscode from "vscode";
export function getNonce(): string {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({length:32},()=>c[Math.floor(Math.random()*c.length)]).join("");
}
export function getGraphHtml(webview: vscode.Webview, serverUrl: string, repoId: string): string {
  const nonce = getNonce();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline';script-src 'nonce-${nonce}';connect-src http: https:;img-src ${webview.cspSource} data:;">
<title>CodeAtlas</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:var(--vscode-editor-background);color:var(--vscode-foreground);font-family:var(--vscode-font-family,system-ui,sans-serif);font-size:13px;height:100vh;overflow:hidden}
#root{display:flex;flex-direction:column;height:100vh}

/* toolbar */
#tb{display:flex;align-items:center;gap:5px;padding:0 8px;height:38px;border-bottom:1px solid var(--vscode-panel-border,rgba(128,128,128,.3));background:var(--vscode-titleBar-activeBackground,var(--vscode-editor-background));flex-shrink:0;overflow-x:auto}
#tb::-webkit-scrollbar{height:0}
.ti{background:var(--vscode-input-background);border:1px solid var(--vscode-input-border,rgba(128,128,128,.3));border-radius:3px;color:var(--vscode-input-foreground,var(--vscode-foreground));padding:3px 7px;font-size:11px;outline:none}
.ti:focus{border-color:var(--vscode-focusBorder)}
.btn{padding:3px 9px;border-radius:3px;border:1px solid rgba(128,128,128,.3);background:rgba(128,128,128,.1);color:var(--vscode-foreground);font-size:11px;cursor:pointer;white-space:nowrap;transition:background .1s;flex-shrink:0}
.btn:hover{background:rgba(128,128,128,.2)}
.btn.hi{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:transparent}
.btn.hi:hover{background:var(--vscode-button-hoverBackground,var(--vscode-button-background))}
.sep{width:1px;height:16px;background:rgba(128,128,128,.3);flex-shrink:0;margin:0 1px}
.tl{font-size:10px;color:var(--vscode-descriptionForeground);white-space:nowrap;flex-shrink:0}
.sp{flex:1;min-width:2px}
#sd{width:7px;height:7px;border-radius:50%;background:rgba(128,128,128,.4);flex-shrink:0;transition:background .3s}
#sd.ok{background:#4ec9b0}
#sd.err{background:#f48771}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
#sd.go{animation:blink .8s infinite}

/* banner */
#ban{display:none;font-size:11px;padding:4px 10px;text-align:center;border-bottom:1px solid var(--vscode-panel-border,rgba(128,128,128,.3))}
#ban button{background:none;border:none;cursor:pointer;font-size:11px;text-decoration:underline;color:inherit}

/* body */
#bd{display:flex;flex:1;overflow:hidden}

/* left sidebar */
#ls{width:196px;flex-shrink:0;border-right:1px solid var(--vscode-panel-border,rgba(128,128,128,.3));display:flex;flex-direction:column;overflow:hidden;transition:width .15s;background:var(--vscode-sideBar-background,var(--vscode-editor-background))}
#ls.off{width:0}
.sc{padding:7px 8px;border-bottom:1px solid rgba(128,128,128,.15)}
.sh{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--vscode-descriptionForeground);margin-bottom:5px;opacity:.7}
#sb{width:100%;background:var(--vscode-input-background);border:1px solid rgba(128,128,128,.3);border-radius:3px;color:var(--vscode-foreground);padding:4px 7px;font-size:11px;outline:none}
#sb:focus{border-color:var(--vscode-focusBorder)}
.mg{display:grid;grid-template-columns:1fr 1fr;gap:3px}
.mb{border:1px solid rgba(128,128,128,.25);border-radius:3px;padding:4px 3px;text-align:center;background:transparent;color:var(--vscode-descriptionForeground);font-size:9px;cursor:pointer;line-height:1.3;transition:all .1s}
.mb.on{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:transparent}
.mb:hover:not(.on){background:var(--vscode-list-hoverBackground)}
.ms{font-size:8px;opacity:.6;margin-top:1px}
.ck{display:flex;align-items:center;gap:5px;padding:2px 0;font-size:11px;cursor:pointer}
.ck input{cursor:pointer;accent-color:var(--vscode-button-background)}
.dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.sq{border-radius:2px}
#tr{flex:1;overflow-y:auto;padding:2px 0}
#tr::-webkit-scrollbar{width:3px}
#tr::-webkit-scrollbar-thumb{background:rgba(128,128,128,.25);border-radius:2px}
.tr-row{display:flex;align-items:center;gap:4px;padding:2px 6px;font-size:10px;font-family:var(--vscode-editor-font-family,monospace);color:var(--vscode-descriptionForeground);cursor:pointer;border-radius:2px;margin:0 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tr-row:hover{background:var(--vscode-list-hoverBackground);color:var(--vscode-foreground)}
.tr-row.on{background:var(--vscode-list-activeSelectionBackground);color:var(--vscode-list-activeSelectionForeground,var(--vscode-foreground))}

/* canvas */
#cv{flex:1;position:relative;overflow:hidden;cursor:grab}
#cv.pn{cursor:grabbing}
#gs{width:100%;height:100%;display:block;user-select:none}

/* overlays */
.ov{position:absolute;border:1px solid rgba(128,128,128,.25);background:var(--vscode-editorWidget-background,rgba(30,30,30,.92));border-radius:4px;padding:6px 8px;font-size:10px;color:var(--vscode-descriptionForeground);backdrop-filter:blur(6px)}
#oi{top:8px;left:8px}
#os{bottom:8px;right:8px}
#ol{bottom:8px;left:8px}
.oh{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;opacity:.6;margin-bottom:3px}
.or{display:flex;justify-content:space-between;gap:12px;padding:1px 0;font-size:10px}
.ov2{font-family:monospace;color:var(--vscode-foreground)}
.lr{display:flex;align-items:center;gap:5px;padding:1px 0;font-size:10px}

/* zoom */
#zc{position:absolute;right:8px;top:8px;border:1px solid rgba(128,128,128,.25);border-radius:4px;overflow:hidden;background:var(--vscode-editorWidget-background,rgba(30,30,30,.9))}
#zc button{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border:none;background:none;color:var(--vscode-foreground);cursor:pointer;font-size:14px;transition:background .1s}
#zc button:hover{background:var(--vscode-list-hoverBackground)}
#zc button:not(:last-child){border-bottom:1px solid rgba(128,128,128,.2)}

/* loading */
#ld{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--vscode-descriptionForeground);z-index:30}
#ld.off{display:none}
.spin{width:20px;height:20px;border:2px solid rgba(128,128,128,.2);border-top-color:var(--vscode-button-background,#007acc);border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
#ldm{font-size:11px;max-width:220px;text-align:center;line-height:1.5}

/* tooltip */
#tip{position:fixed;pointer-events:none;display:none;background:var(--vscode-editorHoverWidget-background,#252526);border:1px solid var(--vscode-editorHoverWidget-border,rgba(128,128,128,.3));border-radius:4px;padding:6px 9px;font-size:11px;max-width:220px;z-index:100;line-height:1.5}
#tip.on{display:block}
#tip-name{font-weight:600;color:var(--vscode-foreground);margin-bottom:2px;word-break:break-all}
#tip-kind{font-size:9px;font-family:monospace;opacity:.7}
#tip-deg{font-size:9px;opacity:.6;margin-top:2px}

/* right panel */
#rp{width:256px;flex-shrink:0;border-left:1px solid var(--vscode-panel-border,rgba(128,128,128,.3));background:var(--vscode-sideBar-background,var(--vscode-editor-background));display:flex;flex-direction:column;overflow:hidden}
.tabs{display:flex;border-bottom:1px solid rgba(128,128,128,.25);flex-shrink:0}
.tab{flex:1;padding:7px 4px;text-align:center;font-size:11px;color:var(--vscode-tab-inactiveForeground,rgba(128,128,128,.7));cursor:pointer;border-bottom:2px solid transparent;transition:all .1s;white-space:nowrap}
.tab.on{color:var(--vscode-foreground);border-bottom-color:var(--vscode-button-background,#007acc)}
.tab:hover:not(.on){background:var(--vscode-list-hoverBackground);color:var(--vscode-foreground)}
.tb{display:none;flex:1;overflow-y:auto;flex-direction:column}
.tb.on{display:flex}
.tb::-webkit-scrollbar{width:3px}
.tb::-webkit-scrollbar-thumb{background:rgba(128,128,128,.25);border-radius:2px}
.pd{padding:10px}

/* detail */
.nc{border-left:3px solid var(--nc,#75beff);background:rgba(128,128,128,.06);border-radius:0 4px 4px 0;padding:9px;margin-bottom:10px}
.nbg{display:inline-block;border-radius:2px;padding:1px 5px;font-family:monospace;font-size:9px;margin-bottom:4px}
.nm{font-size:12px;font-weight:600;font-family:var(--vscode-editor-font-family,monospace);color:var(--vscode-foreground);word-break:break-all;line-height:1.4}
.np{font-size:9px;font-family:monospace;color:var(--vscode-descriptionForeground);margin-top:2px;word-break:break-all}
.dh{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--vscode-descriptionForeground);margin-bottom:4px;opacity:.65}
.dr{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(128,128,128,.1);font-size:11px}
.dr:last-child{border-bottom:none}
.dk{color:var(--vscode-descriptionForeground)}
.dv{font-family:monospace;color:var(--vscode-foreground);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}
.rb{display:flex;align-items:center;gap:5px;width:100%;padding:4px 6px;border-radius:3px;background:rgba(128,128,128,.06);border:none;color:var(--vscode-foreground);font-size:10px;cursor:pointer;text-align:left;transition:background .1s;margin-bottom:3px}
.rb:hover{background:var(--vscode-list-hoverBackground)}
.rt{border:1px solid rgba(128,128,128,.3);border-radius:2px;padding:0 4px;font-family:monospace;font-size:8px;flex-shrink:0}
.rn{font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.ab{display:flex;align-items:center;gap:5px;width:100%;padding:5px 7px;border-radius:3px;border:1px solid rgba(128,128,128,.25);background:none;color:var(--vscode-foreground);font-size:11px;cursor:pointer;margin-bottom:5px;transition:background .1s}
.ab:hover{background:var(--vscode-list-hoverBackground)}
.sumbox{background:rgba(128,128,128,.07);border-radius:3px;padding:7px;font-size:10px;line-height:1.6;color:var(--vscode-foreground);min-height:40px;white-space:pre-wrap;word-break:break-word}
.sbtn{padding:2px 8px;border-radius:2px;border:none;background:var(--vscode-button-background);color:var(--vscode-button-foreground);font-size:9px;cursor:pointer}
.sbtn:disabled{opacity:.4}
pre.pp{background:rgba(128,128,128,.06);border-radius:3px;padding:6px;font-size:9px;font-family:monospace;overflow-x:auto;max-height:130px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;line-height:1.5}
.emp{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:var(--vscode-descriptionForeground);text-align:center;padding:16px;opacity:.6}
.ei{font-size:28px;margin-bottom:2px}

/* insights */
.hc{background:rgba(128,128,128,.06);border-radius:3px;padding:6px;margin-bottom:4px;cursor:pointer;transition:background .1s}
.hc:hover{background:var(--vscode-list-hoverBackground)}
.hh{display:flex;align-items:center;justify-content:space-between;margin-bottom:2px}
.hn{font-family:monospace;font-size:10px;color:var(--vscode-foreground);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.db{background:rgba(128,128,128,.15);border-radius:10px;padding:1px 6px;font-size:8px;flex-shrink:0;margin-left:4px}
.bg{height:3px;background:rgba(128,128,128,.15);border-radius:2px;margin-top:2px}
.bf{height:100%;background:var(--vscode-button-background,#007acc);border-radius:2px}
</style>
</head>
<body>
<div id="root">
<div id="tb">
  <button class="btn" id="b-tog">☰</button>
  <div class="sep"></div>
  <span id="sd"></span><span class="tl">Server</span>
  <input class="ti" id="i-sv" value="${serverUrl}" style="width:175px" placeholder="http://localhost:3000">
  <span class="tl">Repo</span>
  <input class="ti" id="i-rp" value="${repoId}" style="width:115px" placeholder="Repo ID">
  <button class="btn" id="b-sync">⟳ Sync</button>
  <div class="sep"></div>
  <button class="btn" id="b-emb">↑ Embed</button>
  <div class="sp"></div>
  <button class="btn hi" id="b-ai">Ask AI →</button>
</div>
<div id="ban"></div>
<div id="bd">

<div id="ls">
  <div class="sc"><input id="sb" placeholder="Search nodes…"></div>
  <div class="sc">
    <div class="sh">Mode</div>
    <div class="mg">
      <div class="mb on" data-m="select">Select<div class="ms">inspect</div></div>
      <div class="mb" data-m="neighbour">Neighbours<div class="ms">links</div></div>
      <div class="mb" data-m="path">Path<div class="ms">shortest</div></div>
      <div class="mb" data-m="insight">Insights<div class="ms">hotspots</div></div>
    </div>
  </div>
  <div class="sc">
    <div class="sh">Edges</div>
    <label class="ck"><input type="checkbox" checked data-e="CONTAINS"><span class="dot sq" style="background:var(--vscode-charts-purple,#b180d7)"></span>CONTAINS</label>
    <label class="ck"><input type="checkbox" checked data-e="IMPORTS"><span class="dot sq" style="background:var(--vscode-charts-blue,#75beff)"></span>IMPORTS</label>
    <label class="ck"><input type="checkbox" checked data-e="CALLS"><span class="dot sq" style="background:var(--vscode-charts-green,#89d185)"></span>CALLS</label>
  </div>
  <div class="sc">
    <div class="sh">Node types</div>
    <label class="ck"><input type="checkbox" checked data-k="folder"><span class="dot" style="background:var(--vscode-charts-purple,#b180d7)"></span>Folder</label>
    <label class="ck"><input type="checkbox" checked data-k="file"><span class="dot" style="background:var(--vscode-charts-blue,#75beff)"></span>File</label>
    <label class="ck"><input type="checkbox" checked data-k="class"><span class="dot" style="background:var(--vscode-charts-yellow,#e9c46a)"></span>Class</label>
    <label class="ck"><input type="checkbox" checked data-k="fn"><span class="dot" style="background:var(--vscode-charts-green,#89d185)"></span>Function</label>
  </div>
  <div class="sc" style="padding-bottom:3px"><div class="sh">Repository tree</div></div>
  <div id="tr"></div>
</div>

<div id="cv">
  <div id="ld"><div class="spin" id="spin"></div><div id="ldm">Loading…</div></div>
  <svg id="gs">
    <defs>
      <marker id="ar" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
        <path d="M0,0 L0,5 L5,2.5z" fill="rgba(128,128,128,.4)"/>
      </marker>
    </defs>
    <g id="vp"><g id="el"></g><g id="nl"></g></g>
  </svg>

  <div class="ov" id="oi">
    <div class="oh" id="oi-l">Graph</div>
    <div class="or"><span>Nodes</span><span class="ov2" id="on">0</span></div>
    <div class="or"><span>Edges</span><span class="ov2" id="oe">0</span></div>
  </div>
  <div class="ov" id="os">
    <div class="or"><span>Visible</span><span class="ov2" id="sn">0</span></div>
    <div class="or"><span>Edges</span><span class="ov2" id="se">0</span></div>
    <div class="or"><span>Selected</span><span class="ov2" id="ss">—</span></div>
    <div class="or"><span>Mode</span><span class="ov2" id="sm">select</span></div>
  </div>
  <div class="ov" id="ol">
    <div class="oh">Legend</div>
    <div class="lr"><span class="dot" style="background:var(--vscode-charts-purple,#b180d7)"></span>Folder</div>
    <div class="lr"><span class="dot" style="background:var(--vscode-charts-blue,#75beff)"></span>File</div>
    <div class="lr"><span class="dot" style="background:var(--vscode-charts-yellow,#e9c46a)"></span>Class</div>
    <div class="lr"><span class="dot" style="background:var(--vscode-charts-green,#89d185)"></span>Function</div>
    <div class="lr" style="margin-top:3px;padding-top:3px;border-top:1px solid rgba(128,128,128,.2);font-size:9px;opacity:.7">Larger = more connections</div>
  </div>
  <div id="zc">
    <button id="z+">+</button><button id="z-">−</button><button id="zf" style="font-size:9px">fit</button>
  </div>
</div>

<div id="rp">
  <div class="tabs">
    <div class="tab on" data-t="detail">Detail</div>
    <div class="tab" data-t="insights">Insights</div>
    <div class="tab" data-t="ai">AI</div>
  </div>
  <div class="tb on pd" id="tb-detail">
    <div class="emp" id="de"><div class="ei">⬡</div><div style="font-size:11px">Click any node to inspect</div><div style="font-size:10px;margin-top:3px">Larger nodes have more connections</div></div>
    <div id="dc" style="display:none"></div>
  </div>
  <div class="tb pd" id="tb-insights"></div>
  <div class="tb pd" id="tb-ai">
    <div style="background:rgba(128,128,128,.07);border-radius:4px;padding:8px;margin-bottom:8px;font-size:11px;color:var(--vscode-descriptionForeground);line-height:1.6">Use the <strong style="color:var(--vscode-foreground)">AI Chat</strong> sidebar for Q&A. Selecting a node auto-sends it as context.</div>
    <button class="ab" id="b-chat">💬 Open Chat Panel</button>
    <button class="ab" id="b-idx">🗄 Index a Repository</button>
  </div>
</div>
</div>
</div>

<div id="tip"><div id="tip-name"></div><div id="tip-kind"></div><div id="tip-deg"></div></div>

<script nonce="${nonce}">
window.onerror=function(msg,src,line,col,err){
  var ld=document.getElementById('ldm');
  if(ld) ld.textContent='⚠ JS Error: '+msg+' (line '+line+')';
};
(function(){
'use strict';
const vsc=acquireVsCodeApi();
const NS='http://www.w3.org/2000/svg';
const $=id=>document.getElementById(id);

// ── node classification ───────────────────────────────────────────
function classify(n){
  const L=n.labels||[],id=String(n.id||'');
  if(L.some(l=>['Repository','Repo','Folder','Directory'].includes(l))||id.startsWith('repo:')||id.startsWith('dir:')) return 'folder';
  if(L.some(l=>['Class','Interface','Enum'].includes(l))) return 'class';
  if(L.some(l=>['CallSite','CallSiteSummary'].includes(l))||id.startsWith('call:')) return 'callsite';
  if(L.some(l=>['Function','Method','Chunk','Symbol'].includes(l))||id.startsWith('sym:')) return 'fn';
  if(L.some(l=>['Import','ExternalModule','ExternalSymbol'].includes(l))||id.startsWith('imp:')||id.startsWith('extmod:')) return 'import';
  if(L.some(l=>['CodeFile','TextFile'].includes(l))||id.startsWith('file:')) return 'file';
  return 'file';
}

function getLabel(n){
  const p=n.properties||{},id=String(n.id||'');
  for(const k of['name','displayName','symbol','callee','raw','qname']){
    const v=p[k];
    if(typeof v==='string'&&v.trim()&&v.length<80){
      const s=v.replace(/\\/g,'/').split('/').filter(Boolean).pop()||v;
      return s.length>26?s.slice(0,25)+'…':s;
    }
  }
  for(const k of['relPath','filePath','path','fileRelPath','relativePath','rootPath']){
    const v=p[k];
    if(typeof v==='string'&&v.trim()){
      const s=v.replace(/\\/g,'/').split('/').filter(Boolean).pop()||v;
      return s.length>26?s.slice(0,25)+'…':s;
    }
  }
  // ID fallback - strip prefix and repo-id
  const m=id.match(/^(repo|dir|file|sym|imp|call|chunk|extmod|extsym|edge):(.+)$/);
  if(m){
    const[,kind,rest]=m;
    if(kind==='file'||kind==='dir'){
      const parts=rest.split(':');const rel=parts.slice(1).join(':');
      const s=rel.replace(/\\/g,'/').split('/').filter(Boolean).pop()||rel;
      return s.length>26?s.slice(0,25)+'…':s;
    }
    return {imp:'import',call:'call',sym:'symbol',chunk:'chunk',repo:'root',extmod:'external'}[kind]||kind;
  }
  return id.slice(0,14)+(id.length>14?'…':'');
}

function getPath(n){
  const p=n.properties||{};
  for(const k of['relPath','filePath','path','fileRelPath','relativePath','rootPath']){
    if(typeof p[k]==='string'&&p[k].trim()) return p[k];
  }
  return '';
}

// Colors
const KC={folder:'var(--vscode-charts-purple,#b180d7)',file:'var(--vscode-charts-blue,#75beff)','class':'var(--vscode-charts-yellow,#e9c46a)',fn:'var(--vscode-charts-green,#89d185)',callsite:'rgba(128,128,128,.4)',import:'rgba(128,128,128,.3)'};
const EC={CONTAINS:'var(--vscode-charts-purple,#b180d7)',IMPORTS:'var(--vscode-charts-blue,#75beff)',CALLS:'var(--vscode-charts-green,#89d185)'};
function kc(k){return KC[k]||KC.file;}
function ec(t){const u=String(t).toUpperCase();return u.includes('CALL')?EC.CALLS:u.includes('IMPORT')?EC.IMPORTS:EC.CONTAINS;}
function ed(t){const u=String(t).toUpperCase();return u.includes('CALL')?'2 4':u.includes('IMPORT')?'4 3':null;}
function ne(t){const u=String(t).toUpperCase();return u.includes('CALL')?'CALLS':u.includes('IMPORT')?'IMPORTS':'CONTAINS';}
function sid(v){return String(v||'');}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function trunc(s,n=18){s=String(s||'');return s.length>n?s.slice(0,n-1)+'…':s;}

// ── base radius & degree-scaled radius ─────────────────────────────
const BR={folder:14,file:10,'class':12,fn:8,callsite:5,import:4};
function baseR(k){return BR[k]||10;}
function degR(k,deg){
  const b=baseR(k);
  if(deg===0) return Math.max(5,b*.7);
  if(deg>=10) return b*2.4;
  if(deg>=6)  return b*2.0;
  if(deg>=3)  return b*1.5;
  return b*1.15;
}
function degOpacity(deg){
  if(deg===0) return .45;
  if(deg>=6)  return 1;
  if(deg>=2)  return .85;
  return .7;
}

// ── State ────────────────────────────────────────────────────────
const ST={
  all:[],allE:[],filt:[],filtE:[],
  simN:[],degMap:new Map(),
  sel:null,mode:'select',search:'',
  visE:{CONTAINS:true,IMPORTS:true,CALLS:true},
  visK:{folder:true,file:true,'class':true,fn:true,callsite:false,import:false},
  tx:{x:0,y:0,k:1},pan:null,
  rafId:null,sbOpen:true,
  serverUrl:$('i-sv').value.trim(),
  repoId:$('i-rp').value.trim(),
};

// ── Filter ───────────────────────────────────────────────────────
function rebuild(){
  const lo=ST.search.toLowerCase();
  ST.filt=ST.all.filter(n=>{
    if(!ST.visK[n._k]) return false;
    if(!lo) return true;
    return (n._lbl+getPath(n)+JSON.stringify(n.properties||{})).toLowerCase().includes(lo);
  });
  const ids=new Set(ST.filt.map(n=>sid(n.id)));
  ST.filtE=ST.allE.filter(e=>{
    const cat=ne(e.type);
    return ST.visE[cat]&&ids.has(sid(e.from))&&ids.has(sid(e.to));
  });
  // Build degree map for filtered graph
  ST.degMap=new Map();
  ST.filt.forEach(n=>ST.degMap.set(sid(n.id),0));
  ST.filtE.forEach(e=>{
    ST.degMap.set(sid(e.from),(ST.degMap.get(sid(e.from))||0)+1);
    ST.degMap.set(sid(e.to),(ST.degMap.get(sid(e.to))||0)+1);
  });
}

// ── Simulation ────────────────────────────────────────────────────
// Hierarchical ring placement: folder=inner, file=mid, fn=outer
const RINGS={folder:0,file:1,'class':1,fn:2,callsite:3,import:3};
function initSim(){
  const svg=$('gs'),W=svg.clientWidth||900,H=svg.clientHeight||600;
  const prev=new Map(ST.simN.map(n=>[sid(n.id),n]));
  // Sort by degree desc for better placement
  const sorted=[...ST.filt].sort((a,b)=>(ST.degMap.get(sid(b.id))||0)-(ST.degMap.get(sid(a.id))||0));
  const byRing=[{},{},{}];
  sorted.forEach(n=>{const r=RINGS[n._k]||1;if(!byRing[r])byRing[r]={};const k=n._k+':'+r;(byRing[r][k]=byRing[r][k]||[]).push(n);});
  const maxR=Math.min(W,H)*.44;
  const ringR=[maxR*.15,maxR*.55,maxR*.9];
  const placed=new Map();
  sorted.forEach((n,globalIdx)=>{
    const ring=RINGS[n._k]||1;const r=ringR[ring]||ringR[1];
    // Place high-degree nodes evenly around their ring
    const ringNodes=sorted.filter(x=>RINGS[x._k]===ring);
    const i=ringNodes.indexOf(n);const total=ringNodes.length||1;
    const angle=(i/total)*Math.PI*2-Math.PI/2;
    const jitter=r*.25*(Math.random()-.5);
    placed.set(sid(n.id),{x:W/2+Math.cos(angle)*(r+jitter),y:H/2+Math.sin(angle)*(r+jitter)});
  });
  ST.simN=ST.filt.map(n=>{
    const p=prev.get(sid(n.id));
    const pl=placed.get(sid(n.id))||{x:W/2,y:H/2};
    return Object.assign({},n,{x:p?p.x:pl.x,y:p?p.y:pl.y,vx:0,vy:0});
  });
}

function simTick(a){
  const nodes=ST.simN,edges=ST.filtE;
  if(!nodes.length) return;
  const svg=$('gs'),W=svg.clientWidth||900,H=svg.clientHeight||600;
  const nmap=new Map(nodes.map(n=>[sid(n.id),n]));
  const LIM=Math.min(nodes.length,280);
  // Repulsion
  for(let i=0;i<LIM;i++){
    for(let j=i+1;j<LIM;j++){
      const A=nodes[i],B=nodes[j];
      let dx=B.x-A.x||(Math.random()-.5)*.3,dy=B.y-A.y||(Math.random()-.5)*.3;
      const d2=dx*dx+dy*dy||.001,d=Math.sqrt(d2);
      const rA=degR(A._k,ST.degMap.get(sid(A.id))||0);
      const rB=degR(B._k,ST.degMap.get(sid(B.id))||0);
      const minD=(rA+rB)*3.5;
      const f=(d<minD?-6000/d2:-3200/d2)*a;
      A.vx+=f*dx/d;A.vy+=f*dy/d;B.vx-=f*dx/d;B.vy-=f*dy/d;
    }
  }
  // Springs
  for(const e of edges){
    const s=nmap.get(sid(e.from)),t=nmap.get(sid(e.to));
    if(!s||!t) continue;
    const dx=t.x-s.x,dy=t.y-s.y,d=Math.sqrt(dx*dx+dy*dy)||.001;
    const rs=degR(s._k,ST.degMap.get(sid(s.id))||0),rt=degR(t._k,ST.degMap.get(sid(t.id))||0);
    const rest=Math.max(rs+rt+40,s._k==='folder'||t._k==='folder'?180:130);
    const f=(d-rest)*.18*a;
    s.vx+=f*dx/d;s.vy+=f*dy/d;t.vx-=f*dx/d;t.vy-=f*dy/d;
  }
  // Integrate
  for(const nd of nodes){
    nd.vx+=(W/2-nd.x)*.005*a;nd.vy+=(H/2-nd.y)*.005*a;
    nd.vx*=.78;nd.vy*=.78;
    nd.x+=nd.vx;nd.y+=nd.vy;
    nd.x=Math.max(22,Math.min(W-22,nd.x));nd.y=Math.max(22,Math.min(H-22,nd.y));
  }
}

// Pre-warm: run simulation to completion synchronously, THEN display
function computeLayout(){
  let a=1.0;
  const STEPS=450;
  for(let i=0;i<STEPS;i++){
    a*=.982;
    if(a<0.003) break;
    simTick(a);
  }
  autoFit();
}

function autoFit(){
  if(!ST.simN.length) return;
  const svg=$('gs'),W=svg.clientWidth||900,H=svg.clientHeight||600;
  const xs=ST.simN.map(n=>n.x),ys=ST.simN.map(n=>n.y);
  const mnX=Math.min(...xs)-30,mxX=Math.max(...xs)+30;
  const mnY=Math.min(...ys)-30,mxY=Math.max(...ys)+30;
  const k=Math.min(W/(mxX-mnX||1),H/(mxY-mnY||1),.96);
  ST.tx={x:(W-(mxX+mnX)*k)/2,y:(H-(mxY+mnY)*k)/2,k:Math.max(.05,Math.min(k,5))};
}

// ── Static render (no animation loop) ────────────────────────────
const eEls=new Map(),nEls=new Map();

function render(){
  const nodes=ST.simN,edges=ST.filtE;
  const nmap=new Map(nodes.map(n=>[sid(n.id),n]));
  const selId=ST.sel;

  // Highlight set
  const hi=new Set();
  if(selId){
    hi.add(selId);
    if(ST.mode==='neighbour'||ST.mode==='select'){
      edges.forEach(e=>{if(sid(e.from)===selId)hi.add(sid(e.to));if(sid(e.to)===selId)hi.add(sid(e.from));});
    }
    if(ST.mode==='insight'){
      [...ST.degMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([id])=>hi.add(id));
    }
  }
  const dim=!!selId&&ST.mode!=='insight';

  // ── Edges ──
  const el=$('el'),nl=$('nl');
  const eIds=new Set(edges.map(e=>sid(e.id)||(sid(e.from)+':'+sid(e.to))));
  for(const[k,v]of eEls)if(!eIds.has(k)){v.remove();eEls.delete(k);}
  for(const e of edges){
    const s=nmap.get(sid(e.from)),t=nmap.get(sid(e.to));if(!s||!t)continue;
    const eid=sid(e.id)||(sid(e.from)+':'+sid(e.to));
    let ln=eEls.get(eid);
    if(!ln){ln=document.createElementNS(NS,'line');el.appendChild(ln);eEls.set(eid,ln);}
    const dx=t.x-s.x,dy=t.y-s.y,d=Math.sqrt(dx*dx+dy*dy)||1;
    const r=degR(t._k,ST.degMap.get(sid(t.id))||0);
    const isHi=selId&&(sid(e.from)===selId||sid(e.to)===selId);
    ln.setAttribute('x1',s.x);ln.setAttribute('y1',s.y);
    ln.setAttribute('x2',t.x-dx/d*r);ln.setAttribute('y2',t.y-dy/d*r);
    ln.setAttribute('stroke',ec(e.type));
    ln.setAttribute('stroke-dasharray',ed(e.type)||'');
    ln.setAttribute('stroke-width',isHi?1.8:.7);
    ln.setAttribute('stroke-opacity',dim&&!isHi?.03:isHi?.75:.2);
    ln.setAttribute('marker-end','url(#ar)');
  }

  // ── Nodes ──
  const nIds=new Set(nodes.map(n=>sid(n.id)));
  for(const[k,v]of nEls)if(!nIds.has(k)){v.remove();nEls.delete(k);}
  for(const node of nodes){
    const nid=sid(node.id);let g=nEls.get(nid);
    if(!g){
      g=document.createElementNS(NS,'g');g.style.cursor='pointer';
      const ci=document.createElementNS(NS,'circle');
      const rb=document.createElementNS(NS,'rect');rb.setAttribute('rx','2');
      const tx=document.createElementNS(NS,'text');tx.setAttribute('pointer-events','none');
      tx.setAttribute('font-family','var(--vscode-editor-font-family,monospace,monospace)');
      g.appendChild(ci);g.appendChild(rb);g.appendChild(tx);
      nl.appendChild(g);nEls.set(nid,g);

      // CLICK — purely selection, zero physics
      g.addEventListener('click',ev=>{
        ev.stopPropagation();
        ST.sel=nid;
        if(ST.mode==='select') switchTab('detail');
        renderDetail(node);
        vsc.postMessage({type:'nodeSelected',payload:{node:{id:node.id,labels:node.labels,properties:node.properties,_k:node._k,_lbl:node._lbl}}});
        $('ss').textContent=trunc(node._lbl,14);
        $('b-ai').textContent='Ask AI: '+trunc(node._lbl,12)+' →';
        buildTree(); // refresh tree selection
        render(); // just re-render highlight, no physics
      });

      // HOVER tooltip
      g.addEventListener('mouseenter',ev=>{
        const deg=ST.degMap.get(nid)||0;
        $('tip-name').textContent=node._lbl||node.id;
        $('tip-kind').textContent=(node.labels||[]).join(', ')||node._k;
        $('tip-deg').textContent='Connections: '+deg;
        const tip=$('tip'); tip.classList.add('on');
        tip.style.left=(ev.clientX+12)+'px'; tip.style.top=(ev.clientY+12)+'px';
      });
      g.addEventListener('mousemove',ev=>{
        const tip=$('tip'); tip.style.left=(ev.clientX+12)+'px'; tip.style.top=(ev.clientY+12)+'px';
      });
      g.addEventListener('mouseleave',()=>$('tip').classList.remove('on'));

      // DRAG — moves node only, no physics restart
      let dragging=false,dx0=0,dy0=0,nx0=0,ny0=0;
      g.addEventListener('mousedown',ev=>{
        ev.stopPropagation();ev.preventDefault();
        dragging=true;dx0=ev.clientX;dy0=ev.clientY;nx0=node.x;ny0=node.y;
        function mv(ev){
          if(!dragging)return;
          node.x=nx0+(ev.clientX-dx0)/ST.tx.k;
          node.y=ny0+(ev.clientY-dy0)/ST.tx.k;
          render(); // re-render while dragging
        }
        function up(){dragging=false;window.removeEventListener('mousemove',mv);window.removeEventListener('mouseup',up);}
        window.addEventListener('mousemove',mv);window.addEventListener('mouseup',up);
      });
    }

    const isSel=nid===selId,isHi=hi.has(nid),isDim=dim&&!isHi;
    const deg=ST.degMap.get(nid)||0;
    const r=degR(node._k,deg)+(isSel?3:0);
    const op=degOpacity(deg);
    const ci=g.children[0],rb=g.children[1],tx=g.children[2];

    ci.setAttribute('cx',node.x);ci.setAttribute('cy',node.y);ci.setAttribute('r',r);
    ci.setAttribute('fill',kc(node._k));
    ci.setAttribute('stroke',isSel?'var(--vscode-focusBorder,#007acc)':kc(node._k));
    ci.setAttribute('stroke-width',isSel?2.5:1);
    ci.setAttribute('fill-opacity',isDim?.1:op);
    ci.setAttribute('stroke-opacity',isDim?.1:op);

    // Labels: always show for folder/file/class, show fn only if high degree or selected
    const showLbl=node._k==='folder'||node._k==='file'||node._k==='class'||isSel||(node._k==='fn'&&deg>=3)||(node._k==='fn'&&nodes.length<50);
    const lbl=showLbl?trunc(node._lbl,18):'';
    // Font size scales with node radius
    const fs=Math.max(7,Math.min(11,r*.75+(isSel?1:0)));
    const lx=node.x+r+3,ly=node.y+fs*.35;
    tx.textContent=lbl;
    tx.setAttribute('x',lx);tx.setAttribute('y',ly);
    tx.setAttribute('fill',isDim?'rgba(128,128,128,.25)':isSel?'var(--vscode-focusBorder,#007acc)':'var(--vscode-foreground)');
    tx.setAttribute('fill-opacity',isDim?.25:isSel?1:op);
    tx.setAttribute('font-size',fs);
    tx.setAttribute('font-weight',isSel||deg>=5?'600':'400');
    if(lbl){
      const lw=lbl.length*fs*.58+6;
      rb.setAttribute('x',lx-2);rb.setAttribute('y',ly-fs);
      rb.setAttribute('width',lw);rb.setAttribute('height',fs+3);
      rb.setAttribute('fill','var(--vscode-editor-background)');
      rb.setAttribute('fill-opacity',isDim?.05:.72);
      rb.setAttribute('rx','2');
    }else{rb.setAttribute('width',0);}
  }

  // stats
  $('on').textContent=nodes.length;$('oe').textContent=edges.length;
  $('sn').textContent=nodes.length;$('se').textContent=edges.length;$('sm').textContent=ST.mode;
  $('vp').setAttribute('transform','translate('+ST.tx.x+','+ST.tx.y+') scale('+ST.tx.k+')');
}

// ── Load ──────────────────────────────────────────────────────────
async function load(){
  ST.serverUrl=$('i-sv').value.trim(); ST.repoId=$('i-rp').value.trim();
  if(!ST.repoId){setLdMsg('Enter a Repo ID → run "Index a Repository" first if needed.');return;}
  showLd('Connecting to '+ST.serverUrl+'…');
  try{
    const res=await fetch(ST.serverUrl+'/debug/subgraph?repoId='+encodeURIComponent(ST.repoId)+'&limit=500&_='+Date.now());
    if(!res.ok) throw new Error('HTTP '+res.status+' — verify server and Repo ID');
    const data=await res.json();
    if(data.ok===false) throw new Error(data.error||'Server returned error');
    if(!(data.nodes||[]).length) throw new Error('No nodes found — index the repository first');
    ST.all=(data.nodes||[]).map(n=>Object.assign({},n,{_k:classify(n),_lbl:getLabel(n)}));
    ST.allE=data.edges||[];
    rebuild();
    setLdMsg('Computing layout…');
    // Defer heavy computation so loading message appears
    setTimeout(()=>{
      initSim();
      computeLayout(); // run to completion, then freeze
      buildTree();
      buildInsights();
      $('sd').className='ok';
      hideLd();
      render();
      vsc.postMessage({type:'graph/nodes',payload:{nodes:ST.all}});
      vsc.postMessage({type:'settings/save',payload:{serverUrl:ST.serverUrl,repoId:ST.repoId}});
    },40);
  }catch(err){
    $('sd').className='err';
    setLdMsg('⚠ '+err.message);
  }
}
function showLd(m){const l=$('ld');l.classList.remove('off');$('spin').style.display='';$('ldm').textContent=m;}
function setLdMsg(m){const l=$('ld');l.classList.remove('off');$('spin').style.display=m.startsWith('⚠')||m.startsWith('Enter')?'none':'';$('ldm').textContent=m;}
function hideLd(){$('ld').classList.add('off');}

// ── Recompute layout ──────────────────────────────────────────────
function relayout(){
  showLd('Computing layout…');
  setTimeout(()=>{initSim();computeLayout();hideLd();render();buildTree();buildInsights();},40);
}

// ── Detail ────────────────────────────────────────────────────────
function renderDetail(node){
  $('de').style.display='none';const dc=$('dc');dc.style.display='block';
  const k=node._k||'file';
  const cols={folder:'#b180d7',file:'#75beff','class':'#e9c46a',fn:'#89d185',callsite:'#aaa',import:'#888'};
  const col=cols[k]||cols.file;
  const nid=sid(node.id);
  let inD=0,outD=0;
  ST.filtE.forEach(e=>{if(sid(e.to)===nid)inD++;if(sid(e.from)===nid)outD++;});
  const path_=getPath(node);
  const fullName=path_.split(/[/\\]/).pop()||path_;
  const ext=fullName.includes('.')?fullName.split('.').pop().toLowerCase():'';
  const LANG={ts:'TypeScript',tsx:'TypeScript',js:'JavaScript',jsx:'JavaScript',py:'Python',java:'Java',cs:'C#',go:'Go',rb:'Ruby',cpp:'C++',rs:'Rust',kt:'Kotlin',html:'HTML',css:'CSS',json:'JSON',md:'Markdown'};
  const lang=(node.properties||{}).language||(ext&&LANG[ext])||( ext&&ext.length<=6&&ext.length>0?ext.toUpperCase():'—');
  const rels=ST.filtE.filter(e=>sid(e.from)===nid||sid(e.to)===nid).slice(0,16).map(e=>{
    const tid=sid(e.from)===nid?sid(e.to):sid(e.from);
    const t=ST.simN.find(n=>sid(n.id)===tid);
    return {e,t,cat:ne(e.type)};
  }).filter(r=>r.t);
  const cc={CONTAINS:'var(--vscode-charts-purple,#b180d7)',IMPORTS:'var(--vscode-charts-blue,#75beff)',CALLS:'var(--vscode-charts-green,#89d185)'};
  const props=Object.assign({},node.properties||{});delete props.embedding;
  dc.innerHTML='<style>#dc .nc{--nc:'+col+'}</style>'+
  '<div class="nc"><div class="nbg" style="background:'+col+'22;color:'+col+'">'+k+'</div>'+
  '<div class="nm">'+esc(node._lbl||node.id)+'</div>'+
  (path_?'<div class="np">'+esc(path_)+'</div>':'')+
  '</div>'+
  '<div style="margin-bottom:10px"><div class="dh">Metadata</div>'+
  '<div class="dr"><span class="dk">Type</span><span class="dv">'+k+'</span></div>'+
  '<div class="dr"><span class="dk">Language</span><span class="dv">'+esc(lang)+'</span></div>'+
  '<div class="dr"><span class="dk">Degree in/out</span><span class="dv">'+inD+' / '+outD+'</span></div>'+
  '<div class="dr"><span class="dk">Labels</span><span class="dv" title="'+esc((node.labels||[]).join(', '))+'">'+esc((node.labels||[]).slice(0,3).join(', '))+'</span></div>'+
  '</div>'+
  '<div style="margin-bottom:10px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px"><div class="dh" style="margin:0">AI Summary</div><button class="sbtn" id="b-sum">Generate</button></div>'+
  '<div class="sumbox" id="sum-b">Click Generate for an AI summary of this node.</div>'+
  '</div>'+
  '<div style="margin-bottom:10px"><div class="dh">Relationships ('+rels.length+')</div>'+
  rels.map(r=>'<button class="rb" data-tid="'+sid(r.t.id)+'"><span class="rt" style="color:'+cc[r.cat]+'">'+r.cat+'</span><span class="rn">'+esc(trunc(r.t._lbl||'',22))+'</span></button>').join('')+
  (!rels.length?'<div style="font-size:10px;color:var(--vscode-descriptionForeground)">No visible relationships</div>':'')+
  '</div>'+
  '<div style="margin-bottom:10px"><div class="dh">Properties</div><pre class="pp">'+esc(JSON.stringify(props,null,2))+'</pre></div>'+
  '<div><div class="dh">Actions</div>'+
  '<button class="ab" id="b-ctx">✨ Add to AI context</button>'+
  '<button class="ab" id="b-nb">→ Explore neighbours</button>'+
  '<button class="ab" id="b-pt">🔗 Trace path</button>'+
  '</div>';

  dc.querySelectorAll('[data-tid]').forEach(b=>b.addEventListener('click',()=>{
    const t=ST.simN.find(n=>sid(n.id)===b.dataset.tid);
    if(t){ST.sel=sid(t.id);renderDetail(t);render();}
  }));
  $('b-sum')?.addEventListener('click',()=>doSum(node));
  $('b-ctx')?.addEventListener('click',()=>{switchTab('ai');vsc.postMessage({type:'nodeSelected',payload:{node:{id:node.id,labels:node.labels,properties:node.properties,_k:node._k,_lbl:node._lbl}}});});
  $('b-nb')?.addEventListener('click',()=>setMode('neighbour'));
  $('b-pt')?.addEventListener('click',()=>setMode('path'));
}

async function doSum(node){
  const box=$('sum-b'),btn=$('b-sum');if(!box||!btn)return;
  btn.textContent='…';btn.disabled=true;box.textContent='Generating…';
  try{
    const p=getPath(node)||node._lbl||'';
    const r=await fetch(ST.serverUrl+'/graphrag/summarize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({repoId:ST.repoId,filePaths:[p],repoRoot:''})});
    const d=await r.json();
    box.textContent=d.results?.length>0?d.results.map(x=>x.summary||x.text||'').join('\n\n'):'No summary returned.';
  }catch(e){box.textContent='Error: '+e.message;}
  btn.textContent='Generate';btn.disabled=false;
}

// ── Insights ──────────────────────────────────────────────────────
function buildInsights(){
  const tab=$('tb-insights');
  const hot=[...ST.filt].map(n=>({n,d:ST.degMap.get(sid(n.id))||0}))
    .sort((a,b)=>b.d-a.d).slice(0,7);
  const maxD=Math.max(1,...hot.map(h=>h.d));
  const orphans=ST.filt.filter(n=>(ST.degMap.get(sid(n.id))||0)===0).slice(0,4);
  tab.innerHTML='<div class="dh">Hotspot nodes</div>'+
    hot.map(h=>'<div class="hc" data-hi="'+sid(h.n.id)+'"><div class="hh"><span class="hn">'+esc(h.n._lbl||'')+'</span><span class="db">'+h.d+' links</span></div><div class="bg"><div class="bf" style="width:'+Math.round(h.d/maxD*100)+'%"></div></div><div style="font-size:9px;color:var(--vscode-descriptionForeground);margin-top:1px">'+esc(h.n._k)+'</div></div>').join('')+
    '<div class="dh" style="margin-top:10px">Orphans (no connections)</div>'+
    (orphans.length?orphans.map(n=>'<div style="border:1px dashed rgba(128,128,128,.25);border-radius:3px;padding:4px 6px;font-size:10px;color:var(--vscode-descriptionForeground);font-family:monospace;margin-bottom:3px">'+esc(n._lbl||'')+'</div>').join(''):'<div style="font-size:10px;color:var(--vscode-descriptionForeground)">None</div>')+
    '<div class="dh" style="margin-top:10px">Stats</div>'+
    '<div style="font-size:11px;line-height:1.8">'+
    '<div>Nodes: <b>'+ST.filt.length+'</b></div>'+
    '<div>Edges: <b>'+ST.filtE.length+'</b></div>'+
    '<div>Avg degree: <b>'+(ST.filt.length?(ST.filtE.length*2/ST.filt.length).toFixed(1):'—')+'</b></div>'+
    '</div>';
  tab.querySelectorAll('[data-hi]').forEach(c=>c.addEventListener('click',()=>{
    const n=ST.simN.find(n=>sid(n.id)===c.dataset.hi);
    if(n){ST.sel=sid(n.id);switchTab('detail');renderDetail(n);render();}
  }));
}

// ── Tree ──────────────────────────────────────────────────────────
function buildTree(){
  const con=$('tr'),items=[],seen=new Set();
  const paths=ST.filt.filter(n=>['folder','file','class'].includes(n._k))
    .sort((a,b)=>(ST.degMap.get(sid(b.id))||0)-(ST.degMap.get(sid(a.id))||0))
    .map(n=>({nid:sid(n.id),path:getPath(n)||n._lbl||'',lbl:n._lbl}));
  for(const it of paths){
    const clean=it.path.replace(/^[/\\]+/,'');const segs=clean.split(/[/\\]/).filter(Boolean);
    if(!segs.length){if(!seen.has(it.nid)){items.push({key:it.nid,lbl:it.lbl,d:0,nid:it.nid});seen.add(it.nid);}continue;}
    let pfx='';
    segs.forEach((seg,i)=>{
      pfx=pfx?pfx+'/'+seg:seg;const isLeaf=i===segs.length-1;
      if(!seen.has(pfx)){items.push({key:pfx,lbl:isLeaf?it.lbl:seg+'/',d:i,nid:isLeaf?it.nid:null});seen.add(pfx);}
    });
  }
  con.innerHTML=items.slice(0,130).map(it=>'<div class="tr-row'+(it.nid&&it.nid===ST.sel?' on':'')+'" data-nid="'+(it.nid||'')+'" style="padding-left:'+(6+it.d*9)+'px">'+
    '<span style="width:5px;height:5px;border-radius:'+(it.lbl.endsWith('/')?'1px':'50%')+';background:'+(it.lbl.endsWith('/')?'var(--vscode-charts-purple,#b180d7)':'var(--vscode-charts-blue,#75beff)')+';flex-shrink:0;display:inline-block"></span>'+
    esc(it.lbl)+'</div>').join('');
  con.querySelectorAll('[data-nid]').forEach(el=>el.addEventListener('click',()=>{
    if(!el.dataset.nid)return;
    const n=ST.simN.find(n=>sid(n.id)===el.dataset.nid);
    if(n){ST.sel=sid(n.id);switchTab('detail');renderDetail(n);render();}
  }));
}

// ── Pan/Zoom (no simulation) ───────────────────────────────────────
const cv=$('cv');
cv.addEventListener('mousedown',ev=>{
  if(ev.target.closest('g[style]')) return;
  ST.pan={sx:ev.clientX-ST.tx.x,sy:ev.clientY-ST.tx.y};cv.classList.add('pn');
});
window.addEventListener('mousemove',ev=>{if(!ST.pan)return;ST.tx.x=ev.clientX-ST.pan.sx;ST.tx.y=ev.clientY-ST.pan.sy;render();});
window.addEventListener('mouseup',()=>{ST.pan=null;cv.classList.remove('pn');});
cv.addEventListener('wheel',ev=>{
  ev.preventDefault();
  const k=Math.max(.05,Math.min(8,ST.tx.k*(ev.deltaY>0?.9:1.11)));
  const rect=cv.getBoundingClientRect(),mx=ev.clientX-rect.left,my=ev.clientY-rect.top;
  ST.tx.x=mx-(mx-ST.tx.x)*(k/ST.tx.k);ST.tx.y=my-(my-ST.tx.y)*(k/ST.tx.k);ST.tx.k=k;render();
},{passive:false});
$('z+').addEventListener('click',()=>{ST.tx.k=Math.min(8,ST.tx.k*1.3);render();});
$('z-').addEventListener('click',()=>{ST.tx.k=Math.max(.05,ST.tx.k/1.3);render();});
$('zf').addEventListener('click',()=>{autoFit();render();});
$('gs').addEventListener('click',ev=>{
  if(['svg','g'].includes(ev.target.tagName.toLowerCase())){
    ST.sel=null;$('de').style.display='';$('dc').style.display='none';
    $('ss').textContent='—';$('b-ai').textContent='Ask AI →';
    render();buildTree();
  }
});
new ResizeObserver(()=>{if(ST.simN.length){autoFit();render();}}).observe(cv);

// ── Tabs ──────────────────────────────────────────────────────────
function switchTab(n){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.t===n));
  document.querySelectorAll('.tb').forEach(t=>t.classList.toggle('on',t.id==='tb-'+n));
}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>switchTab(t.dataset.t)));

// ── Mode ──────────────────────────────────────────────────────────
function setMode(m){
  ST.mode=m;
  document.querySelectorAll('.mb').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  $('sm').textContent=m;$('oi-l').textContent=m==='insight'?'Insight mode':m==='path'?'Path trace':'Graph';
  render();
}
document.querySelectorAll('.mb').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.m)));

// ── Filters ───────────────────────────────────────────────────────
document.querySelectorAll('[data-e]').forEach(cb=>cb.addEventListener('change',()=>{ST.visE[cb.dataset.e]=cb.checked;rebuild();buildInsights();render();}));
document.querySelectorAll('[data-k]').forEach(cb=>cb.addEventListener('change',()=>{ST.visK[cb.dataset.k]=cb.checked;rebuild();relayout();}));
let st_; $('sb').addEventListener('input',ev=>{clearTimeout(st_);st_=setTimeout(()=>{ST.search=ev.target.value;rebuild();relayout();},240);});

// ── Toolbar ───────────────────────────────────────────────────────
$('b-tog').addEventListener('click',()=>{ST.sbOpen=!ST.sbOpen;$('ls').classList.toggle('off',!ST.sbOpen);});
$('b-sync').addEventListener('click',load);
$('b-ai').addEventListener('click',()=>vsc.postMessage({type:'openChat'}));
$('b-chat').addEventListener('click',()=>vsc.postMessage({type:'openChat'}));
$('b-idx').addEventListener('click',()=>vsc.postMessage({type:'indexRepo'}));
$('b-emb').addEventListener('click',async()=>{
  const b=$('b-emb');b.textContent='⏳…';b.disabled=true;
  try{const r=await fetch(ST.serverUrl+'/graphrag/embedRepo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({repoId:ST.repoId,repoRoot:''})});const d=await r.json();b.textContent=d.ok!==false?'✓ Done':'✗ Failed';}
  catch(){b.textContent='✗ Error';}
  setTimeout(()=>{b.textContent='↑ Embed';b.disabled=false;},3000);
});
['i-sv','i-rp'].forEach(id=>document.getElementById(id).addEventListener('change',()=>{ST.serverUrl=$('i-sv').value.trim();ST.repoId=$('i-rp').value.trim();}));

// ── Extension messages ────────────────────────────────────────────
window.addEventListener('message',ev=>{
  const msg=ev.data;
  if(msg.type==='settings/update'){
    const{serverUrl:su,repoId:ri}=msg.payload||{};
    if(su){$('i-sv').value=su;ST.serverUrl=su;}
    if(ri){$('i-rp').value=ri;ST.repoId=ri;}
    load();
  }
  if(msg.type==='server/status'){
    const s=msg.payload||{};const dot=$('sd'),ban=$('ban');
    if(s.status==='running'){
      dot.className='ok';dot.title=s.url;ban.style.display='none';
      if(s.url&&$('i-sv').value!==s.url){$('i-sv').value=s.url;ST.serverUrl=s.url;if(ST.repoId)load();}
    }else if(s.status==='starting'){
      dot.className='go';ban.style.display='';ban.style.background='rgba(240,164,0,.1)';ban.style.color='#f0c27f';ban.textContent='⏳ Backend starting…';
    }else if(s.status==='error'){
      dot.className='err';ban.style.display='';ban.style.background='rgba(244,71,71,.1)';ban.style.color='#f48771';
      ban.innerHTML='⚠ Backend error — <button onclick="vsc.postMessage({type:\'server/start\'})">Retry</button>';
    }else{
      dot.className='';ban.style.display='';ban.style.background='rgba(128,128,128,.06)';ban.style.color='var(--vscode-descriptionForeground)';
      ban.innerHTML='Server stopped — <button onclick="vsc.postMessage({type:\'server/start\'})">Start</button>';
    }
  }
});

// ── Init ──────────────────────────────────────────────────────────
load().catch(function(e){ setLdMsg('⚠ Init error: '+e.message); });
})();
</script>
</body>
</html>`;
}