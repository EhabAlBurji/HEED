# Heed — Launch Roadmap

دليل إطلاق Heed على Supabase + توزيع الأبلكيشن للناس.
كل خطوة عليها مسؤول واضح (👤 المستخدم / 🤖 Claude) ومدة تقريبية.

---

## Phase 1 — قاعدة البيانات (Database foundation)

### الخطوة 1.1 — أنشئ مشروع Supabase 👤
1. روح [supabase.com/dashboard](https://supabase.com/dashboard) وسجّل دخول
2. اضغط **New project**
3. اختار:
   - **Name**: `heed-prod`
   - **Database password**: ولّد كلمة سر قوية واحفظها في password manager
   - **Region**: `Frankfurt (eu-central-1)` (أقرب للناس في الشرق الأوسط) أو `London`
   - **Pricing plan**: Free للبداية
4. استنّى دقيقتين لحد ما المشروع يجهز

### الخطوة 1.2 — شغّل الـ migration 👤
بعد ما المشروع يجهز:

1. روح **SQL Editor** من الـ sidebar
2. اضغط **New query**
3. افتح ملف [supabase/migrations/20260529000001_initial_schema.sql](supabase/migrations/20260529000001_initial_schema.sql) من الريبو
4. الصق المحتوى كله في الـ editor
5. اضغط **Run** (⌘+Enter)
6. لازم تشوف "Success. No rows returned" — ده معناه إن كل الجداول والـ RLS اتعملت

> 💡 لو ظهرت أي errors، ابعتلي screenshot لو وقتها هصلحها.

### الخطوة 1.3 — احفظ الـ env keys 👤
في dashboard المشروع → **Settings → API**:

1. انسخ **Project URL** → ضعه في `.env` كقيمة `VITE_SUPABASE_URL`
2. انسخ **anon public** key → ضعه في `.env` كقيمة `VITE_SUPABASE_ANON_KEY`
3. أنشئ ملف `.env` في جذر المشروع لو مش موجود

```bash
# .env (في جذر المشروع)
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

> ⚠️ **مهم**: `.env` لازم يكون في `.gitignore` — متلوحش keys على GitHub.

### الخطوة 1.4 — فعّل auth providers 👤
في **Authentication → Providers**:

1. **Email**: مفعّل افتراضياً — اختار "Email OTP" (مش Magic Link)، 6 digits
2. **Google**: 
   - فعّله من الـ toggle
   - عبّي `Client ID` و `Client Secret` من [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - في Authorized redirect URIs، ضيف الـ Supabase callback URL اللي بيظهرلك في الـ dashboard

---

## Phase 2 — Sync Layer (Claude — جلسة قادمة) 🤖

الـ Zustand stores حالياً بتكتب في localStorage بس. لازم نضيف طبقة sync بحيث:
- على الـ login: نسحب كل بيانات المستخدم من Supabase ونحطها في الـ stores
- على أي mutation: نكتب لـ Supabase + نحدث الـ store
- نتسمع realtime subscriptions ونحدث الـ store لو حد غيّر من جهاز تاني
- conflict resolution: last-write-wins (الأبسط)

**ملفات هتتعدّل** (في الجلسة القادمة):
- `src/lib/sync.ts` (جديد) — طبقة sync مشتركة
- `src/stores/tasksStore.ts` — wrap mutations
- `src/stores/workspaceStore.ts` — wrap mutations
- `src/stores/scheduleStore.ts` — wrap mutations
- `src/stores/meetingsStore.ts` — wrap mutations
- `src/hooks/useInitialSync.ts` (جديد) — pull on app start

**المخطط:**
```
Login → useInitialSync() pulls all data → Zustand stores populated
                              ↓
                User performs action (e.g., addTask)
                              ↓
              Store optimistic update → push to Supabase
                              ↓
              Realtime listener picks up changes from other clients
                              ↓
              Store updated → UI re-renders
```

---

## Phase 3 — OAuth Deep Link ✅ (تم 2026-05-29)

**اتنفّذ كاملاً:**
- ✅ `tauri-plugin-deep-link` 2.x مضاف في Cargo.toml + lib.rs
- ✅ scheme `heed` مسجّل في `tauri.conf.json` تحت `plugins.deep-link.desktop.schemes`
- ✅ permission `deep-link:default` في `src-tauri/capabilities/default.json`
- ✅ npm package `@tauri-apps/plugin-deep-link` متثبّت
- ✅ `authStore.signInWithGoogle` يستخدم `redirectTo: "heed://auth-callback"`
- ✅ `authStore.handleOAuthCallback(url)` بيعمل `exchangeCodeForSession` (PKCE) أو `setSession` (hash tokens)
- ✅ `App.tsx` يـ listen عبر `onOpenUrl` + `getCurrent` (cold/warm starts)

**خطوة manual باقية في Supabase Dashboard:** 👤
1. Authentication → URL Configuration → **Redirect URLs**
2. ضيف `heed://auth-callback`
3. (احتياطي) ممكن تضيف `http://localhost:1420` للـ dev من المتصفح

**خطوة manual في Google Cloud Console:** 👤
- لازم Google OAuth client يكون مظبوط في Supabase Auth Providers مع Client ID + Secret من [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- Authorized redirect URI في Google Cloud = `https://fojakeyxfvdrahxcrdoj.supabase.co/auth/v1/callback`

---

## Phase 4 — Code Signing 👤 (إجراءات إدارية)

عشان macOS مايقولش "unidentified developer":
- **Mac**: تحتاج Apple Developer Program ($99/سنة) + Developer ID Application certificate
- **Windows**: code-signing cert من DigiCert/Sectigo ($100-300/سنة) — اختياري لكن يمنع SmartScreen warnings
- **Linux**: مش محتاج signing

**التكلفة سنوياً**: $99 لـ Apple فقط (الأقل ضرورة)

> 🟡 ممكن نأجل ده ونطلق Mac unsigned مع تعليمات للناس "right-click → Open" أول مرة.

---

## Phase 5 — Tauri Build & Auto-updater 🤖🟨 (Code جاهز، باقي خطوات manual)

### الـ code اتعمل ✅
- `tauri-plugin-updater` + `tauri-plugin-process` مضافين في Cargo.toml + lib.rs
- npm packages `@tauri-apps/plugin-updater` + `@tauri-apps/plugin-process` متثبتين
- `bundle.createUpdaterArtifacts: true` في tauri.conf.json
- `plugins.updater` config مضافة (endpoints + pubkey placeholder)
- `UpdateChecker` component في `src/components/UpdateChecker.tsx` — يفحص عند فتح الأبلكيشن، ويعرض toast لو في تحديث، ويعمل download + relaunch
- مربوط في `App.tsx`

### الخطوات Manual اللي عليك 👤

#### الخطوة 5.1 — Generate signing keys (مرة واحدة فقط، احفظهم كويس)

```bash
# توليد keypair (هيسألك password)
npm run tauri signer generate -- -w ~/.tauri/heed.key

# Output: private key path + public key string
```

دلوقتي:
1. **خد الـ public key** اللي طلع → افتح `src-tauri/tauri.conf.json` → استبدل `REPLACE_WITH_PUBLIC_KEY_FROM_TAURI_SIGNER_GENERATE` بيه
2. **احفظ الـ private key** (في `~/.tauri/heed.key`) في password manager. لو ضاع، مش هتقدر تطلع تحديثات تاني والمستخدمين هيـ stuck على الإصدار الحالي
3. **احفظ الـ password** بتاع المفتاح في password manager
4. ضيف environment variables في الـ shell الـ rc بتاعك:
   ```bash
   export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/heed.key)"
   export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<the-password-you-set>"
   ```

#### الخطوة 5.2 — Update endpoint URL

في `tauri.conf.json` → `plugins.updater.endpoints`:
```json
"https://github.com/HEED_OWNER/heed/releases/latest/download/latest.json"
```
استبدل `HEED_OWNER` بـ GitHub username/org. (لو هتستخدم Cloudflare R2 أو موقع آخر، حط الـ URL مباشرة).

#### الخطوة 5.3 — Build commands

```bash
# Mac (Universal: Intel + Apple Silicon)
npm run tauri build -- --target universal-apple-darwin

# Windows
npm run tauri build -- --target x86_64-pc-windows-msvc

# Linux
npm run tauri build -- --target x86_64-unknown-linux-gnu
```

Outputs في `src-tauri/target/<target>/release/bundle/`:
- Mac: `dmg/Heed_X.X.X_universal.dmg` + `macos/Heed.app.tar.gz` + `.sig`
- Windows: `msi/Heed_X.X.X_x64_en-US.msi` + `.sig`
- Linux: `appimage/heed_X.X.X_amd64.AppImage` + `.sig`

#### الخطوة 5.4 — GitHub Release + latest.json

1. اعمل tag و push: `git tag v0.1.0 && git push --tags`
2. اعمل GitHub Release من الـ tag وارفع الـ DMG/MSI/AppImage + الـ `.sig` files
3. ارفع كمان ملف `latest.json` بالـ format ده:

```json
{
  "version": "v0.1.0",
  "notes": "First release",
  "pub_date": "2026-05-29T12:00:00Z",
  "platforms": {
    "darwin-x86_64": {
      "signature": "<contents of .sig file>",
      "url": "https://github.com/.../Heed_0.1.0_universal.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "<same>",
      "url": "<same>"
    },
    "windows-x86_64": {
      "signature": "<contents of .sig>",
      "url": "https://github.com/.../Heed_0.1.0_x64_en-US.msi.zip"
    },
    "linux-x86_64": {
      "signature": "<contents of .sig>",
      "url": "https://github.com/.../heed_0.1.0_amd64.AppImage.tar.gz"
    }
  }
}
```

### 5.5 — GitHub Action للأتمتة ✅ (تم 2026-05-29)

في `.github/workflows/release.yml`. يـ trigger على tag push (مثل `v0.1.0`)، يبني لـ macOS universal + Windows + Linux، يـ sign بالـ updater key، يعمل GitHub Release، يرفع كل الـ artifacts + `latest.json`، ويـ publish الـ release لما كل الـ builds تخلص.

**خطوة لمرة واحدة قبل أول tag** 👤:

1. اعمل الـ GitHub repo (مثلاً `ehabalburji/heed`) و push الكود
2. Settings → Secrets and variables → Actions → New repository secret:
   - **`TAURI_SIGNING_PRIVATE_KEY`** = محتوى `~/.tauri/heed.key` (الـ private key كله)
     ```bash
     cat ~/.tauri/heed.key | pbcopy   # ينسخ للـ clipboard
     ```
   - **`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`** = الـ password اللي حطيته أثناء التوليد
3. (اختياري بعدين) لو اشتركت في Apple Developer Program، ضيف الـ Apple secrets المذكورة في تعليق الـ workflow

**عمل release:**

```bash
# تأكد إن tauri.conf.json فيه version جديدة
git tag v0.1.0
git push origin v0.1.0
```

اقعد روح Actions tab — هتلاقي 3 builds شغالين parallel. لما يخلصوا (~15-25 دقيقة)، الـ release هيتـ publish تلقائياً مع كل الـ binaries + `latest.json`. الأبلكيشن المنصّب على أجهزة المستخدمين هيلاقي التحديث في الفحص التالي.

**لو في build فشل:** الـ release يفضل draft. شوف logs الـ Actions، صلح المشكلة، احذف الـ tag (`git push --delete origin v0.1.0`)، احذف الـ release من GitHub، اعمل tag تاني.

---

## Phase 6 — Landing Page ✅ (تم 2026-05-29)

موقع static في `landing/index.html` (Tailwind CDN)، RTL Arabic، نفس البراندنج، مع:
- Hero مع 4 floating mockup cards animated
- Features grid (6 cards)
- Download CTAs (Mac/Windows/Linux) — حالياً تشاور على `HEED_OWNER/heed` (placeholder)
- Favicon + Open Graph meta

**Deploy options** (موثّقين في `landing/README.md`):
- Cloudflare Pages (recommended): `wrangler pages deploy landing --project-name heed-landing`
- Vercel: `cd landing && vercel deploy --prod`
- GitHub Pages: source folder = `/landing`

---

## ملخص الترتيب

| Phase | المسؤول | حالة |
|---|---|---|
| 1. قاعدة البيانات | 👤 | ✅ done |
| 2. Sync Layer | 🤖 | ✅ done + UI indicator |
| 3. OAuth Deep Link | 🤖 | ✅ done |
| 4. Code Signing | 👤 | 🟨 updater keys done؛ Apple notarization اختياري |
| 5. Build & Updater | 🤖 | ✅ code done — pending: secrets + first tag |
| 5.5. GitHub Action | 🤖 | ✅ done |
| 6. Landing Page | 🤖 | ✅ done |

---

## آخر خطوات قبل أول release 👤

1. **خلّص `~/.zshrc`** — استبدل `REPLACE_ME_WITH_THE_PASSWORD_YOU_SET` بالـ password بتاع الـ signing key
2. **اعمل GitHub repo** — مثلاً `ehabalburji/heed`
3. **استبدل الـ placeholders:**
   - `tauri.conf.json` → `HEED_OWNER` بتاعك في الـ updater endpoint
   - `landing/index.html` → `HEED_OWNER` (4 أماكن)
4. **Push الكود + ضيف الـ GitHub secrets:**
   - `TAURI_SIGNING_PRIVATE_KEY` = `cat ~/.tauri/heed.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = الـ password
5. **Deploy الـ Supabase Dashboard manual steps** (email template + Google OAuth + redirect URLs)
6. **أول tag:**
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
   روح Actions tab واستنى ~20 دقيقة.
7. **Deploy الـ landing:**
   ```bash
   cd landing && wrangler pages deploy . --project-name heed-landing
   ```

🎉 **بعد كده المنتج online ومنتشر.**
