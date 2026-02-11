// KRIOS Audio Engine - JNI Implementation for React Native Android
// Provides low-latency audio playback for premium feel
// Target: <10ms latency on mobile devices

#include <jni.h>
#include <string>
#include <map>
#include <android/log.h>

#define LOG_TAG "KriosEngine"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

class AudioEngine {
private:
    bool initialized;
    std::map<std::string, std::string> soundPaths;

public:
    AudioEngine() : initialized(false) {
        // Map sound names to file paths
        soundPaths["click"] = "sounds/click.wav";
        soundPaths["whoosh"] = "sounds/whoosh.wav";
        soundPaths["success"] = "sounds/success.wav";
    }

    bool Initialize() {
        // TODO: Initialize OpenSL ES audio engine when ready
        // For now, just mark as initialized
        LOGI("AudioEngine initialized");
        initialized = true;
        return true;
    }

    bool PlaySound(const std::string& soundName) {
        if (!initialized) {
            LOGE("AudioEngine not initialized");
            return false;
        }

        auto it = soundPaths.find(soundName);
        if (it == soundPaths.end()) {
            LOGE("Sound not found: %s", soundName.c_str());
            return false;
        }

        // TODO: Play sound with OpenSL ES when ready
        LOGI("Playing sound: %s", soundName.c_str());
        
        return true;
    }

    ~AudioEngine() {
        if (initialized) {
            // TODO: Cleanup audio engine when implemented
            LOGI("AudioEngine destroyed");
        }
    }
};

// Global audio engine instance
static AudioEngine audioEngine;

// JNI method implementations
extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_kriosengine_KriosEngineModule_initAudioNative(JNIEnv *env, jobject thiz) {
    LOGI("initAudioNative called");
    bool success = audioEngine.Initialize();
    return static_cast<jboolean>(success);
}

JNIEXPORT jboolean JNICALL
Java_com_kriosengine_KriosEngineModule_playSoundNative(JNIEnv *env, jobject thiz, jstring soundName) {
    const char *nativeSoundName = env->GetStringUTFChars(soundName, nullptr);
    LOGI("playSoundNative called with: %s", nativeSoundName);
    
    bool success = audioEngine.PlaySound(std::string(nativeSoundName));
    
    env->ReleaseStringUTFChars(soundName, nativeSoundName);
    return static_cast<jboolean>(success);
}

// JNI_OnLoad - called when library is loaded
JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *reserved) {
    LOGI("KriosEngine native library loaded");
    return JNI_VERSION_1_6;
}

} // extern "C"
