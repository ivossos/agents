#!/usr/bin/env node
/**
 * test-agent-parser.js
 *
 * Zero-dependency unit tests for scripts/lib/agent-parser.js.
 * Uses only Node's built-in `assert` and `fs` modules.
 *
 * Run with:  node scripts/test-agent-parser.js
 * Exit 0 = all pass, exit 1 = at least one failure.
 */

'use strict';

const assert = require('assert/strict');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');

const { parseAgent, loadAgents } = require('./lib/agent-parser');

// ── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function run() {
  for (const { name, fn } of tests) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${e.message}`);
      failed++;
    }
  }
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

/** Write a temporary file and return its path. Cleaned up at process exit. */
function tmpFile(name, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-parser-test-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, content, 'utf8');
  process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));
  return { file, dir };
}

/** Create a temporary repo-like directory tree and return its root path. */
function tmpRepo(structure) {
  // structure: { 'dept/agent.md': 'content', ... }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-repo-test-'));
  for (const [rel, content] of Object.entries(structure)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
  process.on('exit', () => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

// ── parseAgent tests ─────────────────────────────────────────────────────────

test('parseAgent: valid frontmatter returns correct fields', () => {
  const { file } = tmpFile('rapid-prototyper.md', `---
name: rapid-prototyper
description: Build MVPs in days, not weeks. Examples:\\n<example>user: "build me an app"</example>
color: blue
tools: Write, Read, Bash
---

You are a rapid prototyper. Ship fast.
`);
  const agent = parseAgent(file, 'engineering');
  assert.equal(agent.id,    'rapid-prototyper');
  assert.equal(agent.dept,  'engineering');
  assert.equal(agent.color, 'blue');
  assert.deepEqual(agent.tools, ['Write', 'Read', 'Bash']);
  assert.ok(agent.prompt.includes('Ship fast'), 'prompt should contain body text');
});

test('parseAgent: Examples: section is stripped from desc', () => {
  const { file } = tmpFile('test-agent.md', `---
name: test-agent
description: Does something useful. Examples: see docs
color: green
tools:
---
Body.
`);
  const agent = parseAgent(file, 'testing');
  assert.equal(agent.desc, 'Does something useful.');
});

test('parseAgent: escaped \\n in description is stripped correctly', () => {
  const { file } = tmpFile('test-agent.md', `---
name: test-agent
description: First line\\nSecond line
color: gray
tools:
---
Body.
`);
  const agent = parseAgent(file, 'testing');
  assert.equal(agent.desc, 'First line');
});

test('parseAgent: returns null when name is missing', () => {
  const { file } = tmpFile('no-name.md', `---
description: Some desc
color: red
tools: Write
---
Body.
`);
  const result = parseAgent(file, 'engineering');
  assert.equal(result, null);
});

test('parseAgent: no frontmatter — falls back to filename as id', () => {
  const { file } = tmpFile('my-agent.md', `# My Agent\n\nThis agent does things.\n`);
  const agent = parseAgent(file, 'bonus');
  assert.equal(agent.id,    'my-agent');
  assert.equal(agent.color, 'gray');
  assert.deepEqual(agent.tools, []);
  assert.ok(agent.desc.length > 0, 'desc should be non-empty for no-frontmatter file');
});

test('parseAgent: no frontmatter — extracts first paragraph as desc', () => {
  const { file } = tmpFile('joke-teller.md', `# Joke Teller\n\nTells great jokes.\n\nMore info here.\n`);
  const agent = parseAgent(file, 'bonus');
  assert.equal(agent.desc, 'Tells great jokes.');
});

test('parseAgent: tools with extra whitespace are trimmed', () => {
  const { file } = tmpFile('test-agent.md', `---
name: test-agent
description: desc
color: gray
tools:  Write ,  Read ,  Bash
---
Body.
`);
  const agent = parseAgent(file, 'engineering');
  assert.deepEqual(agent.tools, ['Write', 'Read', 'Bash']);
});

test('parseAgent: empty tools string returns empty array', () => {
  const { file } = tmpFile('test-agent.md', `---
name: test-agent
description: desc
color: gray
tools:
---
Body.
`);
  const agent = parseAgent(file, 'engineering');
  assert.deepEqual(agent.tools, []);
});

