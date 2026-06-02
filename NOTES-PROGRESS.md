# Autonomous session — progress & what's left

Everything below **type-checks and builds clean** (`npx tsc --noEmit` + `npm run build`). Local-first; no data loss (migrations handle existing state).

## ✅ Done this session

### Cleanup & foundation
- Removed dead code (Reports/CalendarPage/Sessions/MeetingsPanel) + orphan nav keys.
- **Carbon 2x grid foundation**: spacing tokens (`c1`–`c13`), 16-col grid, `Page/Grid/Column` primitives (`src/components/ui/grid.tsx`), shared primitives (`src/components/ui/primitives.tsx`), centralized priority colors (`src/lib/taskMeta.ts`). Applied to Boards; gutters aligned on Projects/Dashboard.

### Surface consolidation
- **Boards = the single visual layer.** Removed the in-project "Plan" canvas; `Board` now has optional `project_id`; project header has an **"Open board"** button. Migration (v3) converts old Spaces → Boards (no node loss). Removed `ProjectCanvas`/`CanvasSpacesBar`.

### Canvas improvements (your notes)
- **Select vs Hand tool** toggle (bottom-left); marquee selection in select mode.
- **Multi-select + Group** (⌘G) → draws a colored frame behind the selection.
- **Media drag fixed**: video nodes get a grab strip (iframes were swallowing pointer events).
- **Aspect-ratio sizing**: images/videos size to the media's real ratio (`object-contain`, no crop).
- **Board covers**: auto-picked from the board's first image node (or set explicitly via `setBoardCover`); project badge on board cards.

### Tasks
- **Comments + activity thread** in the task drawer (`TaskComments.tsx`) with **@mentions** of workspace members. Mentioning someone creates a **notification**.

### Search & notifications
- **Global search (⌘K)** over tasks + projects with fuzzy relevance ranking (`GlobalSearch.tsx`, mounted in `AppShell`).
- **Notification inbox** (bell in TopBar, unread badge) with **workspace-invite accept/reject**. Inviting a member emits an invite notification; accepting adds the workspace so it appears in the switcher/projects.

## ✅ Backend built (deploy to activate) — see `supabase/DEPLOY.md`
- **Migration** `supabase/migrations/20260602000001_team_collab.sql`: `notifications`, `task_comments` tables (+ RLS + realtime), `profiles.access_status` early-access column.
- **Edge Functions** (`supabase/functions/`): `invite-member` (email lookup → notification + email), `notify-mention`, `approve-access` (admin approve → welcome email).
- **Client wiring** (`src/lib/teamSync.ts`, all guarded → no-op offline/guest): invites + @mentions go through the functions; the bell pulls + **realtime-subscribes** to notifications; accept-invite joins the workspace server-side; **task comments sync live** across members. `database.ts` types added.
- **To turn on:** `supabase db push` + `supabase functions deploy …` + set `RESEND_API_KEY`/`ADMIN_EMAILS` (full steps in `supabase/DEPLOY.md`).

## ✅ Shared boards / canvas sync built (deploy to activate)
- **Migration** `20260602000002_canvas_sync.sql`: `boards`, `canvas_nodes`, `canvas_edges` (RLS + realtime) + public **`canvas-media`** Storage bucket.
- **`src/lib/canvasSync.ts`**: media (base64) → Storage upload → URL in the node; push/pull/realtime for boards+nodes+edges; node drags debounced; realtime changes applied via `setState` so they never echo. Wired into every `canvasStore` mutation (guarded). `database.ts` types added. Starts on login in `App.tsx`.
- Result once deployed: boards + nodes + edges + media sync **live across all members** of a workspace.

## ✅ Cross-workspace board sharing UI (done)
- `ShareBoardButton` in the board header: share a board into your other workspaces (toggles `shared_workspace_ids`, syncs). It then appears in those workspaces' Boards lists.

## ▸ Deploy the backend (your action — needs your secrets)
- **DB:** paste `supabase/DEPLOY_SQL.sql` into the Supabase SQL editor (one time). No CLI/token needed.
- **Functions + secrets:** `export SUPABASE_ACCESS_TOKEN=sbp_… [RESEND_API_KEY=…]` then `bash supabase/deploy.sh`.
- **Auth:** add `heed://auth-callback` to Auth → URL Configuration → Redirect URLs.
- Supabase CLI is already installed (`2.104.0`).
1. **Real email sending** (welcome emails on accept) → Supabase Edge Function + an email provider (Resend/SES).
2. **Cross-user delivery** of notifications/invites → currently local; needs a `notifications` table + Supabase Realtime so user A's invite reaches user B's device.
3. **Early-access gate + admin dashboard** (approve new signups, then email them) → needs a server-side `access_status` per user + the email function above. UI gate intentionally not added so it can't lock you out before the backend exists.
4. **AI semantic search** → the search is fast fuzzy/relevance now; "understands intent" needs an LLM call (Claude API) for embeddings/reranking.

## ✅ Done (later batch)
- **Perf**: `recharts` extracted to a lazy chunk (`components/dashboard/Charts.tsx`) → **Dashboard chunk 384KB → 18KB**; `manualChunks` added in `vite.config.ts` (recharts/dndkit/vendor split out of the main bundle).
- **Board cover upload**: manual "غلاف" button in `BoardView` (+ existing auto-pick from image nodes).
- **Mic permission for the packaged app**: `src-tauri/Info.plist` adds `NSMicrophoneUsageDescription` (+ camera) so voice recording prompts/works in the built `.app`.
- **Rebuilt** the universal `.app`/`.dmg` with everything.

## ✅ Done (i18n batch)
- **i18n unification (canvas/boards/search/comments/notifications)**: all ~67 hardcoded Arabic strings moved to `t()` with new `canvas.*`, `boards.*`, `search.*`, `comments.*`, `notifications.*` namespaces in `src/locales/{en,ar}.json`. **0 hardcoded Arabic** left in those files — switching to English now works there. (Fixed a `t` shadowing bug in GlobalSearch by aliasing to `tr`.)

## ⏳ Remaining from the overhaul plan (low priority — not bugs)
- **`isAr ? …` ternaries** in older pages (Settings/Projects/Dashboard/AddTaskInput) still work correctly (they DO switch) — only a style-consistency cleanup, not a bug.
- **Carbon grid** on the remaining content pages (Settings/Schedule) — foundation is ready; not force-applied to avoid regressions on intentional reading-column / dnd-sortable layouts.
- **Shared EmptyState primitive** + **file splitting** (Settings/Projects) — deferred, cosmetic.

## How to test
`npm run dev` → create a project + task (open drawer, add a comment with @mention → bell shows a notification). Open a board, add image/video (drag from Finder), try Select tool + marquee + ⌘G group. ⌘K to search. Invite a member in a team workspace → accept the invite from the bell.
