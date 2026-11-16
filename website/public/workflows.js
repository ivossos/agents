// Workflows: builder + run "montage" (visual pipeline map with live status).
// Relies on globals from index.html: $, esc, cap, api, agents, drawer, closeD, banner, render, ago, fmtD, view.
window.WF = [];
let wfRuns = [], wfSel = null /* {id, step} */, wfLive = '';

const wfAgo = t => (typeof ago === 'function' ? ago(t) : '');
const stDur = s => s.startedAt ? fmtD(((s.endedAt || Date.now()) - s.startedAt) / 1000 | 0) : '';
const wfStatusClass = s => ({ pending: 'idle', skipped: 'idle', queued: 'queued' }[s] || s);

async function loadWf() {
  try { [window.WF, wfRuns] = await Promise.all([api('/workflows'), api('/wfruns')]); } catch (e) { banner(e.message); }
  render();
}

// ---- the montage: a left-to-right pipeline of steps ----
function montage(steps, { selected, clickable } = {}) {
  return `<div class="wf-map" role="list">` + steps.map((s, i) => {
    const st = s.status || 'pending';
    return `${i ? `<div class="wf-arrow ${st === 'running' || st === 'done' ? 'live' : ''}" aria-hidden="true"><svg width="34" height="14" viewBox="0 0 34 14"><path d="M0 7h28M22 1l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></div>` : ''}
    <button class="wf-node ${st} ${selected === i ? 'sel' : ''}" role="listitem" ${clickable ? `data-step="${i}"` : 'tabindex="-1"'}>
      <span class="wf-n">${i + 1}</span><b class="mono">${esc(s.agent)}</b>
      <span class="wf-s"><span class="dot ${wfStatusClass(st)}"></span>${st === 'pending' && !clickable ? 'step' : st}${stDur(s) ? ' · ' + stDur(s) : ''}</span>
    </button>`;
  }).join('') + `</div>`;
}

// ---- workflows view ----
window.wfRender = function () {
  const el = $('#viewWf'); if (!el) return;
  el.innerHTML = `<div class="row2" style="margin-bottom:14px"><span class="conn" style="flex:1">Chain agents into a pipeline — each step's output feeds the next.</span><button class="btn" id="wfNew">New workflow</button></div>
  <div class="wf-grid">${WF.map(w => `<section class="card wf-card"><div style="padding:14px"><div class="row2"><b style="flex:1;font-size:15px">${esc(w.name)}</b><span class="chip">${esc(w.mode)}</span></div>
    <p class="conn" style="margin:4px 0 12px">${esc(w.description)}</p>${montage(w.steps)}
    <div class="row2" style="margin-top:14px"><button class="btn" data-run="${w.id}">Run</button><button class="ghost" data-edit="${w.id}">Edit</button></div></div></section>`).join('') || '<div class="card empty">No workflows yet.</div>'}</div>
  <section class="card" style="margin-top:16px"><header><span>Workflow runs</span></header><div style="overflow:auto"><table><thead><tr><th>Workflow</th><th>Input</th><th>Status</th><th class="hide-s">Steps</th><th class="hide-s">Started</th></tr></thead><tbody>${wfRuns.map(r => `<tr class="row" data-wr="${r.id}"><td><b>${esc(r.name)}</b></td><td>${esc(r.input.slice(0, 70))}</td><td><span class="dot ${wfStatusClass(r.status)}"></span>${r.status}</td><td class="hide-s">${r.steps.filter(s => s.status === 'done').length}/${r.steps.length}</td><td class="hide-s" style="color:var(--mute)">${wfAgo(r.createdAt)}</td></tr>`).join('') || '<tr><td colspan=5 class="empty">No runs yet.</td></tr>'}</tbody></table></div></section>`;
  $('#wfNew').onclick = () => builder();
  el.querySelectorAll('[data-run]').forEach(b => b.onclick = () => runForm(b.dataset.run));
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => builder(b.dataset.edit));
  el.querySelectorAll('tr[data-wr]').forEach(r => r.onclick = () => monitor(r.dataset.wr));
};

// ---- run form ----
function runForm(id) {
  const w = WF.find(x => x.id === id); if (!w) return;
  drawer(`<button class="ghost" id="cl" style="float:right">Close</button><h2>${esc(w.name)}</h2><p>${esc(w.description)}</p>${montage(w.steps)}
  <h3 style="margin-top:18px;font-size:14px">Input</h3><textarea id="wfin" placeholder="What should this workflow work on? (available to steps as {{input}})"></textarea>
  <div class="row2"><select id="wfmode" aria-label="Permission mode"><option value="plan">Read-only (plan)</option><option value="acceptEdits">Allow file edits</option><option value="default">Default permissions</option></select><button class="btn" id="wfgo">Run workflow</button></div><div class="err hidden" id="wferr"></div>`);
  $('#drawer').classList.add('wide'); $('#cl').onclick = closeD; $('#wfmode').value = w.mode;
  $('#wfgo').onclick = async () => {
    const input = $('#wfin').value.trim(); if (!input) return; $('#wfgo').disabled = true;
    try { const r = await api('/wfruns', { method: 'POST', body: JSON.stringify({ workflow: id, input, mode: $('#wfmode').value }) }); wfUpsert(r); monitor(r.id); }
    catch (e) { const x = $('#wferr'); x.textContent = e.message; x.classList.remove('hidden'); $('#wfgo').disabled = false; }
  };
}

// ---- run monitor (the live montage) ----
function wfUpsert(r) { const i = wfRuns.findIndex(x => x.id === r.id); if (i >= 0) wfRuns[i] = r; else wfRuns.unshift(r); }
async function monitor(id, step) {
  let r = wfRuns.find(x => x.id === id);
  try { r = await api('/wfruns/' + id); wfUpsert(r); } catch (e) { return banner(e.message); }
  if (step === undefined) step = (wfSel && wfSel.id === id) ? wfSel.step : Math.max(0, r.steps.findIndex(s => s.status === 'running') >= 0 ? r.steps.findIndex(s => s.status === 'running') : r.steps.filter(s => s.status === 'done').length - 1);
  wfSel = { id, step }; paintMonitor(r);
}
async function paintMonitor(r) {
  const i = wfSel.step, s = r.steps[i], live = r.status === 'running' || r.status === 'queued';
  let out = s.output || '';
  if (!out && s.runId && (s.status === 'running' || s.status === 'failed' || s.status === 'cancelled')) { try { out = (await api('/runs/' + s.runId)).output || ''; } catch {} }
  if (!wfSel || wfSel.id !== r.id || wfSel.step !== i) return; // user moved on while fetching
  wfLive = out;
  drawer(`<button class="ghost" id="cl" style="float:right">Close</button><h2>${esc(r.name)}</h2>
  <div style="color:var(--mute)"><span class="dot ${wfStatusClass(r.status)}"></span>${r.status} · ${esc(r.mode)}${r.cost ? ` · $${r.cost.toFixed(3)}` : ''}</div>
  <h3 style="margin:14px 0 4px;font-size:13px;color:var(--mute)">Input</h3><div class="pre" style="max-height:90px">${esc(r.input)}</div>
  ${montage(r.steps, { selected: i, clickable: true })}
  ${r.error ? `<div class="err">${esc(r.error)}</div>` : ''}
  <h3 style="margin:14px 0 0;font-size:14px">Step ${i + 1} · <span class="mono">${esc(s.agent)}</span> <span class="conn">${s.status}</span></h3>
  <details><summary style="cursor:pointer;color:var(--mute);font-size:12px">Prompt sent</summary><div class="pre" style="max-height:140px">${esc(s.runId ? '' : s.prompt)}${s.runId ? 'Loading…' : ''}</div></details>
  <div class="pre" id="wfout">${esc(out) || '<span class="conn">No output yet.</span>'}</div>
  <div class="row2">${live ? '<button class="ghost" id="wfcancel">Cancel workflow</button>' : ''}<button class="ghost" id="wfagain">Run again</button></div>`);
  $('#drawer').classList.add('wide'); $('#cl').onclick = closeD;
  document.querySelectorAll('.wf-node[data-step]').forEach(b => b.onclick = () => { wfSel.step = +b.dataset.step; paintMonitor(wfRuns.find(x => x.id === r.id)); });
  const c = $('#wfcancel'); if (c) c.onclick = () => api('/wfruns/' + r.id + '/cancel', { method: 'POST' }).catch(e => banner(e.message));
  $('#wfagain').onclick = () => runForm(r.workflowId);
  if (s.runId) api('/runs/' + s.runId).then(x => { const d = document.querySelector('details .pre'); if (d && wfSel && wfSel.id === r.id && wfSel.step === i) d.textContent = x.task; }).catch(() => {});
  const o = $('#wfout'); if (o) o.scrollTop = o.scrollHeight;
}
window.wfClosed = () => { wfSel = null; };

// ---- builder ----
function builder(id) {
  const w = id ? JSON.parse(JSON.stringify(WF.find(x => x.id === id))) : { name: '', description: '', mode: 'plan', steps: [{ agent: agents[0]?.id, prompt: '{{input}}' }, { agent: agents[1]?.id, prompt: "Continue from the previous step's output:\n\n{{prev}}" }] };
  const opts = sel => agents.map(a => `<option value="${esc(a.id)}" ${a.id === sel ? 'selected' : ''}>${esc(a.id)} · ${esc(cap(a.dept))}</option>`).join('');
  const paint = () => {
    drawer(`<button class="ghost" id="cl" style="float:right">Close</button><h2>${id ? 'Edit' : 'New'} workflow</h2>
    <label class="conn">Name</label><input id="bn" class="in" value="${esc(w.name)}" maxlength="100"><label class="conn">Description</label><input id="bd" class="in" value="${esc(w.description)}" maxlength="300">
    <label class="conn">Permission mode</label><select id="bm"><option value="plan">Read-only (plan)</option><option value="acceptEdits">Allow file edits</option><option value="default">Default permissions</option></select>
    <p class="conn" style="margin:12px 0 4px">Use <code class="mono">{{input}}</code>, <code class="mono">{{prev}}</code> or <code class="mono">{{step1}}</code>… in prompts.</p>
    ${w.steps.map((s, i) => `<div class="wf-step"><div class="row2"><span class="wf-n">${i + 1}</span><select data-a="${i}" style="flex:1">${opts(s.agent)}</select>
      <button class="ghost" data-up="${i}" ${i ? '' : 'disabled'} aria-label="Move up">↑</button><button class="ghost" data-dn="${i}" ${i < w.steps.length - 1 ? '' : 'disabled'} aria-label="Move down">↓</button><button class="ghost" data-rm="${i}" ${w.steps.length > 1 ? '' : 'disabled'} aria-label="Remove step">✕</button></div>
      <textarea data-p="${i}" aria-label="Step ${i + 1} prompt">${esc(s.prompt)}</textarea></div>`).join('')}
    <div class="row2"><button class="ghost" id="badd" ${w.steps.length >= 12 ? 'disabled' : ''}>+ Add step</button><span style="flex:1"></span>${id ? '<button class="ghost" id="bdel">Delete</button>' : ''}<button class="btn" id="bsave">Save</button></div><div class="err hidden" id="berr"></div>`);
    $('#drawer').classList.add('wide'); $('#bm').value = w.mode; $('#cl').onclick = closeD;
    const sync = () => { w.name = $('#bn').value; w.description = $('#bd').value; w.mode = $('#bm').value; document.querySelectorAll('[data-a]').forEach(e => w.steps[+e.dataset.a].agent = e.value); document.querySelectorAll('[data-p]').forEach(e => w.steps[+e.dataset.p].prompt = e.value); };
    const on = (sel, fn) => document.querySelectorAll(sel).forEach(e => e.onclick = () => { sync(); fn(e); paint(); });
    on('[data-up]', e => { const i = +e.dataset.up;[w.steps[i - 1], w.steps[i]] = [w.steps[i], w.steps[i - 1]]; });
    on('[data-dn]', e => { const i = +e.dataset.dn;[w.steps[i + 1], w.steps[i]] = [w.steps[i], w.steps[i + 1]]; });
    on('[data-rm]', e => w.steps.splice(+e.dataset.rm, 1));
    $('#badd').onclick = () => { sync(); w.steps.push({ agent: agents[0]?.id, prompt: "Continue from the previous step's output:\n\n{{prev}}" }); paint(); };
    $('#bsave').onclick = async () => {
      sync();
      try { const saved = await api(id ? '/workflows/' + id : '/workflows', { method: id ? 'PUT' : 'POST', body: JSON.stringify(w) }); await loadWf(); closeD(); }
      catch (e) { const x = $('#berr'); x.textContent = e.message; x.classList.remove('hidden'); }
    };
    const d = $('#bdel'); if (d) d.onclick = async () => { if (!confirm('Delete this workflow? Past runs are kept.')) return; try { await api('/workflows/' + id, { method: 'DELETE' }); await loadWf(); closeD(); } catch (e) { banner(e.message); } };
  };
  paint();
}

// ---- live updates ----
function hook(es) {
  es.addEventListener('wfrun', e => {
    const r = JSON.parse(e.data); wfUpsert(r);
    if (view === 'workflows') wfRender();
    if (wfSel && wfSel.id === r.id) paintMonitor(r);
  });
  es.addEventListener('chunk', e => { // stream the selected step's output
    const c = JSON.parse(e.data), r = wfSel && wfRuns.find(x => x.id === wfSel.id), s = r && r.steps[wfSel.step];
    if (s && s.runId === c.id) { const o = $('#wfout'); if (o) { wfLive += c.text; o.textContent = wfLive; o.scrollTop = o.scrollHeight; } }
  });
}
if (window.es) hook(window.es); else window.addEventListener('es', e => hook(e.detail));

// ---- styles ----
const st = document.createElement('style');
st.textContent = `.wf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px}
.wf-map{display:flex;align-items:stretch;gap:0;flex-wrap:nowrap;overflow-x:auto;padding-bottom:6px;margin:8px 0}
.wf-arrow{flex:none;display:flex;align-items:center;color:var(--line);padding:0 2px}.wf-arrow.live{color:var(--accent)}
.wf-node{font:inherit;color:var(--text);text-align:left;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;gap:2px;min-width:96px;flex:none;position:relative}
button.wf-node[data-step]{cursor:pointer}.wf-node.sel{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.wf-node.running{border-color:var(--run)}.wf-node.done{border-color:var(--ok)}.wf-node.failed{border-color:var(--err)}
.wf-node.skipped,.wf-node.cancelled{opacity:.55}
.wf-node b{font-size:12px}.wf-s{font-size:11px;color:var(--mute)}
.wf-n{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--line);font-size:11px;font-weight:700;flex:none}
.wf-step{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:10px;margin:8px 0}
.wf-step textarea{min-height:70px;margin:8px 0 0}
.in{width:100%;background:var(--panel2);border:1px solid var(--line);border-radius:8px;color:var(--text);padding:8px 10px;font:inherit;margin:4px 0 10px}
.drawer label{display:block}.drawer code{background:var(--panel2);padding:1px 5px;border-radius:4px}`;
document.head.appendChild(st);
loadWf();