test('parseAgent: file path is relative to repoRoot when provided', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-root-'));
  const dept = path.join(root, 'engineering');
  fs.mkdirSync(dept);
  const file = path.join(dept, 'rapid-prototyper.md');
  fs.writeFileSync(file, `---\nname: rapid-prototyper\ndescription: desc\ncolor: blue\ntools:\n---\nBody.\n`);
  process.on('exit', () => fs.rmSync(root, { recursive: true, force: true }));

  const agent = parseAgent(file, 'engineering', root);
  assert.equal(agent.file, path.join('engineering', 'rapid-prototyper.md'));
});

test('parseAgent: color defaults to gray when missing', () => {
  const { file } = tmpFile('test-agent.md', `---
name: test-agent
description: desc
tools:
---
Body.
`);
  const agent = parseAgent(file, 'engineering');
  assert.equal(agent.color, 'gray');
});

// ── loadAgents tests ─────────────────────────────────────────────────────────

test('loadAgents: returns all valid agents from repo', () => {
  const root = tmpRepo({
    'engineering/rapid-prototyper.md': `---\nname: rapid-prototyper\ndescription: Build MVPs\ncolor: blue\ntools: Write\n---\nBody.\n`,
    'design/ui-designer.md':           `---\nname: ui-designer\ndescription: Design UIs\ncolor: purple\ntools: Read\n---\nBody.\n`,
    'bonus/joker.md':                  `# Joker\n\nTells jokes.\n`,
  });
  const agents = loadAgents(root);
  assert.equal(agents.length, 3);
});

test('loadAgents: results are sorted by dept then id', () => {
  const root = tmpRepo({
    'engineering/z-agent.md': `---\nname: z-agent\ndescription: Z\ncolor: gray\ntools:\n---\nBody.\n`,
    'engineering/a-agent.md': `---\nname: a-agent\ndescription: A\ncolor: gray\ntools:\n---\nBody.\n`,
    'design/ui-designer.md':  `---\nname: ui-designer\ndescription: UI\ncolor: gray\ntools:\n---\nBody.\n`,
  });
  const agents = loadAgents(root);
  assert.equal(agents[0].dept, 'design');
  assert.equal(agents[1].id,   'a-agent');
  assert.equal(agents[2].id,   'z-agent');
});

test('loadAgents: skips directories in the skip set', () => {
  const root = tmpRepo({
    'engineering/agent.md': `---\nname: agent\ndescription: d\ncolor: gray\ntools:\n---\nBody.\n`,
    'website/server.js':    `// not an agent`,
    'node_modules/pkg.md':  `---\nname: pkg\ndescription: d\ncolor: gray\ntools:\n---\nBody.\n`,
  });
  const agents = loadAgents(root);
  assert.equal(agents.length, 1);
  assert.equal(agents[0].id, 'agent');
});

test('loadAgents: accepts a custom skip set', () => {
  const root = tmpRepo({
    'engineering/agent.md': `---\nname: agent\ndescription: d\ncolor: gray\ntools:\n---\nBody.\n`,
    'scripts/helper.md':    `---\nname: helper\ndescription: d\ncolor: gray\ntools:\n---\nBody.\n`,
  });
  const agents = loadAgents(root, new Set(['scripts']));
  assert.equal(agents.length, 1);
  assert.equal(agents[0].id, 'agent');
});

test('loadAgents: skips hidden directories (dot-prefixed)', () => {
  const root = tmpRepo({
    'engineering/agent.md': `---\nname: agent\ndescription: d\ncolor: gray\ntools:\n---\nBody.\n`,
    '.git/COMMIT_EDITMSG':  `Initial commit`,
  });
  // .git has no .md files but we ensure no crash and no contamination
  const agents = loadAgents(root);
  assert.equal(agents.length, 1);
});

test('loadAgents: silently skips unreadable / malformed files', () => {
  const root = tmpRepo({
    'engineering/good-agent.md': `---\nname: good-agent\ndescription: d\ncolor: gray\ntools:\n---\nBody.\n`,
    'engineering/no-name.md':    `---\ndescription: missing name field\n---\nBody.\n`,
  });
  // no-name.md returns null → should not appear in output
  const agents = loadAgents(root);
  assert.equal(agents.length, 1);
  assert.equal(agents[0].id, 'good-agent');
});

// ── Run ───────────────────────────────────────────────────────────────────────

console.log('\nRunning agent-parser tests…\n');
run();
