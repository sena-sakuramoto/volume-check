#!/usr/bin/env bash
# scripts/mojmap/run-local.sh
# -----------------------------------------------------------------------------
# WSL 側で mojxml-rs + tippecanoe + pnpm を用意し、Phase 1 full pipeline を
# ローカル IP（senaa さん自宅/事務所）から直接走らせるスクリプト。
# G空間 CDN が Cloud Run の egress IP を 403 ブロックするため、初回フルビルド
# だけはこのスクリプトで手元から走らせる必要がある。
#
# 使い方:
#   wsl -d Ubuntu -- bash /mnt/d/senaa_dev/volume-check/scripts/mojmap/run-local.sh
# パスワードは sudo apt 実行時に一度だけ聞かれる。
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Copy the whole scripts/mojmap tree to /tmp to avoid pnpm symlink + NTFS
# friction when the same directory has been pnpm-installed on Windows.
WORK_SRC="${MOJMAP_SRC_COPY:-/tmp/mojmap-src}"
rm -rf "$WORK_SRC"
mkdir -p "$WORK_SRC"
cp -r "$SCRIPT_SRC"/. "$WORK_SRC"/
rm -rf "$WORK_SRC/node_modules" "$WORK_SRC/out"
cd "$WORK_SRC"

log() { printf '\n\033[1;36m[mojmap] %s\033[0m\n' "$*"; }
fatal() { printf '\n\033[1;31m[mojmap fatal] %s\033[0m\n' "$*" >&2; exit 1; }

log "Step 1/6: ensure tippecanoe (apt)"
if ! command -v tippecanoe >/dev/null 2>&1; then
    sudo apt-get update -qq
    sudo apt-get install -y tippecanoe libssl-dev pkg-config build-essential cmake git curl
else
    log "tippecanoe already installed"
fi

log "Step 2/6: ensure rustup + stable rust 1.88+"
if ! command -v cargo >/dev/null 2>&1; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal
    # shellcheck disable=SC1091
    source "$HOME/.cargo/env"
fi
# shellcheck disable=SC1091
[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"
RUST_VER="$(rustc --version | awk '{print $2}')"
log "rustc $RUST_VER"

log "Step 3/6: ensure mojxml-rs binary"
if ! command -v mojxml-rs >/dev/null 2>&1; then
    cargo install --git https://github.com/KotobaMedia/mojxml-rs.git --locked
else
    log "mojxml-rs already installed"
fi

log "Step 4/6: pnpm install"
# corepack in Ubuntu should activate pnpm@10.25.0 automatically from package.json
corepack enable >/dev/null 2>&1 || true
pnpm install --ignore-workspace

log "Step 5/6: gcloud ADC check"
# Use Windows-side gcloud ADC to avoid another interactive login inside WSL.
WIN_ADC="/mnt/c/Users/${USER:-$(whoami)}/AppData/Roaming/gcloud/application_default_credentials.json"
# User's Windows home is at /mnt/c/Users/senaa — try that explicitly if the
# env-derived path doesn't work.
if [ ! -f "$WIN_ADC" ]; then
    WIN_ADC="/mnt/c/Users/senaa/AppData/Roaming/gcloud/application_default_credentials.json"
fi
if [ -f "$WIN_ADC" ]; then
    export GOOGLE_APPLICATION_CREDENTIALS="$WIN_ADC"
    log "using Windows gcloud ADC: $GOOGLE_APPLICATION_CREDENTIALS"
else
    fatal "gcloud ADC not found. Run 'gcloud auth application-default login' on Windows first."
fi

log "Step 6/6: running full pipeline (download + parse + upload geojson + tippecanoe + publish)"
export MOJMAP_BUCKET="${MOJMAP_BUCKET:-volans-web-parcel-data}"
export MOJMAP_TIPPECANOE_BIN="${MOJMAP_TIPPECANOE_BIN:-tippecanoe}"
export MOJMAP_MOJXML_BIN="${MOJMAP_MOJXML_BIN:-mojxml-rs}"
export MOJMAP_LOG_LEVEL="${MOJMAP_LOG_LEVEL:-info}"
# Work dir under /tmp avoids slow /mnt/c filesystem during the multi-GB phase.
export MOJMAP_WORKDIR="${MOJMAP_WORKDIR:-/tmp/mojmap-out}"
mkdir -p "$MOJMAP_WORKDIR"

pnpm run full

log "done. Check: gsutil cat gs://${MOJMAP_BUCKET}/moj/current.txt"
