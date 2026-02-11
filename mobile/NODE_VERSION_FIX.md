# Node.js Version Compatibility Fix

## Problem

You're using **Node.js v24.13.0**, which is too new for Expo/Metro bundler.

**Error:**
```
Package subpath './src/lib/TerminalReporter' is not defined by "exports" in metro/package.json
```

This happens because Metro bundler hasn't been updated for Node v24's stricter module resolution.

---

## Solution Options

### Option 1: Install NVM and Switch to Node 20 ⭐ (Best)

**NVM (Node Version Manager)** lets you switch between Node versions easily.

#### Step 1: Install NVM for Windows

1. Download **nvm-setup.exe** from:
   https://github.com/coreybutler/nvm-windows/releases

2. Run the installer (keep default settings)

3. Close and reopen VSCode terminal

#### Step 2: Install and Use Node 20

```powershell
# Install Node 20 LTS
nvm install 20.11.0

# Switch to Node 20
nvm use 20.11.0

# Verify
node --version
# Should show: v20.11.0
```

#### Step 3: Reinstall Dependencies

```powershell
cd mobile
Remove-Item node_modules, package-lock.json -Recurse -Force
npm install
```

#### Step 4: Start Expo

```powershell
npx expo start
```

---

### Option 2: Install Node 20 Directly (Replaces Node 24)

1. Go to: https://nodejs.org/
2. Download **Node.js 20 LTS** (20.11.0 or newer)
3. Run installer (will replace Node 24)
4. Restart VSCode
5. Verify: `node --version`
6. Reinstall dependencies:
   ```powershell
   cd mobile
   Remove-Item node_modules, package-lock.json -Recurse -Force
   npm install
   ```

---

### Option 3: Skip Dev Server (Work Without It)

**You don't actually need the dev server right now!**

The Expo dev server is only for:
- Hot reload during development
- Live code updates
- Development debugging

**You CAN:**
- Build production APK with Railway URL
- Test on device
- Make changes
- Rebuild when needed

**Your workflow without dev server:**
1. Edit code in VSCode
2. When ready to test: `eas build --profile development --platform android`
3. Install APK on device
4. Test changes
5. Repeat

This is slower than hot reload, but works fine for testing!

---

## Why This Happened

Node.js v24 was just released (2024) and introduced stricter ES module resolution.

Many packages (including Metro) haven't updated their `package.json` exports field yet.

**Node versions and Expo compatibility:**
- ✅ Node 18 LTS - Fully supported
- ✅ Node 20 LTS - Fully supported ⭐ (Recommended)
- ⚠️ Node 22 - Mostly works
- ❌ Node 24 - Too new, not supported yet

---

## Recommended Action

**For now:** Skip the dev server, use your APK for testing

**Later (when doing active development):** Install NVM and switch to Node 20

---

## Quick Commands After Fixing Node Version

```powershell
# Verify Node version
node --version

# Clean install
cd mobile
Remove-Item node_modules, package-lock.json -Recurse -Force
npm cache clean --force
npm install

# Start Expo
npx expo start
```

---

## Your Current Plan (No Dev Server Needed)

✅ Get Railway URL  
✅ Update mobile/.env.production  
✅ Build APK: `eas build --profile production --platform android`  
✅ Install and test on device  

**None of this requires the dev server!** 🎉
