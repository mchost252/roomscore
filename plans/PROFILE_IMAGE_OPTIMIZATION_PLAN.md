# Profile Image Storage Optimization Plan

## Problem Statement

Current implementation stores profile image URLs in SQLite and fetches from server on every render, causing:
- Large database entries (long URL strings)
- Slow image loading and display
- Excessive network calls
- Degraded performance with more users

## Current Architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Profile   │ ───► │    API      │ ───► │   Server    │
│   Update    │      │  (PUT /auth │      │  (stores    │
│ (dataUri)   │      │   /profile)│      │   image)    │
└─────────────┘      └─────────────┘      └─────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │   SQLite    │
                     │  (stores    │
                     │  avatar     │
                     │    URL)     │
                     └─────────────┘
```

## Proposed Solution: Local File System + Caching

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Profile   │ ───► │   Image     │ ───► │  Local File │
│   Update    │      │ Compressor  │      │   System    │
│ (dataUri)   │      │ (resize)   │      │  (cache)    │
└─────────────┘      └─────────────┘      └─────────────┘
                            │                      │
                            ▼                      ▼
                     ┌─────────────┐      ┌─────────────┐
                     │    API      │      │  SQLite DB  │
                     │ (upload)   │      │ (stores     │
                     │            │      │  filename)  │
                     └─────────────┘      └─────────────┘
```

## Implementation Plan

### 1. Image Storage Service (`mobile/services/imageStorageService.ts`)

```typescript
// Key responsibilities:
// - Save images to local file system
// - Compress images before storage
// - Generate unique filenames
// - Provide cached image URIs
// - Handle image cleanup
```

**Storage Strategy:**
- Use `FileSystem.documentDirectory` for permanent storage
- Use `FileSystem.cacheDirectory` for temporary cache
- Store in `avatars/` subdirectory
- Filename format: `avatar_{userId}_{timestamp}.jpg`

### 2. Image Compression

```typescript
// Use react-native-image-editor or expo-image-manipulator
// Compression settings:
// - Max width/height: 400px (sufficient for avatar)
// - Quality: 0.8 (80% JPEG quality)
// - Format: JPEG (smaller than PNG)
```

### 3. Database Schema Change

```sql
-- Before: avatar TEXT (full URL string)
-- After:  avatar TEXT (local filename only, e.g., "avatar_123_1699999999.jpg")

-- Benefits:
// - Smaller storage (filename ~40 chars vs URL ~200+ chars)
// - Faster queries
// - Database doesn't depend on server availability
```

### 4. Sync Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Image Sync Flow                          │
├─────────────────────────────────────────────────────────────┤
│  1. App startup                                             │
│     ├── Load user from SQLite                               │
│     ├── Check if local avatar file exists                   │
│     └── If not, download from server and cache              │
│                                                              │
│  2. Display avatar                                          │
│     ├── Check local file first                              │
│     ├── If exists, use file:// URI                          │
│     └── If not, show placeholder                           │
│                                                              │
│  3. Profile update                                          │
│     ├── Compress new image                                  │
│     ├── Save to local file system                           │
│     ├── Update SQLite with local filename                   │
│     └── Upload to server in background                      │
│                                                              │
│  4. Server sync (other user updates avatar)                 │
│     ├── Receive push notification or poll                   │
│     ├── Download new avatar                                 │
│     ├── Replace local file                                   │
│     └── Update local reference                              │
└─────────────────────────────────────────────────────────────┘
```

### 5. Caching Strategy

**LRU Cache (Least Recently Used)**
- Maximum cache size: 50MB
- Evict oldest when limit reached
- Track last access time

**Cache Invalidation**
- On profile update: clear old cached version
- On logout: clear all cached images
- Periodic cleanup on app startup

### 6. React Native Implementation

```typescript
// ImageLoading component pattern:
// 1. Check local cache first
// 2. If miss, show placeholder
// 3. Fetch from server
// 4. Cache and display

// Usage in components:
// <CachedAvatar userId={userId} size={50} />
```

## File Changes Required

| File | Change |
|------|--------|
| `mobile/services/imageStorageService.ts` | NEW - Image storage & compression |
| `mobile/services/sqliteService.ts` | MODIFY - Store filename not URL |
| `mobile/context/AuthContext.tsx` | MODIFY - Update profile handling |
| `mobile/components/ui/CachedImage.tsx` | NEW - Optimized image component |
| `mobile/app/(home)/profile.tsx` | MODIFY - Use new image service |
| `mobile/app/(home)/messages.tsx` | MODIFY - Use cached images |
| `mobile/app/(home)/index.tsx` | MODIFY - Use cached images |

## Expected Performance Improvements

| Metric | Before | After |
|--------|--------|-------|
| Database size per user | ~200 bytes | ~40 bytes |
| Image load time | 500-2000ms | 10-50ms |
| Network calls per session | 10-20 | 1-2 |
| Offline avatar access | No | Yes |

## Backward Compatibility

- Detect old URL format in database
- Auto-migrate on first app open
- Fallback to server URL if local file missing
