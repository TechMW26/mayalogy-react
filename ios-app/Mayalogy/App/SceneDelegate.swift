import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else {
            return
        }

        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = MayaWebViewController()
        self.window = window
        window.makeKeyAndVisible()

        if let response = connectionOptions.notificationResponse {
            MayaNotificationRouter.shared.capture(userInfo: response.notification.request.content.userInfo)
        }
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        MayaFcmTokenStore.shared.postCurrentToken()
    }
}
