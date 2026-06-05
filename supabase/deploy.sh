#!/usr/bin/env bash
# Deploy Heed's Edge Functions + secrets to Supabase.
# Usage:
#   export SUPABASE_ACCESS_TOKEN=sbp_xxx        # from supabase.com/dashboard/account/tokens
#   export GROQ_API_KEY=gsk_xxx                 # HEED CHAT proxy key (use a FRESH one)
#   export GOOGLE_AI_KEY=AIza_xxx               # Google Gemini API key (free from aistudio.google.com)
#   export CF_IMAGE_KEY=xxx                     # Cloudflare API token (image gen)
#   export CF_ACCOUNT_ID=xxx                    # Cloudflare account ID
#   export HF_IMAGE_TOKEN=hf_xxx               # Hugging Face token (image gen)
#   export RESEND_API_KEY=re_xxx                # optional (email); omit to skip emails
#   export ADMIN_EMAILS=ehab@om.sa              # optional (defaults below)
#   bash supabase/deploy.sh
#
# DB part: paste supabase/DEPLOY_SQL.sql into the Supabase SQL editor (one time).
set -euo pipefail

REF="fojakeyxfvdrahxcrdoj"
: "${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN first (sbp_... from supabase.com/dashboard/account/tokens)}"

echo "▸ Deploying Edge Functions to $REF ..."
supabase functions deploy invite-member  --project-ref "$REF"
supabase functions deploy notify-mention --project-ref "$REF"
supabase functions deploy notify-dm      --project-ref "$REF"
supabase functions deploy notify-task    --project-ref "$REF"
supabase functions deploy notify-hr      --project-ref "$REF"
supabase functions deploy approve-access --project-ref "$REF"
supabase functions deploy list-users     --project-ref "$REF"
supabase functions deploy chat           --project-ref "$REF"
supabase functions deploy transcribe     --project-ref "$REF"
supabase functions deploy image          --project-ref "$REF"

echo "▸ Setting secrets ..."
SECRETS=( "ADMIN_EMAILS=${ADMIN_EMAILS:-ehab@om.sa}" )
[ -n "${RESEND_API_KEY:-}" ]  && SECRETS+=( "RESEND_API_KEY=${RESEND_API_KEY}" )
[ -n "${GROQ_API_KEY:-}" ]    && SECRETS+=( "GROQ_API_KEY=${GROQ_API_KEY}" )
[ -n "${GOOGLE_AI_KEY:-}" ]  && SECRETS+=( "GOOGLE_AI_KEY=${GOOGLE_AI_KEY}" )
[ -n "${CF_IMAGE_KEY:-}" ]    && SECRETS+=( "CF_IMAGE_KEY=${CF_IMAGE_KEY}" )
[ -n "${CF_ACCOUNT_ID:-}" ]   && SECRETS+=( "CF_ACCOUNT_ID=${CF_ACCOUNT_ID}" )
[ -n "${HF_IMAGE_TOKEN:-}" ]  && SECRETS+=( "HF_IMAGE_TOKEN=${HF_IMAGE_TOKEN}" )
supabase secrets set "${SECRETS[@]}" --project-ref "$REF"

echo "✓ Functions + secrets deployed."
echo "  Remaining: run supabase/DEPLOY_SQL.sql in the SQL editor (if not done),"
echo "  and add 'heed://auth-callback' under Auth → URL Configuration → Redirect URLs."
