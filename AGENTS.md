# Krios/RoomScore Agent Guidelines

This repository contains the Krios (RoomScore) platform, a social habit-tracking application with gamification features. It is a monorepo consisting of a Node.js/Express backend, a React/Vite web frontend, and a React Native/Expo mobile app.

## 🚀 Build, Lint & Test Commands

### Root Project
- **Install Dependencies**: `npm install` (Note: root delegates to frontend for postinstall)
- **Development**: Use sub-directory commands below for specific targets.
- **Git Safety**: Always check `git status` and `git diff` before committing.

### Backend (`/backend`)
- **Start Production**: `npm start`
- **Start Development**: `npm run dev` (uses nodemon)
- **Local DB Setup**: `npm run dev:local` (pushes schema to local sqlite/pg)
- **Prisma Commands**: 
  - `npx prisma generate` (Updates client)
  - `npx prisma db push` (Syncs schema to DB)
  - `npx prisma studio` (UI for data)
- **Test All**: `npm test` (Uses Jest)
- **Single Test**: `npx jest path/to/file.test.js` or `npm test -- <filename>`

### Frontend (`/frontend`)
- **Start Development**: `npm run dev` (Vite)
- **Production Build**: `npm run build`
- **Linting**: `npm run lint`
- **Preview Build**: `npm run preview`

### Mobile (`/mobile`)
- **Start Expo**: `npx expo start`
- **Run Android**: `npm run android`
- **Type Check**: `npm run type-check` (Crucial before any PR)
- **Linting**: `npm run lint`
- **Reset Cache**: `npm run reset`

---

## 🛠 Code Style & Conventions

### Core Philosophy: "Think Deeply"
- **Verify Assumptions**: Never assume a file's purpose; read it.
- **Plan First**: Write out your approach before implementing large changes.
- **Ask Questions**: If behavior is ambiguous, seek clarification from the user.
- **Chunking**: Break complex tasks into smaller, verifiable units.

### General Conventions
- **Naming**: 
  - Variables/Functions/Hooks: `camelCase` (e.g., `useAuth`, `handleSend`)
  - Components/Models: `PascalCase` (e.g., `AppLayout`, `User`)
  - Routes: Mostly `camelCase` or kebab-case (e.g., `/google/callback`, `/rooms/:roomId`)
- **Imports Sorting**:
  1. React/Native core hooks and components
  2. External libraries (MUI, Expo, Axios)
  3. Internal Contexts/Providers
  4. Custom Hooks
  5. Components/Screens
  6. Utils/Constants/Types
- **Error Handling**: 
  - Backend: Always use `try/catch` and pass errors to `next(error)`.
  - Frontend/Mobile: Use Error Boundaries and localized `try/catch` for API calls.

### Backend Patterns (Express + Prisma)
- **Database**: PostgreSQL (Production) / SQLite (Local). Check `prisma/schema.prisma` first.
- **Middleware**: Authentication is handled via `protect` in `middleware/auth.js`.
- **Validation**: Strict Joi validation in `middleware/validation.js` for all POST/PUT routes.
- **API Response**: Standard format is `{ success: boolean, message?: string, data?: any }`.

### Mobile Patterns (Expo + TypeScript)
- **Local-First Messaging**: 
  - Messages are saved to `expo-sqlite` immediately with a `local_id`.
  - UI emits `message_sent` event instantly (Optimistic Update).
  - Background sync `sendToServer` handles network retries and status updates.
- **Styling**: Heavy use of `expo-linear-gradient` and `react-native-reanimated` for "Premium" feel.
- **Navigation**: Uses `expo-router` (File-based routing in `app/` directory).

### Frontend Patterns (React + MUI)
- **Theming**: Premium styles involve global noise textures and glassmorphism (see `App.jsx`).
- **Styling**: Prefer MUI's `sx` prop for local styles; use `styled()` for reusable components.

---

## 🔍 Verification Checklist for Agents

- [ ] **Context Check**: Have I read the parent directory and related files?
- [ ] **Dependency Check**: Am I using libraries already present in `package.json`?
- [ ] **Convention Match**: Does my indentation, naming, and structure match the file's current style?
- [ ] **Type Safety**: (Mobile) Does `npm run type-check` pass?
- [ ] **Linting**: Did I run `npm run lint` for frontend/mobile?
- [ ] **Tests**: Did I run relevant Jest tests for backend changes?
- [ ] **Proactiveness**: Did I consider the "why" and handle reasonable edge cases?

---

## 📂 Key Architecture Locations
- `backend/prisma/schema.prisma`: Data model source of truth.
- `backend/routes/`: API endpoint definitions.
- `mobile/services/messageService.ts`: Core messaging logic and sync engine.
- `mobile/services/sqliteService.ts`: SQLite schema and queries.
- `frontend/src/context/`: Global state management.
- `DEVELOPMENT_GUIDELINES.md`: Detailed philosophical guide.
- `CODE_LOCATIONS_REFERENCE.md`: Implementation deep-dives (Messaging, etc.).



## prompting precedures
