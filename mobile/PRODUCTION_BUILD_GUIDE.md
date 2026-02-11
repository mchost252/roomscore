# KRIOS Mobile - Production Build Guide for Railway

## 🎯 Current Status

✅ **All critical code fixes applied:**
- C++ module uses JNI (Android-compatible)
- Network security configured for HTTP/HTTPS
- Android permissions set
- CMake properly configured
- SDK versions correct

✅ **App works on your phone:**
- App launches successfully
- React Native is running
- Ready to connect to backend

⏳ **Next step:** Configure for Railway production backend

---

## 📱 Building Production APK with Railway Backend

### Step 1: Get Your Railway Backend URL

1. Go to **Railway Dashboard**: https://railway.app/dashboard
2. Find your **KRIOS backend** project
3. Click on the service/deployment
4. Copy the **public URL** (format: `https://xxx.up.railway.app`)

Example URLs:
- `https://krios-backend-production.up.railway.app`
- `https://roomscore-api.up.railway.app`
- `https://web-production-xxxx.up.railway.app`

### Step 2: Update .env File

I've created `mobile/.env.production` for you.

**Edit the file and replace the URL:**

```bash
# Open in VSCode
code mobile/.env.production
```

**Replace this:**
```
EXPO_PUBLIC_API_URL=https://your-railway-app.up.railway.app/api
EXPO_PUBLIC_SOCKET_URL=https://your-railway-app.up.railway.app
```

**With your actual Railway URL:**
```
EXPO_PUBLIC_API_URL=https://krios-backend-production.up.railway.app/api
EXPO_PUBLIC_SOCKET_URL=https://krios-backend-production.up.railway.app
```

### Step 3: Copy to Active .env

```powershell
# Copy production config to .env
Copy-Item mobile\.env.production mobile\.env -Force

# Verify it worked
Get-Content mobile\.env
```

### Step 4: Build Production APK

```powershell
cd mobile

# Build for production
eas build --profile production --platform android
```

**Build will take:** 15-25 minutes

### Step 5: Download and Install

1. Wait for EAS build to complete
2. Download the APK from the provided link
3. Install on your device:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); adb install -r path\to\new-build.apk
```

4. Launch:
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); adb shell am start -n com.krios.hub/.MainActivity
```

---

## 🔍 Verify Backend Connection

### Test from Device

```powershell
# Replace with your Railway URL
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); adb shell curl https://your-railway-app.up.railway.app/health
```

### Test from Browser

Open in browser:
```
https://your-railway-app.up.railway.app/health
```

Should return JSON with backend health status.

---

## 📋 Pre-Build Checklist

Before running `eas build`:

- [ ] Railway backend is deployed and running
- [ ] Got the Railway public URL
- [ ] Updated `mobile/.env.production` with Railway URL
- [ ] Copied `.env.production` to `.env`
- [ ] Verified .env has correct HTTPS URLs
- [ ] Tested Railway backend URL in browser

---

## ⚠️ Important Notes

### HTTPS is Required for Production

Railway provides HTTPS by default, so no need to worry about cleartext traffic.

The network security config we created allows both HTTP (for development) and HTTPS (for production).

### Environment Variables are Baked into APK

Once you build the APK, the `.env` values are permanently embedded.

To change the backend URL, you must rebuild the APK.

### Development vs Production Builds

**Development Build:**
- Includes dev tools
- Can connect to Metro bundler
- Larger file size
- Good for testing

**Production Build:**
- Optimized and minified
- Smaller file size
- No dev tools
- Ready for distribution

---

## 🚀 Quick Commands Reference

### Launch App
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); adb shell am start -n com.krios.hub/.MainActivity
```

### View Logs
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); adb logcat | Select-String "ReactNativeJS"
```

### Check Native Module
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); adb logcat | Select-String "KriosEngine"
```

### Clear App Data
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); adb shell pm clear com.krios.hub
```

---

## 🎓 What Happens During Build

1. **EAS reads your .env file**
2. **Bundles JavaScript with environment variables**
3. **Compiles C++ native modules (JNI)**
4. **Builds Android APK with all assets**
5. **Signs the APK**
6. **Uploads to EAS servers for download**

The `.env` values become `Constants.expoConfig.extra` in your app, which is why they can't be changed without rebuilding.

---

## 🎉 You're Ready!

Once you have your Railway URL:
1. Update `.env.production`
2. Copy to `.env`
3. Run `eas build --profile production --platform android`
4. Wait for build
5. Install and test!

All the hard fixes (C++, network security, permissions) are already done! 🚀
