// Agents Control Center — zero-dependency server.
// Reads agent definitions from the repo, dispatches tasks via the `claude` CLI,
// persists run history and streams updates to the browser over SSE.
const http = require('http'), fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';          // localhost only by default
const REPO = path.resolve(process.env.AGENTS_DIR || path.join(__dirname, '..'));
const WORKDIR = path.resolve(process.env.WORKDIR || REPO); // where agents run
const CLAUDE = process.env.CLAUDE_BIN || 'claude';
const MAX_PARALLEL = +process.env.MAX_PARALLEL || 4;
const RUN_TIMEOUT_MS = Math.round((process.env.RUN_TIMEOUT_MIN !== undefined ? +process.env.RUN_TIMEOUT_MIN : 15) * 60000); // 0 disables
const MAX_OUTPUT = Math.round((+process.env.MAX_OUTPUT_KB || 256) * 1024);   // stored/streamed chars per run
const KILL_GRACE_MS = +process.env.KILL_GRACE_MS || 5000;                    // SIGTERM → SIGKILL
const MAX_LINE = 8 * 1024 * 1024, MAX_PROMPT = 100000;
const TOKEN = process.env.CONTROL_TOKEN || '';          // optional bearer token
const DATA = path.join(__dirname, 'data', 'runs.json');
const PUB = path.join(__dirname, 'public');
const SKIP = new Set(['website', 'node_modules']);
const MODES = ['plan', 'acceptEdits', 'default'];

