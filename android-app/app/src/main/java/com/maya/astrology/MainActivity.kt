package com.maya.astrology

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.provider.Settings
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.*
import android.widget.Toast
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.google.firebase.messaging.FirebaseMessaging
import com.maya.astrology.databinding.ActivityMainBinding
import java.io.File
import java.io.IOException
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var cameraPhotoPath: String? = null
    
    // Permission request codes
    private lateinit var locationPermissionLauncher: ActivityResultLauncher<Array<String>>
    private lateinit var cameraPermissionLauncher: ActivityResultLauncher<Array<String>>
    private lateinit var fileChooserLauncher: ActivityResultLauncher<Intent>
    private lateinit var notificationPermissionLauncher: ActivityResultLauncher<String>
    
    // Pending permission callbacks
    private var pendingGeolocationCallback: GeolocationPermissions.Callback? = null
    private var pendingGeolocationOrigin: String? = null
    
    // Network monitoring
    private lateinit var connectivityManager: ConnectivityManager
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var isNetworkAvailable = true
    private var pendingNotificationUrl: String? = null
    
    // Web app URL - load from hosted URL
    private val webAppUrl = "https://www.mayalogy.in/"

    companion object {
        private const val TAG = "MAYAAstrology"
        private const val NOTIFICATION_PERMISSION_REQUESTED = "notification_permission_requested"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Ensure system bar insets are respected - content doesn't overlap
        WindowCompat.setDecorFitsSystemWindows(window, true)
        
        // Set system bar colors to match app theme (#0b0b0c)
        val darkColor = android.graphics.Color.parseColor("#0b0b0c")
        window.statusBarColor = darkColor
        window.navigationBarColor = darkColor
        
        // Handle display cutout for notched phones (API 28+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
        
        // Set light status bar icons to false (use white icons on dark background)
        val windowInsetsController = WindowInsetsControllerCompat(window, window.decorView)
        windowInsetsController.isAppearanceLightStatusBars = false
        windowInsetsController.isAppearanceLightNavigationBars = false
        
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupPermissionLaunchers()
        setupNetworkMonitoring()
        setupWebView()
        setupOfflinePage()
        MayaPushNotifications.ensureChannel(this)
        extractNotificationIntent(intent)
        refreshFirebaseToken()
        
        // Check initial network state and load appropriate content
        checkNetworkAndLoad()
    }

    private fun setupPermissionLaunchers() {
        // Location permission launcher
        locationPermissionLauncher = registerForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions()
        ) { permissions ->
            val fineLocationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
            val coarseLocationGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
            
            pendingGeolocationCallback?.invoke(
                pendingGeolocationOrigin,
                fineLocationGranted || coarseLocationGranted,
                false
            )
            pendingGeolocationCallback = null
            pendingGeolocationOrigin = null
        }
        
        // Camera permission launcher
        cameraPermissionLauncher = registerForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions()
        ) { permissions ->
            val cameraGranted = permissions[Manifest.permission.CAMERA] ?: false
            if (cameraGranted) {
                Log.d(TAG, "Camera permission granted")
            } else {
                Toast.makeText(this, "Camera permission is needed for Vastu scanning", Toast.LENGTH_SHORT).show()
            }
        }
        
        // File chooser launcher (for camera/gallery)
        fileChooserLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            if (result.resultCode == Activity.RESULT_OK) {
                val data = result.data
                var results: Array<Uri>? = null
                
                // Check if result is from camera
                if (data == null || data.data == null) {
                    // Camera result
                    cameraPhotoPath?.let { path ->
                        results = arrayOf(Uri.parse(path))
                    }
                } else {
                    // Gallery/file result
                    data.data?.let { uri ->
                        results = arrayOf(uri)
                    }
                }
                
                filePathCallback?.onReceiveValue(results)
            } else {
                filePathCallback?.onReceiveValue(null)
            }
            filePathCallback = null
        }

        notificationPermissionLauncher = registerForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { granted ->
            if (!granted && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                Log.w(TAG, "Notification permission denied")
            }
            injectNotificationPermissionState()
        }
    }

    private fun setupNetworkMonitoring() {
        connectivityManager = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
        
        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                runOnUiThread {
                    Log.d(TAG, "Network available")
                    isNetworkAvailable = true
                    hideOfflinePage()
                    
                    // Reload if currently showing offline page
                    if (binding.offlineLayout.visibility == View.VISIBLE) {
                        binding.webView.reload()
                    }
                }
            }
            
            override fun onLost(network: Network) {
                runOnUiThread {
                    Log.d(TAG, "Network lost")
                    isNetworkAvailable = false
                    // Show offline page since we're loading from URL
                    showOfflinePage()
                }
            }
            
            override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
                val hasInternet = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                runOnUiThread {
                    isNetworkAvailable = hasInternet
                }
            }
        }
        
        val networkRequest = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        
        connectivityManager.registerNetworkCallback(networkRequest, networkCallback!!)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        binding.webView.apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = true
                allowContentAccess = true
                loadWithOverviewMode = true
                useWideViewPort = true
                builtInZoomControls = false
                displayZoomControls = false
                setSupportZoom(false)
                cacheMode = WebSettings.LOAD_DEFAULT
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                mediaPlaybackRequiresUserGesture = false
                
                // Enable geolocation
                setGeolocationEnabled(true)
                
                // User agent
                userAgentString = "$userAgentString MAYAAstrology-Android/1.0"
            }

            addJavascriptInterface(MayaWebAppBridge(), "MayaAndroid")
            
            // WebView client for handling page navigation
            webViewClient = object : WebViewClient() {
                override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                    super.onPageStarted(view, url, favicon)
                    showLoading()
                }
                
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    hideLoading()
                    hideOfflinePage()
                    injectFcmTokenToWebView()
                    injectNotificationPermissionState()
                }
                
                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    super.onReceivedError(view, request, error)
                    if (request?.isForMainFrame == true) {
                        Log.e(TAG, "WebView error: ${error?.description}")
                        if (!isNetworkAvailable) {
                            showOfflinePage()
                        }
                    }
                }
                
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val url = request?.url?.toString() ?: return false
                    
                    // Handle external links
                    return if (url.startsWith("http://") || url.startsWith("https://")) {
                        if (url.contains("mayalogy.in") || url.contains("maya") || url.contains("localhost") || url.startsWith("file://")) {
                            false // Load in WebView
                        } else {
                            // Open in external browser
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                            startActivity(intent)
                            true
                        }
                    } else if (url.startsWith("tel:") || url.startsWith("mailto:")) {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        startActivity(intent)
                        true
                    } else {
                        false
                    }
                }
            }
            
            // WebChromeClient for handling permissions, file chooser, etc.
            webChromeClient = object : WebChromeClient() {
                
                // Handle geolocation permission
                override fun onGeolocationPermissionsShowPrompt(
                    origin: String?,
                    callback: GeolocationPermissions.Callback?
                ) {
                    if (hasLocationPermission()) {
                        callback?.invoke(origin, true, false)
                    } else {
                        pendingGeolocationCallback = callback
                        pendingGeolocationOrigin = origin
                        requestLocationPermission()
                    }
                }
                
                // Handle file chooser (camera/gallery)
                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = filePathCallback
                    
                    // Check camera permission
                    if (!hasCameraPermission()) {
                        requestCameraPermission()
                    }
                    
                    openFileChooser(fileChooserParams)
                    return true
                }
                
                // Handle permission request from JavaScript
                override fun onPermissionRequest(request: PermissionRequest?) {
                    request?.let { permRequest ->
                        val resources = permRequest.resources
                        val grantedResources = mutableListOf<String>()
                        
                        for (resource in resources) {
                            when (resource) {
                                PermissionRequest.RESOURCE_VIDEO_CAPTURE -> {
                                    if (hasCameraPermission()) {
                                        grantedResources.add(resource)
                                    } else {
                                        requestCameraPermission()
                                    }
                                }
                                PermissionRequest.RESOURCE_AUDIO_CAPTURE -> {
                                    grantedResources.add(resource)
                                }
                                else -> {
                                    grantedResources.add(resource)
                                }
                            }
                        }
                        
                        if (grantedResources.isNotEmpty()) {
                            runOnUiThread {
                                permRequest.grant(grantedResources.toTypedArray())
                            }
                        } else {
                            runOnUiThread {
                                permRequest.deny()
                            }
                        }
                    }
                }
                
                // Console messages for debugging
                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                    Log.d(TAG, "WebView Console: ${consoleMessage?.message()}")
                    return true
                }
            }
        }
    }

    private fun setupOfflinePage() {
        binding.retryButton.setOnClickListener {
            if (isNetworkAvailable) {
                hideOfflinePage()
                binding.webView.reload()
            } else {
                Toast.makeText(this, "No internet connection", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun checkNetworkAndLoad() {
        val activeNetwork = connectivityManager.activeNetwork
        val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork)
        isNetworkAvailable = capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
        
        if (isNetworkAvailable) {
            binding.webView.loadUrl(getLaunchUrl())
        } else {
            showOfflinePage()
        }
    }

    private fun showOfflinePage() {
        binding.offlineLayout.visibility = View.VISIBLE
        binding.webView.visibility = View.GONE
        binding.loadingLayout.visibility = View.GONE
    }

    private fun hideOfflinePage() {
        binding.offlineLayout.visibility = View.GONE
        binding.webView.visibility = View.VISIBLE
    }

    private fun showLoading() {
        binding.loadingLayout.visibility = View.VISIBLE
    }

    private fun hideLoading() {
        binding.loadingLayout.visibility = View.GONE
    }

    // Permission helpers
    private fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == 
            PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == 
            PackageManager.PERMISSION_GRANTED
    }

    private fun hasCameraPermission(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == 
            PackageManager.PERMISSION_GRANTED
    }

    private fun requestLocationPermission() {
        if (shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_FINE_LOCATION)) {
            AlertDialog.Builder(this)
                .setTitle("Location Permission")
                .setMessage("MAYA needs location access for accurate Vastu analysis based on your geographical position.")
                .setPositiveButton("Grant") { _, _ ->
                    locationPermissionLauncher.launch(
                        arrayOf(
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                        )
                    )
                }
                .setNegativeButton("Cancel") { dialog, _ ->
                    dialog.dismiss()
                    pendingGeolocationCallback?.invoke(pendingGeolocationOrigin, false, false)
                    pendingGeolocationCallback = null
                }
                .show()
        } else {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }

    private fun requestCameraPermission() {
        val permissions = mutableListOf(Manifest.permission.CAMERA)
        
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            permissions.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
        }
        
        if (shouldShowRequestPermissionRationale(Manifest.permission.CAMERA)) {
            AlertDialog.Builder(this)
                .setTitle("Camera Permission")
                .setMessage("MAYA needs camera access for Vastu room scanning and analysis.")
                .setPositiveButton("Grant") { _, _ ->
                    cameraPermissionLauncher.launch(permissions.toTypedArray())
                }
                .setNegativeButton("Cancel") { dialog, _ ->
                    dialog.dismiss()
                }
                .show()
        } else {
            cameraPermissionLauncher.launch(permissions.toTypedArray())
        }
    }

    private fun hasNotificationPermission(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || hasNotificationPermission()) {
            injectNotificationPermissionState()
            return
        }

        if (shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
            AlertDialog.Builder(this)
                .setTitle(R.string.notification_permission_title)
                .setMessage(R.string.notification_permission_message)
                .setPositiveButton(R.string.grant) { _, _ ->
                    notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
                .setNegativeButton(R.string.cancel) { dialog, _ ->
                    dialog.dismiss()
                }
                .show()
        } else if (getPreferences(MODE_PRIVATE).getBoolean(NOTIFICATION_PERMISSION_REQUESTED, false)) {
            openNotificationSettings()
        } else {
            getPreferences(MODE_PRIVATE).edit().putBoolean(NOTIFICATION_PERMISSION_REQUESTED, true).apply()
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun getNotificationPermissionState(): String {
        if (hasNotificationPermission()) return "granted"
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return "granted"
        val requested = getPreferences(MODE_PRIVATE).getBoolean(NOTIFICATION_PERMISSION_REQUESTED, false)
        return if (!requested || shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
            "prompt"
        } else {
            "blocked"
        }
    }

    private fun openNotificationSettings() {
        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
            putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
        }
        startActivity(intent)
    }

    private fun refreshFirebaseToken() {
        FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->
                if (!task.isSuccessful) {
                    Log.w(TAG, "Unable to fetch FCM token", task.exception)
                    return@addOnCompleteListener
                }

                val token = task.result
                if (!token.isNullOrBlank()) {
                    FcmTokenStore.saveToken(this, token)
                    injectFcmTokenToWebView()
                }
            }
    }

    private fun extractNotificationIntent(intent: Intent?) {
        val rawUrl = intent?.getStringExtra(MayaPushNotifications.EXTRA_NOTIFICATION_URL)
        pendingNotificationUrl = resolveAppUrl(rawUrl)
    }

    private fun getLaunchUrl(): String {
        return pendingNotificationUrl?.also { pendingNotificationUrl = null } ?: webAppUrl
    }

    private fun loadPendingNotificationUrl() {
        val notificationUrl = pendingNotificationUrl ?: return
        pendingNotificationUrl = null

        if (isNetworkAvailable) {
            hideOfflinePage()
            binding.webView.loadUrl(notificationUrl)
        } else {
            showOfflinePage()
        }
    }

    private fun resolveAppUrl(rawUrl: String?): String? {
        if (rawUrl.isNullOrBlank()) {
            return null
        }

        val trimmed = rawUrl.trim()
        return when {
            trimmed.startsWith("http://") || trimmed.startsWith("https://") -> trimmed
            trimmed.startsWith("/") -> webAppUrl.trimEnd('/') + trimmed
            else -> webAppUrl.trimEnd('/') + "/" + trimmed.removePrefix("/")
        }
    }

    private fun injectFcmTokenToWebView() {
        val token = FcmTokenStore.getToken(this) ?: return
        val tokenJson = JSONObject.quote(token)
        val script = """
            (function() {
                var token = $tokenJson;
                if (window.onMayaFcmToken) {
                    window.onMayaFcmToken(token);
                }
                window.dispatchEvent(new CustomEvent('maya:fcm-token', {
                    detail: { token: token }
                }));
            })();
        """.trimIndent()

        binding.webView.post {
            binding.webView.evaluateJavascript(script, null)
        }
    }

    private fun injectNotificationPermissionState() {
        val stateJson = JSONObject.quote(getNotificationPermissionState())
        val script = """
            window.dispatchEvent(new CustomEvent('maya:notification-permission', {
                detail: { state: $stateJson }
            }));
        """.trimIndent()

        binding.webView.post {
            binding.webView.evaluateJavascript(script, null)
        }
    }

    private inner class MayaWebAppBridge {
        @JavascriptInterface
        fun getFcmToken(): String {
            return FcmTokenStore.getToken(this@MainActivity).orEmpty()
        }

        @JavascriptInterface
        fun getAppBaseUrl(): String {
            return webAppUrl
        }

        @JavascriptInterface
        fun getNotificationPermissionState(): String {
            return this@MainActivity.getNotificationPermissionState()
        }

        @JavascriptInterface
        fun requestNotificationPermission() {
            runOnUiThread {
                requestNotificationPermissionIfNeeded()
            }
        }
    }

    private fun openFileChooser(fileChooserParams: WebChromeClient.FileChooserParams?) {
        val acceptTypes = fileChooserParams?.acceptTypes ?: arrayOf("image/*")
        val captureEnabled = fileChooserParams?.isCaptureEnabled ?: true
        
        val intents = mutableListOf<Intent>()
        
        // Camera intent
        if (captureEnabled && hasCameraPermission()) {
            val photoFile = createImageFile()
            photoFile?.let { file ->
                cameraPhotoPath = "file:${file.absolutePath}"
                val photoUri = FileProvider.getUriForFile(
                    this,
                    "${packageName}.fileprovider",
                    file
                )
                
                val cameraIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                    putExtra(MediaStore.EXTRA_OUTPUT, photoUri)
                    addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                }
                intents.add(cameraIntent)
            }
        }
        
        // Gallery intent
        val galleryIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = acceptTypes.firstOrNull() ?: "image/*"
        }
        
        // Create chooser
        val chooserIntent = Intent.createChooser(galleryIntent, "Select Image")
        if (intents.isNotEmpty()) {
            chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, intents.toTypedArray())
        }
        
        fileChooserLauncher.launch(chooserIntent)
    }

    @Throws(IOException::class)
    private fun createImageFile(): File? {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val imageFileName = "MAYA_${timeStamp}_"
        val storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES)
        return File.createTempFile(imageFileName, ".jpg", storageDir)
    }

    override fun onBackPressed() {
        if (binding.webView.canGoBack()) {
            binding.webView.goBack()
        } else {
            // Show exit confirmation
            AlertDialog.Builder(this)
                .setTitle("Exit MAYA")
                .setMessage("Are you sure you want to exit?")
                .setPositiveButton("Yes") { _, _ -> super.onBackPressed() }
                .setNegativeButton("No", null)
                .show()
        }
    }

    override fun onResume() {
        super.onResume()
        binding.webView.onResume()
        injectFcmTokenToWebView()
        injectNotificationPermissionState()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        extractNotificationIntent(intent)
        loadPendingNotificationUrl()
    }

    override fun onPause() {
        super.onPause()
        binding.webView.onPause()
    }

    override fun onDestroy() {
        super.onDestroy()
        networkCallback?.let {
            connectivityManager.unregisterNetworkCallback(it)
        }
        binding.webView.destroy()
    }
}
