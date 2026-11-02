#!/usr/bin/env bash
# Temporary check of a built APK on an emulator: picks a folder, edits a position,
# and tries the keyboard, Back and a restart. Results show up as run annotations.
set -u
APK=$1
PACKAGE=com.github.steigner.stockspie
FOLDER=/sdcard/Documents/SmokeTest
mkdir -p smoke
FAILED=0

note() { echo "::notice title=smoke::$*"; }
fail() {
  echo "::error title=smoke::$*"
  FAILED=1
}
dump() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  adb pull /sdcard/ui.xml smoke/ui.xml >/dev/null 2>&1
}
shot() {
  adb exec-out screencap -p >"smoke/$1.png"
  dump
  cp smoke/ui.xml "smoke/$1.xml"
}
seen() {
  dump
  grep -qi -- "$1" smoke/ui.xml
}
wait_for() {
  for _ in $(seq 1 20); do
    seen "$1" && return 0
    sleep 2
  done
  return 1
}
texts() {
  python3 - <<'EOF'
import re
print(sorted(set(re.findall(r'(?:text|content-desc)="([^"]+)"', open('smoke/ui.xml').read())))[:30])
EOF
}
tap() {
  dump
  local point
  point=$(WANTED="$1" python3 - <<'EOF'
import os, re
import xml.etree.ElementTree as ET
wanted = os.environ['WANTED'].lower()
for node in ET.parse('smoke/ui.xml').iter('node'):
    label = (node.get('text') or node.get('content-desc') or '').strip().lower()
    if label == wanted:
        a, b, c, d = map(int, re.findall(r'\d+', node.get('bounds')))
        print((a + c) // 2, (b + d) // 2)
        break
EOF
  )
  if [ -z "$point" ]; then
    echo "::warning title=smoke::no '$1' on screen: $(texts)"
    return 1
  fi
  # shellcheck disable=SC2086
  adb shell input tap $point
  sleep 2
}
webview_bounds() {
  dump
  python3 - <<'EOF'
import xml.etree.ElementTree as ET
for node in ET.parse('smoke/ui.xml').iter('node'):
    if node.get('class') == 'android.webkit.WebView':
        print(node.get('bounds'))
        break
EOF
}
finish() {
  adb logcat -d >smoke/logcat.txt 2>&1
  [ "$FAILED" = 0 ] && note "all checks passed"
  exit "$FAILED"
}

adb shell mkdir -p "$FOLDER"
adb install "$APK" || { fail "install failed"; finish; }
adb shell am start -n "$PACKAGE/.MainActivity"

if wait_for 'Choose a folder'; then
  note "loads with no INTERNET permission, webview $(webview_bounds)"
else
  fail "connect screen never appeared: $(texts)"
  shot no-start
  finish
fi
shot connect

tap 'Choose a folder'
if wait_for 'documentsui'; then
  note "system folder picker opened"
else
  fail "picker did not open: $(texts)"
  finish
fi
shot picker
tap 'Documents' && tap 'SmokeTest'
shot picker-folder
tap 'Use this folder'
shot picker-confirm
tap 'Allow'
if wait_for 'How much are you investing'; then
  note "folder connected"
else
  fail "folder not connected: $(texts)"
  shot no-connect
  finish
fi
sleep 2
if adb shell cat "$FOLDER/portfolio.json" | grep -q positions; then
  note "portfolio.json written to the folder"
else
  fail "portfolio.json missing: $(adb shell ls "$FOLDER")"
fi
shot invest

tap 'Portfolio'
tap 'Add position'
shot editor
closed=$(webview_bounds)
tap 'Ticker'
sleep 3
open=$(webview_bounds)
shot editor-keyboard
note "webview $closed, with keyboard $open"
[ "$closed" = "$open" ] && fail "the keyboard did not shrink the page"
adb shell input text NEW
adb shell input keyevent KEYCODE_BACK
sleep 1
tap 'Target %'
adb shell input text 100
adb shell input keyevent KEYCODE_BACK
sleep 1
tap 'Save'
sleep 2
if adb shell cat "$FOLDER/portfolio.json" | grep -q NEW; then
  note "edit saved to portfolio.json"
else
  fail "edit not saved: $(texts)"
fi
shot portfolio

tap 'Add position'
adb shell input keyevent KEYCODE_BACK
sleep 2
if seen 'New position'; then
  fail "Back did not close the editor"
else
  note "Back closes the editor"
fi
adb shell input keyevent KEYCODE_BACK
if wait_for 'How much are you investing'; then
  note "Back returns to Invest"
else
  fail "Back did not return to Invest: $(texts)"
fi

adb shell am force-stop "$PACKAGE"
adb shell am start -n "$PACKAGE/.MainActivity"
if wait_for 'How much are you investing'; then
  note "folder remembered after restart"
else
  fail "folder forgotten after restart: $(texts)"
fi
shot restarted
finish
