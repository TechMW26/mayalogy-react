import Foundation

final class MayaNotificationRouter {
    static let shared = MayaNotificationRouter()

    private let urlKeys = ["url", "deep_link", "path"]
    private var pendingURLString: String?

    private init() {}

    func capture(userInfo: [AnyHashable: Any]) {
        guard let resolved = resolveURLString(from: userInfo) else {
            return
        }

        pendingURLString = resolved
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .mayaNotificationRouteDidChange,
                object: nil,
                userInfo: ["url": resolved]
            )
        }
    }

    func takePendingURLString() -> String? {
        let current = pendingURLString
        pendingURLString = nil
        return current
    }

    private func resolveURLString(from userInfo: [AnyHashable: Any]) -> String? {
        for key in urlKeys {
            if let value = userInfo[key] as? String,
               let resolved = MayaConfiguration.resolveAppURL(rawURL: value)?.absoluteString {
                return resolved
            }
        }

        return nil
    }
}
