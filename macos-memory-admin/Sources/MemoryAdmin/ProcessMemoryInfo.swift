import Foundation

/// Resident memory usage for a single running process, as reported by `ps`.
struct ProcessMemoryInfo: Identifiable {
    let id: Int32
    let pid: Int32
    let name: String
    let residentBytes: UInt64

    static func topProcesses(limit: Int) -> [ProcessMemoryInfo] {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/ps")
        process.arguments = ["-axo", "pid=,rss=,comm="]

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

        var infos: [ProcessMemoryInfo] = []
        for line in output.split(separator: "\n") {
            let parts = line.trimmingCharacters(in: .whitespaces)
                .split(separator: " ", maxSplits: 2, omittingEmptySubsequences: true)
            guard parts.count == 3,
                  let pid = Int32(parts[0]),
                  let rssKB = UInt64(parts[1]) else { continue }

            let fullPath = String(parts[2])
            let name = fullPath.components(separatedBy: "/").last ?? fullPath
            infos.append(ProcessMemoryInfo(id: pid, pid: pid, name: name, residentBytes: rssKB * 1024))
        }

        return Array(infos.sorted { $0.residentBytes > $1.residentBytes }.prefix(limit))
    }
}
