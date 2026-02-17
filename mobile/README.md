# RoomScore Mobile App

Mobile version of RoomScore built with Expo SDK 54 and React Native.

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   - Copy `.env.example` to `.env`
   - The app is already configured to use your Railway backend: `https://roomscore-production.up.railway.app`
   - For local development, uncomment and use `http://localhost:5000` in `.env`

3. **Start Development Server**
   ```bash
   npm start
   ```

4. **Run on Device/Emulator**
   ```bash
   npm run android  # Android
   npm run ios      # iOS (macOS only)
   npm run web      # Web browser
   ```

## Project Structure

```
mobile/
├── app/                    # Expo Router pages (file-based routing)
│   ├── (auth)/            # Authentication screens
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── (tabs)/            # Main app tabs
│   │   ├── index.tsx      # Dashboard
│   │   ├── rooms.tsx      # Rooms list
│   │   └── profile.tsx    # User profile
│   ├── _layout.tsx        # Root layout
│   └── index.tsx          # Entry point with auth routing
├── components/            # Reusable UI components (ready for your web UI)
├── context/              # React contexts
│   └── AuthContext.tsx   # Authentication state management
├── services/             # API and utility services
│   ├── api.ts           # Axios instance with JWT refresh & retry logic
│   └── storage.ts       # Secure storage for tokens
├── constants/            # App constants
│   ├── config.ts        # API URLs and endpoints
│   └── theme.ts         # Colors, spacing, typography
└── types/               # TypeScript type definitions
    └── index.ts         # User, API response types

```

## Features Implemented

✅ **Authentication**
- JWT-based auth with automatic token refresh
- Login & Signup screens
- Secure token storage using expo-secure-store
- Matches backend auth flow exactly

✅ **API Integration**
- Configured for Railway production backend
- Automatic retry logic for network issues & Neon cold starts
- Token refresh on 401 errors
- Request/response interceptors

✅ **Navigation**
- File-based routing with Expo Router
- Protected routes (auto-redirect based on auth state)
- Tab navigation for main app
- Stack navigation for auth flows

✅ **TypeScript**
- Full TypeScript support
- Type definitions for User, API responses
- Strict mode enabled

## Next Steps

1. **Copy UI Components**: You can now copy your UI components from the web version to the `components/` folder
2. **Add Screens**: Implement rooms, tasks, friends, messages screens
3. **Socket.io**: Add real-time features using the socket URL from config
4. **Styling**: Apply your design system (colors, spacing already set up in `constants/theme.ts`)

## API Configuration

The app connects to your Railway backend:
- **API URL**: `https://roomscore-production.up.railway.app`
- **Socket URL**: `https://roomscore-production.up.railway.app`

All endpoints match your backend routes:
- `/api/auth/*` - Authentication
- `/api/rooms/*` - Rooms and tasks
- `/api/notifications/*` - Notifications
- `/api/friends/*` - Friends
- `/api/direct-messages/*` - DMs

## Technologies

- **Expo SDK 54** - Latest stable version
- **React Native 0.81.5** - Compatible with Expo SDK 54
- **TypeScript 5.9.2** - Type safety
- **Expo Router 4.0.22** - File-based routing
- **Axios** - HTTP client with interceptors
- **expo-secure-store** - Secure token storage
- **AsyncStorage** - Local data persistence
