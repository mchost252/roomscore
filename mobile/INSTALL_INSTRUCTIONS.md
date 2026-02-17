# Installation Instructions

## Step 1: Install core dependencies
```bash
cd mobile
npm install
```

## Step 2: Install Expo Router and dependencies using Expo CLI
After step 1 completes, run:
```bash
npx expo install expo-router expo-linking expo-constants expo-secure-store react-native-safe-area-context react-native-screens @react-native-async-storage/async-storage
```

This will automatically install the correct versions compatible with Expo SDK 54.

## Step 3: Start the app
```bash
npm start
```

Then press:
- `a` for Android
- `i` for iOS
- `w` for web
