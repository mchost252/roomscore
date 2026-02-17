# 🚀 Building Your RoomScore Mobile App

## ✅ What's Been Set Up:
- ✅ EAS configuration created (`eas.json`)
- ✅ `expo-dev-client` installed
- ✅ Storage issue fixed (platform-specific storage)
- ✅ New architecture disabled for Expo Go compatibility

## 📱 Build Your APK (Development Build)

Open your terminal in the `mobile` folder and run:

```bash
cd mobile
eas build -p android --profile development
```

This will:
1. Ask you to configure your Android bundle identifier (if needed)
2. Build a development APK with debugging capabilities
3. Give you a download link when complete (usually 10-20 minutes)

## 📥 After Build Completes:

1. **Download the APK** from the link provided
2. **Install on your Android device:**
   - Transfer the APK to your phone
   - Enable "Install from Unknown Sources" in settings
   - Tap the APK to install
3. **Run the app** - it will connect to your development server automatically!

## 🔄 Alternative: Preview Build (Standalone APK)

If you want a standalone APK that doesn't need the dev server:

```bash
eas build -p android --profile preview
```

## 🎯 Production Build (for Play Store)

When you're ready to publish:

```bash
eas build -p android --profile production
```

## 🐛 Debugging

The development build includes:
- Dev menu (shake your device)
- Hot reload
- Remote debugging
- Better error messages

## 📝 Build Profiles Explained:

- **development**: Development client with debugging, requires dev server running
- **preview**: Standalone APK for testing, doesn't need dev server
- **production**: Optimized APK ready for Play Store

## ⚡ Quick Commands:

```bash
# Check build status
eas build:list

# View build logs
eas build:view <build-id>

# Run local dev server (needed for development builds)
npx expo start --dev-client
```

---

**Start with the development build command above and let me know when you get the download link!** 🎉
