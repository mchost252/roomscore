# Fix Expo Dev Server - Complete Guide

## Why You Need This

Your **development build APK** needs to connect to the Expo dev server for:
- ✅ Hot reload (see code changes instantly)
- ✅ JavaScript bundle updates
- ✅ Debugging and error messages
- ✅ Fast development workflow

Without the dev server running, your development APK won't work properly!

---

## The Problem

Node.js v24 is too new → Metro bundler doesn't support it → `npx expo start` fails

**Solution:** Downgrade to Node.js v20 using NVM

---

## Step-by-Step Fix (15 minutes)

### Step 1: Download NVM for Windows

🔗 **Link:** https://github.com/coreybutler/nvm-windows/releases

1. Click the link above
2. Scroll to **"Assets"** section
3. Click **"nvm-setup.exe"** to download
4. Save to your Downloads folder

---

### Step 2: Install NVM

1. **Run** `nvm-setup.exe` from Downloads
2. Click **"Next"** through the installer
3. Keep **default settings**
4. It may ask about existing Node installation - click **"Yes"** to manage it
5. Click **"Install"** then **"Finish"**

---

### Step 3: Close VSCode Completely

⚠️ **IMPORTANT:** Close ALL VSCode windows!

This is necessary for the PATH environment variable to update.

---

### Step 4: Open New PowerShell (Administrator)

1. Press **Windows Key**
2. Type **"PowerShell"**
3. **Right-click** "Windows PowerShell"
4. Select **"Run as administrator"**

---

### Step 5: Verify NVM Installed

In the PowerShell, type:
```powershell
nvm version
```

You should see something like: `1.1.12` (or newer)

If you get an error, restart your computer and try again.

---

### Step 6: Install Node.js 20

```powershell
nvm install 20.11.0
```

This will download and install Node 20. Wait for it to complete.

---

### Step 7: Switch to Node 20

```powershell
nvm use 20.11.0
```

You should see: `Now using node v20.11.0 (64-bit)`

---

### Step 8: Verify Node Version

```powershell
node --version
```

Should show: `v20.11.0`

```powershell
npm --version
```

Should show something like: `10.2.4`

---

### Step 9: Navigate to Mobile Directory

```powershell
cd C:\Users\obinn\Desktop\KRIOS\roomscore\mobile
```

---

### Step 10: Clean Install Dependencies

```powershell
# Remove old dependencies
Remove-Item -Path node_modules -Recurse -Force
Remove-Item -Path package-lock.json -Force

# Clear npm cache
npm cache clean --force

# Fresh install
npm install
```

This will take 2-5 minutes. Wait for it to complete.

---

### Step 11: Start Expo Dev Server

```powershell
npx expo start
```

✅ **Success!** You should see:
```
Starting Metro Bundler
› Metro waiting on exp://192.168.1.172:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)
```

**No more errors!** 🎉

---

### Step 12: Connect Your Development APK

1. Make sure your **phone and computer are on the same WiFi**
2. **Launch your development APK** on the phone
3. The app will **automatically connect** to the dev server
4. You'll see in the terminal:
   ```
   › Opening on Android...
   › Opening exp://192.168.1.172:8081 on R94XA07WFEH
   ```

---

## Troubleshooting

### "nvm: command not found"

**Fix:** Restart your computer after installing NVM

---

### "Cannot find module 'metro'"

**Fix:** You skipped the clean install. Run:
```powershell
cd mobile
Remove-Item node_modules -Recurse -Force
npm install
```

---

### Development APK won't connect

**Fix:**
1. Check both devices on same WiFi
2. Find your IP: `ipconfig` (look for IPv4 Address)
3. Update `mobile/.env`:
   ```
   EXPO_PUBLIC_API_URL=http://YOUR_IP:5000/api
   EXPO_PUBLIC_SOCKET_URL=http://YOUR_IP:5000
   ```
4. Restart Expo: `npx expo start`

---

### Still getting Node v24 errors

**Fix:** VSCode is using cached Node path

1. Close ALL VSCode windows
2. Open new PowerShell
3. Check: `node --version` (should be v20.11.0)
4. Navigate to project: `cd mobile`
5. Start: `npx expo start`

---

## After Setup - Normal Workflow

### Every time you develop:

1. **Open terminal in mobile directory**
2. **Start dev server:**
   ```powershell
   npx expo start
   ```
3. **Launch development APK** on your phone
4. **Make code changes** in VSCode
5. **See changes instantly** on your phone! ✨

---

## Switching Between Node Versions (Future)

You can keep both Node 20 and Node 24 installed:

**Use Node 20 (for Expo):**
```powershell
nvm use 20.11.0
```

**Use Node 24 (for other projects):**
```powershell
nvm use 24.13.0
```

**See installed versions:**
```powershell
nvm list
```

---

## Summary

✅ NVM installed  
✅ Node 20 installed and active  
✅ Dependencies reinstalled  
✅ Expo dev server working  
✅ Development APK can connect  
✅ Hot reload working!  

**You're ready to develop! 🚀**
