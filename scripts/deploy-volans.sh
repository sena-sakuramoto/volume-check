#!/usr/bin/env bash
#
# VOLANS Cloud Run deploy helper
# ==============================
# One-command deploy for when the prerequisite GCP resources are in place.
#
# Usage:
#   scripts/deploy-volans.sh PROJECT_ID [REGION]
#
# Pre-reqs (run once per GCP project):
#   gcloud auth login
#   gcloud projects create PROJECT_ID --name="VOLANS"        # or use existing
#   gcloud config set project PROJECT_ID
#   gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
#                          cloudbuild.googleapis.com secretmanager.googleapis.com
#   gcloud artifacts repositories create volans \
#     --repository-format=docker --location=asia-northeast1
#   echo -n "$GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
#   # Grant Cloud Build SA the Secret Manager accessor + Cloud Run admin roles
#   #   (see docs/DEPLOY.md for the full IAM setup)

set -euo pipefail

PROJECT_ID="${1:-}"
REGION="${2:-asia-northeast1}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "ERROR: PROJECT_ID required. Usage: $0 PROJECT_ID [REGION]" >&2
  exit 1
fi

echo "▶ Setting project to $PROJECT_ID, region $REGION"
gcloud config set project "$PROJECT_ID"

echo "▶ Verifying Artifact Registry 'volans' repo exists in $REGION"
if ! gcloud artifacts repositories describe volans --location="$REGION" >/dev/null 2>&1; then
  echo "  → repo missing, creating…"
  gcloud artifacts repositories create volans \
    --repository-format=docker --location="$REGION"
fi

echo "▶ Submitting build (cloudbuild.yaml)"
gcloud builds submit --config cloudbuild.yaml \
  --substitutions="_REGION=$REGION"

echo "✅ Done. Service URL:"
gcloud run services describe volans-web --region="$REGION" \
  --format='value(status.url)'
