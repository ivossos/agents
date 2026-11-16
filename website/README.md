# Agents Control Center

A small web app to browse, monitor and dispatch the Claude agents defined in this repository.
Zero dependencies — Node 18+ and the `claude` CLI (Claude Code) on your PATH.

```bash
cd website
npm start        # http://127.0.0.1:3000
```

## What's real
- **Fleet**: read live from the agent `.md` files in the repo (one folder = one department). Edit a file and the page picks it up within ~15s.
- **Dispatch**: sends a task to an agent by running `claude -p` with that agent's prompt and allowed tools, in `WORKDIR`. Output streams to the browser.
- **Status, KPIs, activity**: derived from actual runs (running / queued / failed / done within the last hour / idle). History is saved to `data/runs.json` (gitignored).
- **Cancel** stops a running or queued task.

## Workflows
Open **Workflows** in the sidebar. A workflow is an ordered chain of agents; each step's prompt can use `{{input}}` (what you typed when running it), `{{prev}}` (the previous step's output) or `{{step1}}`, `{{step2}}`… Three starters are included (idea → sprint plan, design review, launch content), and you can build, edit and delete your own.

Running one opens a live pipeline map: each step lights up as it runs, you can click a step to read its output (streaming while it works), and cancel the whole workflow. A failed step stops the chain and later steps are marked skipped. Workflow definitions are stored in `data/workflows.json`, runs in `data/wfruns.json` (both gitignored).

### Import / export
**Export** on a workflow card (or **Export all**) downloads JSON; **Import JSON** accepts one or several files — a single workflow, a bundle, or a plain array. Imported workflows get new ids; any that reference an unknown agent or are malformed are skipped with the reason shown. File shape:

```json
{ "format": "agents-control-center.workflow", "version": 1,
  "workflow": { "name": "…", "description": "…", "mode": "plan",
    "steps": [ { "agent": "api-tester", "prompt": "…{{input}}…" }, { "agent": "…", "prompt": "…{{prev}}…" } ] } }
```
Ready-made real-world examples are in `examples/workflows/` (`pre-release-quality-gate`, `feedback-to-sprint`, `feature-launch-kit`, or `all-three.json`).

## Safety defaults
- Binds to `127.0.0.1` and rejects non-local `Host` and cross-site `Origin` requests.
- Each run is its own process group: timeout or **Cancel** stops the whole tree (SIGTERM, then SIGKILL), so a hung agent can't hold a slot. A timed-out run shows as failed with the reason.
- Tasks default to **Read-only (plan)** permission mode; file edits must be chosen per run.
- Set `CONTROL_TOKEN` to require a bearer token (open the UI with `?token=...`) if you expose it beyond localhost (`HOST=0.0.0.0 ALLOW_ANY_HOST=1`).

## Configuration (env vars)
| Var | Default | Purpose |
|---|---|---|
| `PORT` / `HOST` | `3000` / `127.0.0.1` | Listen address |
| `AGENTS_DIR` | repo root | Where agent folders live |
| `WORKDIR` | `AGENTS_DIR` | Directory agents run in |
| `MAX_PARALLEL` | `4` | Concurrent runs; extra runs queue |
| `RUN_TIMEOUT_MIN` | `15` | Stop a run (and everything it spawned) after this many minutes; `0` disables |
| `MAX_OUTPUT_KB` | `256` | Max output kept/streamed per run; the rest is dropped with a visible marker |
| `KILL_GRACE_MS` | `5000` | Time between SIGTERM and SIGKILL when stopping a run |
| `CLAUDE_BIN` | `claude` | CLI binary |
| `CONTROL_TOKEN` | – | Optional bearer token |

`designs/` holds the three original concept mockups.
