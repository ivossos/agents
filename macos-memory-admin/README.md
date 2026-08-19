# Memory Admin

A native macOS menu bar app for monitoring and managing system RAM. It shows
live memory usage, breaks it down (wired / active / inactive / compressed /
free), lists the top memory-consuming processes, and lets you purge cached
memory or quit a runaway process without opening Activity Monitor.

## Requirements

- macOS 13 (Ventura) or later
- Xcode 15+ (or the Swift 5.9+ toolchain from Xcode Command Line Tools)

## Run it

From this directory:

```bash
swift run
```

The first run builds the executable; a memory-chip icon with a live usage
percentage then appears in your menu bar. Click it to see the full
breakdown, top processes, and the **Purge Memory** / quit-process controls.

## Build a standalone app / open in Xcode

```bash
open Package.swift
```

This opens the package in Xcode. Use **Product > Run** to launch it, or
**Product > Archive** to build a release binary you can move to
`/Applications` and keep running in the background.

## How it works

- **Memory stats** (`MemoryStats.swift`) come from the Mach kernel's
  `host_statistics64` VM info — the same source `vm_stat` and Activity
  Monitor read from — plus `sysctl hw.memsize` for total physical RAM.
- **Top processes** (`ProcessMemoryInfo.swift`) are read via `ps -axo
  pid=,rss=,comm=`, sorted by resident set size.
- **Purge Memory** shells out to `/usr/sbin/purge` through `osascript ...
  with administrator privileges`, so macOS prompts you for an admin
  password — the app itself never runs with elevated privileges.
- **Quitting a process** sends `SIGTERM` to its PID. This only works for
  processes owned by your user account, matching what a normal (non-root)
  Activity Monitor quit can do.

The app hides its Dock icon (`NSApp.setActivationPolicy(.accessory)`) and
lives entirely in the menu bar.
