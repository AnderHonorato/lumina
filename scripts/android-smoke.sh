#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="lumina-android-logcat.txt"
PACKAGE="com.lumina.notes"
ACTIVITY="${PACKAGE}/.MainActivity"
MARKER="[Lumina] Android v2.1 pronto"

rm -f "$LOG_FILE"
adb logcat -c
adb install -r Lumina-Notes.apk
adb shell am force-stop "$PACKAGE"

START_OUTPUT="$(adb shell am start -W -n "$ACTIVITY")"
printf '%s\n' "$START_OUTPUT"
printf '%s\n' "$START_OUTPUT" | grep -F "Status: ok" >/dev/null

BOOT_OK=0
for i in $(seq 1 35); do
  adb logcat -d > "$LOG_FILE"
  if grep -F "$MARKER" "$LOG_FILE" >/dev/null; then
    BOOT_OK=1
    break
  fi
  if grep -E "FATAL EXCEPTION|Process: com\.lumina\.notes.*has died" "$LOG_FILE" >/dev/null; then
    echo "Falha nativa detectada no logcat."
    grep -E "FATAL EXCEPTION|AndroidRuntime|Lumina|chromium|Capacitor|SQLite" "$LOG_FILE" | tail -n 300 || true
    exit 1
  fi
  sleep 1
done

adb logcat -d > "$LOG_FILE"
PID="$(adb shell pidof "$PACKAGE" | tr -d '\r' || true)"
if [ -z "$PID" ]; then
  echo "O processo do Lumina encerrou depois da abertura."
  grep -E "FATAL EXCEPTION|AndroidRuntime|Lumina|chromium|Capacitor|SQLite" "$LOG_FILE" | tail -n 300 || true
  exit 1
fi

if [ "$BOOT_OK" -ne 1 ]; then
  echo "O app abriu e permaneceu ativo, mas o bootstrap não confirmou 100%."
  grep -E "Lumina|chromium|Capacitor|SQLite" "$LOG_FILE" | tail -n 300 || true
  exit 1
fi

echo "Bootstrap Android confirmado: 100% e processo ativo ($PID)."
grep -F "$MARKER" "$LOG_FILE" | tail -n 5 || true
