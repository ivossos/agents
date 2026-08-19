import Foundation

/// A snapshot of system-wide RAM usage, read from the Mach kernel's
/// virtual memory statistics (the same source `vm_stat` and Activity
/// Monitor use).
struct MemoryStats {
    let totalBytes: UInt64
    let wiredBytes: UInt64
    let activeBytes: UInt64
    let inactiveBytes: UInt64
    let compressedBytes: UInt64
    let freeBytes: UInt64

    /// Wired + active + compressed pages, mirroring Activity Monitor's "Memory Used".
    var usedBytes: UInt64 {
        wiredBytes + activeBytes + compressedBytes
    }

    var usedFraction: Double {
        totalBytes > 0 ? Double(usedBytes) / Double(totalBytes) : 0
    }

    static func current() -> MemoryStats? {
        var size = mach_msg_type_number_t(
            MemoryLayout<vm_statistics64_data_t>.stride / MemoryLayout<integer_t>.stride
        )
        var rawStats = vm_statistics64_data_t()
        let result = withUnsafeMutablePointer(to: &rawStats) { pointer -> kern_return_t in
            pointer.withMemoryRebound(to: integer_t.self, capacity: Int(size)) {
                host_statistics64(mach_host_self(), HOST_VM_INFO64, $0, &size)
            }
        }
        guard result == KERN_SUCCESS else { return nil }

        var totalMemory: UInt64 = 0
        var len = MemoryLayout<UInt64>.size
        sysctlbyname("hw.memsize", &totalMemory, &len, nil, 0)

        let pageSize = UInt64(vm_kernel_page_size)
        return MemoryStats(
            totalBytes: totalMemory,
            wiredBytes: UInt64(rawStats.wire_count) * pageSize,
            activeBytes: UInt64(rawStats.active_count) * pageSize,
            inactiveBytes: UInt64(rawStats.inactive_count) * pageSize,
            compressedBytes: UInt64(rawStats.compressor_page_count) * pageSize,
            freeBytes: UInt64(rawStats.free_count) * pageSize
        )
    }
}
