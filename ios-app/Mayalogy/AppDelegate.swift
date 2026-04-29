import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    static let didReceiveAPNsTokenNotification = Notification.Name("MayaDidReceiveAPNsToken")
    static let didReceivePushPayloadNotification = Notification.Name("MayaDidReceivePushPayload")

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        registerForRemoteNotifications(application: application)

        // Surface launch-from-notification payload to the WebView
        if let remote = launchOptions?[.remoteNotification] as? [AnyHashable: Any] {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                NotificationCenter.default.post(
                    name: AppDelegate.didReceivePushPayloadNotification,
                    object: nil,
                    userInfo: remote
                )
            }
        }
        return true
    }

    private func registerForRemoteNotifications(application: UIApplication) {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        center.requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            guard granted else { return }
            DispatchQueue.main.async {
                application.registerForRemoteNotifications()
            }
        }
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(token, forKey: "MayaAPNsToken")
        NotificationCenter.default.post(
            name: AppDelegate.didReceiveAPNsTokenNotification,
            object: nil,
            userInfo: ["token": token]
        )
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NSLog("APNs registration failed: \(error.localizedDescription)")
    }

    // MARK: - UISceneSession Lifecycle
    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }
}

import UserNotifications

extension AppDelegate: UNUserNotificationCenterDelegate {
    // Foreground push presentation
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .badge])
    }

    // Tapped a push notification
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let userInfo = response.notification.request.content.userInfo
        NotificationCenter.default.post(
            name: AppDelegate.didReceivePushPayloadNotification,
            object: nil,
            userInfo: userInfo
        )
        completionHandler()
    }
}
