# MAYA Astrology - Android App

Android WebView wrapper for MAYA Astrology web application with native permissions and offline support.

## Features

- ✅ WebView-based app loading the MAYA web application
- ✅ Location permission handling (for Vastu analysis)
- ✅ Camera permission handling (for room scanning)
- ✅ File chooser support (camera + gallery)
- ✅ Automatic network detection
- ✅ Offline page with retry functionality
- ✅ Auto-reconnect when network is available
- ✅ Back button handling with exit confirmation
- ✅ Dark theme matching MAYA design

## Permissions

The app requests the following permissions as needed:

| Permission | Usage |
|------------|-------|
| `INTERNET` | Load web content |
| `ACCESS_NETWORK_STATE` | Network monitoring |
| `ACCESS_FINE_LOCATION` | Vastu location analysis |
| `ACCESS_COARSE_LOCATION` | Fallback location |
| `CAMERA` | Room scanning for Vastu |
| `READ_MEDIA_IMAGES` | Gallery access |

## Setup

### Prerequisites

- Android Studio Hedgehog (2023.1.1) or later
- JDK 17
- Android SDK 34 (API 34)
- Kotlin 1.9.x

### Building

1. Open the `android-app` folder in Android Studio

2. Sync Gradle files

3. Configure the web app URL in `MainActivity.kt`:
   ```kotlin
   // For local assets (bundle web app with APK):
   private val webAppUrl = "file:///android_asset/index.html"
   
   // For hosted version:
   private val webAppUrl = "https://your-domain.com"
   ```

4. If using local assets, copy your web app files to:
   ```
   app/src/main/assets/
   ```

5. Build and run:
   ```bash
   ./gradlew assembleDebug
   ```

### Bundling Web App (Optional)

To bundle the web app inside the APK:

1. Create the assets folder:
   ```bash
   mkdir -p app/src/main/assets
   ```

2. Copy your web files:
   ```bash
   cp -r ../index.html ../css ../js ../images app/src/main/assets/
   ```

3. Update URL in MainActivity.kt to use `file:///android_asset/index.html`

## Project Structure

```
android-app/
├── app/
│   ├── src/main/
│   │   ├── java/com/maya/astrology/
│   │   │   └── MainActivity.kt          # Main activity with WebView
│   │   ├── res/
│   │   │   ├── layout/
│   │   │   │   └── activity_main.xml    # Main layout with WebView + offline page
│   │   │   ├── values/
│   │   │   │   ├── colors.xml           # MAYA color scheme
│   │   │   │   ├── strings.xml          # App strings
│   │   │   │   └── themes.xml           # Dark theme
│   │   │   ├── drawable/
│   │   │   │   ├── ic_offline.xml       # Offline icon
│   │   │   │   └── ic_launcher_*.xml    # App icons
│   │   │   └── xml/
│   │   │       ├── file_paths.xml       # File provider paths
│   │   │       ├── network_security_config.xml
│   │   │       ├── backup_rules.xml
│   │   │       └── data_extraction_rules.xml
│   │   └── AndroidManifest.xml
│   ├── build.gradle.kts
│   └── proguard-rules.pro
├── gradle/
│   └── libs.versions.toml               # Version catalog
├── build.gradle.kts
├── settings.gradle.kts
└── gradle.properties
```

## Network Detection

The app automatically:
- Monitors network connectivity changes
- Shows offline page when connection is lost
- Auto-reloads when connection is restored
- Displays "Will reconnect automatically" hint

## Customization

### App Icon
Replace the drawables in `res/mipmap-*` or update `ic_launcher_foreground.xml`

### Colors
Edit `res/values/colors.xml` to match your branding

### Splash Screen
Add a splash screen by creating a new theme with `windowSplashScreen*` attributes

## Building Release APK

1. Create a keystore:
   ```bash
   keytool -genkey -v -keystore maya-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias maya
   ```

2. Add the signing values to the repo root `.env.local` file:
   ```properties
   MAYA_STORE_FILE=maya-release.jks
   MAYA_STORE_PASSWORD=your_store_password
   MAYA_KEY_ALIAS=maya
   MAYA_KEY_PASSWORD=your_key_password
   ```

3. Build release:
   ```bash
   ./gradlew assembleRelease
   ```

## License

© 2026 MAYA Astrology. All rights reserved.
