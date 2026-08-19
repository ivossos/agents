import Foundation

/// A running process, as reported by `ps` — enough to drive a monitor UI
/// (name, owner, CPU, resident memory) and to act on it (its PID).
struct SystemProcess: Identifiable, Hashable {
    var id: Int32 { pid }
    let pid: Int32
    let parentPid: Int32
    let user: String
    let cpuPercent: Double
    let residentBytes: UInt64
    let name: String

    /// Core OS processes that must never be quit from this app: killing
    /// one of these crashes, logs out, or infinite-relaunches the Mac.
    /// Matched by name because several of them (Dock, Finder, WindowServer,
    /// loginwindow, SystemUIServer) run as the logged-in user, not root, so
    /// ownership alone isn't enough to protect them.
    private static let protectedNames: Set<String> = [
        "kernel_task", "launchd", "WindowServer", "loginwindow", "Dock", "Finder",
        "SystemUIServer", "ControlCenter", "ControlStrip", "NotificationCenter",
        "Spotlight", "coreaudiod", "distnoted", "cfprefsd", "opendirectoryd",
        "securityd", "trustd", "syslogd", "logd", "UserEventAgent", "mds",
        "mds_stores", "mdworker", "backupd", "powerd", "configd", "bluetoothd",
        "airportd", "wifid", "usernoted", "systemsoundserverd", "coreduetd",
        "cloudd", "bird", "nsurlsessiond", "diskarbitrationd", "fseventsd",
        "kextd", "amfid", "installd", "storagekitd", "watchdogd",
    ]

    /// True for OS daemons and services that this app refuses to quit —
    /// either because they run as `root`/a system service account, or
    /// because their name is on the protected list above.
    var isSystemCritical: Bool {
        user == "root" || user.hasPrefix("_") || Self.protectedNames.contains(name)
    }

    static func snapshotAll() -> [SystemProcess] {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/ps")
        process.arguments = ["-axo", "pid=,ppid=,pcpu=,rss=,user=,comm="]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = Pipe()

        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            return []
        }

        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        guard let output = String(data: data, encoding: .utf8) else { return [] }

        var results: [SystemProcess] = []
        for line in output.split(separator: "\n") {
            let parts = line.trimmingCharacters(in: .whitespaces)
                .split(separator: " ", maxSplits: 5, omittingEmptySubsequences: true)
            guard parts.count == 6,
                  let pid = Int32(parts[0]),
                  let ppid = Int32(parts[1]),
                  let cpu = Double(parts[2]),
                  let rssKB = UInt64(parts[3]) else { continue }

            let user = String(parts[4])
            let fullPath = String(parts[5])
            let name = fullPath.components(separatedBy: "/").last ?? fullPath

            results.append(
                SystemProcess(
                    pid: pid,
                    parentPid: ppid,
                    user: user,
                    cpuPercent: cpu,
                    residentBytes: rssKB * 1024,
                    name: name
                )
            )
        }
        return results
    }
}
