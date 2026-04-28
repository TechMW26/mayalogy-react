import UIKit
import UserNotifications
import FirebaseCore
import FirebaseMessaging

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        configureFirebaseIfAvailable()
        MayaNetworkMonitor.shared.start()
        configureNotifications(for: application)

        if let remoteNotification = launchOptions?[.remoteNotification] as? [AnyHashable: Any] {
            MayaNotificationRouter.shared.capture(userInfo: remoteNotification)
        }

        return true
    }

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        let configuration = UISceneConfiguration(
            name: "Default Configuration",
            sessionRole: connectingSceneSession.role
        )
        configuration.delegateClass = SceneDelegate.self
        return configuration
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        guard FirebaseApp.app() != nil else {
            return
        }

        Messaging.messaging().apnsToken = deviceToken
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        NSLog("APNs registration failed: \(error.localizedDescription)")
    }

    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        MayaNotificationRouter.shared.capture(userInfo: userInfo)
        completionHandler(.noData)
    }

    private func configureFirebaseIfAvailable() {
        guard FirebaseApp.app() == nil else {
            Messaging.messaging().delegate = self
            return
        }

        guard let plistPath = Bundle.main.path(
            forResource: MayaConfiguration.firebasePlistName,
            ofType: "plist"
        ), let options = FirebaseOptions(contentsOfFile: plistPath) else {
            NSLog("GoogleService-Info.plist is missing from the iOS target. Firebase messaging will stay disabled until that file is added.")
            return
        }

        FirebaseApp.configure(options: options)
        Messaging.messaging().delegate = self
    }

    private func configureNotifications(for application: UIApplication) {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        center.requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            if let error {
                NSLog("Notification authorization failed: \(error.localizedDescription)")
                return
            }

            guard granted else {
                return
            }

            DispatchQueue.main.async {
                application.registerForRemoteNotifications()
            }
        }
    }
}

extension AppDelegate: UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        MayaNotificationRouter.shared.capture(userInfo: notification.request.content.userInfo)
        completionHandler([.banner, .badge, .sound, .list])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        MayaNotificationRouter.shared.capture(userInfo: response.notification.request.content.userInfo)
        completionHandler()
    }
}

extension AppDelegate: MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let fcmToken else {
            return
        }

        MayaFcmTokenStore.shared.save(fcmToken)
    }
}
