import AppKit
import SwiftUI

/// The compact label shown in the menu bar itself.
struct MenuBarLabel: View {
    @ObservedObject private var monitor = MemoryMonitor.shared

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "memorychip")
            if let stats = monitor.stats {
                Text("\(Int((stats.usedFraction * 100).rounded()))%")
            } else {
                Text("--")
            }
        }
    }
}

/// The dropdown content shown when the menu bar item is clicked.
struct MenuBarView: View {
    @ObservedObject private var monitor = MemoryMonitor.shared

    private let byteFormatter: ByteCountFormatter = {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useGB, .useMB]
        formatter.countStyle = .memory
        return formatter
    }()

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header
            Divider()
            if let stats = monitor.stats {
                statsSection(stats)
            } else {
                Text("Loading memory stats…")
                    .foregroundColor(.secondary)
            }
            Divider()
            processSection
            if let error = monitor.lastError {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.red)
            }
            Divider()
            footer
        }
        .padding(16)
        .frame(width: 320)
    }

    private var header: some View {
        HStack {
            Text("Memory Admin")
                .font(.headline)
            Spacer()
            Button {
                monitor.refresh()
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .buttonStyle(.plain)
            .help("Refresh now")
        }
    }

    private func statsSection(_ stats: MemoryStats) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ProgressView(value: stats.usedFraction)
                .tint(stats.usedFraction > 0.85 ? .red : .accentColor)

            HStack {
                Text("Used \(byteFormatter.string(fromByteCount: Int64(stats.usedBytes)))")
                Spacer()
                Text("of \(byteFormatter.string(fromByteCount: Int64(stats.totalBytes)))")
            }
            .font(.caption)
            .foregroundColor(.secondary)

            Grid(alignment: .leading, horizontalSpacing: 10, verticalSpacing: 2) {
                statRow("Wired", stats.wiredBytes)
                statRow("Active", stats.activeBytes)
                statRow("Inactive", stats.inactiveBytes)
                statRow("Compressed", stats.compressedBytes)
                statRow("Free", stats.freeBytes)
            }
            .font(.caption)
        }
    }

    private func statRow(_ label: String, _ bytes: UInt64) -> some View {
        GridRow {
            Text(label).foregroundColor(.secondary)
            Text(byteFormatter.string(fromByteCount: Int64(bytes)))
        }
    }

    private var processSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Top Memory Usage")
                .font(.subheadline.bold())

            ForEach(monitor.topProcesses) { proc in
                HStack {
                    Text(proc.name)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Spacer()
                    Text(byteFormatter.string(fromByteCount: Int64(proc.residentBytes)))
                        .foregroundColor(.secondary)
                    Button {
                        monitor.terminate(pid: proc.pid)
                    } label: {
                        Image(systemName: "xmark.circle")
                    }
                    .buttonStyle(.plain)
                    .help("Quit \(proc.name)")
                }
                .font(.caption)
            }
        }
    }

    private var footer: some View {
        HStack {
            Button {
                monitor.purgeMemory()
            } label: {
                if monitor.isPurging {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Text("Purge Memory")
                }
            }
            .disabled(monitor.isPurging)
            .help("Evicts inactive/cached pages. Requires an admin password.")

            Spacer()

            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
        }
    }
}
