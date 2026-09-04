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

# O launcher do Pixel do runner costuma entrar em ANR sem relação com o Lumina.
# Mantê-lo parado evita que um diálogo do sistema cubra o WebView durante o teste.
stop_unstable_launcher() {
  adb shell am force-stop com.google.android.apps.nexuslauncher >/dev/null 2>&1 || true
  adb shell am force-stop com.android.launcher3 >/dev/null 2>&1 || true
}
stop_unstable_launcher

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
records = []
for node in root.iter('node'):
    text = ' '.join(filter(None, [node.attrib.get('text',''), node.attrib.get('content-desc',''), node.attrib.get('resource-id','')]))
    klass = node.attrib.get('class','')
    m = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.attrib.get('bounds',''))
    if not m:
        continue
    x1,y1,x2,y2 = map(int, m.groups())
    if x2 <= x1 or y2 <= y1:
        continue
    records.append({
        'text': text,
        'klass': klass,
        'editable': node.attrib.get('editable') == 'true' or 'EditText' in klass,
        'x': (x1+x2)//2,
        'y': (y1+y2)//2,
    })

if mode in ('text', 'text_top'):
    found = [(r['x'], r['y']) for r in records if needle.casefold() in r['text'].casefold()]
    if not found:
        sys.exit(2)
    x,y = min(found, key=lambda p: p[1]) if mode == 'text_top' else max(found, key=lambda p: p[1])
elif mode == 'edit':
    found = [(r['x'], r['y']) for r in records if r['editable']]
    if not found:
        sys.exit(2)
    x,y = found[0]
elif mode == 'edit_after':
    labels = [r for r in records if needle.casefold() in r['text'].casefold() and not r['editable']]
    edits = [r for r in records if r['editable']]
    candidates = []
    for label in labels:
        for edit in edits:
            dy = edit['y'] - label['y']
            if 0 < dy < 220:
                candidates.append((dy, edit['x'], edit['y']))
    if not candidates:
        sys.exit(2)
    _,x,y = min(candidates)
else:
    sys.exit(2)
print(f'{x} {y}')
PY
}

dismiss_system_overlays() {
  # Runners headless podem exibir ANR do Pixel Launcher/System UI por cima do app.
  # Esses alertas pertencem ao Android do emulador, não ao Lumina.
  for _ in $(seq 1 8); do
    dump_ui || true
    if ! grep -Eqi "isn't responding|is not responding|Close app|Wait|System UI" "$UI_FILE" 2>/dev/null; then
      return 0
    fi
    local pos=""
    # Fechar o launcher é mais estável que escolher "Wait", que costuma recriar o ANR.
    if pos="$(node_center text 'Close app' 2>/dev/null)"; then
      read -r x y <<<"$pos"
      adb shell input tap "$x" "$y"
    elif pos="$(node_center text 'Wait' 2>/dev/null)"; then
      read -r x y <<<"$pos"
      adb shell input tap "$x" "$y"
    else
      adb shell input keyevent KEYCODE_BACK || true
    fi
    stop_unstable_launcher
    sleep 1
    adb shell am force-stop "$PACKAGE" >/dev/null 2>&1 || true
    adb shell am start -n "$ACTIVITY" >/dev/null || true
    sleep 2
  done
}

fill_after_label() {
  local label="$1"
  local value="$2"
  dump_ui
  local pos
  if ! pos="$(node_center edit_after "$label" 2>/dev/null)"; then
    echo "Falha: campo após '$label' não foi encontrado."
    cat "$UI_FILE" || true
    exit 1
  fi
  read -r x y <<<"$pos"
  adb shell input tap "$x" "$y"
  sleep 1
  adb shell input text "$value"
  sleep 1
  adb shell input keyevent KEYCODE_BACK || true
  sleep 1
}

# Teste funcional real: não basta o processo estar vivo; a tela precisa aceitar toque e digitação.
sleep 1
dismiss_system_overlays
dump_ui

if grep -Eqi "isn't responding|is not responding|Close app|Wait" "$UI_FILE"; then
  echo "Falha de infraestrutura: um alerta do Android continuou cobrindo o Lumina."
  cat "$UI_FILE" || true
  exit 2
fi

if ONBOARDING_POS="$(node_center text 'Começar' 2>/dev/null)"; then
  read -r OX OY <<<"$ONBOARDING_POS"
  adb shell input tap "$OX" "$OY"
  sleep 1
  dismiss_system_overlays
  dump_ui
fi

# Regressão do erro App.ui.switchAuthTab: tocar nas duas abas deve alternar os formulários.
if ! REGISTER_TAB_POS="$(node_center text_top 'Criar conta' 2>/dev/null)"; then
  echo "Falha: aba Criar conta não foi encontrada."
  cat "$UI_FILE" || true
  exit 1
