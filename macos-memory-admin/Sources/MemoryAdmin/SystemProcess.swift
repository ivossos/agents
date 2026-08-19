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
