# Krios - Capacitor & Appflow Setup Guide

This guide will help you set up Capacitor for building native iOS/Android apps and Appflow for live updates and CI/CD.

## 📋 Prerequisites

Before starting, you'll need:

### Required Accounts & Keys

| Item | Purpose | Where to Get | Cost |
|------|---------|--------------|------|
| **Ionic Appflow Account** | CI/CD, Live Updates | [ionic.io/appflow](https://ionic.io/appflow) | Free tier available |
| **Apple Developer Account** | iOS builds & App Store | [developer.apple.com](https://developer.apple.com) | $99/year |
| **Google Play Console** | Android builds & Play Store | [play.google.com/console](https://play.google.com/console) | $25 one-time |
| **Firebase Project** | Android Push Notifications | [console.firebase.google.com](https://console.firebase.google.com) | Free |

### Development Environment

- **Node.js** 18+ and npm
- **For iOS**: macOS with Xcode 15+ installed
- **For Android**: Android Studio with SDK 34+
- **Git** for version control

---

## 🚀 Step 1: Initial Capacitor Setup

### 1.1 Install Dependencies

```bash
cd frontend
npm install
```

### 1.2 Build Your Web App

```bash
npm run build
```

### 1.3 Add Native Platforms

```bash
# Add Android
npm run cap:add:android

# Add iOS (macOS only)
npm run cap:add:ios
```

### 1.4 Sync Web Code to Native

```bash
npm run cap:sync
```

---

## 📱 Step 2: Android Setup

### 2.1 Open in Android Studio

```bash
npm run cap:android
```

### 2.2 Configure Firebase (for Push Notifications)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project or select existing
3. Add an Android app with package name: `com.krios.app`
4. Download `google-services.json`
5. Place it in `android/app/google-services.json`

### 2.3 Create Signing Keystore (for Release Builds)

```bash
cd android
keytool -genkey -v -keystore krios-release.keystore -alias krios -keyalg RSA -keysize 2048 -validity 10000
```

**⚠️ IMPORTANT**: Save these credentials securely:
- Keystore file: `krios-release.keystore`
- Keystore password
- Key alias: `krios`
- Key password

### 2.4 Configure Signing in Gradle

Create `android/keystore.properties`:
```properties
storeFile=krios-release.keystore
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=krios
keyPassword=YOUR_KEY_PASSWORD
```

Add to `.gitignore`:
```
android/keystore.properties
android/*.keystore
```

### 2.5 Test on Device/Emulator

```bash
npm run cap:run:android
```

---

## 🍎 Step 3: iOS Setup (macOS Only)

### 3.1 Open in Xcode

```bash
npm run cap:ios
```

### 3.2 Configure Signing

1. Open `ios/App/App.xcworkspace` in Xcode
2. Select the "App" target
3. Go to "Signing & Capabilities"
4. Select your Team (Apple Developer Account)
5. Set Bundle Identifier: `com.krios.app`

### 3.3 Set Up Push Notifications

1. In Xcode, go to "Signing & Capabilities"
2. Click "+ Capability"
3. Add "Push Notifications"
4. Add "Background Modes" → Check "Remote notifications"

### 3.4 Create APNs Key (for Push Notifications)

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/authkeys/list)
2. Create a new Key
3. Enable "Apple Push Notifications service (APNs)"
4. Download the `.p8` file
5. Note the Key ID and Team ID

### 3.5 Test on Device/Simulator

```bash
npm run cap:run:ios
```

---

## ☁️ Step 4: Appflow Setup

### 4.1 Create Appflow Account

1. Go to [ionic.io/appflow](https://ionic.io/appflow)
2. Sign up / Log in
3. Create a new app
4. Note your **App ID** (e.g., `abc123de`)

### 4.2 Update Configuration

Edit `frontend/capacitor.config.ts` and uncomment the LiveUpdates section:

```typescript
plugins: {
  // ... other plugins ...
  LiveUpdates: {
    appId: 'YOUR_APPFLOW_APP_ID',  // Replace with your App ID
    channel: 'Production',
    autoUpdateMethod: 'background',
    maxVersions: 2
  }
}
```

Edit `frontend/appflow.config.json`:
```json
{
  "app_id": "YOUR_APPFLOW_APP_ID"  // Replace with your App ID
}
```

### 4.3 Install Appflow CLI

```bash
npm install -g @ionic/cloud-cli
ionic login
```

### 4.4 Connect Repository

1. In Appflow Dashboard, go to Settings → Git
2. Connect your GitHub/GitLab/Bitbucket repository
3. Select the branch to track (usually `main`)

### 4.5 Install Live Updates Plugin

```bash
cd frontend
npm install @capacitor/live-updates
npx cap sync
```

---

## 🔧 Step 5: Configure Build Environments

### 5.1 Add Signing Credentials in Appflow

**For Android:**
1. Go to Appflow → Build → Signing Certificates
2. Upload your `.keystore` file
3. Enter keystore password, key alias, and key password

**For iOS:**
1. Go to Appflow → Build → Signing Certificates
2. Upload your Distribution Certificate (`.p12`)
3. Upload your Provisioning Profile (`.mobileprovision`)

### 5.2 Create Build Automations

In Appflow Dashboard → Automations:

1. **Development Build** (on every push):
   - Trigger: Push to `develop` branch
   - Build Type: Debug
   - Platform: Both

2. **Production Build** (on release):
   - Trigger: Push to `main` branch
   - Build Type: Release
   - Platform: Both

---

## 📤 Step 6: Live Updates (OTA)

### 6.1 How It Works

Live Updates allow you to push web code changes directly to users' devices without going through the app stores. This is perfect for:
- Bug fixes
- UI changes
- New features (that don't require native code changes)

### 6.2 Deploy an Update

```bash
# Build your web app
npm run build

# Deploy to Appflow
ionic deploy add --app-id=YOUR_APP_ID --channel=Production
```

Or use the Appflow Dashboard:
1. Go to Deploy → Builds
2. Select a web build
3. Click "Deploy" → Select channel (Production/Staging)

### 6.3 Update Channels

| Channel | Purpose |
|---------|---------|
| `Production` | Stable releases for all users |
| `Staging` | Beta testing before production |
| `Development` | Internal testing only |

---

## 📲 Step 7: App Store Deployment

### 7.1 Google Play Store

1. Build a signed APK/AAB in Appflow
2. Download the artifact
3. Go to [Google Play Console](https://play.google.com/console)
4. Create your app listing
5. Upload the AAB file
6. Complete store listing (screenshots, description, etc.)
7. Submit for review

### 7.2 Apple App Store

1. Build a signed IPA in Appflow
2. Download the artifact
3. Use Transporter app (or Xcode) to upload to App Store Connect
4. Go to [App Store Connect](https://appstoreconnect.apple.com)
5. Complete app information
6. Submit for review

---

## 🔑 Environment Variables Reference

### Backend (.env)
```env
# Add these for push notifications
FIREBASE_SERVER_KEY=your_firebase_server_key
APNS_KEY_ID=your_apns_key_id
APNS_TEAM_ID=your_apple_team_id
```

### Appflow Build Environment
```
VITE_API_URL=https://your-backend-url.com
```

---

## 📁 Project Structure After Setup

```
frontend/
├── android/                    # Android native project
│   ├── app/
│   │   ├── google-services.json   # Firebase config
│   │   └── src/
│   └── keystore.properties     # Signing config (git-ignored)
├── ios/                        # iOS native project
│   └── App/
│       └── App.xcworkspace
├── src/
│   └── utils/
│       └── capacitor.js        # Native utilities
├── capacitor.config.ts         # Capacitor configuration
├── appflow.config.json         # Appflow configuration
└── package.json
```

---

## 🛠️ Useful Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build web app |
| `npm run cap:sync` | Sync web to native |
| `npm run cap:build` | Build + Sync |
| `npm run cap:android` | Open Android Studio |
| `npm run cap:ios` | Open Xcode |
| `npm run cap:run:android` | Run on Android device |
| `npm run cap:run:ios` | Run on iOS device |

---

## ❓ Troubleshooting

### "Capacitor plugins not found"
```bash
npm run cap:sync
```

### iOS build fails with signing error
- Check your Apple Developer membership is active
- Verify provisioning profile matches bundle ID
- Try: Xcode → Product → Clean Build Folder

### Android build fails
- Update Android Studio and SDK tools
- Check `android/local.properties` has correct SDK path
- Try: Android Studio → Build → Clean Project

### Live Updates not working
- Verify App ID in `capacitor.config.ts`
- Check device has internet connection
- Look for errors in native logs

---

## 📞 Support

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Ionic Appflow Documentation](https://ionic.io/docs/appflow)
- [Firebase Documentation](https://firebase.google.com/docs)

---

## ✅ Checklist

- [ ] Install npm dependencies
- [ ] Build web app
- [ ] Add Android platform
- [ ] Add iOS platform (if on macOS)
- [ ] Create Firebase project & add `google-services.json`
- [ ] Create Android signing keystore
- [ ] Configure iOS signing in Xcode
- [ ] Create Appflow account & get App ID
- [ ] Update `capacitor.config.ts` with App ID
- [ ] Connect repository to Appflow
- [ ] Upload signing certificates to Appflow
- [ ] Create build automations
- [ ] Test live updates
- [ ] Submit to app stores
