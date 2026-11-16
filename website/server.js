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
const TOKEN = process.env.CONTROL_TOKEN || '';          // optional bearer token
const DATA = path.join(__dirname, 'data', 'runs.json');
const PUB = path.join(__dirname, 'public');
const SKIP = new Set(['website', 'node_modules']);
const MODES = ['plan', 'acceptEdits', 'default'];

// ---------- agents ----------
function parseAgent(file, dept) {
  const t = fs.readFileSync(file, 'utf8');
  const m = t.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
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
const procs = new Map(), queue = [];
let saveT;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => {
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  fs.writeFileSync(DATA + '.tmp', JSON.stringify(runs.slice(-500))); fs.renameSync(DATA + '.tmp', DATA); }, 200); };
const clients = new Set();
const emit = (type, data) => { const s = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`; clients.forEach(c => c.write(s)); };
const brief = r => ({ ...r, output: undefined, outputLen: (r.output || '').length });

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
  try { child = spawn(CLAUDE, args, { cwd: WORKDIR, stdio: ['ignore', 'pipe', 'pipe'], env: process.env }); }
  catch (e) { return finish(run, 'failed', e.message); }
  procs.set(run.id, child);
  let buf = '', err = '';
  const onLine = line => {
    let j; try { j = JSON.parse(line); } catch { return; }
    if (j.type === 'assistant' && j.message && Array.isArray(j.message.content)) {
      for (const c of j.message.content) {
        if (c.type === 'text') { run.output += c.text + '\n'; emit('chunk', { id: run.id, text: c.text + '\n' }); }
        else if (c.type === 'tool_use') { const t = `▸ ${c.name}\n`; run.output += t; emit('chunk', { id: run.id, text: t }); }
      }
    } else if (j.type === 'result') {
      run.cost = j.total_cost_usd; run.isError = !!j.is_error;
      if (j.is_error && j.result) run.error = String(j.result).slice(0, 500);
    }
  };
  child.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { onLine(buf.slice(0, i)); buf = buf.slice(i + 1); } });
  child.stderr.on('data', d => { err = (err + d).slice(-2000); });
  child.on('error', e => finish(run, 'failed', e.code === 'ENOENT' ? `'${CLAUDE}' CLI not found` : e.message));
  child.on('close', code => {
    if (buf.trim()) onLine(buf);
    if (run.status === 'cancelled') return finish(run, 'cancelled');
    if (code === 0 && !run.isError) finish(run, 'done');
    else finish(run, 'failed', run.error || err.trim().slice(-500) || `exited with code ${code}`);
  });
}
function finish(run, status, error) {
  if (run.endedAt && run.status !== 'running') return;
  procs.delete(run.id); run.status = status; run.endedAt = Date.now(); if (error) run.error = error;
  save(); emit('run', brief(run)); pump();
}
function createRun(agent, task, mode) {
  const run = { id: crypto.randomBytes(5).toString('hex'), agent, task, mode, status: 'queued', createdAt: Date.now(), output: '' };
  runs.push(run); queue.push(run); save(); emit('run', brief(run)); pump(); return run;
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
  if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) { res.writeHead(403); return res.end('Forbidden origin'); }
  if (p.startsWith('/api/')) {
    if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}` && u.searchParams.get('token') !== TOKEN) return json(res, 401, { error: 'Unauthorized' });
    try {
      if (p === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write('retry: 2000\n\n'); clients.add(res); req.on('close', () => clients.delete(res)); return;
      }
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
        if (r.status === 'queued') { queue.splice(queue.indexOf(r), 1); finish(r, 'cancelled'); }
        else if (r.status === 'running') { r.status = 'cancelled'; procs.get(r.id)?.kill('SIGTERM'); }
        return json(res, 200, brief(r));
      }
      return json(res, 404, { error: 'Not found' });
    } catch (e) { return json(res, 400, { error: e.message }); }
  }
  const f = path.join(PUB, p === '/' ? 'index.html' : p);
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(PORT, HOST, () => console.log(`Agents Control Center → http://${HOST}:${PORT}  (agents: ${REPO}, workdir: ${WORKDIR})`));

process.on('SIGINT', () => { procs.forEach(c => c.kill()); process.exit(0); });
