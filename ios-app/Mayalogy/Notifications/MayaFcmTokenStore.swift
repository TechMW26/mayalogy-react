import Foundation

final class MayaFcmTokenStore {
    static let shared = MayaFcmTokenStore()

    private let tokenKey = "maya.native.fcmToken"
    private let defaults = UserDefaults.standard

    private init() {}

    func save(_ token: String) {
        let normalized = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else {
            return
        }

        if defaults.string(forKey: tokenKey) == normalized {
            return
        }

        defaults.set(normalized, forKey: tokenKey)
        post(token: normalized)
    }

    func currentToken() -> String? {
        guard let token = defaults.string(forKey: tokenKey)?.trimmingCharacters(in: .whitespacesAndNewlines),
              !token.isEmpty else {
            return nil
        }

        return token
    }

    func postCurrentToken() {
        guard let token = currentToken() else {
            return
        }

        post(token: token)
    }

    private func post(token: String) {
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .mayaFcmTokenDidChange,
                object: nil,
                userInfo: ["token": token]
            )
        }
    }
}
