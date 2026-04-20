#!/usr/bin/env bash
#
# VOLANS Firebase setup helper
# ============================
# Creates the Firestore DB, deploys security rules, and prints the web-app
# config keys that need to land in `.env.local`.
#
# Usage:
#   scripts/setup-firebase.sh FIREBASE_PROJECT_ID
#
# Pre-reqs:
#   firebase login                # interactive, one time
#   (optionally) firebase projects:create FIREBASE_PROJECT_ID

set -euo pipefail

PROJECT_ID="${1:-}"
if [[ -z "$PROJECT_ID" ]]; then
  echo "ERROR: FIREBASE_PROJECT_ID required. Usage: $0 PROJECT_ID" >&2
  exit 1
fi

echo "▶ Selecting project $PROJECT_ID"
firebase use "$PROJECT_ID"

echo "▶ Ensuring Firestore is provisioned (nam5 multi-region by default)"
firebase firestore:databases:list --project="$PROJECT_ID" >/dev/null 2>&1 || \
  firebase firestore:databases:create '(default)' --location=nam5 --project="$PROJECT_ID"

echo "▶ Deploying firestore.rules"
firebase deploy --only firestore:rules --project="$PROJECT_ID"

echo ""
echo "✅ Done. Add these to .env.local (run Firebase Console → Project Settings → Web app to get values):"
echo "  NEXT_PUBLIC_FIREBASE_API_KEY="
echo "  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$PROJECT_ID.firebaseapp.com"
echo "  NEXT_PUBLIC_FIREBASE_PROJECT_ID=$PROJECT_ID"
echo "  NEXT_PUBLIC_FIREBASE_APP_ID="
