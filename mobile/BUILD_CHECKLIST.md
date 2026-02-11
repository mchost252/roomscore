# Pre-Build Checklist ✓

Use this checklist before building your APK to ensure everything is configured correctly.

## 1. Backend Server ✓
- [ ] Backend server is running
- [ ] Accessible on port 5000
- [ ] Can access http://localhost:5000/health in browser
- [ ] Database is connected

## 2. Environment Configuration ✓
- [ ] `mobile/.env` file exists
- [ ] API URL is correctly set for your setup:
  - Emulator: `http://10.0.2.2:5000/api`
  - Physical device: `http://YOUR_IP:5000/api`
- [ ] Socket URL matches API URL (without /api)

## 3. Network Configuration ✓
- [ ] Computer and phone on same WiFi (if using physical device)
- [ ] Firewall allows port 5000
- [ ] No VPN blocking local network access

## 4. Dependencies ✓
- [ ] Run `npm install` in mobile directory
- [ ] All packages installed without errors
- [ ] expo-build-properties is installed

## 5. Build Configuration ✓
- [ ] EAS CLI installed: `npm install -g eas-cli`
- [ ] Logged into Expo account: `eas login`
- [ ] Project configured: `eas build:configure`

## 6. Build Command ✓
For development APK with native modules:
```bash
eas build --profile development --platform android
```

## 7. After Build ✓
- [ ] Download APK from EAS
- [ ] Install via ADB: `adb install your-app.apk`
- [ ] Start Metro bundler: `npm start`
- [ ] Launch app on device
- [ ] Verify connection to backend

## 8. Debugging Tools ✓
- [ ] ADB installed and accessible
- [ ] Can view logs: `adb logcat | grep KriosEngine`
- [ ] Can view React Native logs: `adb logcat | grep ReactNative`

---

## Quick Commands

### Find Your IP Address
**Windows:**
```bash
ipconfig
# Look for IPv4 Address under your WiFi adapter
```

**Mac/Linux:**
```bash
ifconfig
# or
ip addr
# Look for inet address under en0 or wlan0
```

### Test Backend Connection
```bash
# From your phone's browser or a tool like Postman
curl http://YOUR_IP:5000/health
```

### View Native Module Logs
```bash
adb logcat | grep KriosEngine
```

### Clear App Data
```bash
adb shell pm clear com.krios.hub
```

### Uninstall Previous Build
```bash
adb uninstall com.krios.hub
```

---

## Expected Build Time
- First build: 15-25 minutes
- Subsequent builds: 10-15 minutes

---

## Success Indicators

### Build Success:
✅ EAS build completes without errors
✅ APK download link provided
✅ APK installs on device

### Runtime Success:
✅ App launches without crashing
✅ Login/signup screens appear
✅ Can connect to backend
✅ No "cleartext traffic" errors
✅ Native module loads (check logs)

---

## If Build Fails

1. **Check build logs** on EAS dashboard
2. **Look for**:
   - C++ compilation errors
   - Missing dependencies
   - Network issues
3. **Common fixes**:
   - Clear cache: `expo prebuild --clean`
   - Reinstall dependencies: `rm -rf node_modules && npm install`
   - Check CMakeLists.txt syntax

---

Ready to build? Follow SETUP_INSTRUCTIONS.md! 🚀