// ---------- agents ----------
function parseAgent(file, dept) {
  const t = fs.readFileSync(file, 'utf8');
  const m = t.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) {
    // No frontmatter: derive the agent from the filename and the markdown body.
    const para = (t.split(/^## Description\s*$/m)[1] || t).split(/\r?\n/).map(l => l.trim()).find(l => l && !l.startsWith('#'));
    return { id: path.basename(file, '.md'), dept, desc: (para || '').slice(0, 400), color: 'gray', tools: [], prompt: t.trim(), file: path.relative(REPO, file) };
  }
  const fm = {};
  m[1].split(/\r?\n/).forEach(l => { const k = l.match(/^(\w+):\s*(.*)$/); if (k) fm[k[1]] = k[2]; });
  if (!fm.name) return null;
  const desc = (fm.description || '').split(/\\n|\s+Examples:/)[0].trim();
  return {
    id: fm.name.trim(), dept, desc, color: (fm.color || 'gray').trim(),
    tools: fm.tools ? fm.tools.split(',').map(s => s.trim()).filter(Boolean) : [],
    prompt: m[2].trim(), file: path.relative(REPO, file),
  };
}
function loadAgents() {
  const out = [];
  for (const d of fs.readdirSync(REPO, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith('.') || SKIP.has(d.name)) continue;
    for (const f of fs.readdirSync(path.join(REPO, d.name)))
      if (f.endsWith('.md')) { try { const a = parseAgent(path.join(REPO, d.name, f), d.name); if (a) out.push(a); } catch {} }
  }
  return out.sort((a, b) => a.dept.localeCompare(b.dept) || a.id.localeCompare(b.id));
}

// ---------- runs ----------
let runs = [];
try { runs = JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch {}
// Runs that were live when the server last stopped can't still be running.
runs.forEach(r => { if (r.status === 'running' || r.status === 'queued') { r.status = 'failed'; r.error = 'Server restarted'; r.endedAt = Date.now(); } });
const procs = new Map(), queue = [], waiters = new Map(), timers = new Map(); // timers kept off the run objects (they get serialised)
let saveT;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => {
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  fs.writeFileSync(DATA + '.tmp', JSON.stringify(runs.slice(-500), (k, v) => (k === 'output' || k === 'final') && typeof v === 'string' ? v.slice(0, 100000) : v)); fs.renameSync(DATA + '.tmp', DATA); }, 200); };
const clients = new Set();
const emit = (type, data) => { const s = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`; clients.forEach(c => c.write(s)); };
const brief = r => ({ ...r, output: undefined, final: undefined, outputLen: (r.output || '').length });

// Never hand the control-center's own secret to agent subprocesses.
const childEnv = () => { const e = { ...process.env }; delete e.CONTROL_TOKEN; return e; };

function pump() {
  while (procs.size < MAX_PARALLEL && queue.length) start(queue.shift());
}
function start(run) {
  const agent = loadAgents().find(a => a.id === run.agent);
  if (!agent) { run.status = 'failed'; run.error = 'Agent no longer exists'; run.endedAt = Date.now(); save(); return emit('run', brief(run)); }
  const def = { [agent.id]: { description: agent.desc || agent.id, prompt: agent.prompt } };
  const args = ['-p', run.task, '--agents', JSON.stringify(def), '--agent', agent.id,
    '--output-format', 'stream-json', '--verbose', '--permission-mode', run.mode];
  if (agent.tools.length) args.push('--allowedTools', agent.tools.join(','));
  run.status = 'running'; run.startedAt = Date.now(); emit('run', brief(run));
  let child;
  try { child = spawn(CLAUDE, args, { cwd: WORKDIR, stdio: ['ignore', 'pipe', 'pipe'], env: childEnv(), detached: true }); } // own process group so the whole tree can be killed
  catch (e) { return finish(run, 'failed', e.message); }
  procs.set(run.id, child);
  if (RUN_TIMEOUT_MS > 0) timers.set(run.id, { t: setTimeout(() => { run.timedOut = true; stopRun(run); }, RUN_TIMEOUT_MS) });
  let buf = '', err = '';
  const onLine = line => {
    let j; try { j = JSON.parse(line); } catch { return; }
    if (j.type === 'assistant' && j.message && Array.isArray(j.message.content)) {
      for (const c of j.message.content) {
        if (c.type === 'text') append(run, c.text + '\n');
        else if (c.type === 'tool_use') append(run, `▸ ${c.name}\n`);
      }
    } else if (j.type === 'result') {
      run.cost = j.total_cost_usd; run.isError = !!j.is_error; if (typeof j.result === 'string') run.final = j.result.slice(0, MAX_OUTPUT);
      if (j.is_error && j.result) run.error = String(j.result).slice(0, 500);
    }
  };
  child.stdout.on('data', d => { buf += d; if (buf.length > MAX_LINE) buf = ''; let i; while ((i = buf.indexOf('\n')) >= 0) { onLine(buf.slice(0, i)); buf = buf.slice(i + 1); } });
  child.stderr.on('data', d => { err = (err + d).slice(-2000); });
  child.on('error', e => finish(run, 'failed', e.code === 'ENOENT' ? `'${CLAUDE}' CLI not found` : e.message));
  child.on('close', code => {
    if (buf.trim()) onLine(buf);
    if (run.status === 'cancelled') return finish(run, 'cancelled');
    if (run.timedOut) return finish(run, 'failed', `Timed out after ${fmtMs(RUN_TIMEOUT_MS)} and was stopped`);
    if (code === 0 && !run.isError) finish(run, 'done');
    else finish(run, 'failed', run.error || err.trim().slice(-500) || `exited with code ${code}`);
  });
}
const fmtMs = ms => ms >= 60000 ? +(ms / 60000).toFixed(1) + ' min' : Math.round(ms / 1000) + ' s';
// Append to a run's output, enforcing the cap (excess is dropped once, with a visible marker).
function append(run, text) {
  if (run.truncated) return;
  const room = MAX_OUTPUT - run.output.length;
  if (text.length > room) { text = text.slice(0, Math.max(0, room)) + `\n[output truncated at ${Math.round(MAX_OUTPUT / 1024)} KB]\n`; run.truncated = true; }
  run.output += text; emit('chunk', { id: run.id, text });
}
// Stop a running process and everything it spawned: SIGTERM first, SIGKILL if it ignores it.
function killTree(child, sig) { try { process.kill(-child.pid, sig); } catch { try { child.kill(sig); } catch {} } }
function stopRun(run) {
  const child = procs.get(run.id); if (!child) return;
  killTree(child, 'SIGTERM');
  const tm = timers.get(run.id) || {}; timers.set(run.id, tm); clearTimeout(tm.t);
  tm.k = setTimeout(() => {
    killTree(child, 'SIGKILL');
    // Safety net: if 'close' still never fires, free the slot anyway.
    tm.k = setTimeout(() => { if (procs.has(run.id)) finish(run, run.timedOut && run.status !== 'cancelled' ? 'failed' : 'cancelled', run.timedOut ? 'Timed out and was force-killed' : undefined); }, 3000);
  }, KILL_GRACE_MS);
}
function finish(run, status, error) {
  if (run.endedAt && run.status !== 'running') return;
  const tm = timers.get(run.id); if (tm) { clearTimeout(tm.t); clearTimeout(tm.k); timers.delete(run.id); }
  procs.delete(run.id); run.status = status; run.endedAt = Date.now(); if (error) run.error = error;
  save(); emit('run', brief(run));
  const w = waiters.get(run.id); if (w) { waiters.delete(run.id); w(run); }
  pump();
}
function createRun(agent, task, mode, meta) {
  const run = { id: crypto.randomBytes(5).toString('hex'), agent, task, mode, status: 'queued', createdAt: Date.now(), output: '', ...(meta || {}) };
  runs.push(run); queue.push(run); save(); emit('run', brief(run)); pump(); return run;
}

function cancelRun(r) {
  if (r.status === 'queued') { queue.splice(queue.indexOf(r), 1); finish(r, 'cancelled'); }
  else if (r.status === 'running') { r.status = 'cancelled'; stopRun(r); }
}

// ---------- workflows ----------
const WF_FILE = path.join(__dirname, 'data', 'workflows.json'), WFR_FILE = path.join(__dirname, 'data', 'wfruns.json');
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(v)); fs.renameSync(f + '.tmp', f); };
const S = (agent, prompt) => ({ agent, prompt });
let workflows = readJson(WF_FILE, null) || [
  { id: 'idea-to-plan', name: 'Idea → sprint plan', description: 'Research a product idea, prioritise a 6-day scope, then outline the build.', mode: 'plan', steps: [
    S('trend-researcher', 'Research current trends and opportunities relevant to this idea and summarise the strongest angles:\n\n{{input}}'),
    S('sprint-prioritizer', 'Prioritise features for a 6-day sprint based on this research. Be explicit about what is cut.\n\n{{prev}}'),
    S('rapid-prototyper', 'Write a concise implementation plan (no code) for this sprint scope:\n\n{{prev}}')] },
  { id: 'design-review', name: 'Design review', description: 'User research, UI direction, then a brand consistency check.', mode: 'plan', steps: [
    S('ux-researcher', 'Identify the key user needs and friction points for:\n\n{{input}}'),
    S('ui-designer', 'Propose UI direction that addresses these findings:\n\n{{prev}}'),
    S('brand-guardian', 'Review this UI direction for brand consistency and list concrete fixes:\n\n{{prev}}')] },
  { id: 'launch-content', name: 'Launch content', description: 'Growth angles, long-form content, then social posts.', mode: 'plan', steps: [
    S('growth-hacker', 'Suggest 3 growth angles for launching:\n\n{{input}}'),
    S('content-creator', 'Write a short launch article using the strongest angle:\n\n{{prev}}'),
    S('twitter-engager', 'Turn this article into a thread of 5 tweets:\n\n{{prev}}')] },
].map(w => ({ ...w, steps: w.steps.map(x => ({ ...x })) }));
let wfruns = readJson(WFR_FILE, []);
wfruns.forEach(w => { if (w.status === 'running') { w.status = 'failed'; w.error = 'Server restarted'; w.endedAt = Date.now(); w.steps.forEach(s => { if (s.status === 'running' || s.status === 'pending') s.status = s.status === 'running' ? 'failed' : 'skipped'; }); } });
const saveWf = () => writeJson(WF_FILE, workflows), saveWfr = () => writeJson(WFR_FILE, wfruns.slice(-200));
const wfActive = new Map();
const emitWf = w => { saveWfr(); emit('wfrun', w); };
const tpl = (t, c) => t.replace(/\{\{\s*(input|prev|step(\d+))\s*\}\}/g, (_, k, n) => k === 'input' ? c.input : k === 'prev' ? c.prev : (c.steps[n - 1] || ''));
const outputOf = r => (r.final || (r.output || '').split('\n').filter(l => !l.startsWith('▸ ')).join('\n')).trim();

function cleanWorkflow(b, id) {
  if (!b || typeof b.name !== 'string' || !b.name.trim() || b.name.length > 100) throw new Error('Name is required (max 100 chars)');
  if (!Array.isArray(b.steps) || !b.steps.length || b.steps.length > 12) throw new Error('A workflow needs 1–12 steps');
  const known = new Set(loadAgents().map(a => a.id));
  const steps = b.steps.map((s, i) => {
    if (!s || !known.has(s.agent)) throw new Error(`Step ${i + 1}: unknown agent`);
    let p = typeof s.prompt === 'string' ? s.prompt.trim() : '';
    if (p.length > 8000) throw new Error(`Step ${i + 1}: prompt too long`);
    if (!p) p = i === 0 ? '{{input}}' : "Continue from the previous step's output:\n\n{{prev}}";
    return { agent: s.agent, prompt: p };
  });
  return { id, name: b.name.trim(), description: String(b.description || '').slice(0, 300), mode: MODES.includes(b.mode) ? b.mode : 'plan', steps };
}

const capPrompt = t => t.length > MAX_PROMPT ? t.slice(0, MAX_PROMPT) + '\n\n[truncated: previous output was too long]' : t;
async function execWf(w) {
  const ctl = { cancelled: false, runId: null }; wfActive.set(w.id, ctl);
  w.status = 'running'; w.startedAt = Date.now(); emitWf(w);
  const outs = []; let prev = w.input;
  try {
    for (let i = 0; i < w.steps.length && !ctl.cancelled; i++) {
      const st = w.steps[i];
      const run = createRun(st.agent, capPrompt(tpl(st.prompt, { input: w.input, prev, steps: outs })), w.mode, { wf: w.id, step: i });
      st.runId = run.id; st.status = 'running'; st.startedAt = Date.now(); ctl.runId = run.id; emitWf(w);
      const done = run.endedAt ? run : await new Promise(r => waiters.set(run.id, r));
      st.endedAt = Date.now(); st.status = done.status; st.cost = done.cost;
      if (done.status !== 'done') { w.error = `Step ${i + 1} (${st.agent}) ${done.status}${done.error ? ': ' + done.error : ''}`; break; }
      prev = outputOf(done); outs.push(prev); st.output = prev.slice(0, 30000); emitWf(w);
    }
  } catch (e) { w.error = e.message; }
  w.steps.forEach(s => { if (s.status === 'pending') s.status = 'skipped'; });
  if (ctl.cancelled) delete w.error;
  w.status = ctl.cancelled ? 'cancelled' : w.error ? 'failed' : 'done'; w.endedAt = Date.now();
  w.cost = w.steps.reduce((a, s) => a + (s.cost || 0), 0);
  wfActive.delete(w.id); emitWf(w);
}
function startWfRun(def, input) {
  const w = { id: crypto.randomBytes(5).toString('hex'), workflowId: def.id, name: def.name, input, mode: def.mode, status: 'queued', createdAt: Date.now(),
    steps: def.steps.map(s => ({ agent: s.agent, prompt: s.prompt, status: 'pending' })) };
  wfruns.push(w); emitWf(w); execWf(w); return w;
}

// ---------- http ----------
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const body = req => new Promise((ok, no) => { let b = ''; req.on('data', d => { b += d; if (b.length > 1e5) { req.destroy(); no(new Error('too large')); } }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { no(e); } }); });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = u.pathname;
  // Block cross-site/DNS-rebinding requests: Host must be local, Origin (if any) must match Host.
  const host = (req.headers.host || '').replace(/:\d+$/, '');
  const localOK = ['localhost', '127.0.0.1', '[::1]'].includes(host) || process.env.ALLOW_ANY_HOST;
  if (!localOK) { res.writeHead(403); return res.end('Forbidden host'); }
  if (req.headers.origin) {
    let oh = null; try { oh = new URL(req.headers.origin).host; } catch {}
    if (oh !== req.headers.host) { res.writeHead(403); return res.end('Forbidden origin'); }
  }
  if (p.startsWith('/api/')) {
    if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}` && u.searchParams.get('token') !== TOKEN) return json(res, 401, { error: 'Unauthorized' });
    try {
      if (p === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write('retry: 2000\n\n'); clients.add(res); req.on('close', () => clients.delete(res)); return;
      }
      if (p === '/api/config') return json(res, 200, { runTimeoutMs: RUN_TIMEOUT_MS, maxOutputKb: Math.round(MAX_OUTPUT / 1024), maxParallel: MAX_PARALLEL });
      if (p === '/api/agents' && req.method === 'GET') return json(res, 200, loadAgents().map(a => ({ ...a, prompt: undefined })));
      let m;
      if ((m = p.match(/^\/api\/agents\/([\w-]+)$/)) && req.method === 'GET') {
        const a = loadAgents().find(x => x.id === m[1]); return a ? json(res, 200, a) : json(res, 404, { error: 'Not found' });
      }
      if (p === '/api/runs' && req.method === 'GET') return json(res, 200, runs.slice(-200).reverse().map(brief));
      if (p === '/api/runs' && req.method === 'POST') {
        const b = await body(req);
        if (!loadAgents().some(a => a.id === b.agent)) return json(res, 400, { error: 'Unknown agent' });
        if (typeof b.task !== 'string' || !b.task.trim()) return json(res, 400, { error: 'Task is required' });
        const mode = MODES.includes(b.mode) ? b.mode : 'plan';
        return json(res, 201, brief(createRun(b.agent, b.task.trim().slice(0, 8000), mode)));
      }
      if ((m = p.match(/^\/api\/runs\/(\w+)$/)) && req.method === 'GET') {
        const r = runs.find(x => x.id === m[1]); return r ? json(res, 200, r) : json(res, 404, { error: 'Not found' });
      }
      if ((m = p.match(/^\/api\/runs\/(\w+)\/cancel$/)) && req.method === 'POST') {
        const r = runs.find(x => x.id === m[1]); if (!r) return json(res, 404, { error: 'Not found' });
        cancelRun(r); return json(res, 200, brief(r));
      }
      if (p === '/api/workflows' && req.method === 'GET') return json(res, 200, workflows);
      if (p === '/api/workflows' && req.method === 'POST') {
        const w = cleanWorkflow(await body(req), crypto.randomBytes(4).toString('hex')); workflows.push(w); saveWf(); return json(res, 201, w);
      }
      if (p === '/api/workflows/import' && req.method === 'POST') {
        const b = await body(req);
        const d = b && b.data;
        const list = Array.isArray(d) ? d : d && Array.isArray(d.workflows) ? d.workflows : d && d.workflow ? [d.workflow] : d && d.steps ? [d] : null;
        if (!list || !list.length) return json(res, 400, { error: 'No workflows found in this file' });
        if (list.length > 50) return json(res, 400, { error: 'Too many workflows (max 50 per import)' });
        const imported = [], skipped = [];
        list.forEach((x, i) => {
          try { const w = cleanWorkflow(x, crypto.randomBytes(4).toString('hex')); workflows.push(w); imported.push({ id: w.id, name: w.name }); }
          catch (e) { skipped.push({ name: (x && x.name) || `#${i + 1}`, reason: e.message }); }
        });
        if (imported.length) saveWf();
        return json(res, 200, { imported, skipped });
      }
      if ((m = p.match(/^\/api\/workflows\/([\w-]+)$/))) {
        const i = workflows.findIndex(x => x.id === m[1]); if (i < 0) return json(res, 404, { error: 'Not found' });
        if (req.method === 'PUT') { workflows[i] = cleanWorkflow(await body(req), m[1]); saveWf(); return json(res, 200, workflows[i]); }
        if (req.method === 'DELETE') { workflows.splice(i, 1); saveWf(); return json(res, 200, { ok: true }); }
        return json(res, 200, workflows[i]);
      }
      if (p === '/api/wfruns' && req.method === 'GET') return json(res, 200, wfruns.slice(-100).reverse());
      if (p === '/api/wfruns' && req.method === 'POST') {
        const b = await body(req), def = workflows.find(x => x.id === b.workflow);
        if (!def) return json(res, 400, { error: 'Unknown workflow' });
        if (typeof b.input !== 'string' || !b.input.trim()) return json(res, 400, { error: 'Input is required' });
        const known = new Set(loadAgents().map(a => a.id)), gone = def.steps.find(s => !known.has(s.agent));
        if (gone) return json(res, 400, { error: `Agent "${gone.agent}" no longer exists` });
        return json(res, 201, startWfRun({ ...def, mode: MODES.includes(b.mode) ? b.mode : def.mode }, b.input.trim().slice(0, 8000)));
      }
      if ((m = p.match(/^\/api\/wfruns\/(\w+)(\/cancel)?$/))) {
        const w = wfruns.find(x => x.id === m[1]); if (!w) return json(res, 404, { error: 'Not found' });
        if (m[2] && req.method === 'POST') {
          const c = wfActive.get(w.id); if (c) { c.cancelled = true; const r = runs.find(x => x.id === c.runId); if (r) cancelRun(r); }
        }
        return json(res, 200, w);
      }
      return json(res, 404, { error: 'Not found' });
    } catch (e) { return json(res, 400, { error: e.message }); }
  }
  const f = path.join(PUB, p === '/' ? 'index.html' : p);
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(PORT, HOST, () => console.log(`Agents Control Center → http://${HOST}:${PORT}  (agents: ${REPO}, workdir: ${WORKDIR})`));

process.on('unhandledRejection', e => console.error('unhandled rejection:', e));
process.on('uncaughtException', e => console.error('uncaught exception:', e));
process.on('SIGINT', () => { procs.forEach(c => killTree(c, 'SIGKILL')); process.exit(0); });
process.on('SIGTERM', () => { procs.forEach(c => killTree(c, 'SIGKILL')); process.exit(0); });
