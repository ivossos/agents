'use strict';

/**
 * Shared agent-parsing utilities used by both the control-center server
 * (website/server.js) and the showcase builder (scripts/build-showcase.js).
 *
 * Keeping the logic here means changes to the agent file format only need
 * to be made in one place.
 */

const fs   = require('fs');
const path = require('path');

/**
 * Parse a single agent markdown file and return a descriptor object.
 *
 * Returns null if the file lacks a recognisable agent definition (e.g. no
 * `name:` field in its YAML frontmatter and no readable first paragraph).
 *
 * @param {string} file      - Absolute path to the .md file
 * @param {string} dept      - Department name (the parent directory)
 * @param {string} [repoRoot] - Repo root used to compute the relative `file` path
 * @returns {{ id: string, dept: string, desc: string, color: string,
 *             tools: string[], prompt: string, file: string } | null}
 */
function parseAgent(file, dept, repoRoot) {
  const t = fs.readFileSync(file, 'utf8');
  const m = t.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (!m) {
    // No YAML frontmatter — derive name from filename, desc from first paragraph.
    const para = (t.split(/^## Description\s*$/m)[1] || t)
      .split(/\r?\n/)
      .map(l => l.trim())
      .find(l => l && !l.startsWith('#'));
    return {
      id:     path.basename(file, '.md'),
      dept,
      desc:   (para || '').slice(0, 400),
      color:  'gray',
      tools:  [],
      prompt: t.trim(),
      file:   repoRoot ? path.relative(repoRoot, file) : file,
    };
  }

  // Parse YAML frontmatter (simple key: value pairs only).
  const fm = {};
  m[1].split(/\r?\n/).forEach(l => {
    const k = l.match(/^(\w+):\s*(.*)$/);
    if (k) fm[k[1]] = k[2];
  });
  if (!fm.name) return null;

  // Strip escaped newlines and the Examples: section from the description.
  const desc = (fm.description || '')
    .split(/\\n|\s+Examples:/)[0]
    .trim();

  return {
    id:     fm.name.trim(),
    dept,
    desc,
    color:  (fm.color || 'gray').trim(),
    tools:  fm.tools ? fm.tools.split(',').map(s => s.trim()).filter(Boolean) : [],
    prompt: m[2].trim(),
    file:   repoRoot ? path.relative(repoRoot, file) : file,
  };
}

/**
 * Walk a repo root directory, parse every *.md agent file found in its
 * top-level subdirectories, and return a list sorted by department then id.
 *
 * @param {string}    repoRoot         - Directory to scan
 * @param {Set<string>} [skip]         - Directory names to skip
 *                                       (default: website, node_modules)
 * @returns {Array<ReturnType<parseAgent>>}
 */
function loadAgents(repoRoot, skip) {
  const skipSet = skip || new Set(['website', 'node_modules']);
  const out = [];

  for (const d of fs.readdirSync(repoRoot, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith('.') || skipSet.has(d.name)) continue;
    for (const f of fs.readdirSync(path.join(repoRoot, d.name))) {
      if (!f.endsWith('.md')) continue;
      try {
        const a = parseAgent(path.join(repoRoot, d.name, f), d.name, repoRoot);
        if (a) out.push(a);
      } catch { /* skip unreadable or malformed files */ }
    }
  }

  return out.sort((a, b) => a.dept.localeCompare(b.dept) || a.id.localeCompare(b.id));
}

module.exports = { parseAgent, loadAgents };
