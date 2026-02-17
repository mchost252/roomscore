# Debug Guide for Expo Go Issues

## Quick Test
To verify Expo Go works, navigate to the test screen:
1. Open the app in Expo Go
2. Manually navigate to: `exp://[your-ip]:8081/--/test`
3. Or shake device → "Go to URL" → enter `/test`

If the test screen shows "✅ Expo Go Works!", then the issue is with authentication/routing.

## Common Expo Go Errors

### Blue Screen: "Something went wrong"
**Possible causes:**
1. **SecureStore issue** - Fixed with fallback to AsyncStorage
2. **Navigation error** - Check console logs
3. **Missing dependency** - Run `npx expo install --check`

### To see detailed error:
1. Shake device in Expo Go
2. Enable "Debug Remote JS"
3. Open browser console to see full error stack

## Temporary Bypass for Testing

If you want to test the app without authentication:

**Option 1: Comment out auth redirect**
In `mobile/app/index.tsx`, replace the useEffect with:
```typescript
useEffect(() => {
  // Temporarily skip auth
  router.replace('/(tabs)');
}, []);
```

**Option 2: Use test screen**
Navigate to `/test` route to verify app loads

## Console Logging
Check terminal output for:
- "App starting on platform: ios/android"
- Any error messages from AuthContext
- Storage-related errors

## Next Steps After Fix
Once Expo Go loads successfully:
1. Test login with real credentials
2. Build out UI screens
3. Connect all API endpoints
4. Add Socket.io for real-time features
