# KRIOS Engine - Native C++ Module

High-performance C++ engine for KRIOS mobile app.

## Features

### ✅ Implemented
- **Audio Engine Structure** - Prepared for miniaudio integration
- **AI Placeholders** - Ready for Set Word detection
- **Person Detection Hooks** - Framework for future features

### 🚧 TODO
- Download and integrate miniaudio library
- Implement AI logic in C++/Rust
- Add person detection with TensorFlow Lite
- Add sound files (click.wav, whoosh.wav, success.wav)

## Architecture

```
krios-engine/
├── cpp/
│   ├── audio/          # miniaudio wrapper
│   └── ai/             # AI logic (future)
├── android/            # Android JNI bindings
├── ios/                # iOS bindings (future)
└── index.ts            # TypeScript API
```

## Building

### Android
```bash
cd android
./gradlew build
```

### iOS (Future)
```bash
cd ios
pod install
```

## Usage

```typescript
import { Audio, AI, Person } from 'krios-engine';

// Initialize audio
await Audio.init();

// Play sounds
await Audio.playClick();
await Audio.playWhoosh();
await Audio.playSuccess();

// AI features (future)
const result = await AI.detectSetWord("help me");
const emotion = await AI.analyzeEmotion("I'm happy");

// Person detection (future)
const person = await Person.detect();
```

## Performance Targets

- Audio latency: <10ms
- AI detection: <50ms
- Person detection: <100ms

## Next Steps

1. Download miniaudio: https://github.com/mackron/miniaudio
2. Add sound files to assets
3. Test on Android device
4. Implement AI logic
5. Add person detection
