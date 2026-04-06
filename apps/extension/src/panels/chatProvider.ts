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
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:var(--vscode-sideBar-background,var(--vscode-editor-background));color:var(--vscode-foreground);font-family:var(--vscode-font-family,system-ui,-apple-system,sans-serif);font-size:var(--vscode-font-size,13px);height:100vh;overflow:hidden;display:flex;flex-direction:column}

/* ── context bar ─────────────────────────────── */
#ctx-bar{padding:6px 8px;border-bottom:1px solid var(--vscode-panel-border,rgba(128,128,128,.35));min-height:32px;display:flex;align-items:center;gap:5px;flex-shrink:0;background:var(--vscode-editorGroupHeader-tabsBackground,rgba(128,128,128,.05))}
#ctx-node{display:none;align-items:center;gap:5px;flex:1;overflow:hidden}
#ctx-node.show{display:flex}
.ctx-badge{border-radius:2px;padding:1px 5px;font-family:monospace;font-size:9px;flex-shrink:0}
.ctx-name{font-family:monospace;font-size:10px;color:var(--vscode-foreground);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.ctx-x{background:none;border:none;color:var(--vscode-descriptionForeground);cursor:pointer;font-size:14px;padding:0 2px;line-height:1;flex-shrink:0}
.ctx-x:hover{color:var(--vscode-foreground)}
#ctx-empty{font-size:10px;color:var(--vscode-descriptionForeground);flex:1}

/* ── messages ────────────────────────────────── */
#msgs{flex:1;overflow-y:auto;padding:8px 8px 4px;display:flex;flex-direction:column;gap:8px}
#msgs::-webkit-scrollbar{width:4px}
#msgs::-webkit-scrollbar-thumb{background:rgba(128,128,128,.3);border-radius:2px}
.msg{max-width:95%;border-radius:4px;padding:7px 9px;font-size:11px;line-height:1.6;white-space:pre-wrap;word-break:break-word}
.msg.user{align-self:flex-end;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-radius:4px 4px 1px 4px}
.msg.bot{align-self:flex-start;background:var(--vscode-editorWidget-background,rgba(128,128,128,.1));border:1px solid var(--vscode-panel-border,rgba(128,128,128,.25));border-radius:4px 4px 4px 1px}
.msg.err{background:var(--vscode-inputValidation-errorBackground,rgba(244,71,71,.15));border:1px solid var(--vscode-inputValidation-errorBorder,rgba(244,71,71,.5));color:var(--vscode-editorError-foreground,#f48771)}
.msg.sys{align-self:center;background:rgba(128,128,128,.08);color:var(--vscode-descriptionForeground);font-size:10px;border-radius:4px}
.ctx-files{margin-top:6px;padding-top:5px;border-top:1px solid rgba(128,128,128,.2)}
.cf-lbl{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:var(--vscode-descriptionForeground);margin-bottom:2px}
.cf-item{font-family:monospace;font-size:9px;color:var(--vscode-descriptionForeground);line-height:1.5}
.typing{display:flex;gap:4px;align-items:center;padding:4px 2px}
.typing span{width:5px;height:5px;background:var(--vscode-button-background);border-radius:50%;animation:bounce 1.1s ease-in-out infinite}
.typing span:nth-child(2){animation-delay:.15s}
.typing span:nth-child(3){animation-delay:.3s}
@keyframes bounce{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}

/* ── empty state ─────────────────────────────── */
#empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--vscode-descriptionForeground);padding:16px;text-align:center}
.ei{font-size:26px;opacity:.4}

/* ── embed notice ────────────────────────────── */
#embed-notice{display:none;margin:6px 8px;background:var(--vscode-editorWarning-background,rgba(240,164,0,.1));border:1px solid var(--vscode-editorWarning-border,rgba(240,164,0,.3));border-radius:4px;padding:8px 10px;font-size:10px;color:var(--vscode-editorWarning-foreground,#f0c27f);line-height:1.6}
#embed-notice button{margin-top:5px;padding:3px 9px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:3px;font-size:10px;cursor:pointer;display:block}

/* ── quick prompts ───────────────────────────── */
#quick{padding:4px 8px;display:flex;flex-wrap:wrap;gap:4px;flex-shrink:0}
.qb{border:1px solid var(--vscode-panel-border,rgba(128,128,128,.35));border-radius:10px;padding:2px 8px;font-size:10px;color:var(--vscode-descriptionForeground);background:none;cursor:pointer;white-space:nowrap;transition:all .12s}
.qb:hover{background:var(--vscode-list-hoverBackground);color:var(--vscode-foreground)}

/* ── input area ──────────────────────────────── */
#inp-area{padding:6px 8px 8px;border-top:1px solid var(--vscode-panel-border,rgba(128,128,128,.2));flex-shrink:0;position:relative}
.inp-row{display:flex;gap:5px;align-items:flex-end}
#chat-ta{flex:1;background:var(--vscode-input-background);border:1px solid var(--vscode-input-border,rgba(128,128,128,.35));border-radius:3px;color:var(--vscode-input-foreground,var(--vscode-foreground));padding:6px 8px;font-size:11px;resize:none;outline:none;height:52px;font-family:inherit;line-height:1.5}
#chat-ta:focus{border-color:var(--vscode-focusBorder)}
#chat-ta::placeholder{color:var(--vscode-input-placeholderForeground,rgba(128,128,128,.6))}
#btn-send{padding:0 11px;border-radius:3px;border:none;background:var(--vscode-button-background);color:var(--vscode-button-foreground);font-size:11px;cursor:pointer;align-self:flex-end;height:30px;transition:opacity .12s;white-space:nowrap;flex-shrink:0}
#btn-send:disabled{opacity:.4;cursor:default}
#btn-send:hover:not(:disabled){background:var(--vscode-button-hoverBackground)}

/* mention dropdown */
#mention-dd{display:none;position:absolute;bottom:100%;left:8px;right:8px;margin-bottom:3px;background:var(--vscode-editorWidget-background,var(--vscode-editor-background));border:1px solid var(--vscode-panel-border,rgba(128,128,128,.35));border-radius:4px;box-shadow:0 -3px 12px rgba(0,0,0,.3);max-height:150px;overflow-y:auto;z-index:10}
#mention-dd.show{display:block}
.mi{display:flex;align-items:center;gap:6px;padding:5px 8px;font-size:10px;cursor:pointer;transition:background .1s}
.mi:hover,.mi.sel{background:var(--vscode-list-activeSelectionBackground)}
.mn{font-family:monospace;color:var(--vscode-foreground);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.mp{font-size:9px;color:var(--vscode-descriptionForeground);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px}
.mk-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}

/* settings row */
#cfg{padding:4px 8px 0;display:flex;gap:4px;font-size:9px;color:var(--vscode-descriptionForeground);align-items:center}
#cfg input{background:none;border:none;border-bottom:1px solid rgba(128,128,128,.2);color:var(--vscode-descriptionForeground);font-size:9px;outline:none;padding:1px 2px;min-width:0;flex:1}
#cfg input:focus{border-bottom-color:var(--vscode-focusBorder);color:var(--vscode-foreground)}
</style>
</head>
<body>

<div id="ctx-bar">
  <div id="ctx-node">
    <span class="ctx-badge" id="ctx-badge"></span>
    <span class="ctx-name" id="ctx-name"></span>
    <button class="ctx-x" id="ctx-clear" title="Clear context">×</button>
  </div>
  <span id="ctx-empty">Select a node in the graph to add context</span>
</div>

<div id="msgs">
  <div id="empty">
    <div class="ei">💬</div>
    <div style="font-size:11px">Ask anything about your codebase</div>
    <div style="font-size:10px;opacity:.6;margin-top:3px">Select a node for context · use @name to mention nodes</div>
  </div>
</div>

<div id="embed-notice">
  <strong>⚠ Embeddings needed</strong><br>
  The AI needs code embeddings to answer questions. Click below to generate them (takes a few minutes).
  <button id="btn-embed-fix">↑ Generate Embeddings Now</button>
</div>

<div id="quick">
  <button class="qb" data-p="What does this node do?">What does this do?</button>
  <button class="qb" data-p="Why is this highly connected?">Why connected?</button>
  <button class="qb" data-p="Suggest a refactor for this.">Suggest refactor</button>
  <button class="qb" data-p="What are the main entry points?">Entry points</button>
  <button class="qb" data-p="Show the key dependencies.">Dependencies</button>
</div>

<div id="inp-area">
  <div id="mention-dd"></div>
  <div class="inp-row">
    <textarea id="chat-ta" placeholder="Ask about your codebase… (@name to mention a node)"></textarea>
    <button id="btn-send">Send</button>
  </div>
  <div id="cfg">
    <span>Server:</span><input id="cfg-s" value="${serverUrl}" placeholder="http://localhost:3000">
    <span style="margin-left:5px">Repo:</span><input id="cfg-r" value="${repoId}" placeholder="repo-id">
  </div>
</div>

<script nonce="${nonce}">
(function(){
'use strict';
const vsc = acquireVsCodeApi();
const $ = id => document.getElementById(id);

const ST = {
  msgs: [],
  ctxNode: null,
  loading: false,
  gNodes: [],
  mentionSearch: null,
  mentionIdx: 0,
  get serverUrl(){ return $('cfg-s').value.trim(); },
  get repoId(){    return $('cfg-r').value.trim(); },
};

const KIND_COLOR = {
  folder:'var(--vscode-charts-purple,#b180d7)',
  file:'var(--vscode-charts-blue,#75beff)',
  'class':'var(--vscode-charts-yellow,#e9c46a)',
  fn:'var(--vscode-charts-green,#89d185)',
};

// ── Context node ─────────────────────────────────────────────────
function setCtx(node){
  ST.ctxNode=node;
  const cn=$('ctx-node'), ce=$('ctx-empty');
  if(node){
    cn.classList.add('show'); ce.style.display='none';
    const col=KIND_COLOR[node._k||'file']||KIND_COLOR.file;
    $('ctx-badge').style.background=col+'33'; $('ctx-badge').style.color=col;
    $('ctx-badge').textContent=node._k||'node';
    $('ctx-name').textContent=node._lbl||node.id||'';
  } else {
    cn.classList.remove('show'); ce.style.display='';
  }
}
$('ctx-clear').addEventListener('click',()=>setCtx(null));

// ── Render messages ───────────────────────────────────────────────
function renderMsgs(){
  const el=$('msgs'), empty=$('empty');
  if(!ST.msgs.length&&!ST.loading){ empty.style.display=''; return; }
  empty.style.display='none';
  // rebuild
  const nodes=el.querySelectorAll('.msg');
  nodes.forEach(n=>n.remove());
  el.querySelector('.typing')?.remove();

  for(const m of ST.msgs){
    const div=document.createElement('div');
    div.className='msg '+(m.role==='user'?'user':m.error?'err':'bot');
    div.textContent=m.text;
    if(m.role==='bot'&&m.files?.length){
      const cf=document.createElement('div'); cf.className='ctx-files';
      cf.innerHTML='<div class="cf-lbl">Context files</div>'+m.files.map(f=>'<div class="cf-item">'+escHtml(f)+'</div>').join('');
      div.appendChild(cf);
    }
    el.appendChild(div);
  }
  if(ST.loading){
    const t=document.createElement('div'); t.className='msg bot';
    t.innerHTML='<div class="typing"><span></span><span></span><span></span></div>';
    el.appendChild(t);
  }
  el.scrollTop=el.scrollHeight;
}

function addMsg(m){ ST.msgs.push({id:Date.now()+Math.random(),...m}); renderMsgs(); }
function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Send ─────────────────────────────────────────────────────────
async function send(rawText){
  rawText=(rawText||$('chat-ta').value).trim();
  if(!rawText||ST.loading) return;
  if(!ST.repoId){ addMsg({role:'bot',text:'Please set a Repo ID in the settings below.',error:true}); return; }

  $('chat-ta').value=''; hideMention();
  $('embed-notice').style.display='none';
  const {clean,mentioned}=parseMentions(rawText);
  addMsg({role:'user',text:rawText});
  ST.loading=true; $('btn-send').disabled=true;
  renderMsgs();

  const body={
    repoId:ST.repoId, question:clean,
    ...(ST.ctxNode?{contextNodeId:ST.ctxNode.id,contextNodeLabel:ST.ctxNode._lbl}:{}),
    ...(mentioned.length?{mentionedNodes:mentioned}:{}),
  };

  try{
    const res=await fetch(ST.serverUrl+'/graphrag/ask',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok||data.ok===false){
      const errMsg=data.error||'HTTP '+res.status;
      // Detect embedding error and show notice
      if(errMsg.toLowerCase().includes('chunk')||errMsg.toLowerCase().includes('embed')||errMsg.toLowerCase().includes('summar')){
        $('embed-notice').style.display='';
      }
      throw new Error(errMsg);
    }
    const files=(data.sources||[]).map(s=>s.file).filter(Boolean);
    addMsg({role:'bot',text:data.answer||'No answer returned.',files:[...new Set(files)]});
  }catch(err){
    addMsg({role:'bot',text:'Error: '+err.message,error:true});
  }finally{
    ST.loading=false; $('btn-send').disabled=false; renderMsgs();
  }
}

// ── Mentions ──────────────────────────────────────────────────────
function parseMentions(text){
  const mentioned=[];
  const clean=text.replace(/@(\w+)/g,(match,name)=>{
    const found=ST.gNodes.find(n=>(n._lbl||'').replace(/\s+/g,'_')===name||(n._path||'').includes(name));
    if(found){ mentioned.push({id:found.id,name:found._lbl,path:found._path||''}); return '[Node: '+found._lbl+']'; }
    return match;
  });
  return {clean,mentioned};
}
function getMatches(q){
  const lo=(q||'').toLowerCase();
  return ST.gNodes.filter(n=>(n._lbl||'').toLowerCase().includes(lo)||(n._path||'').toLowerCase().includes(lo)).slice(0,8);
}
function showMention(matches){
  if(!matches.length){hideMention();return;}
  const dd=$('mention-dd');
  dd.innerHTML=matches.map((n,i)=>'<div class="mi'+(i===ST.mentionIdx?' sel':'')+'" data-i="'+i+'"><span class="mk-dot" style="background:'+(KIND_COLOR[n._k||'file']||KIND_COLOR.file)+'"></span><span class="mn">'+(n._lbl||n.id||'')+'</span><span class="mp">'+(n._path||'')+'</span></div>').join('');
  dd.classList.add('show');
  dd.querySelectorAll('.mi').forEach(m=>m.addEventListener('click',()=>insertMention(matches[parseInt(m.dataset.i)])));
}
function hideMention(){ ST.mentionSearch=null; ST.mentionIdx=0; $('mention-dd').classList.remove('show'); }
function insertMention(n){
  const ta=$('chat-ta'), val=ta.value, at=val.lastIndexOf('@');
  if(at===-1) return;
  ta.value=val.slice(0,at)+'@'+(n._lbl||n.id||'').replace(/\s+/g,'_')+' ';
  hideMention(); ta.focus();
}

$('chat-ta').addEventListener('input',ev=>{
  const val=ev.target.value;
  const before=val.slice(0,ev.target.selectionStart||val.length);
  const m=before.match(/@(\w*)$/);
  if(m){ ST.mentionSearch=m[1]; showMention(getMatches(m[1])); }
  else hideMention();
});
$('chat-ta').addEventListener('keydown',ev=>{
  const dd=$('mention-dd');
  if(dd.classList.contains('show')){
    const matches=getMatches(ST.mentionSearch||'');
    if(ev.key==='ArrowDown'){ev.preventDefault();ST.mentionIdx=Math.min(ST.mentionIdx+1,matches.length-1);showMention(matches);return;}
    if(ev.key==='ArrowUp'){ev.preventDefault();ST.mentionIdx=Math.max(ST.mentionIdx-1,0);showMention(matches);return;}
    if(ev.key==='Enter'||ev.key==='Tab'){ev.preventDefault();insertMention(matches[ST.mentionIdx]);return;}
    if(ev.key==='Escape'){hideMention();return;}
  }
  if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();send();}
});
$('btn-send').addEventListener('click',()=>send());

// Quick prompts
document.querySelectorAll('.qb').forEach(b=>b.addEventListener('click',()=>{$('chat-ta').value=b.dataset.p||'';$('chat-ta').focus();}));

// Embed fix button
$('btn-embed-fix').addEventListener('click',async()=>{
  const btn=$('btn-embed-fix'); btn.textContent='⏳ Embedding…'; btn.disabled=true;
  addMsg({role:'bot',text:'Starting embedding generation — this may take a few minutes…'});
  try{
    const res=await fetch(ST.serverUrl+'/graphrag/embedRepo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({repoId:ST.repoId,repoRoot:''})});
    const d=await res.json();
    if(d.ok!==false){ $('embed-notice').style.display='none'; addMsg({role:'bot',text:'✓ Embeddings generated! Try asking your question again.'}); }
    else addMsg({role:'bot',text:'Embedding failed: '+d.error,error:true});
  }catch(e){ addMsg({role:'bot',text:'Embedding error: '+e.message,error:true}); }
  btn.textContent='↑ Generate Embeddings Now'; btn.disabled=false;
});

// ── Extension messages ────────────────────────────────────────────
window.addEventListener('message',ev=>{
  const msg=ev.data;
  if(msg.type==='contextNode'){
    setCtx(msg.payload?.node);
    if(msg.payload?.allNodes) ST.gNodes=msg.payload.allNodes.map(n=>({...n,_path:n.properties?.relPath||n.properties?.filePath||n.properties?.path||''}));
  }
  if(msg.type==='graphNodes'){
    ST.gNodes=(msg.payload?.nodes||[]).map(n=>({...n,_path:n.properties?.relPath||n.properties?.filePath||n.properties?.path||''}));
  }
  if(msg.type==='settings/update'){
    const{serverUrl,repoId}=msg.payload||{};
    if(serverUrl) $('cfg-s').value=serverUrl;
    if(repoId)    $('cfg-r').value=repoId;
  }
  if(msg.type==='server/status'){
    const s=msg.payload||{};
    if(s.status==='stopped'||s.status==='error'){
      addMsg({role:'sys',text:s.status==='error'?'⚠ Backend error: '+(s.error||''):'Server stopped'});
    }
  }
});

// Persist settings on change
['cfg-s','cfg-r'].forEach(id=>document.getElementById(id).addEventListener('change',()=>{
  vsc.postMessage({type:'settings/save',payload:{serverUrl:$('cfg-s').value,repoId:$('cfg-r').value}});
}));

})();
</script>
</body>
</html>`;
}