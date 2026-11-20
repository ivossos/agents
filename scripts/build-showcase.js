#!/usr/bin/env node
/**
 * build-showcase.js
 * Reads all agent markdown files from the repo and generates a static
 * showcase page at docs/index.html suitable for GitHub Pages.
 *
 * Usage: node scripts/build-showcase.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const OUT  = path.join(REPO, 'docs', 'index.html');

// Directories to skip when scanning for agents.
const SKIP = new Set([
  'website', 'node_modules', 'docs', 'examples',
  'scripts', '.git', 'designs', 'video',
]);

// ----- agent parsing (mirrors server.js parseAgent) -----

/**
 * Parse a single agent markdown file and return a lightweight descriptor.
 * Returns null if the file lacks a recognisable agent definition.
 */
function parseAgent(file, dept) {
  const t = fs.readFileSync(file, 'utf8');
  const m = t.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (!m) {
    // No YAML frontmatter — derive name from filename, desc from first paragraph.
    const para = (t.split(/^## Description\s*$/m)[1] || t)
      .split(/\r?\n/)
      .map(l => l.trim())
      .find(l => l && !l.startsWith('#'));
    return {
      id:    path.basename(file, '.md'),
      dept,
      desc:  (para || '').slice(0, 300),
      color: 'gray',
      tools: [],
    };
  }

  const fm = {};
  m[1].split(/\r?\n/).forEach(l => {
    const k = l.match(/^(\w+):\s*(.*)$/);
    if (k) fm[k[1]] = k[2];
  });
  if (!fm.name) return null;

  // Strip escaped newlines and the Examples: section from the description.
  const desc = (fm.description || '')
    .split(/\\n|\s+Examples:/)[0]
    .trim()
    .slice(0, 280);

  return {
    id:    fm.name.trim(),
    dept,
    desc,
    color: (fm.color || 'gray').trim(),
    tools: fm.tools
      ? fm.tools.split(',').map(s => s.trim()).filter(Boolean)
      : [],
  };
}

/**
 * Walk the repo root, parse every *.md agent file, return sorted list.
 */
function loadAgents() {
  const out = [];
  for (const d of fs.readdirSync(REPO, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith('.') || SKIP.has(d.name)) continue;
    for (const f of fs.readdirSync(path.join(REPO, d.name))) {
      if (!f.endsWith('.md')) continue;
      try {
        const a = parseAgent(path.join(REPO, d.name, f), d.name);
        if (a) out.push(a);
      } catch { /* skip unreadable files */ }
    }
  }
  return out.sort((a, b) => a.dept.localeCompare(b.dept) || a.id.localeCompare(b.id));
}

// ----- color → hex mapping -----

const COLOR_HEX = {
  green:   '#10b981',
  blue:    '#3b82f6',
  purple:  '#a855f7',
  indigo:  '#6366f1',
  orange:  '#f97316',
  red:     '#ef4444',
  yellow:  '#eab308',
  teal:    '#14b8a6',
  cyan:    '#06b6d4',
  pink:    '#ec4899',
  rose:    '#f43f5e',
  amber:   '#f59e0b',
  lime:    '#84cc16',
  sky:     '#0ea5e9',
  violet:  '#8b5cf6',
  gray:    '#6b7280',
  default: '#6b7280',
};

function colorHex(c) {
  return COLOR_HEX[c] || COLOR_HEX.default;
}

// ----- department display labels -----

const DEPT_LABEL = {
  design:              'Design',
  engineering:         'Engineering',
  marketing:           'Marketing',
  product:             'Product',
  'project-management':'Project Mgmt',
  'studio-operations': 'Studio Ops',
  testing:             'Testing',
  bonus:               'Bonus',
};

function deptLabel(d) {
  return DEPT_LABEL[d] || d.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ----- HTML generation -----

/**
 * Build a single-file static HTML page and write it to docs/index.html.
 */
function buildShowcase(agents) {
  const depts    = [...new Set(agents.map(a => a.dept))].sort();
  const agentJson = JSON.stringify(agents);
  const deptsJson = JSON.stringify(depts);
  const deptLabelsJson = JSON.stringify(
    Object.fromEntries(depts.map(d => [d, deptLabel(d)]))
  );
  const colorHexJson = JSON.stringify(
    Object.fromEntries([...new Set(agents.map(a => a.color))].map(c => [c, colorHex(c)]))
  );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Contains Studio — Agent Library</title>
  <meta name="description" content="A library of ${agents.length} specialized AI agents built for rapid product development at Contains Studio." />

  <!-- Open Graph / social sharing -->
  <meta property="og:type"        content="website" />
  <meta property="og:title"       content="Contains Studio — Agent Library" />
  <meta property="og:description" content="${agents.length} specialized AI agents for rapid product development." />
  <meta property="og:url"         content="https://ivossos.github.io/agents/" />
  <meta name="twitter:card"       content="summary_large_image" />

  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet" />

  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'ui-sans-serif', 'system-ui'],
            mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
          },
        },
      },
    };
  </script>

  <style>
    * { box-sizing: border-box; }
    body { background: #09090b; }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #18181b; }
    ::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 3px; }

    /* Animated gradient hero text */
    .hero-gradient {
      background: linear-gradient(135deg, #fff 0%, #a1a1aa 60%, #71717a 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* Card hover glow using CSS variable for the agent color */
    .agent-card {
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
      border: 1px solid #27272a;
    }
    .agent-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 0 0 1px var(--accent), 0 8px 32px -4px rgba(0,0,0,0.6);
      border-color: var(--accent);
    }

    /* Department tab active state */
    .dept-tab.active {
      background: var(--tab-color, #6366f1);
      color: #fff;
      border-color: transparent;
    }
    .dept-tab {
      transition: background 0.1s, color 0.1s, border-color 0.1s;
    }

    /* Color left border on card */
    .card-accent-bar {
      position: absolute;
      left: 0; top: 16px; bottom: 16px;
      width: 3px;
      border-radius: 0 2px 2px 0;
      background: var(--accent);
      opacity: 0.7;
    }

    /* Fade-in for cards */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .agent-card { animation: fadeUp 0.2s ease both; }

    /* Search input focus ring */
    #search:focus { outline: none; box-shadow: 0 0 0 2px #6366f1; }
  </style>
</head>

<body class="dark font-sans text-zinc-100 min-h-screen">

  <!-- ── HERO ─────────────────────────────────────────────────── -->
  <header class="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-30">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <span class="font-mono text-xs font-medium text-zinc-400 tracking-widest uppercase">Contains Studio</span>
        <span class="text-zinc-700">·</span>
        <span class="font-mono text-xs font-medium text-zinc-500">Agents</span>
      </div>
      <a href="https://github.com/ivossos/agents"
         target="_blank" rel="noopener"
         class="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
        </svg>
        GitHub
      </a>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 pb-24">

    <!-- Hero section -->
    <section class="pt-16 pb-12 text-center">
      <p class="font-mono text-xs tracking-[0.3em] uppercase text-zinc-500 mb-4">Agent Library</p>
      <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold hero-gradient mb-5 leading-tight">
        ${agents.length} Specialized Agents.<br class="hidden sm:block"/>Built to Ship Fast.
      </h1>
      <p class="text-zinc-400 text-lg max-w-xl mx-auto leading-relaxed">
        A complete team of AI agents covering design, engineering, marketing, product, and operations — ready to run in Claude Code.
      </p>
      <div class="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
        <a href="https://github.com/ivossos/agents"
           target="_blank" rel="noopener"
           class="inline-flex items-center gap-2 bg-white text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-zinc-100 transition-colors">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          Clone on GitHub
        </a>
        <a href="#agents"
           class="inline-flex items-center gap-2 border border-zinc-700 text-zinc-300 font-medium text-sm px-5 py-2.5 rounded-lg hover:border-zinc-500 hover:text-white transition-colors">
          Browse agents ↓
        </a>
      </div>
    </section>

    <!-- Stats strip -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
        <div class="text-2xl font-bold text-white">${agents.length}</div>
        <div class="text-xs text-zinc-500 mt-0.5">Total agents</div>
      </div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
        <div id="dept-count" class="text-2xl font-bold text-white">${depts.length}</div>
        <div class="text-xs text-zinc-500 mt-0.5">Departments</div>
      </div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
        <div class="text-2xl font-bold text-white">0</div>
        <div class="text-xs text-zinc-500 mt-0.5">Dependencies</div>
      </div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
        <div class="text-2xl font-bold text-indigo-400">6-day</div>
        <div class="text-xs text-zinc-500 mt-0.5">Sprint cycle</div>
      </div>
    </div>

    <!-- ── FILTER BAR ─────────────────────────────────────────── -->
    <section id="agents" class="mb-6 scroll-mt-20">
      <!-- Search -->
      <div class="relative mb-4">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input id="search" type="text" placeholder="Search agents…"
               class="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 transition-colors" />
      </div>

      <!-- Department tabs -->
      <div id="dept-tabs" class="flex flex-wrap gap-2">
        <button class="dept-tab active text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-300 cursor-pointer"
                data-dept="all" style="--tab-color:#6366f1">
          All <span class="text-zinc-400 ml-0.5" id="all-count">(${agents.length})</span>
        </button>
      </div>
    </section>

    <!-- Results header -->
    <div class="flex items-center justify-between mb-4">
      <p class="text-xs text-zinc-500"><span id="visible-count">${agents.length}</span> agents</p>
    </div>

    <!-- ── AGENT GRID ─────────────────────────────────────────── -->
    <div id="grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Cards injected by JS -->
    </div>

    <!-- Empty state -->
    <div id="empty" class="hidden text-center py-24 text-zinc-600">
      <svg class="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <p class="text-sm">No agents match your search.</p>
    </div>

  </main>

  <!-- ── FOOTER ────────────────────────────────────────────────── -->
  <footer class="border-t border-zinc-800 bg-zinc-950 py-10">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
      <div>
        <p class="font-mono text-sm font-medium text-zinc-300 mb-1">Contains Studio</p>
        <p class="text-xs text-zinc-600">Rapid product development, powered by AI agents.</p>
      </div>
      <div class="text-xs text-zinc-600 space-y-1">
        <p class="font-medium text-zinc-500 mb-2">Run the control center locally</p>
        <code class="block bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 font-mono text-zinc-300">
          git clone https://github.com/ivossos/agents.git
        </code>
        <code class="block bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 font-mono text-zinc-300">
          cd agents/website &amp;&amp; node server.js
        </code>
      </div>
    </div>
  </footer>

  <!-- ── DATA + LOGIC ──────────────────────────────────────────── -->
  <script>
    const AGENTS      = ${agentJson};
    const DEPTS       = ${deptsJson};
    const DEPT_LABELS = ${deptLabelsJson};
    const COLOR_MAP   = ${colorHexJson};

    function hex(agent) {
      return COLOR_MAP[agent.color] || '#6b7280';
    }

    function slugToTitle(s) {
      return s.replace(/-/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase());
    }

    // ── Build department tabs ────────────────────────────────────
    const tabsEl = document.getElementById('dept-tabs');
    DEPTS.forEach(dept => {
      // Pick a representative color from that department's agents.
      const deptAgents = AGENTS.filter(a => a.dept === dept);
      const repColor = hex(deptAgents.find(a => a.color !== 'gray') || deptAgents[0]);
      const btn = document.createElement('button');
      btn.className = 'dept-tab text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-400 cursor-pointer hover:text-white hover:border-zinc-500 transition-colors';
      btn.dataset.dept = dept;
      btn.style.setProperty('--tab-color', repColor);
      btn.innerHTML = \`\${DEPT_LABELS[dept] || dept} <span class="text-zinc-500">(\${deptAgents.length})</span>\`;
      tabsEl.appendChild(btn);
    });

    // ── State ────────────────────────────────────────────────────
    let activeDept  = 'all';
    let searchQuery = '';

    function filteredAgents() {
      return AGENTS.filter(a => {
        const matchDept   = activeDept === 'all' || a.dept === activeDept;
        const q = searchQuery.toLowerCase();
        const matchSearch = !q ||
          a.id.includes(q) ||
          a.desc.toLowerCase().includes(q) ||
          a.dept.includes(q) ||
          (a.tools || []).some(t => t.toLowerCase().includes(q));
        return matchDept && matchSearch;
      });
    }

    function renderCard(agent, delay) {
      const accent = hex(agent);
      const div = document.createElement('div');
      div.className = 'agent-card relative bg-zinc-900 rounded-xl p-5 pl-6 cursor-default';
      div.style.cssText = \`--accent:\${accent}; animation-delay:\${delay}ms\`;
      div.innerHTML = \`
        <div class="card-accent-bar"></div>
        <div class="flex items-start justify-between gap-2 mb-2">
          <h3 class="font-mono text-sm font-medium text-white leading-snug">
            \${slugToTitle(agent.id)}
          </h3>
          <span class="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border"
                style="color:\${accent};border-color:\${accent}22;background:\${accent}11">
            \${DEPT_LABELS[agent.dept] || agent.dept}
          </span>
        </div>
        <p class="text-xs text-zinc-400 leading-relaxed line-clamp-3 mb-3">\${agent.desc || 'No description.'}</p>
        \${agent.tools.length ? \`
        <div class="flex flex-wrap gap-1 mt-auto">
          \${agent.tools.slice(0,5).map(t =>
            \`<span class="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded font-mono">\${t}</span>\`
          ).join('')}\${agent.tools.length > 5 ? \`<span class="text-[10px] text-zinc-700">+\${agent.tools.length-5}</span>\` : ''}
        </div>\` : ''}
      \`;
      return div;
    }

    function render() {
      const agents = filteredAgents();
      const grid   = document.getElementById('grid');
      const empty  = document.getElementById('empty');

      grid.innerHTML = '';
      if (agents.length === 0) {
        empty.classList.remove('hidden');
        grid.classList.add('hidden');
      } else {
        empty.classList.add('hidden');
        grid.classList.remove('hidden');
        agents.forEach((a, i) => grid.appendChild(renderCard(a, i * 20)));
      }
      document.getElementById('visible-count').textContent = agents.length;
    }

    // ── Tab click ───────────────────────────────────────────────
    document.getElementById('dept-tabs').addEventListener('click', e => {
      const btn = e.target.closest('[data-dept]');
      if (!btn) return;
      document.querySelectorAll('.dept-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeDept = btn.dataset.dept;
      render();
    });

    // ── Search ──────────────────────────────────────────────────
    document.getElementById('search').addEventListener('input', e => {
      searchQuery = e.target.value;
      render();
    });

    // ── Init ────────────────────────────────────────────────────
    render();
  </script>
</body>
</html>`;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html, 'utf8');
  console.log(`✓ Built ${agents.length} agents → ${path.relative(REPO, OUT)}`);
  console.log(`  Departments: ${depts.map(deptLabel).join(', ')}`);
}

// ----- main -----
const agents = loadAgents();
buildShowcase(agents);
