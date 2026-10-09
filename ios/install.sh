#!/usr/bin/env bash
# VWTOBD — one-command build & install to iPhone
# Usage: ./install.sh [--team XXXXXXXX] [--simulator]
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$PROJECT_DIR/VWTOBD.xcodeproj"
SCHEME="VWTOBD"
BUILD_DIR="$PROJECT_DIR/.build"

# ── colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}▶ $*${RESET}"; }
ok()      { echo -e "${GREEN}✔ $*${RESET}"; }
warn()    { echo -e "${YELLOW}⚠ $*${RESET}"; }
err()     { echo -e "${RED}✖ $*${RESET}" >&2; exit 1; }
header()  { echo -e "\n${BOLD}$*${RESET}\n"; }

# ── arg parsing ───────────────────────────────────────────────────────────────
SIMULATOR=false
TEAM="${DEVELOPMENT_TEAM:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --team)     TEAM="$2"; shift 2 ;;
    --simulator) SIMULATOR=true; shift ;;
    -h|--help)
      echo "Usage: $0 [--team XXXXXXXXXX] [--simulator]"
      echo "  --team       Your 10-char Apple Team ID (or set DEVELOPMENT_TEAM env var)"
      echo "  --simulator  Build for the iOS Simulator instead of a real device"
      exit 0 ;;
    *) err "Unknown argument: $1" ;;
  esac
done

# ── prerequisites ─────────────────────────────────────────────────────────────
header "VWTOBD Installer"

command -v xcodebuild &>/dev/null || err "Xcode not found. Install Xcode from the App Store."
XCODE_VER=$(xcodebuild -version 2>/dev/null | head -1 | awk '{print $2}')
ok "Xcode $XCODE_VER found"

XCODE_MAJOR=$(echo "$XCODE_VER" | cut -d. -f1)
if (( XCODE_MAJOR < 15 )); then
  err "Xcode 15+ required (found $XCODE_VER). Please update Xcode."
fi

# ── simulator path ────────────────────────────────────────────────────────────
if $SIMULATOR; then
  info "Building for iOS Simulator…"
  DEST="platform=iOS Simulator,name=iPhone 15,OS=latest"
  xcodebuild \
    -project "$PROJECT" \
    -scheme "$SCHEME" \
    -configuration Debug \
    -destination "$DEST" \
    -derivedDataPath "$BUILD_DIR" \
    ${TEAM:+DEVELOPMENT_TEAM="$TEAM"} \
    -quiet build | grep -E "error:|warning:|Build" || true
  ok "Build succeeded"
  # Launch in simulator
  DEVICE_ID=$(xcrun simctl list devices available -j \
    | python3 -c "
import json,sys
d=json.load(sys.stdin)
for _,devs in d['devices'].items():
    for dev in devs:
        if dev['isAvailable'] and 'iPhone' in dev['name']:
            print(dev['udid']); break
    else: continue
    break
" 2>/dev/null || true)
  if [[ -n "$DEVICE_ID" ]]; then
    APP_PATH=$(find "$BUILD_DIR" -name "VWTOBD.app" -path "*/Debug-iphonesimulator/*" | head -1)
    xcrun simctl boot "$DEVICE_ID" 2>/dev/null || true
    xcrun simctl install "$DEVICE_ID" "$APP_PATH"
    xcrun simctl launch "$DEVICE_ID" com.vwt5obd.VWTOBD
    open -a Simulator
    ok "Launched in Simulator"
  fi
  exit 0
fi

# ── detect connected iPhone ───────────────────────────────────────────────────
info "Looking for connected iPhone…"

# devicectl (Xcode 15+)
DEVICE_JSON=$(xcrun devicectl list devices --json-output /dev/stdout 2>/dev/null || echo "{}")
DEVICE_ID=$(echo "$DEVICE_JSON" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    devs=d.get('result',{}).get('devices',[])
    phones=[x for x in devs if x.get('deviceType','')=='iPhone' and x.get('connectionProperties',{}).get('transportType','')!='localNetwork']
    if phones:
        print(phones[0]['hardwareProperties']['udid'])
except: pass
" 2>/dev/null || true)

if [[ -z "$DEVICE_ID" ]]; then
  warn "No iPhone found via devicectl, trying instruments…"
  DEVICE_LINE=$(instruments -s devices 2>/dev/null | grep "iPhone" | grep -v "Simulator" | head -1 || true)
  DEVICE_ID=$(echo "$DEVICE_LINE" | grep -oE '[0-9a-f]{40}' | head -1 || true)
fi

if [[ -z "$DEVICE_ID" ]]; then
  err "No iPhone detected.\n  1. Connect your iPhone with a USB cable\n  2. Unlock the phone and tap 'Trust This Computer'\n  3. Run this script again"
fi

DEVICE_NAME=$(echo "$DEVICE_JSON" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    devs=d.get('result',{}).get('devices',[])
    for x in devs:
        if x.get('hardwareProperties',{}).get('udid','')=='$DEVICE_ID':
            print(x.get('deviceProperties',{}).get('name','iPhone'))
except: print('iPhone')
" 2>/dev/null || echo "iPhone")

ok "Found: $DEVICE_NAME ($DEVICE_ID)"

# ── team ID ───────────────────────────────────────────────────────────────────
if [[ -z "$TEAM" ]]; then
  echo ""
  warn "No Team ID set."
  echo "  Find it at: https://developer.apple.com/account  →  Membership  →  Team ID"
  echo "  (Free Apple ID works — no paid membership required for personal use)"
  echo ""
  read -rp "  Enter your Team ID (10 characters): " TEAM
  TEAM=$(echo "$TEAM" | tr -d '[:space:]')
fi

[[ ${#TEAM} -eq 10 ]] || err "Team ID should be 10 characters (got: '$TEAM')"
ok "Team ID: $TEAM"

# ── build ─────────────────────────────────────────────────────────────────────
info "Building VWTOBD for $DEVICE_NAME…"
mkdir -p "$BUILD_DIR"

xcodebuild \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "platform=iOS,id=$DEVICE_ID" \
  -derivedDataPath "$BUILD_DIR" \
  DEVELOPMENT_TEAM="$TEAM" \
  CODE_SIGN_STYLE=Automatic \
  -quiet build 2>&1 | grep -E "(error:|Build succeeded|BUILD)" || true

APP_PATH=$(find "$BUILD_DIR" -name "VWTOBD.app" -path "*/Release-iphoneos/*" | head -1)
[[ -n "$APP_PATH" ]] || err "Build failed — run 'xcodebuild -project VWTOBD.xcodeproj -scheme VWTOBD build' to see full errors."
ok "Build succeeded → $APP_PATH"

# ── install ───────────────────────────────────────────────────────────────────
info "Installing on $DEVICE_NAME…"
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"
ok "Installed!"

echo ""
echo -e "${BOLD}${GREEN}All done! Open 'VWTOBD' on your iPhone.${RESET}"
echo -e "  Demo mode is ON by default — no OBD adapter needed to explore."
echo ""
