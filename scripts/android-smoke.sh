#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="lumina-android-logcat.txt"
UI_FILE="lumina-android-ui.xml"
PACKAGE="com.lumina.notes"
ACTIVITY="${PACKAGE}/.MainActivity"
MARKER="[Lumina] Android v2.1 pronto"

rm -f "$LOG_FILE" "$UI_FILE"
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

dump_ui() {
  adb shell uiautomator dump /sdcard/lumina-ui.xml >/dev/null
  adb pull /sdcard/lumina-ui.xml "$UI_FILE" >/dev/null
}

node_center() {
  local mode="$1"
  local needle="${2:-}"
  python3 - "$UI_FILE" "$mode" "$needle" <<'PY'
import re, sys, xml.etree.ElementTree as ET
path, mode, needle = sys.argv[1:4]
root = ET.parse(path).getroot()
found = []
for node in root.iter('node'):
    text = ' '.join(filter(None, [node.attrib.get('text',''), node.attrib.get('content-desc',''), node.attrib.get('resource-id','')]))
    klass = node.attrib.get('class','')
    ok = False
    if mode == 'text':
        ok = needle.casefold() in text.casefold()
    elif mode == 'edit':
        ok = 'EditText' in klass or node.attrib.get('editable') == 'true'
    if not ok:
        continue
    m = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.attrib.get('bounds',''))
    if not m:
        continue
    x1,y1,x2,y2 = map(int, m.groups())
    if x2 <= x1 or y2 <= y1:
        continue
    found.append(((x1+x2)//2, (y1+y2)//2))
if not found:
    sys.exit(2)
# Para textos repetidos como "Entrar", o controle de ação fica mais abaixo.
x,y = max(found, key=lambda p: p[1]) if mode == 'text' else found[0]
print(f'{x} {y}')
PY
}

# Teste funcional real: não basta o processo estar vivo; a tela precisa aceitar toque e digitação.
sleep 1
dump_ui
if ONBOARDING_POS="$(node_center text 'Começar' 2>/dev/null)"; then
  read -r OX OY <<<"$ONBOARDING_POS"
  adb shell input tap "$OX" "$OY"
  sleep 1
  dump_ui
fi

if ! USER_POS="$(node_center edit 2>/dev/null)"; then
  echo "Falha: o campo de usuário/email não ficou acessível ao toque no Android."
  cat "$UI_FILE" || true
  exit 1
fi
read -r UX UY <<<"$USER_POS"
adb shell input tap "$UX" "$UY"
sleep 1
adb shell input text 'lumina_smoke'
sleep 1
dump_ui
if ! grep -F 'lumina_smoke' "$UI_FILE" >/dev/null; then
  echo "Falha: o toque chegou à tela, mas o campo de login não aceitou digitação."
  cat "$UI_FILE" || true
  exit 1
fi

adb shell input keyevent KEYCODE_BACK || true
sleep 1
dump_ui
if ! LOGIN_POS="$(node_center text 'Entrar' 2>/dev/null)"; then
  echo "Falha: botão Entrar não foi encontrado pela camada de acessibilidade."
  cat "$UI_FILE" || true
  exit 1
fi
read -r LX LY <<<"$LOGIN_POS"
adb shell input tap "$LX" "$LY"
sleep 1
dump_ui
if ! grep -F 'Preencha todos os campos' "$UI_FILE" >/dev/null; then
  echo "Falha: botão Entrar não respondeu ao toque como esperado."
  cat "$UI_FILE" || true
  exit 1
fi

echo "Interação Android confirmada: campo editável recebeu toque/texto e botão Entrar respondeu."
echo "Bootstrap Android confirmado: 100% e processo ativo ($PID)."
grep -F "$MARKER" "$LOG_FILE" | tail -n 5 || true
