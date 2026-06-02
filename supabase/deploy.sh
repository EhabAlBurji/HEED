#!/usr/bin/env bash
# Deploy Heed's Edge Functions + secrets to Supabase.
# Usage:
#   export SUPABASE_ACCESS_TOKEN=sbp_xxx        # from supabase.com/dashboard/account/tokens
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
supabase functions deploy approve-access --project-ref "$REF"
supabase functions deploy list-users     --project-ref "$REF"

echo "▸ Setting secrets ..."
SECRETS=( "ADMIN_EMAILS=${ADMIN_EMAILS:-ehab@om.sa}" )
[ -n "${RESEND_API_KEY:-}" ] && SECRETS+=( "RESEND_API_KEY=${RESEND_API_KEY}" )
supabase secrets set "${SECRETS[@]}" --project-ref "$REF"

echo "✓ Functions + secrets deployed."
echo "  Remaining: run supabase/DEPLOY_SQL.sql in the SQL editor (if not done),"
echo "  and add 'heed://auth-callback' under Auth → URL Configuration → Redirect URLs."
