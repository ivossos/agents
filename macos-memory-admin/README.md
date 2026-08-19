# Memory Admin

A native macOS app for monitoring system RAM and managing running
processes — a lightweight, purpose-built alternative to Activity Monitor.
It shows live memory usage (wired / active / inactive / compressed / free),
lists every running process in a sortable, searchable table, and lets you
start (launch), quit, or force-quit processes, plus purge cached memory.

> **This only runs on macOS.** It uses Mach kernel VM APIs, AppKit, and
> SwiftUI that don't exist on Linux, so it can't be built or run inside a
> cloud/Linux session — it has to be built and launched on your Mac
> directly (see below).

## Requirements

- macOS 13 (Ventura) or later
- Xcode 15+ (or the Swift 5.9+ toolchain from Xcode Command Line Tools)

## Run it on your Mac

Pull this branch onto your Mac, then from this directory:

```bash
swift run
```

The first run compiles the app; a window titled **Memory Admin** then
opens showing live memory stats and the full process table.

### Or open it in Xcode

```bash
open Package.swift
```

Use **Product > Run** to launch it, or **Product > Archive** to build a
release `.app` you can move to `/Applications`.

## Using the app

- **Monitor** — the top panel shows overall memory usage and a breakdown;
  the table lists every process with PID, CPU %, memory, and owning user.
  Click a column header to sort, or type in the search field to filter by
  name or PID. It auto-refreshes every 3 seconds, or click **Refresh**.
- **Stop** — select one or more rows (or right-click a row) and choose
  **Quit** (SIGTERM, a normal cooperative quit) or **Force Quit**
  (SIGKILL, immediate). Both only work on processes owned by your user
  account, same as a non-root Activity Monitor quit.
- **Start** — **Launch App…** opens a file picker (defaulting to
  `/Applications`) to start a new process by launching an app bundle.
- **Purge Memory** — shells out to `/usr/sbin/purge` via `osascript ...
  with administrator privileges`, so macOS prompts for an admin password;
  the app itself never runs elevated.

## How it works

- **Memory stats** (`MemoryStats.swift`) come from the Mach kernel's
  `host_statistics64` VM info — the same source `vm_stat` and Activity
  Monitor read from — plus `sysctl hw.memsize` for total physical RAM.
- **Process list** (`SystemProcess.swift`) is read via `ps -axo
  pid=,ppid=,pcpu=,rss=,user=,comm=`.
- **Quit / Force Quit** send `SIGTERM` / `SIGKILL` to the selected PID(s).
- **Launch App…** uses `NSWorkspace.openApplication` on the app bundle you
  pick.
