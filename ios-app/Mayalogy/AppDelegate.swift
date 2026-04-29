import UIKit
import UserNotifications
import FirebaseCore
import FirebaseMessaging

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    static let didReceiveAPNsTokenNotification = Notification.Name("MayaDidReceiveAPNsToken")
    static let didReceiveFCMTokenNotification  = Notification.Name("MayaDidReceiveFCMToken")
    static let didReceivePushPayloadNotification = Notification.Name("MayaDidReceivePushPayload")

    static let apnsTokenUserDefaultsKey = "MayaAPNsToken"
    static let fcmTokenUserDefaultsKey  = "MayaFCMToken"

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        FirebaseApp.configure()
        Messaging.messaging().delegate = self

        registerForRemoteNotifications(application: application)

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
        // Forward APNs token to Firebase so it can mint an FCM token.
        Messaging.messaging().apnsToken = deviceToken

        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(token, forKey: AppDelegate.apnsTokenUserDefaultsKey)
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

    // Silent / data remote notification
    func application(_ application: UIApplication,
                     didReceiveRemoteNotification userInfo: [AnyHashable : Any],
                     fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        NotificationCenter.default.post(
            name: AppDelegate.didReceivePushPayloadNotification,
            object: nil,
            userInfo: userInfo
        )
        completionHandler(.newData)
    }

    // MARK: - UISceneSession Lifecycle
    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }
}

// MARK: - MessagingDelegate (FCM)
extension AppDelegate: MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken, !token.isEmpty else { return }
        UserDefaults.standard.set(token, forKey: AppDelegate.fcmTokenUserDefaultsKey)
        NotificationCenter.default.post(
            name: AppDelegate.didReceiveFCMTokenNotification,
            object: nil,
            userInfo: ["token": token]
        )
        NSLog("FCM registration token: \(token)")
    }
}

// MARK: - UNUserNotificationCenterDelegate
extension AppDelegate: UNUserNotificationCenterDelegate {
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .badge, .list])
    }

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
