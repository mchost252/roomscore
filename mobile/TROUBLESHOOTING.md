# Expo Installation Issue - Manual Fix Required

## Problem
Your npm installation is having issues installing the complete Expo dependencies, specifically `@expo/cli` is missing.

## SOLUTION: Manual Installation Steps

### Option 1: Use Yarn Instead of NPM (Recommended)

```bash
# Install yarn globally if you don't have it
npm install -g yarn

# Navigate to mobile directory
cd mobile

# Remove node_modules and package-lock.json
Remove-Item -Path node_modules, package-lock.json -Recurse -Force

# Install with yarn
yarn install

# Start Expo
yarn start
```

### Option 2: Fix NPM Installation

```bash
cd mobile

# Clean everything
Remove-Item -Path node_modules, package-lock.json -Recurse -Force
npm cache clean --force

# Use specific Node version (if using nvm)
# nvm install 18.17.0
# nvm use 18.17.0

# Install with legacy peer deps
npm install --legacy-peer-deps

# Try starting
npm start
```

### Option 3: Install @expo/cli Globally

```bash
# Install Expo CLI globally
npm install -g @expo/cli

# Then in mobile directory
cd mobile
expo start
```

## IMPORTANT: About Your APK Build

### ✅ YOU DO **NOT** NEED TO REBUILD THE APK!

**The APK you already built is fine!** The Expo dev server issue is ONLY affecting:
- Metro bundler (for hot reload during development)
- Running the app in development mode

**Your built APK contains:**
- ✅ All the C++ native code fixes (JNI implementation)
- ✅ Network security config for HTTP
- ✅ Android permissions
- ✅ Proper SDK configurations

### Why You Don't Need to Rebuild

The APK build happens on EAS servers with a clean environment, so it's not affected by your local npm issues.

### What You Need the Dev Server For

The Expo dev server is only needed to:
1. Connect your APK to see live code updates
2. Debug with hot reload
3. View logs in development

### Testing Your APK Without Dev Server

You can test your APK right now:

```bash
# Install the APK you already built
adb install path/to/your-build.apk

# Launch it on device
adb shell am start -n com.krios.hub/.MainActivity
```

**BUT**: The app will try to connect to your backend server. Make sure:
1. ✅ Backend is running on port 5000
2. ✅ Your `.env` has the correct IP (10.0.2.2 for emulator, or your computer's IP for physical device)

### Quick Backend Connection Test

```bash
# From your device/emulator, test if backend is reachable
adb shell curl http://10.0.2.2:5000/health

# If using physical device
adb shell curl http://YOUR_COMPUTER_IP:5000/health
```

## Once Expo Starts Successfully

After fixing the npm/yarn issue and getting Expo running:

```bash
# Start Metro bundler
npm start  # or expo start

# Install and launch your APK
adb install your-app.apk

# The app will connect to Metro for hot reload
```

## Current Status

✅ All code fixes applied correctly
✅ APK build should work (or already worked)
❌ Local npm/Expo installation issue (THIS IS LOCAL ONLY)

**Next Step**: Try Option 1 (Yarn) or Option 3 (Global @expo/cli) above.
