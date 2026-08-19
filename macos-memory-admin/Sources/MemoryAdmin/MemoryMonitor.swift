import AppKit
import Combine
import Foundation

/// Owns polling of system memory stats and the full process list, and
/// performs the admin-gated "purge memory" action plus process
/// start/stop actions for the GUI.
final class MemoryMonitor: ObservableObject {
    static let shared = MemoryMonitor()

    @Published private(set) var stats: MemoryStats?
    @Published private(set) var processes: [SystemProcess] = []
    @Published private(set) var lastUpdated = Date()
    @Published private(set) var isPurging = false
    @Published var lastError: String?

    private var refreshTimer: AnyCancellable?

    private init() {
        refresh()
        refreshTimer = Timer.publish(every: 3, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in self?.refresh() }
    }

    func refresh() {
        stats = MemoryStats.current()
        processes = SystemProcess.snapshotAll()
        lastUpdated = Date()
    }

    /// Runs `/usr/sbin/purge` (evicts inactive/cached file-backed pages)
    /// via osascript so macOS prompts the user for admin credentials.
    func purgeMemory() {
        guard !isPurging else { return }
        isPurging = true
        lastError = nil

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let script = "do shell script \"/usr/sbin/purge\" with administrator privileges"
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
            process.arguments = ["-e", script]

            let errorPipe = Pipe()
            process.standardError = errorPipe
            process.standardOutput = Pipe()

            var failureMessage: String?
            do {
                try process.run()
                process.waitUntilExit()
                if process.terminationStatus != 0 {
                    let errData = errorPipe.fileHandleForReading.readDataToEndOfFile()
                    let errString = String(data: errData, encoding: .utf8)?
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                    // A non-zero status with no stderr text means the user
                    // cancelled the admin prompt; don't surface that as an error.
                    if let errString, !errString.isEmpty {
                        failureMessage = errString
                    }
                }
            } catch {
                failureMessage = error.localizedDescription
            }

            DispatchQueue.main.async {
                self?.isPurging = false
                self?.lastError = failureMessage
                self?.refresh()
            }
        }
    }

    /// Sends SIGTERM (a normal, cooperative "quit"). Only succeeds for
    /// processes owned by the current user; macOS returns EPERM otherwise.
    func terminate(pid: Int32) {
        guard !blockIfProtected(pid: pid) else { return }
        signalProcess(pid: pid, signal: SIGTERM, verb: "quit")
    }

    /// Sends SIGKILL (an immediate, non-cooperative "force quit").
    func forceTerminate(pid: Int32) {
        guard !blockIfProtected(pid: pid) else { return }
        signalProcess(pid: pid, signal: SIGKILL, verb: "force quit")
    }

    /// Refuses to signal core OS processes, regardless of how the request
    /// got here (button, context menu, multi-select). Returns true if the
    /// pid was protected and the caller should stop.
    private func blockIfProtected(pid: Int32) -> Bool {
        guard let proc = processes.first(where: { $0.pid == pid }), proc.isSystemCritical else {
            return false
        }
        lastError = "\(proc.name) is a core macOS process and is protected from being quit here."
        return true
    }

    private func signalProcess(pid: Int32, signal: Int32, verb: String) {
        if kill(pid, signal) != 0 {
            lastError = "Couldn't \(verb) PID \(pid): \(String(cString: strerror(errno)))"
        }
        refresh()
    }

    /// Starts (launches) an application at the given URL, e.g. one picked
    /// from an NSOpenPanel filtered to .app bundles.
    func launchApplication(at url: URL) {
        NSWorkspace.shared.openApplication(
            at: url,
            configuration: NSWorkspace.OpenConfiguration()
        ) { [weak self] _, error in
            guard let error else { return }
            DispatchQueue.main.async {
                self?.lastError = "Couldn't launch \(url.lastPathComponent): \(error.localizedDescription)"
            }
        }
    }
}
