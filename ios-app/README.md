# Mayalogy iOS WebView App

This folder contains the native iOS wrapper for the hosted Mayalogy web application.

## What is included

- `WKWebView` wrapper pointed at `https://www.mayalogy.in/`
- Native bridge compatibility for the existing web code through `window.MayaAndroid`
- Firebase Messaging hooks for FCM token refresh and push notification deep links
- Offline and loading states similar to the Android wrapper
- Camera, Photos, and Files support for HTML file inputs

## Before you can run push notifications on a device

1. Add the iOS app to the same Firebase project and download `GoogleService-Info.plist`.
2. Place that file inside `ios-app/Mayalogy/App/` and include it in the `Mayalogy` target in Xcode.
3. In Apple Developer, enable Push Notifications for the bundle identifier.
4. In Apple Developer and Firebase, connect your APNs key or certificate.
5. Open `ios-app/MayalogyiOS.xcodeproj`, set your Apple team, and build on a real iPhone.

## Regenerating the Xcode project

This project is generated with XcodeGen.

```bash
cd ios-app
xcodegen generate
```

## Local validation build

```bash
cd ios-app
xcodegen generate
xcodebuild -project MayalogyiOS.xcodeproj \
  -scheme Mayalogy \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```
