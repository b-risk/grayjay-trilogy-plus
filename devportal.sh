#!/bin/bash
# Dev Portal interaction script
#
# Auto-detects local IP, finds the plugin config JSON, and discovers the Dev Portal.
#
# Usage:
#   ./devportal.sh <command> [args]
#   ./devportal.sh --portal IP:PORT <command> [args]
#
# Commands: deploy, inject, load-config, logs, http-logs, login, logout,
#           status, test <method>, watch, help

set -e

# ── Auto-detect local IP ──────────────────────────────────────────────
detect_local_ip() {
    ip -4 addr show | grep -oP 'inet \K[\d.]+' | grep -v '127.0.0.1' | head -1
}
LOCAL_IP=$(detect_local_ip)
PLUGIN_PORT=8080

# ── Find the plugin config JSON ───────────────────────────────────────
find_config() {
    local dir="${1:-.}"
    # If an explicit path was given, use it
    if [ -n "$1" ] && [ -f "$1" ]; then
        echo "$1"
        return
    fi
    # Otherwise find the only JSON config in the project root
    for f in "$dir"/*.json; do
        if [ -f "$f" ]; then
            echo "$f"
            return
        fi
    done
    echo ""
}

# ── Discover Dev Portal ───────────────────────────────────────────────
detect_portal() {
    local portal_hint="$1"
    # If already provided, test it
    if [ -n "$portal_hint" ]; then
        if curl -sf "${portal_hint}/plugin/isLoggedIn" > /dev/null 2>&1; then
            echo "$portal_hint"
            return
        fi
    fi

    # Cache file to avoid re-scanning
    local cache_file="/tmp/devportal_addr"
    if [ -f "$cache_file" ]; then
        local cached
        cached=$(cat "$cache_file")
        if curl -sf "${cached}/plugin/isLoggedIn" > /dev/null 2>&1; then
            echo "$cached"
            return
        fi
    fi

    # Scan the local subnet on port 11337 in parallel
    local subnet
    subnet=$(echo "$LOCAL_IP" | cut -d. -f1-3)
    echo "Scanning $subnet.0/24 for Dev Portal..." >&2
    for host in $(seq 1 254); do
        curl -sf --connect-timeout 0.3 "http://$subnet.$host:11337/plugin/isLoggedIn" > /dev/null 2>&1 &&
        { echo "http://$subnet.$host:11337" | tee "$cache_file"; return; } &
    done
    wait
    echo ""
}

# ── Parse args ────────────────────────────────────────────────────────
CONFIG_FILE=""
PORTAL=""
POSITIONAL=()

while [ $# -gt 0 ]; do
    case "$1" in
        --portal)
            PORTAL="$2"
            shift 2
            ;;
        --port)
            PLUGIN_PORT="$2"
            shift 2
            ;;
        -h|--help)
            cmd="help"
            break
            ;;
        *)
            POSITIONAL+=("$1")
            shift
            ;;
    esac
done

set -- "${POSITIONAL[@]}"
cmd="${1:-help}"
shift 2>/dev/null || true

# Try to find config from remaining args or auto-detect
for arg in "$@"; do
    if [ -f "$arg" ] && [[ "$arg" == *.json ]]; then
        CONFIG_FILE="$arg"
        break
    fi
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -z "$CONFIG_FILE" ]; then
    CONFIG_FILE=$(find_config "$SCRIPT_DIR")
fi

# If config found, build the plugin URL
if [ -n "$CONFIG_FILE" ]; then
    CONFIG_NAME=$(basename "$CONFIG_FILE")
    PLUGIN_URL="http://$LOCAL_IP:$PLUGIN_PORT/$CONFIG_NAME"
fi

# Detect portal if not given
if [ -z "$PORTAL" ]; then
    PORTAL=$(detect_portal "$PORTAL")
fi

# ── Commands ──────────────────────────────────────────────────────────

load_config() {
    local json
    json=$(curl -s "$PLUGIN_URL")
    if [ -z "$json" ]; then
        echo "ERROR: Cannot fetch $PLUGIN_URL — is the HTTP server running?" >&2
        exit 1
    fi
    echo "=== Loading plugin config ==="
    curl -s -X POST "$PORTAL/plugin/updateTestPlugin" \
      -H "Content-Type: application/json" \
      -d "$json"
    echo ""
}

inject() {
    local json
    json=$(curl -s "$PLUGIN_URL")
    if [ -z "$json" ]; then
        echo "ERROR: Cannot fetch $PLUGIN_URL — is the HTTP server running?" >&2
        exit 1
    fi
    echo "=== Injecting plugin onto device ==="
    local dev_id
    dev_id=$(curl -s -X POST "$PORTAL/plugin/loadDevPlugin" \
      -H "Content-Type: application/json" \
      -d "$json")
    echo "Dev session ID: $dev_id"
}

deploy() {
    # Fetch config from local server and patch URLs to point to local IP
    local json
    json=$(curl -s "http://$LOCAL_IP:$PLUGIN_PORT/$(basename "$CONFIG_FILE")" | python3 -c "
import sys, json
config = json.load(sys.stdin)
config['sourceUrl'] = 'http://$LOCAL_IP:$PLUGIN_PORT/' + config.get('scriptUrl', '').lstrip('./')
config['scriptUrl'] = 'http://$LOCAL_IP:$PLUGIN_PORT/' + config.get('scriptUrl', '').lstrip('./')
if config.get('iconUrl', '').startswith('./'):
    config['iconUrl'] = 'http://$LOCAL_IP:$PLUGIN_PORT/' + config['iconUrl'].lstrip('./')
print(json.dumps(config))
")
    if [ -z "$json" ]; then
        echo "ERROR: Cannot fetch plugin config from http://$LOCAL_IP:$PLUGIN_PORT/ — is the HTTP server running?" >&2
        exit 1
    fi

    echo "=== Loading plugin config ==="
    local packages
    packages=$(curl -s -X POST "$PORTAL/plugin/updateTestPlugin" \
      -H "Content-Type: application/json" \
      -d "$json")
    echo "$packages"

    sleep 1

    echo "=== Injecting plugin onto device ==="
    local dev_id
    dev_id=$(curl -s -X POST "$PORTAL/plugin/loadDevPlugin" \
      -H "Content-Type: application/json" \
      -d "$json")
    echo "Dev session ID: $dev_id"

    echo ""
    echo "=== Watching logs (10 seconds) ==="
    timeout 10 watch 2>/dev/null || true
    echo "=== Done ==="
}

logs() {
    local index="${1:-0}"
    echo "=== Device logs (index=$index) ==="
    curl -s "$PORTAL/plugin/getDevLogs?index=$index"
    echo ""
}

http_logs() {
    echo "=== HTTP exchanges ==="
    curl -s "$PORTAL/plugin/getDevHttpExchanges"
    echo ""
}

login() {
    echo "=== Triggering login ==="
    curl -s "$PORTAL/plugin/loginTestPlugin"
    echo ""
}

logout() {
    echo "=== Triggering logout ==="
    curl -s "$PORTAL/plugin/logoutTestPlugin"
    echo ""
}

status() {
    echo "=== Login status ==="
    curl -s "$PORTAL/plugin/isLoggedIn"
    echo ""
}

test_method() {
    local method="${1:-getHome}"
    shift 2>/dev/null || true
    local args_json="[]"
    if [ $# -gt 0 ]; then
        args_json=$(printf '%s\n' "$@" | python3 -c "
import sys, json
args = [x.strip() for x in sys.stdin.readlines() if x.strip()]
# Try to parse JSON values, fall back to strings
parsed = []
for a in args:
    try:
        parsed.append(json.loads(a))
    except:
        parsed.append(a)
print(json.dumps(parsed))
")
    fi
    echo "=== Testing: $method ==="
    local result
    result=$(curl -s -X POST "$PORTAL/plugin/remoteTest?method=$method" \
      -H "Content-Type: application/json" \
      -d "$args_json")
    echo "$result" | python3 -m json.tool 2>/dev/null || echo "$result"
}

warnings() {
    local json
    json=$(curl -s "$PLUGIN_URL")
    if [ -z "$json" ]; then
        echo "ERROR: Cannot fetch $PLUGIN_URL — is the HTTP server running?" >&2
        exit 1
    fi
    echo "=== Plugin warnings ==="
    curl -s -X POST "$PORTAL/plugin/getWarnings" \
      -H "Content-Type: application/json" \
      -d "$json"
    echo ""
}

watch() {
    local last_index=0
    echo "=== Watching device logs (Ctrl+C to stop) ==="
    while true; do
        local logs
        logs=$(curl -s "$PORTAL/plugin/getDevLogs?index=$last_index" 2>/dev/null)
        if [ -n "$logs" ] && [ "$logs" != "[]" ] && [ "$logs" != "null" ]; then
            echo "$logs" | python3 -c "
import sys, json
try:
    logs = json.load(sys.stdin)
    for log in logs:
        idx = log.get('id', 0)
        print(f\"[{log.get('type', '?')}] {log.get('log', '')}\")
    if logs:
        with open('/tmp/devportal_last_index', 'w') as f:
            f.write(str(logs[-1].get('id', 0)))
except: pass
"
            if [ -f /tmp/devportal_last_index ]; then
                last_index=$(cat /tmp/devportal_last_index)
            fi
        fi
        sleep 1
    done
}

help() {
    echo "Dev Portal Control Script"
    echo ""
    echo "Auto-detects:"
    echo "  Local IP     → ${LOCAL_IP:-not found}"
    echo "  Config file  → ${CONFIG_FILE:-not found}"
    echo "  Dev Portal   → ${PORTAL:-not found}"
    echo ""
    echo "Options:"
    echo "  --portal IP:PORT     Dev Portal address (auto-scans if omitted)"
    echo "  --port NUM           Plugin HTTP server port (default: 8080)"
    echo ""
    echo "Commands:"
    echo "  deploy               Load config + inject plugin + watch logs"
    echo "  inject               Inject plugin onto device"
    echo "  load-config          Register plugin config on Dev Portal"
    echo "  logs [index]         Get device logs"
    echo "  http-logs            Get HTTP exchange logs"
    echo "  login                Trigger login on device"
    echo "  logout               Trigger logout on device"
    echo "  status               Check login status"
    echo "  test <method> [args] Run remote test (e.g. getHome, getContentDetails)"
    echo "  warnings             Get plugin security warnings"
    echo "  watch                Continuously watch device logs"
    echo ""
    echo "Examples:"
    echo "  ./devportal.sh deploy"
    echo "  ./devportal.sh --portal 10.0.0.24:11337 deploy"
    echo "  ./devportal.sh test getHome"
    echo "  ./devportal.sh status"
}

# ── Dispatch ──────────────────────────────────────────────────────────
case "$cmd" in
    load-config)        load_config "$@" ;;
    inject)             inject "$@" ;;
    deploy)             deploy "$@" ;;
    logs)               logs "$@" ;;
    http-logs)          http_logs "$@" ;;
    login)              login "$@" ;;
    logout)             logout "$@" ;;
    status)             status "$@" ;;
    test)               test_method "$@" ;;
    warnings)           warnings "$@" ;;
    watch)              watch "$@" ;;
    help|*)             help ;;
esac
