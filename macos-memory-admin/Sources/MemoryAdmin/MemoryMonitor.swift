import Combine
import Foundation

/// Owns polling of system memory stats and the top-process list, and
/// performs the admin-gated "purge memory" and "quit process" actions.
final class MemoryMonitor: ObservableObject {
    static let shared = MemoryMonitor()

    @Published private(set) var stats: MemoryStats?
    @Published private(set) var topProcesses: [ProcessMemoryInfo] = []
    @Published private(set) var lastUpdated = Date()
    @Published private(set) var isPurging = false
    @Published var lastError: String?

    private var refreshTimer: AnyCancellable?
    private let processLimit = 8

    private init() {
        refresh()
        refreshTimer = Timer.publish(every: 3, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in self?.refresh() }
    }

    func refresh() {
        stats = MemoryStats.current()
        topProcesses = ProcessMemoryInfo.topProcesses(limit: processLimit)
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

    /// Sends SIGTERM to the given process. Only succeeds for processes
    /// owned by the current user; macOS returns EPERM otherwise.
    func terminate(pid: Int32) {
        if kill(pid, SIGTERM) != 0 {
            lastError = "Couldn't quit PID \(pid): \(String(cString: strerror(errno)))"
        }
        refresh()
    }
}
