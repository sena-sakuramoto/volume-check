#!/usr/bin/env bash
#
# VOLANS Cloud Run deploy helper
# ==============================
# Idempotent one-command deploy. Safe to re-run.
#
# Usage:
#   scripts/deploy-volans.sh PROJECT_ID [REGION]
#
# Prerequisites:
#   - `gcloud auth login` (interactive, once)
#   - Billing linked to PROJECT_ID (if not, surfaces the quota hint)
#   - $GEMINI_API_KEY set in the shell (for first-time secret provisioning).
#     On subsequent runs the secret is already created and this var is ignored.

set -euo pipefail

PROJECT_ID="${1:-}"
REGION="${2:-asia-northeast1}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "ERROR: PROJECT_ID required. Usage: $0 PROJECT_ID [REGION]" >&2
  exit 1
fi

echo "▶ Setting project to $PROJECT_ID, region $REGION"
gcloud config set project "$PROJECT_ID"

# 1. Billing link check (informational only — billing is manual one-time)
billing=$(gcloud beta billing projects describe "$PROJECT_ID" \
  --format='value(billingEnabled)' 2>/dev/null || echo 'false')
if [[ "$billing" != "True" ]]; then
  echo "✗ Billing is NOT enabled on $PROJECT_ID."
  echo "  Run: gcloud beta billing projects link $PROJECT_ID \\"
  echo "         --billing-account=<BILLING_ACCOUNT_ID>"
  echo "  (If that fails with 'Cloud billing quota exceeded', request a raise:"
  echo "   https://support.google.com/code/contact/billing_quota_increase)"
  exit 1
fi

# 2. Enable the APIs we need. --async would race with subsequent steps.
echo "▶ Enabling required GCP APIs"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  identitytoolkit.googleapis.com \
  firestore.googleapis.com \
  --project="$PROJECT_ID"

# 3. Artifact Registry repo
echo "▶ Verifying Artifact Registry 'volans' repo in $REGION"
if ! gcloud artifacts repositories describe volans --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create volans \
    --repository-format=docker --location="$REGION" \
    --description="VOLANS Cloud Run images"
fi

# 4. Gemini secret
echo "▶ Verifying Secret Manager secret 'gemini-api-key'"
if ! gcloud secrets describe gemini-api-key >/dev/null 2>&1; then
  if [[ -z "${GEMINI_API_KEY:-}" ]]; then
    echo "✗ GEMINI_API_KEY must be set in the shell for first-time secret creation."
    echo "  export GEMINI_API_KEY=AIzaSy..."
    exit 1
  fi
  echo -n "$GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
fi

# 5. Grant Cloud Build SA the needed roles (idempotent — add-iam-policy-binding
#    is a no-op if the binding already exists).
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
echo "▶ Granting Cloud Build SA ($CB_SA) deploy roles"
for role in roles/run.admin roles/artifactregistry.writer \
            roles/iam.serviceAccountUser roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$CB_SA" --role="$role" --condition=None \
    --quiet >/dev/null
done

# Also let the Cloud Run service account access the Gemini secret at runtime.
CR_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:$CR_SA" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet >/dev/null || true

# 6. Submit the build (builds image + pushes + deploys per cloudbuild.yaml)
echo "▶ Submitting Cloud Build"
gcloud builds submit --config cloudbuild.yaml \
  --substitutions="_REGION=$REGION"

echo ""
echo "✅ Deploy complete. Service URL:"
gcloud run services describe volans-web --region="$REGION" \
  --format='value(status.url)'
