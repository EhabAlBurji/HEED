# Heed — Backend deploy (team collaboration)

This turns on cross-user **invites, notifications, @mentions, and synced task comments**.
Everything in the app already calls these — until deployed, the calls are silent no-ops, so the app keeps working locally.

Prereqs: the [Supabase CLI](https://supabase.com/docs/guides/cli) and your project ref (your project URL is `https://fojake….supabase.co`, so the ref is the `fojake…` part).

## 1. Link the project
```bash
supabase link --project-ref <your-project-ref>
```

## 2. Run the migration (creates tables + RLS + realtime)
```bash
supabase db push
```
Adds: `notifications`, `task_comments`, and a `profiles.access_status` column, all with row-level security and realtime enabled (see `migrations/20260602000001_team_collab.sql`).

## 3. Deploy the Edge Functions
```bash
supabase functions deploy invite-member
supabase functions deploy notify-mention
supabase functions deploy approve-access
```

## 4. Set secrets
```bash
# Email provider (Resend). Skip to deliver in-app notifications only (no email).
supabase secrets set RESEND_API_KEY=re_xxx
# Who may approve early-access signups (comma-separated):
supabase secrets set ADMIN_EMAILS=ehab@om.sa
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected into functions automatically.

If you use Resend, verify a sending domain and change the `from:` address in the functions (currently `noreply@heed.app`).

## 5. (Auth) Add the deep-link redirect — fixes Google sign-in returning to the app
Supabase Dashboard → Authentication → URL Configuration → **Redirect URLs** → add:
```
heed://auth-callback
```

## How it works once deployed
- **Invite** (sidebar → add member): `invite-member` looks the person up by email, inserts a notification they receive **in realtime** in the bell, and emails them. They **Accept** → they're added to the workspace's members (RLS grants access) → the workspace shows up in their app.
- **@mention** in a task comment → `notify-mention` resolves the member and notifies them.
- **Task comments** sync live across everyone with workspace access (`task_comments` + realtime).
- **Early access**: new signups default to `access_status = 'early_access'`. Approve via the `approve-access` function (admin-only) → it flips them to `approved` and sends a welcome email.

## Shared boards / canvas (migration `20260602000002_canvas_sync.sql`)
`supabase db push` also creates `boards`, `canvas_nodes`, `canvas_edges` (RLS + realtime) and a public **`canvas-media`** Storage bucket. Once pushed:
- Boards + their nodes/edges sync live across everyone with access to the workspace.
- Image/video/voice media is **uploaded to Storage** and stored as a URL in the node (never base64 in the DB). Node drags are debounced before syncing.
- No extra commands — the bucket + policies are created by the migration. (If your project blocks creating buckets via SQL, create a public bucket named `canvas-media` in the dashboard instead.)

## Optional / later
- **Cross-workspace board sharing UI** (sharing a board into a *different* workspace via `shared_workspace_ids`) — the data + filtering exist; a picker UI isn't wired yet. Within a workspace, all members already see shared boards automatically.
