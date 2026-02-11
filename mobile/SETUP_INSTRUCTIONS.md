# KRIOS Mobile App - Build & Setup Instructions

## Critical Fixes Applied ✅

This document outlines all the fixes applied to ensure the mobile app builds and connects properly.

### 1. ✅ C++ Module Fixed (JNI Implementation)
**Problem**: The C++ module was using N-API (Node.js) instead of JNI (Android)
**Fix**: 
- Rewrote `audio_engine.cpp` to use proper JNI bindings
- Added Android logging support
- Implemented proper native method signatures matching Java declarations

### 2. ✅ Network Configuration
**Problem**: App couldn't connect to dev server (cleartext traffic blocked)
**Fix**:
- Created `AndroidManifest.xml` with `usesCleartextTraffic="true"`
- Created `network_security_config.xml` allowing HTTP for development
- Added support for emulator (10.0.2.2) and physical devices

### 3. ✅ Environment Variables
**Problem**: No `.env` file for API configuration
**Fix**:
- Created `.env` with proper API URLs
- Configured for Android emulator (10.0.2.2 points to host machine)
- Added comments for physical device setup

### 4. ✅ Build Configuration
**Problem**: Missing expo-build-properties plugin
**Fix**:
- Added `expo-build-properties` to package.json
- Configured proper SDK versions (compileSdk: 34, targetSdk: 34, minSdk: 24)
- Set up network security config path

### 5. ✅ CMake Configuration
**Problem**: C++ module wasn't linking JNI properly
**Fix**:
- Added JNI include paths
- Added `android` and `log` libraries for native Android features
- Enabled verbose makefile for debugging

### 6. ✅ App Entry Point
**Problem**: Unused `AppRegistry` import
**Fix**:
- Removed unused import from `App.tsx`
- Verified `index.ts` properly registers the app

---

## Build Instructions

### Prerequisites
1. Install Node.js and npm
2. Install EAS CLI: `npm install -g eas-cli`
3. Have your Expo account ready

### Step 1: Install Dependencies
```bash
cd mobile
npm install
```

### Step 2: Configure Environment
Edit `mobile/.env` and update the API URL:

**For Android Emulator** (already configured):
```
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api
EXPO_PUBLIC_SOCKET_URL=http://10.0.2.2:5000
```

**For Physical Device** (find your computer's IP):
```bash
# Windows
ipconfig

# Mac/Linux
ifconfig
# or
ip addr
```

Then update `.env`:
```
EXPO_PUBLIC_API_URL=http://YOUR_IP_HERE:5000/api
EXPO_PUBLIC_SOCKET_URL=http://YOUR_IP_HERE:5000
```

Example:
```
EXPO_PUBLIC_API_URL=http://192.168.1.100:5000/api
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.100:5000
```

### Step 3: Start Backend Server
Make sure your backend is running:
```bash
cd backend
npm start
```

The server should be accessible on port 5000.

### Step 4: Build Development APK
```bash
cd mobile
eas build --profile development --platform android
```

Wait for the build to complete (this may take 10-20 minutes).

### Step 5: Download and Install APK
1. Download the APK from the EAS build page
2. Transfer to your Android device or emulator
3. Install the APK

**Using ADB**:
```bash
# List connected devices
adb devices

# Install APK
adb install path/to/your-app.apk

# Or if downloaded on your computer
adb install ~/Downloads/build-xxxxx.apk
```

### Step 6: Start Metro Bundler
After installing the APK, start the development server:
```bash
cd mobile
npm start
```

Press 'a' to open on Android, or launch the app from your device.

---

## Testing the Build

### Verify C++ Module Loading
The app should log when the native module loads:
```
KriosEngine native library loaded
```

Check with:
```bash
adb logcat | grep KriosEngine
```

### Verify Network Connection
The app should connect to your backend. Check for:
1. Successful login/signup
2. Socket.IO connection
3. API requests working

Check backend logs to see incoming requests.

### Common Issues & Solutions

#### Issue: "Unable to connect to server"
**Solution**: 
- Verify backend is running on port 5000
- Check `.env` has correct IP address
- For physical device, ensure both device and computer are on same WiFi
- Disable any firewalls blocking port 5000

#### Issue: "Native module cannot be found"
**Solution**:
- Make sure you're using the development build (not Expo Go)
- Rebuild the app with `eas build`
- Check build logs for C++ compilation errors

#### Issue: "Cleartext HTTP traffic not permitted"
**Solution**:
- Already fixed with network_security_config.xml
- If still seeing this, verify app.json has `usesCleartextTraffic: true`

#### Issue: Build fails during C++ compilation
**Solution**:
- Check EAS build logs for specific error
- Verify CMakeLists.txt is correct
- Ensure all C++ files have proper syntax

---

## Network Security for Production

⚠️ **IMPORTANT**: The current configuration allows HTTP traffic for development.

For production:
1. Use HTTPS backend URL
2. Update `network_security_config.xml` to remove cleartext traffic
3. Update `.env` to use production URL:
```
EXPO_PUBLIC_API_URL=https://your-app.railway.app/api
EXPO_PUBLIC_SOCKET_URL=https://your-app.railway.app
```

---

## Files Modified/Created

### Created:
- ✅ `mobile/.env` - Environment configuration
- ✅ `mobile/modules/krios-engine/android/src/main/AndroidManifest.xml` - Network permissions
- ✅ `mobile/modules/krios-engine/android/src/main/res/xml/network_security_config.xml` - Cleartext traffic config

### Modified:
- ✅ `mobile/modules/krios-engine/cpp/audio/audio_engine.cpp` - JNI implementation
- ✅ `mobile/modules/krios-engine/android/CMakeLists.txt` - JNI linking
- ✅ `mobile/app.json` - Build properties & network config
- ✅ `mobile/package.json` - Added expo-build-properties
- ✅ `mobile/App.tsx` - Removed unused import

---

## What's Next?

1. **Build the APK** using the instructions above
2. **Install and test** on your device/emulator
3. **Verify screens** copied from web are working
4. **Start making your changes** for mobile-specific features

Good luck! 🚀
