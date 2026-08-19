import AppKit
import SwiftUI

struct ContentView: View {
    @ObservedObject private var monitor = MemoryMonitor.shared
    @State private var searchText = ""
    @State private var selection: Set<Int32> = []
    @State private var sortOrder = [KeyPathComparator(\SystemProcess.residentBytes, order: .reverse)]

    private let byteFormatter: ByteCountFormatter = {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useGB, .useMB]
        formatter.countStyle = .memory
        return formatter
    }()

    private var displayedProcesses: [SystemProcess] {
        let filtered = searchText.isEmpty
            ? monitor.processes
            : monitor.processes.filter {
                $0.name.localizedCaseInsensitiveContains(searchText) || String($0.pid) == searchText
            }
        return filtered.sorted(using: sortOrder)
    }

    var body: some View {
        VStack(spacing: 0) {
            summary
            Divider()
            processTable
            if let error = monitor.lastError {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.red)
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .searchable(text: $searchText, prompt: "Filter by name or PID")
        .toolbar {
            ToolbarItemGroup {
                Button {
                    monitor.refresh()
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }

                Button {
                    monitor.purgeMemory()
                } label: {
                    if monitor.isPurging {
                        ProgressView().controlSize(.small)
                    } else {
                        Label("Purge Memory", systemImage: "wind")
                    }
                }
                .disabled(monitor.isPurging)
                .help("Evicts inactive/cached pages. Requires an admin password.")

                Button {
                    presentLaunchPanel()
                } label: {
                    Label("Launch App…", systemImage: "play.circle")
                }
                .help("Start a new process by launching an application.")

                Button(role: .destructive) {
                    quitSelection(force: false)
                } label: {
                    Label("Quit", systemImage: "xmark.circle")
                }
                .disabled(selection.isEmpty)
                .help("Send SIGTERM to the selected process(es).")

                Button(role: .destructive) {
                    quitSelection(force: true)
                } label: {
                    Label("Force Quit", systemImage: "exclamationmark.octagon")
                }
                .disabled(selection.isEmpty)
                .help("Send SIGKILL to the selected process(es).")
            }
        }
    }

    private var summary: some View {
        Group {
            if let stats = monitor.stats {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Memory Used").font(.headline)
                        Spacer()
                        Text(
                            "\(byteFormatter.string(fromByteCount: Int64(stats.usedBytes))) of "
                                + byteFormatter.string(fromByteCount: Int64(stats.totalBytes))
                        )
                        .foregroundColor(.secondary)
                    }
                    ProgressView(value: stats.usedFraction)
                        .tint(stats.usedFraction > 0.85 ? .red : .accentColor)

                    HStack(spacing: 20) {
                        statLabel("Wired", stats.wiredBytes)
                        statLabel("Active", stats.activeBytes)
                        statLabel("Inactive", stats.inactiveBytes)
                        statLabel("Compressed", stats.compressedBytes)
                        statLabel("Free", stats.freeBytes)
                        Spacer()
                        Text("\(monitor.processes.count) processes")
                            .foregroundColor(.secondary)
                    }
                    .font(.caption)
                }
                .padding()
            } else {
                ProgressView("Loading memory stats…")
                    .padding()
            }
        }
    }

    private func statLabel(_ title: String, _ bytes: UInt64) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).foregroundColor(.secondary)
            Text(byteFormatter.string(fromByteCount: Int64(bytes)))
        }
    }

    private var processTable: some View {
        Table(displayedProcesses, selection: $selection, sortOrder: $sortOrder) {
            TableColumn("Name", value: \.name) { proc in
                Text(proc.name)
            }
            TableColumn("PID", value: \.pid) { proc in
                Text("\(proc.pid)")
            }
            .width(70)
            TableColumn("CPU %", value: \.cpuPercent) { proc in
                Text(String(format: "%.1f", proc.cpuPercent))
            }
            .width(70)
            TableColumn("Memory", value: \.residentBytes) { proc in
                Text(byteFormatter.string(fromByteCount: Int64(proc.residentBytes)))
            }
            .width(100)
            TableColumn("User", value: \.user) { proc in
                Text(proc.user)
            }
            .width(120)
        }
        .contextMenu(forSelectionType: Int32.self) { pids in
            Button("Quit") { pids.forEach { monitor.terminate(pid: $0) } }
            Button("Force Quit", role: .destructive) { pids.forEach { monitor.forceTerminate(pid: $0) } }
        }
    }

    private func quitSelection(force: Bool) {
        for pid in selection {
            force ? monitor.forceTerminate(pid: pid) : monitor.terminate(pid: pid)
        }
        selection.removeAll()
    }

    private func presentLaunchPanel() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.application]
        panel.directoryURL = URL(fileURLWithPath: "/Applications")
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        if panel.runModal() == .OK, let url = panel.url {
            monitor.launchApplication(at: url)
        }
    }
}
