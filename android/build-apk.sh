#!/usr/bin/env bash
set -euo pipefail
# Pure Java/Android SDK build: no Gradle or third-party runtime dependency.
# Supply your own keystore for signing. Keep it outside the repository.
cd "$(dirname "$0")"
: "${ANDROID_SDK_ROOT:?Set ANDROID_SDK_ROOT to the Android SDK directory}"
: "${NHATIN_KEYSTORE:?Set NHATIN_KEYSTORE to a private Android signing keystore}"
: "${NHATIN_KEY_PASSWORD:?Set NHATIN_KEY_PASSWORD in your environment}"
NHATIN_KEY_ALIAS="${NHATIN_KEY_ALIAS:-nhatin}"
export NHATIN_KEY_PASSWORD
TOOLS="$ANDROID_SDK_ROOT/build-tools/35.0.0"
PLATFORM="$ANDROID_SDK_ROOT/platforms/android-35/android.jar"
mkdir -p build/classes build/generated build/dex build/tests
"$TOOLS/aapt2" compile --dir app/src/main/res -o build/resources.zip
"$TOOLS/aapt2" link -o build/unsigned.apk --manifest app/src/main/AndroidManifest.xml -I "$PLATFORM" --java build/generated --min-sdk-version 26 --target-sdk-version 35 --version-code 2 --version-name 0.2.0-android-preview build/resources.zip
find app/src/main/java build/generated -name '*.java' > build/sources.list
javac -encoding UTF-8 -source 8 -target 8 -bootclasspath "$PLATFORM:$TOOLS/core-lambda-stubs.jar" -d build/classes @build/sources.list
jar cf build/classes.jar -C build/classes .
"$TOOLS/d8" --lib "$PLATFORM" --min-api 26 --output build/dex build/classes.jar
python3 - <<'PY'
import zipfile
from pathlib import Path
with zipfile.ZipFile('build/unsigned.apk','a',zipfile.ZIP_DEFLATED) as apk:
    for dex in Path('build/dex').glob('*.dex'): apk.write(dex,dex.name)
PY
"$TOOLS/zipalign" -f -p 4 build/unsigned.apk build/aligned.apk
"$TOOLS/apksigner" sign --ks "$NHATIN_KEYSTORE" --ks-key-alias "$NHATIN_KEY_ALIAS" --ks-pass env:NHATIN_KEY_PASSWORD --key-pass env:NHATIN_KEY_PASSWORD --out build/NhaTin-Android-0.2.0.apk build/aligned.apk
"$TOOLS/apksigner" verify --verbose build/NhaTin-Android-0.2.0.apk
javac -encoding UTF-8 -d build/tests app/src/main/java/vn/nhatin/app/Entry.java app/src/main/java/vn/nhatin/app/MessageRules.java test/MessageRulesTest.java
java -cp build/tests MessageRulesTest
printf '\nAPK: %s/build/NhaTin-Android-0.2.0.apk\n' "$PWD"
