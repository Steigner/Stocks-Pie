#!/usr/bin/env bash
# Tries a built APK on an emulator: picks a folder, edits a position, and tries the
# keyboard, Back, rotation, large text and restarts. Results show up as annotations.
set -u
APK=$1
PACKAGE=com.github.steigner.stockspie
FOLDER=/sdcard/Documents/SmokeTest
mkdir -p android-check
FAILED=0

# A stuck adb would otherwise hold the job until GitHub's six hour limit.
adb() { timeout 120 adb "$@"; }

# Gathered into one annotation, as GitHub keeps only the first ten per step.
PASSED=""
note() { PASSED="$PASSED$*; "; }
fail() {
  echo "::error title=android-check::$*"
  FAILED=1
}
dump() {
  # Every window, not just the focused one: a tablet opens a <select> as a popup
  # that never takes the focus.
  adb shell uiautomator dump --windows /data/local/tmp/ui.xml >/dev/null 2>&1
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
    # A slow emulator's own apps can stall right after booting, and cover the screen.
    grep -qi "isn.t responding" android-check/ui.xml && tap 'Wait'
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
# A closed side panel keeps its nodes off screen, so only what is on screen counts.
for node in ET.parse('android-check/ui.xml').iter('node'):
    label = (node.get('text') or node.get('content-desc') or '').strip().lower()
    a, b, c, d = map(int, re.findall(r'-?\d+', node.get('bounds')))
    if label == wanted and a >= 0 and c > a and d > b:
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
wait_for_boot() {
  adb wait-for-device
  for _ in $(seq 1 60); do
    [ "$(adb shell getprop sys.boot_completed | tr -d '\r\n')" = 1 ] && return 0
    sleep 3
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
  echo "::notice title=android-check::$PASSED"
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
# Leaving the top of the storage is what shows the tap worked: the button is
# on screen there as well, just refused.
for _ in 1 2 3; do
  tap 'Documents'
  for _ in 1 2 3 4 5; do
    seen "Can.t use this folder" || break 2
    sleep 2
  done
done
sleep 3
if seen "Can.t use this folder"; then
  # What the README tells people to do. Some versions won't open a folder from here.
  note "Documents did not open"
  tap 'Create new folder' || tap 'New folder'
  sleep 2
  adb shell input text SmokeNew
  tap 'OK'
  sleep 3
  shot picker-created
  note "after creating a folder: $(texts)"
  FOLDER=/sdcard/SmokeNew
elif seen 'SmokeTest'; then
  tap_until 'SmokeTest' 'Use this folder'
else
  # The picker can miss a folder made from outside, so Documents itself will do too.
  FOLDER=/sdcard/Documents
fi
shot picker-folder
tap_until 'Use this folder' 'Allow'
shot picker-confirm
tap 'Allow'
if wait_for 'Add your positions'; then
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
elif [ "$(adb shell getprop ro.build.version.sdk | tr -d '\r')" -le 30 ]; then
  # Known on Android 11: this Back leaves the app instead. Nothing is lost by it.
  echo "::warning title=android-check::Back left the app instead of returning to Invest"
  adb shell am start -n "$PACKAGE/.MainActivity"
  wait_for 'How much are you investing'
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
wait_for_boot || { fail "the device did not come back after a restart"; finish; }
sleep 10
adb shell am start -n "$PACKAGE/.MainActivity"
if wait_for 'How much are you investing'; then
  note "folder remembered after a device restart"
else
  fail "folder forgotten after a device restart: $(texts)"
fi
if tap_until 'Portfolio' 'NEW'; then
  note "portfolio still there after a device restart"
else
  fail "portfolio gone after a device restart: $(texts)"
fi
shot rebooted

tap 'Settings'
if tap_until 'English' 'Čeština' && tap 'Čeština'; then
  note "Czech chosen in Settings"
else
  fail "could not choose Czech: $(texts)"
  shot no-czech
  finish
fi
if wait_for 'Nastavení' && tap 'Investovat' && wait_for 'Kolik chcete investovat'; then
  note "switches to Czech at once"
elif [ "$(adb shell getprop ro.build.version.sdk | tr -d '\r')" -le 30 ]; then
  # Known on Android 11: its WebView shows Czech, yet keeps the old text of headings
  # and buttons for uiautomator. The restart below gives it a fresh page.
  echo "::warning title=android-check::uiautomator still reads English after the switch"
else
  fail "the app did not switch to Czech: $(texts)"
fi
shot czech

# The WebView saves the language to disk a few seconds after the change, and
# force-stop would lose it.
sleep 10
adb shell am force-stop "$PACKAGE"
adb shell am start -n "$PACKAGE/.MainActivity"
if wait_for 'Kolik chcete investovat'; then
  note "Czech remembered after an app restart"
else
  fail "language forgotten after an app restart: $(texts)"
fi
tap 'Nastavení'
tap_until 'Čeština' 'English' && tap 'English'
# A fresh page again, for Android 11.
sleep 10
adb shell am force-stop "$PACKAGE"
adb shell am start -n "$PACKAGE/.MainActivity"
if wait_for 'How much are you investing'; then
  note "switches back to English"
else
  fail "could not switch back to English: $(texts)"
fi
shot language-restored
finish
