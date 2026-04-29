import UIKit
import WebKit
import AVFoundation
import Photos
import PhotosUI
import CoreLocation

final class WebViewController: UIViewController {

    // MARK: - Config
    private let webAppURL = URL(string: "https://www.mayalogy.in/")!
    private let allowedHosts: Set<String> = ["mayalogy.in", "www.mayalogy.in", "localhost"]
    private let userAgentSuffix = "MAYAAstrology-iOS/1.0"

    // MARK: - State
    private var webView: WKWebView!
    private var refreshControl: UIRefreshControl!
    private var progressView: UIProgressView!
    private var offlineView: OfflineView!
    private var pendingNotificationURL: URL?

    // MARK: - Lifecycle
    override func loadView() {
        view = UIView()
        view.backgroundColor = UIColor(red: 0x0b/255, green: 0x0b/255, blue: 0x0c/255, alpha: 1)

        configureWebView()
        configureProgressView()
        configureOfflineView()
        configureNotificationObservers()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        loadHomePage()
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    deinit {
        webView?.removeObserver(self, forKeyPath: "estimatedProgress")
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Setup
    private func configureWebView() {
        let config = WKWebViewConfiguration()
        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.websiteDataStore = .default()

        // JS bridge: window.webkit.messageHandlers.maya.postMessage(...)
        let contentController = WKUserContentController()
        contentController.add(MayaScriptMessageHandler(host: self), name: "maya")
        contentController.addUserScript(makeBridgeUserScript())
        config.userContentController = contentController

        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsLinkPreview = false
        webView.scrollView.bounces = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.customUserAgent = (webView.value(forKey: "userAgent") as? String).map { "\($0) \(userAgentSuffix)" } ?? userAgentSuffix
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        webView.scrollView.backgroundColor = view.backgroundColor

        refreshControl = UIRefreshControl()
        refreshControl.tintColor = .white
        refreshControl.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl

        webView.addObserver(self, forKeyPath: "estimatedProgress", options: .new, context: nil)

        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
    }

    private func configureProgressView() {
        progressView = UIProgressView(progressViewStyle: .bar)
        progressView.translatesAutoresizingMaskIntoConstraints = false
        progressView.progressTintColor = UIColor(red: 0xff/255, green: 0xc1/255, blue: 0x07/255, alpha: 1)
        progressView.trackTintColor = .clear
        progressView.alpha = 0
        view.addSubview(progressView)
        NSLayoutConstraint.activate([
            progressView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            progressView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progressView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progressView.heightAnchor.constraint(equalToConstant: 2)
        ])
    }

    private func configureOfflineView() {
        offlineView = OfflineView()
        offlineView.translatesAutoresizingMaskIntoConstraints = false
        offlineView.isHidden = true
        offlineView.onRetry = { [weak self] in
            guard let self = self else { return }
            self.offlineView.isHidden = true
            if self.webView.url == nil {
                self.loadHomePage()
            } else {
                self.webView.reload()
            }
        }
        view.addSubview(offlineView)
        NSLayoutConstraint.activate([
            offlineView.topAnchor.constraint(equalTo: view.topAnchor),
            offlineView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            offlineView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            offlineView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
    }

    private func configureNotificationObservers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAPNsToken(_:)),
            name: AppDelegate.didReceiveAPNsTokenNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handlePushPayload(_:)),
            name: AppDelegate.didReceivePushPayloadNotification,
            object: nil
        )
    }

    // MARK: - Loading
    private func loadHomePage() {
        let target = pendingNotificationURL ?? webAppURL
        pendingNotificationURL = nil
        var req = URLRequest(url: target)
        req.cachePolicy = .useProtocolCachePolicy
        webView.load(req)
    }

    @objc private func handleRefresh() {
        webView.reload()
    }

    // MARK: - JS bridge user script
    private func makeBridgeUserScript() -> WKUserScript {
        let token = UserDefaults.standard.string(forKey: "MayaAPNsToken") ?? ""
        let baseURL = webAppURL.absoluteString
        let escaped = token.replacingOccurrences(of: "\"", with: "\\\"")
        let js = """
        (function() {
            window.MayaIOS = {
                platform: 'ios',
                getApnsToken: function(){ return "\(escaped)"; },
                getFcmToken: function(){ return "\(escaped)"; },
                getAppBaseUrl: function(){ return "\(baseURL)"; }
            };
            // Compatibility shim so the existing Android code paths keep working.
            if (!window.MayaAndroid) {
                window.MayaAndroid = {
                    getFcmToken: function(){ return window.MayaIOS.getApnsToken(); },
                    getAppBaseUrl: function(){ return window.MayaIOS.getAppBaseUrl(); }
                };
            }
        })();
        """
        return WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    }

