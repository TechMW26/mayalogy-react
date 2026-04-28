import PhotosUI
import UIKit
import UniformTypeIdentifiers
import WebKit

final class MayaWebViewController: UIViewController {
    private lazy var webView: WKWebView = {
        let contentController = WKUserContentController()
        contentController.addUserScript(
            WKUserScript(
                source: bridgeBootstrapScript(),
                injectionTime: .atDocumentStart,
                forMainFrameOnly: false
            )
        )

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = contentController
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        configuration.applicationNameForUserAgent = MayaConfiguration.appUserAgentSuffix

        if #available(iOS 14.0, *) {
            let webpagePreferences = WKWebpagePreferences()
            webpagePreferences.allowsContentJavaScript = true
            configuration.defaultWebpagePreferences = webpagePreferences
        }

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.backgroundColor = UIColor(red: 0.043, green: 0.043, blue: 0.047, alpha: 1.0)
        webView.isOpaque = false
        return webView
    }()

    private let loadingView = UIVisualEffectView(effect: UIBlurEffect(style: .systemChromeMaterialDark))
    private let loadingIndicator = UIActivityIndicatorView(style: .large)
    private let loadingLabel = UILabel()

    private let offlineView = UIVisualEffectView(effect: UIBlurEffect(style: .systemChromeMaterialDark))
    private let offlineTitleLabel = UILabel()
    private let offlineSubtitleLabel = UILabel()
    private let retryButton = UIButton(type: .system)

    private var openPanelCompletionHandler: (([URL]?) -> Void)?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.043, green: 0.043, blue: 0.047, alpha: 1.0)

        setupWebViewLayout()
        setupLoadingView()
        setupOfflineView()
        setupObservers()

        MayaNetworkMonitor.shared.start()
        updateForNetworkState(isReachable: MayaNetworkMonitor.shared.isReachable)
        loadInitialURL()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        injectCurrentBridgeState(dispatchTokenEvent: true)
        loadPendingNotificationRouteIfNeeded()
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)

        guard previousTraitCollection?.userInterfaceStyle != traitCollection.userInterfaceStyle else {
            return
        }

        syncThemeToWebView()
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        .lightContent
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    private func setupWebViewLayout() {
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    private func setupLoadingView() {
        loadingView.translatesAutoresizingMaskIntoConstraints = false
        loadingIndicator.translatesAutoresizingMaskIntoConstraints = false
        loadingLabel.translatesAutoresizingMaskIntoConstraints = false
        loadingLabel.text = "Loading Mayalogy..."
        loadingLabel.textColor = .white
        loadingLabel.font = .systemFont(ofSize: 16, weight: .semibold)

        view.addSubview(loadingView)
        loadingView.contentView.addSubview(loadingIndicator)
        loadingView.contentView.addSubview(loadingLabel)

        NSLayoutConstraint.activate([
            loadingView.topAnchor.constraint(equalTo: view.topAnchor),
            loadingView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            loadingView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            loadingView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            loadingIndicator.centerXAnchor.constraint(equalTo: loadingView.contentView.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: loadingView.contentView.centerYAnchor, constant: -12),
            loadingLabel.topAnchor.constraint(equalTo: loadingIndicator.bottomAnchor, constant: 16),
            loadingLabel.centerXAnchor.constraint(equalTo: loadingView.contentView.centerXAnchor)
        ])

        loadingIndicator.startAnimating()
    }

    private func setupOfflineView() {
        offlineView.translatesAutoresizingMaskIntoConstraints = false
        offlineView.isHidden = true
        offlineTitleLabel.translatesAutoresizingMaskIntoConstraints = false
        offlineSubtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        retryButton.translatesAutoresizingMaskIntoConstraints = false

        offlineTitleLabel.text = "No internet connection"
        offlineTitleLabel.textColor = .white
        offlineTitleLabel.font = .systemFont(ofSize: 24, weight: .bold)
        offlineTitleLabel.textAlignment = .center

        offlineSubtitleLabel.text = "Reconnect and tap retry to continue your Mayalogy session."
        offlineSubtitleLabel.textColor = UIColor(white: 0.9, alpha: 1.0)
        offlineSubtitleLabel.font = .systemFont(ofSize: 15, weight: .regular)
        offlineSubtitleLabel.numberOfLines = 0
        offlineSubtitleLabel.textAlignment = .center

        var configuration = UIButton.Configuration.filled()
        configuration.title = "Retry"
        configuration.baseBackgroundColor = UIColor(red: 0.925, green: 0.761, blue: 0.208, alpha: 1.0)
        configuration.baseForegroundColor = .black
        configuration.cornerStyle = .capsule
        retryButton.configuration = configuration
        retryButton.addTarget(self, action: #selector(retryButtonTapped), for: .touchUpInside)

        view.addSubview(offlineView)
        offlineView.contentView.addSubview(offlineTitleLabel)
        offlineView.contentView.addSubview(offlineSubtitleLabel)
        offlineView.contentView.addSubview(retryButton)

        NSLayoutConstraint.activate([
            offlineView.topAnchor.constraint(equalTo: view.topAnchor),
            offlineView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            offlineView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            offlineView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            offlineTitleLabel.centerXAnchor.constraint(equalTo: offlineView.contentView.centerXAnchor),
            offlineTitleLabel.centerYAnchor.constraint(equalTo: offlineView.contentView.centerYAnchor, constant: -40),
            offlineTitleLabel.leadingAnchor.constraint(greaterThanOrEqualTo: offlineView.contentView.leadingAnchor, constant: 24),
            offlineTitleLabel.trailingAnchor.constraint(lessThanOrEqualTo: offlineView.contentView.trailingAnchor, constant: -24),
            offlineSubtitleLabel.topAnchor.constraint(equalTo: offlineTitleLabel.bottomAnchor, constant: 16),
            offlineSubtitleLabel.leadingAnchor.constraint(equalTo: offlineView.contentView.leadingAnchor, constant: 32),
            offlineSubtitleLabel.trailingAnchor.constraint(equalTo: offlineView.contentView.trailingAnchor, constant: -32),
            retryButton.topAnchor.constraint(equalTo: offlineSubtitleLabel.bottomAnchor, constant: 24),
            retryButton.centerXAnchor.constraint(equalTo: offlineView.contentView.centerXAnchor)
        ])
    }

    private func setupObservers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleFcmTokenDidChange(_:)),
            name: .mayaFcmTokenDidChange,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleNotificationRouteDidChange(_:)),
            name: .mayaNotificationRouteDidChange,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleNetworkAvailabilityDidChange(_:)),
            name: .mayaNetworkAvailabilityDidChange,
            object: nil
        )
    }

    private func loadInitialURL() {
        guard MayaNetworkMonitor.shared.isReachable else {
            showOfflineView()
            hideLoadingView()
            return
        }

        let target = MayaNotificationRouter.shared.takePendingURLString() ?? MayaConfiguration.webAppURL.absoluteString
        load(urlString: target)
    }

    private func loadPendingNotificationRouteIfNeeded() {
        guard let target = MayaNotificationRouter.shared.takePendingURLString() else {
            return
        }

        load(urlString: target)
    }

    private func load(urlString: String) {
        guard let url = URL(string: urlString) else {
            return
        }

        hideOfflineView()
        showLoadingView()
        webView.load(URLRequest(url: url))
    }

    private func showLoadingView() {
        loadingView.isHidden = false
        loadingIndicator.startAnimating()
    }

    private func hideLoadingView() {
        loadingView.isHidden = true
        loadingIndicator.stopAnimating()
    }

    private func showOfflineView() {
        offlineView.isHidden = false
        webView.isHidden = true
    }

    private func hideOfflineView() {
        offlineView.isHidden = true
        webView.isHidden = false
    }

    private func updateForNetworkState(isReachable: Bool) {
        if isReachable {
            hideOfflineView()
            if webView.url == nil {
                loadInitialURL()
            }
        } else {
            showOfflineView()
            hideLoadingView()
        }
    }

    @objc private func retryButtonTapped() {
        guard MayaNetworkMonitor.shared.isReachable else {
            showOfflineView()
            return
        }

        if let pendingRoute = MayaNotificationRouter.shared.takePendingURLString() {
            load(urlString: pendingRoute)
            return
        }

        if let currentURL = webView.url {
            load(urlString: currentURL.absoluteString)
            return
        }

        load(urlString: MayaConfiguration.webAppURL.absoluteString)
    }

    @objc private func handleFcmTokenDidChange(_ notification: Notification) {
        injectCurrentBridgeState(dispatchTokenEvent: true)
    }

    @objc private func handleNotificationRouteDidChange(_ notification: Notification) {
        guard let url = notification.userInfo?["url"] as? String else {
            return
        }

        if MayaNetworkMonitor.shared.isReachable {
            load(urlString: url)
        } else {
            showOfflineView()
        }
    }

    @objc private func handleNetworkAvailabilityDidChange(_ notification: Notification) {
        let isReachable = (notification.userInfo?["isReachable"] as? Bool) ?? MayaNetworkMonitor.shared.isReachable
        updateForNetworkState(isReachable: isReachable)
    }

    private func bridgeBootstrapScript() -> String {
        bridgeUpdateScript(dispatchTokenEvent: false)
    }

    private func injectCurrentBridgeState(dispatchTokenEvent: Bool) {
        let script = bridgeUpdateScript(dispatchTokenEvent: dispatchTokenEvent)
        webView.evaluateJavaScript(script, completionHandler: nil)
    }

    private func syncThemeToWebView() {
        let theme = currentTheme
        let script = """
        (function() {
            window.__mayaNative = window.__mayaNative || {};
            window.__mayaNative.deviceTheme = \(javaScriptQuoted(theme));
            if (window.syncThemeFromAndroid) {
                window.syncThemeFromAndroid(window.__mayaNative.deviceTheme);
            }
        })();
        """
        webView.evaluateJavaScript(script, completionHandler: nil)
    }

    private func bridgeUpdateScript(dispatchTokenEvent: Bool) -> String {
        let token = MayaFcmTokenStore.shared.currentToken() ?? ""
        let shouldDispatch = dispatchTokenEvent ? "true" : "false"
        return """
        (function() {
            window.__mayaNative = window.__mayaNative || {};
            window.__mayaNative.fcmToken = \(javaScriptQuoted(token));
            window.__mayaNative.appBaseUrl = \(javaScriptQuoted(MayaConfiguration.webAppURL.absoluteString));
            window.__mayaNative.deviceTheme = \(javaScriptQuoted(currentTheme));
            window.MayaAndroid = window.MayaAndroid || {};
            window.MayaAndroid.getFcmToken = function() { return window.__mayaNative.fcmToken || ''; };
            window.MayaAndroid.getAppBaseUrl = function() { return window.__mayaNative.appBaseUrl || ''; };
            window.MayaAndroid.getDeviceTheme = function() { return window.__mayaNative.deviceTheme || 'dark'; };
            window.MayaIOS = window.MayaAndroid;
            if (window.syncThemeFromAndroid) {
                window.syncThemeFromAndroid(window.__mayaNative.deviceTheme);
            }
            if (\(shouldDispatch) && window.__mayaNative.fcmToken) {
                if (window.onMayaFcmToken) {
                    window.onMayaFcmToken(window.__mayaNative.fcmToken);
                }
                window.dispatchEvent(new CustomEvent('maya:fcm-token', {
                    detail: { token: window.__mayaNative.fcmToken }
                }));
            }
        })();
        """
    }

    private var currentTheme: String {
        MayaConfiguration.deviceTheme(for: traitCollection)
    }

    private func javaScriptQuoted(_ value: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: [value], options: []),
              var json = String(data: data, encoding: .utf8) else {
            return "\"\""
        }

        json.removeFirst()
        json.removeLast()
        return json
    }

    private func presentAttachmentOptions(allowsMultipleSelection: Bool) {
        let alert = UIAlertController(title: "Add attachment", message: nil, preferredStyle: .actionSheet)

        if UIImagePickerController.isSourceTypeAvailable(.camera) {
            alert.addAction(UIAlertAction(title: "Camera", style: .default) { [weak self] _ in
                self?.presentCamera()
            })
        }

        alert.addAction(UIAlertAction(title: "Photos", style: .default) { [weak self] _ in
            self?.presentPhotoPicker(allowsMultipleSelection: allowsMultipleSelection)
        })
        alert.addAction(UIAlertAction(title: "Files", style: .default) { [weak self] _ in
            self?.presentDocumentPicker(allowsMultipleSelection: allowsMultipleSelection)
        })
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { [weak self] _ in
            self?.completeOpenPanel(with: nil)
        })

        if let popover = alert.popoverPresentationController {
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 44, width: 1, height: 1)
        }

        present(alert, animated: true)
    }

    private func presentCamera() {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = self
        picker.modalPresentationStyle = .fullScreen
        present(picker, animated: true)
    }

    private func presentPhotoPicker(allowsMultipleSelection: Bool) {
        var configuration = PHPickerConfiguration(photoLibrary: .shared())
        configuration.filter = .images
        configuration.selectionLimit = allowsMultipleSelection ? 0 : 1

        let picker = PHPickerViewController(configuration: configuration)
        picker.delegate = self
        present(picker, animated: true)
    }

    private func presentDocumentPicker(allowsMultipleSelection: Bool) {
        let picker = UIDocumentPickerViewController(
            forOpeningContentTypes: [.image, .movie, .data, .item],
            asCopy: true
        )
        picker.delegate = self
        picker.allowsMultipleSelection = allowsMultipleSelection
        present(picker, animated: true)
    }

    private func completeOpenPanel(with urls: [URL]?) {
        let completion = openPanelCompletionHandler
        openPanelCompletionHandler = nil
        completion?(urls)
    }

    private func copyToTemporaryUploads(url: URL) -> URL? {
        let fileManager = FileManager.default
        let directory = fileManager.temporaryDirectory.appendingPathComponent(MayaConfiguration.uploadCacheDirectoryName, isDirectory: true)
        try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)

        let destination = directory.appendingPathComponent(UUID().uuidString + "-" + url.lastPathComponent)
        try? fileManager.removeItem(at: destination)

        do {
            try fileManager.copyItem(at: url, to: destination)
            return destination
        } catch {
            NSLog("Could not copy picked file: \(error.localizedDescription)")
            return nil
        }
    }

    private func persistCapturedImage(_ image: UIImage) -> URL? {
        let fileManager = FileManager.default
        let directory = fileManager.temporaryDirectory.appendingPathComponent(MayaConfiguration.uploadCacheDirectoryName, isDirectory: true)
        try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)

        let destination = directory.appendingPathComponent(UUID().uuidString + ".jpg")
        guard let data = image.jpegData(compressionQuality: 0.92) else {
            return nil
        }

        do {
            try data.write(to: destination)
            return destination
        } catch {
            NSLog("Could not persist captured image: \(error.localizedDescription)")
            return nil
        }
    }
}

