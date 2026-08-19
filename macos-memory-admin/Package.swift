// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MemoryAdmin",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "MemoryAdmin",
            path: "Sources/MemoryAdmin"
        )
    ]
)
