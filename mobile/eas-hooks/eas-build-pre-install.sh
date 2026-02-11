#!/usr/bin/env bash
# EAS Build Pre-Install Hook
# This runs before npm install on EAS servers

set -e

echo "🔧 EAS Build Pre-Install Hook: Setting up Gradle 8.8..."

# Create gradle wrapper properties with Gradle 8.8
mkdir -p android/gradle/wrapper
cat > android/gradle/wrapper/gradle-wrapper.properties << 'EOF'
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.8-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
EOF

echo "✅ Gradle 8.8 configuration created"