extension MayaWebViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        showLoadingView()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        hideLoadingView()
        hideOfflineView()
        injectCurrentBridgeState(dispatchTokenEvent: true)
    }

    func webView(
        _ webView: WKWebView,
        didFail navigation: WKNavigation!,
        withError error: Error
    ) {
        NSLog("WebView navigation failed: \(error.localizedDescription)")
        if !MayaNetworkMonitor.shared.isReachable {
            showOfflineView()
        }
        hideLoadingView()
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        NSLog("WebView provisional navigation failed: \(error.localizedDescription)")
        if !MayaNetworkMonitor.shared.isReachable {
            showOfflineView()
        }
        hideLoadingView()
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        // Allow embedded iframes like the YouTube player to load inside the web view.
        if navigationAction.targetFrame?.isMainFrame == false {
            decisionHandler(.allow)
            return
        }

        if let scheme = url.scheme?.lowercased(), ["tel", "mailto"].contains(scheme) {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }

        if MayaConfiguration.isInternal(url: url) || url.isFileURL {
            decisionHandler(.allow)
            return
        }

        UIApplication.shared.open(url)
        decisionHandler(.cancel)
    }
}

extension MayaWebViewController: WKUIDelegate {
    @available(iOS 18.4, *)
    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping ([URL]?) -> Void
    ) {
        openPanelCompletionHandler = completionHandler
        presentAttachmentOptions(allowsMultipleSelection: parameters.allowsMultipleSelection)
    }

    @available(iOS 15.0, *)
    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        decisionHandler(.grant)
    }
}

