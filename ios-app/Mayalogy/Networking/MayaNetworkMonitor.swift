import Foundation
import Network

final class MayaNetworkMonitor {
    static let shared = MayaNetworkMonitor()

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.maya.astrology.network-monitor")
    private(set) var isReachable = true
    private var hasStarted = false

    private init() {}

    func start() {
        guard !hasStarted else {
            return
        }

        hasStarted = true
        monitor.pathUpdateHandler = { [weak self] path in
            guard let self else {
                return
            }

            let reachable = path.status == .satisfied
            guard self.isReachable != reachable else {
                return
            }

            self.isReachable = reachable
            DispatchQueue.main.async {
                NotificationCenter.default.post(
                    name: .mayaNetworkAvailabilityDidChange,
                    object: nil,
                    userInfo: ["isReachable": reachable]
                )
            }
        }
        monitor.start(queue: queue)
    }
}