fi
read -r RTX RTY <<<"$REGISTER_TAB_POS"
adb shell input tap "$RTX" "$RTY"
sleep 1
dismiss_system_overlays
dump_ui
if ! grep -F 'Nome de exibição' "$UI_FILE" >/dev/null; then
  echo "Falha: tocar na aba Criar conta não exibiu o formulário de cadastro."
  cat "$UI_FILE" || true
  exit 1
fi

if ! LOGIN_TAB_POS="$(node_center text_top 'Entrar' 2>/dev/null)"; then
  echo "Falha: aba Entrar não foi encontrada."
  cat "$UI_FILE" || true
  exit 1
fi
read -r LTX LTY <<<"$LOGIN_TAB_POS"
adb shell input tap "$LTX" "$LTY"
sleep 1
dismiss_system_overlays
dump_ui
if ! grep -F 'Usuário ou Email' "$UI_FILE" >/dev/null; then
  echo "Falha: tocar na aba Entrar não restaurou o formulário de login."
  cat "$UI_FILE" || true
  exit 1
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
dismiss_system_overlays
dump_ui
if ! grep -F 'lumina_smoke' "$UI_FILE" >/dev/null; then
  echo "Falha: o toque chegou à tela, mas o campo de login não aceitou digitação."
  cat "$UI_FILE" || true
  exit 1
fi

adb shell input keyevent KEYCODE_BACK || true
sleep 1
dismiss_system_overlays
dump_ui
if ! LOGIN_POS="$(node_center text 'Entrar' 2>/dev/null)"; then
  echo "Falha: botão Entrar não foi encontrado pela camada de acessibilidade."
  cat "$UI_FILE" || true
  exit 1
fi
read -r LX LY <<<"$LOGIN_POS"
adb shell input tap "$LX" "$LY"
sleep 1
dismiss_system_overlays
dump_ui
if ! grep -F 'Preencha todos os campos' "$UI_FILE" >/dev/null; then
  echo "Falha: botão Entrar não respondeu ao toque como esperado."
  cat "$UI_FILE" || true
  exit 1
fi

# Cadastro real para validar a interface depois de autenticada.
if ! REGISTER_TAB_POS="$(node_center text_top 'Criar conta' 2>/dev/null)"; then
  echo "Falha: aba Criar conta sumiu antes do cadastro real."
  exit 1
fi
read -r RTX RTY <<<"$REGISTER_TAB_POS"
adb shell input tap "$RTX" "$RTY"
sleep 1
dismiss_system_overlays

fill_after_label 'Nome de exibição' 'LuminaTeste'
fill_after_label 'Usuário' 'lumina_ci_user'
fill_after_label 'Senha' 'Lumina12345'
dump_ui

if ! CREATE_POS="$(node_center text 'Criar conta' 2>/dev/null)"; then
  echo "Falha: botão Criar conta não foi encontrado após preencher cadastro."
  cat "$UI_FILE" || true
  exit 1
fi
read -r CX CY <<<"$CREATE_POS"
adb shell input tap "$CX" "$CY"
sleep 3
dismiss_system_overlays
dump_ui

if ! grep -F 'Mais' "$UI_FILE" >/dev/null; then
  echo "Falha: cadastro concluiu, mas a navegação mobile completa não apareceu."
  cat "$UI_FILE" || true
  exit 1
fi

# O botão Mais precisa expor os recursos que antes ficavam escondidos pela sidebar desktop.
if ! MORE_POS="$(node_center text 'Mais' 2>/dev/null)"; then
  echo "Falha: botão Mais não ficou acessível."
  exit 1
fi
read -r MX MY <<<"$MORE_POS"
adb shell input tap "$MX" "$MY"
sleep 1
dump_ui
for ITEM in 'Todos os recursos' 'Lembretes' 'Demandas' 'Histórico' 'Usuários' 'IA' 'Busca' 'Alarmes' 'Lixeira' 'Configurações' 'Backup'; do
  if ! grep -F "$ITEM" "$UI_FILE" >/dev/null; then
    echo "Falha: recurso '$ITEM' não apareceu no menu mobile completo."
    cat "$UI_FILE" || true
    exit 1
  fi
done

# Abrir Demandas confirma que a navegação pós-login executa ação real.
if ! DEMAND_POS="$(node_center text 'Demandas' 2>/dev/null)"; then
  echo "Falha: Demandas não ficou clicável no menu Mais."
  exit 1
fi
read -r DX DY <<<"$DEMAND_POS"
adb shell input tap "$DX" "$DY"
sleep 1
dump_ui
if ! grep -F 'Nova demanda' "$UI_FILE" >/dev/null; then
  echo "Falha: tela de Demandas não abriu depois do login."
  cat "$UI_FILE" || true
  exit 1
fi

echo "Interação Android confirmada: login/cadastro, digitação, navegação pós-login e menu completo responderam."
echo "Bootstrap Android confirmado: 100% e processo ativo ($PID)."
grep -F "$MARKER" "$LOG_FILE" | tail -n 5 || true