extension MayaWebViewController: PHPickerViewControllerDelegate {
    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)

        guard !results.isEmpty else {
            completeOpenPanel(with: nil)
            return
        }

        let group = DispatchGroup()
        let lock = NSLock()
        var urls = [URL]()

        for result in results {
            let provider = result.itemProvider
            let typeIdentifier = provider.registeredTypeIdentifiers.first ?? UTType.image.identifier
            group.enter()
            provider.loadFileRepresentation(forTypeIdentifier: typeIdentifier) { [weak self] temporaryURL, _ in
                defer { group.leave() }

                guard let self,
                      let temporaryURL,
                      let copiedURL = self.copyToTemporaryUploads(url: temporaryURL) else {
                    return
                }

                lock.lock()
                urls.append(copiedURL)
                lock.unlock()
            }
        }

        group.notify(queue: .main) { [weak self] in
            self?.completeOpenPanel(with: urls.isEmpty ? nil : urls)
        }
    }
}

extension MayaWebViewController: UIDocumentPickerDelegate {
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        let copiedURLs = urls.compactMap { url -> URL? in
            let accessed = url.startAccessingSecurityScopedResource()
            defer {
                if accessed {
                    url.stopAccessingSecurityScopedResource()
                }
            }
            return copyToTemporaryUploads(url: url)
        }
        completeOpenPanel(with: copiedURLs.isEmpty ? nil : copiedURLs)
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        completeOpenPanel(with: nil)
    }
}

extension MayaWebViewController: UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
        completeOpenPanel(with: nil)
    }

    func imagePickerController(
        _ picker: UIImagePickerController,
        didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
    ) {
        picker.dismiss(animated: true)

        if let imageURL = info[.imageURL] as? URL,
           let copiedURL = copyToTemporaryUploads(url: imageURL) {
            completeOpenPanel(with: [copiedURL])
            return
        }

        if let image = info[.originalImage] as? UIImage,
           let persistedURL = persistCapturedImage(image) {
            completeOpenPanel(with: [persistedURL])
            return
        }

        completeOpenPanel(with: nil)
    }
}
