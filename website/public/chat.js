// Chat with an agent — each conversation is a chain of runs sharing one Claude session (--resume).
(function(){
let cur=null; // {agent, chat, mode, msgs:[]}
const css=document.createElement('style');css.textContent=`
.chat{display:flex;flex-direction:column;height:calc(100vh - 40px)}
.chat-h{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding-bottom:12px;border-bottom:1px solid var(--line)}
.chat-h h2{font-size:18px;margin-right:auto}
.chat-log{flex:1;overflow:auto;padding:16px 2px;display:flex;flex-direction:column;gap:12px}
.cb{max-width:86%;padding:10px 13px;border-radius:14px;white-space:pre-wrap;word-break:break-word;line-height:1.5}
.cb.u{align-self:flex-end;background:var(--accent);color:#fff;border-bottom-right-radius:4px}
.cb.a{align-self:flex-start;background:var(--panel2);border:1px solid var(--line);border-bottom-left-radius:4px}
.cb.a.f{border-color:var(--err)}
.cb .tl{display:block;font:11.5px ui-monospace,Menlo,monospace;color:var(--mute);margin:2px 0}
.cb .meta{display:block;font-size:11px;color:var(--mute);margin-top:6px}
.cb code{font:12.5px ui-monospace,Menlo,monospace;background:var(--line);padding:1px 4px;border-radius:4px}
.typing{color:var(--mute);font-size:13px}
.chat-in{display:flex;gap:8px;align-items:flex-end;border-top:1px solid var(--line);padding-top:12px}
.chat-in textarea{min-height:46px;max-height:180px;margin:0;resize:none}
.chat-hist{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.chat-empty{margin:auto;color:var(--mute);text-align:center;max-width:380px}
.chat-sug{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:12px}`;
document.head.appendChild(css);

const md=t=>esc(t).replace(/`([^`\n]+)`/g,'<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g,'<b>$1</b>');
function bubbleA(m){
  const live=m.status==='running'||m.status==='queued';
  const lines=(m.output||'').split('\n');
  const tools=lines.filter(l=>l.startsWith('▸ ')).map(l=>l.slice(2));
  const text=m.reply||lines.filter(l=>!l.startsWith('▸ ')).join('\n').trim();
  const meta=[m.status==='queued'?'waiting for a free slot…':'',m.status==='cancelled'?'stopped':'',m.cost?'$'+m.cost.toFixed(3):'',m.startedAt&&m.endedAt?fmtD(((m.endedAt-m.startedAt)/1000)|0):''].filter(Boolean).join(' · ');
  return `<div class="cb a ${m.status==='failed'?'f':''}" data-run="${m.id}">${tools.length?tools.map(t=>`<span class="tl">▸ ${esc(t)}</span>`).join(''):''}${text?md(text):live?'<span class="typing">thinking…</span>':''}${m.error?`<span class="meta" style="color:var(--err)">${esc(m.error)}</span>`:''}${meta?`<span class="meta">${esc(meta)}</span>`:''}</div>`}
function chatsOf(agent){const seen=new Map();runs.filter(r=>r.agent===agent&&r.chat).forEach(r=>{const c=seen.get(r.chat);if(!c||r.createdAt<c.createdAt)seen.set(r.chat,r)});return[...seen.values()].sort((a,b)=>b.createdAt-a.createdAt)}
function busy(){return cur&&cur.msgs.some(m=>m.status==='running'||m.status==='queued')}
function paint(keepInput){
  if(!cur)return;if(keepInput&&!$('#chLog')){cur=null;return}const a=agents.find(x=>x.id===cur.agent)||{id:cur.agent,desc:''};
  const draft=keepInput&&$('#chIn')?$('#chIn').value:'';
  const old=chatsOf(cur.agent).filter(r=>r.chat!==cur.chat).slice(0,6);
  drawer(`<div class="chat"><div class="chat-h"><h2 class="mono">💬 ${esc(a.id)}</h2>
   <select id="chMode" aria-label="Permission mode"><option value="plan">Read-only (plan)</option><option value="acceptEdits">Allow file edits</option><option value="default">Default permissions</option></select>
   <button class="ghost" id="chNew">New chat</button><button class="ghost" id="chAg">Agent</button><button class="ghost" id="cl">Close</button></div>
   ${old.length?`<div class="chat-hist"><span class="conn">Earlier chats:</span>${old.map(r=>`<button class="chip" data-chat="${r.chat}">${esc(r.task.slice(0,34))}${r.task.length>34?'…':''}</button>`).join('')}</div>`:''}
   <div class="chat-log" id="chLog">${cur.msgs.length?cur.msgs.map(m=>`<div class="cb u">${md(m.task)}</div>${bubbleA(m)}`).join(''):`<div class="chat-empty">Start a conversation with <b class="mono">${esc(a.id)}</b>. It remembers everything said in this chat.<div class="chat-sug">${['What can you help me with?','What tools do you have?','Suggest a first task for you'].map(s=>`<button class="chip" data-sug>${s}</button>`).join('')}</div></div>`}</div>
   <div class="err hidden" id="chErr"></div>
   <div class="chat-in"><textarea id="chIn" placeholder="Message ${esc(a.id)}… (Enter to send, Shift+Enter for a new line)"></textarea>${busy()?'<button class="ghost" id="chStop">Stop</button>':'<button class="btn" id="chSend">Send</button>'}</div></div>`);
  $('#drawer').classList.add('wide');
  $('#chMode').value=cur.mode;$('#chMode').onchange=e=>cur.mode=e.target.value;
  $('#cl').onclick=closeD;$('#chAg').onclick=()=>{cur=null;showAgent(a.id)};
  $('#chNew').onclick=()=>{cur={agent:a.id,chat:null,mode:cur.mode,msgs:[]};paint()};
  document.querySelectorAll('#drawer [data-chat]').forEach(b=>b.onclick=()=>openChat(a.id,b.dataset.chat));
  document.querySelectorAll('#drawer [data-sug]').forEach(b=>b.onclick=()=>send(b.textContent));
  const i=$('#chIn');i.value=draft;i.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(i.value)}};
  i.oninput=()=>{i.style.height='auto';i.style.height=Math.min(i.scrollHeight,180)+'px'};
  const s=$('#chSend');if(s)s.onclick=()=>send(i.value);
  const st=$('#chStop');if(st)st.onclick=()=>{const m=cur.msgs.find(x=>x.status==='running'||x.status==='queued');m&&api('/runs/'+m.id+'/cancel',{method:'POST'}).catch(e=>banner(e.message))};
  const l=$('#chLog');l.scrollTop=l.scrollHeight;i.focus()}
async function send(text){text=(text||'').trim();if(!text||!cur||busy())return;
  try{const r=await api('/chat',{method:'POST',body:JSON.stringify({agent:cur.agent,chat:cur.chat||undefined,message:text,mode:cur.mode})});
    cur.chat=r.chat;cur.msgs.push({...r,output:'',reply:''});if(!runs.some(x=>x.id===r.id))runs.unshift(r);paint()}
  catch(e){const x=$('#chErr');if(x){x.textContent=e.message;x.classList.remove('hidden')}}}
async function openChat(agent,chat){
  openRun=null;openAgent=null;
  cur={agent,chat:chat||null,mode:(cur&&cur.mode)||'plan',msgs:[]};
  if(chat){try{const c=await api('/chats/'+chat);cur.msgs=c.messages;const l=c.messages[c.messages.length-1];if(l&&l.mode)cur.mode=l.mode}catch(e){banner(e.message)}}
  paint()}
window.openChat=openChat;
window.chatClosed=()=>{cur=null};
function hook(es){
  es.addEventListener('run',e=>{if(!cur)return;const r=JSON.parse(e.data);const m=cur.msgs.find(x=>x.id===r.id);if(!m)return;
    Object.assign(m,r);
    if(r.status==='done'||r.status==='failed'||r.status==='cancelled'){api('/runs/'+r.id).then(full=>{Object.assign(m,{output:full.output||m.output,reply:r.status==='done'?(full.final||'').trim():''});paint(true)}).catch(()=>paint(true))}
    else paint(true)});
  es.addEventListener('chunk',e=>{if(!cur)return;const c=JSON.parse(e.data);const m=cur.msgs.find(x=>x.id===c.id);if(!m)return;m.output=(m.output||'')+c.text;
    const el=document.querySelector(`#chLog [data-run="${c.id}"]`);if(el){el.outerHTML=bubbleA(m);const l=$('#chLog');l.scrollTop=l.scrollHeight}});
}
if(window.es)hook(window.es);
window.addEventListener('es',e=>hook(e.detail));
})();
