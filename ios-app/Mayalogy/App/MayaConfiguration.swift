import Foundation
import UIKit

enum MayaConfiguration {
    static let webAppURL = URL(string: "https://www.mayalogy.in/")!
    static let allowedHosts: Set<String> = ["www.mayalogy.in", "mayalogy.in", "localhost"]
    static let firebasePlistName = "GoogleService-Info"
    static let appUserAgentSuffix = "MAYAAstrology-iOS/1.0"
    static let uploadCacheDirectoryName = "MayaUploads"

    static func resolveAppURL(rawURL: String?) -> URL? {
        guard let rawURL, !rawURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return nil
        }

        let trimmed = rawURL.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") {
            return URL(string: trimmed)
        }

        return URL(string: trimmed, relativeTo: webAppURL)?.absoluteURL
    }

    static func isInternal(url: URL) -> Bool {
        guard let host = url.host?.lowercased() else {
            return url.isFileURL
        }

        return allowedHosts.contains(host) || allowedHosts.contains { host.hasSuffix("." + $0) }
    }

    static func deviceTheme(for traitCollection: UITraitCollection) -> String {
        traitCollection.userInterfaceStyle == .light ? "light" : "dark"
    }
}

extension Notification.Name {
    static let mayaFcmTokenDidChange = Notification.Name("mayaFcmTokenDidChange")
    static let mayaNotificationRouteDidChange = Notification.Name("mayaNotificationRouteDidChange")
    static let mayaNetworkAvailabilityDidChange = Notification.Name("mayaNetworkAvailabilityDidChange")
}
