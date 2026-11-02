#!/usr/bin/env bash
# Tries a built APK on an emulator: picks a folder, edits a position, and tries the
# keyboard, Back, rotation, large text and restarts. Results show up as annotations.
set -u
APK=$1
PACKAGE=com.github.steigner.stockspie
FOLDER=/sdcard/Documents/SmokeTest
mkdir -p android-check
FAILED=0

note() { echo "::notice title=android-check::$*"; }
fail() {
  echo "::error title=android-check::$*"
  FAILED=1
}
dump() {
  adb shell uiautomator dump /data/local/tmp/ui.xml >/dev/null 2>&1
  adb pull /data/local/tmp/ui.xml android-check/ui.xml >/dev/null 2>&1
}
shot() {
  adb exec-out screencap -p >"android-check/$1.png"
  dump
  cp android-check/ui.xml "android-check/$1.xml"
}
seen() {
  dump
  grep -qi -- "$1" android-check/ui.xml
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
print(sorted(set(re.findall(r'(?:text|content-desc)="([^"]+)"', open('android-check/ui.xml').read())))[:30])
EOF
}
tap() {
  dump
  local point
  point=$(WANTED="$1" python3 - <<'EOF'
import os, re
import xml.etree.ElementTree as ET
wanted = os.environ['WANTED'].lower()
for node in ET.parse('android-check/ui.xml').iter('node'):
    label = (node.get('text') or node.get('content-desc') or '').strip().lower()
    if label == wanted:
        a, b, c, d = map(int, re.findall(r'\d+', node.get('bounds')))
        print((a + c) // 2, (b + d) // 2)
        break
EOF
  )
  if [ -z "$point" ]; then
    echo "::warning title=android-check::no '$1' on screen: $(texts)"
    return 1
  fi
  # shellcheck disable=SC2086
  adb shell input tap $point
  sleep 2
}
# Taps until the next screen shows; a tap can land before a list is ready for it.
tap_until() {
  for _ in 1 2 3; do
    tap "$1"
    for _ in 1 2 3 4 5; do
      seen "$2" && return 0
      sleep 2
    done
  done
  return 1
}
webview_bounds() {
  dump
  python3 - <<'EOF'
import xml.etree.ElementTree as ET
for node in ET.parse('android-check/ui.xml').iter('node'):
    if node.get('class') == 'android.webkit.WebView':
        print(node.get('bounds'))
        break
EOF
}
finish() {
  adb logcat -d >android-check/logcat.txt 2>&1
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
if seen "Can.t use this folder"; then
  note "the picker refuses the top of the storage"
fi
tap_until 'Documents' 'SmokeTest'
tap_until 'SmokeTest' 'Use this folder'
shot picker-folder
tap_until 'Use this folder' 'Allow'
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

adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
sleep 3
if seen 'How much are you investing'; then
  note "survives turning the screen, webview $(webview_bounds)"
else
  fail "lost the screen on rotation: $(texts)"
fi
shot landscape
adb shell settings put system user_rotation 0

adb shell settings put system font_scale 1.3
sleep 3
shot large-text
adb shell settings put system font_scale 1.0

# Android destroys any activity left, as it may on a real phone short of memory.
# The picker must still open from the new one, and finish with the folder intact.
adb shell settings put global always_finish_activities 1
adb shell input keyevent KEYCODE_HOME
sleep 3
adb shell am start -n "$PACKAGE/.MainActivity"
wait_for 'How much are you investing'
tap 'Settings'
tap 'Change folder'
if wait_for 'documentsui'; then
  note "picker opens from a recreated activity"
else
  fail "picker did not open from a recreated activity: $(texts)"
fi
adb shell input keyevent KEYCODE_BACK
sleep 3
adb shell settings put global always_finish_activities 0
shot after-recreate

adb shell am force-stop "$PACKAGE"
adb shell am start -n "$PACKAGE/.MainActivity"
if wait_for 'How much are you investing'; then
  note "folder remembered after an app restart"
else
  fail "folder forgotten after an app restart: $(texts)"
fi
shot restarted

adb reboot
adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed | tr -d '
')" = 1 ]; do sleep 3; done
sleep 10
adb shell am start -n "$PACKAGE/.MainActivity"
if wait_for 'How much are you investing'; then
  note "folder remembered after a device restart"
else
  fail "folder forgotten after a device restart: $(texts)"
fi
tap 'Portfolio'
if seen 'NEW'; then
  note "portfolio still there after a device restart"
else
  fail "portfolio gone after a device restart: $(texts)"
fi
shot rebooted
finish