    private func injectAPNsToken(_ token: String) {
        let escaped = token.replacingOccurrences(of: "\"", with: "\\\"")
        let js = """
        (function() {
            var token = "\(escaped)";
            if (window.MayaIOS) { window.MayaIOS._token = token; }
            if (window.onMayaFcmToken) { window.onMayaFcmToken(token); }
            window.dispatchEvent(new CustomEvent('maya:fcm-token', { detail: { token: token } }));
            window.dispatchEvent(new CustomEvent('maya:apns-token', { detail: { token: token } }));
        })();
        """
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    // MARK: - Notifications
    @objc private func handleAPNsToken(_ note: Notification) {
        guard let token = note.userInfo?["token"] as? String else { return }
        injectAPNsToken(token)
    }

    @objc private func handlePushPayload(_ note: Notification) {
        guard let info = note.userInfo else { return }
        let candidate = (info["url"] as? String)
            ?? (info["deep_link"] as? String)
            ?? (info["path"] as? String)
        guard let raw = candidate, let resolved = resolveAppURL(raw) else { return }
        if isViewLoaded && view.window != nil {
            webView.load(URLRequest(url: resolved))
        } else {
            pendingNotificationURL = resolved
        }
    }

    private func resolveAppURL(_ raw: String) -> URL? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") {
            return URL(string: trimmed)
        }
        if trimmed.hasPrefix("/") {
            return URL(string: trimmed, relativeTo: webAppURL)?.absoluteURL
        }
        return URL(string: "/" + trimmed, relativeTo: webAppURL)?.absoluteURL
    }

    // MARK: - KVO
    override func observeValue(forKeyPath keyPath: String?, of object: Any?,
                               change: [NSKeyValueChangeKey : Any]?, context: UnsafeMutableRawPointer?) {
        guard keyPath == "estimatedProgress" else { return }
        let p = Float(webView.estimatedProgress)
        progressView.setProgress(p, animated: true)
        if p >= 1.0 {
            UIView.animate(withDuration: 0.25, delay: 0.2, options: [], animations: {
                self.progressView.alpha = 0
            }, completion: { _ in self.progressView.setProgress(0, animated: false) })
        } else {
            progressView.alpha = 1
        }
    }
}

// MARK: - WKNavigationDelegate
extension WebViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow); return
        }

        // Allow non-main frames (iframes like the embedded YouTube player)
        if navigationAction.targetFrame?.isMainFrame == false {
            decisionHandler(.allow); return
        }

        let scheme = url.scheme?.lowercased() ?? ""
        switch scheme {
        case "http", "https":
            if let host = url.host?.lowercased(),
               allowedHosts.contains(host) || host.hasSuffix(".mayalogy.in") {
                decisionHandler(.allow)
            } else {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
                decisionHandler(.cancel)
            }
        case "tel", "mailto", "sms", "facetime", "facetime-audio", "itms-apps", "maps":
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            decisionHandler(.cancel)
        case "about":
            decisionHandler(.allow)
        default:
            if UIApplication.shared.canOpenURL(url) {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        offlineView.isHidden = true
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        refreshControl.endRefreshing()
        if let token = UserDefaults.standard.string(forKey: "MayaAPNsToken"), !token.isEmpty {
            injectAPNsToken(token)
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        refreshControl.endRefreshing()
        handleNavigationError(error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        refreshControl.endRefreshing()
        handleNavigationError(error)
    }

    private func handleNavigationError(_ error: Error) {
        let nsErr = error as NSError
        // Ignore "frame load interrupted" (caused by openURL on external links)
        if nsErr.domain == "WebKitErrorDomain" && nsErr.code == 102 { return }
        if nsErr.domain == NSURLErrorDomain {
            switch nsErr.code {
            case NSURLErrorCancelled: return
            case NSURLErrorNotConnectedToInternet,
                 NSURLErrorTimedOut,
                 NSURLErrorCannotFindHost,
                 NSURLErrorCannotConnectToHost,
                 NSURLErrorNetworkConnectionLost:
                offlineView.isHidden = false
                return
            default: break
            }
        }
        offlineView.isHidden = false
    }
}

// MARK: - WKUIDelegate (popups, JS dialogs, media perms)
extension WebViewController: WKUIDelegate {
    // Handle window.open / target=_blank by loading in the same webview
    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, navigationAction.targetFrame == nil {
            if let host = url.host?.lowercased(),
               allowedHosts.contains(host) || host.hasSuffix(".mayalogy.in") {
                webView.load(navigationAction.request)
            } else {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
        }
        return nil
    }

    // Auto-grant camera / microphone if the system permission was already granted
    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView,
                 requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo,
                 type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.prompt) // let system handle the OS-level prompt
    }

    // Bridge JS alert/confirm/prompt to native UIAlertController
    func webView(_ webView: WKWebView,
                 runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView,
                 runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView,
                 runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            completionHandler(alert.textFields?.first?.text)
        })
        present(alert, animated: true)
    }
}

// MARK: - JS message handler (window.webkit.messageHandlers.maya.postMessage(...))
private final class MayaScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var host: WebViewController?
    init(host: WebViewController) { self.host = host }
    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        // Hook for future native calls from JS (e.g. share, haptics)
        // Payload shape: { action: 'share', data: {...} }
    }
}
