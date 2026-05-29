# Mindora — Landing Page

Single-file static landing page. RTL Arabic + brand-matched purple gradient.

## Local preview

```bash
# any static server
npx serve landing
# or
python3 -m http.server 8000 --directory landing
```

ثم افتح <http://localhost:3000> (أو 8000).

## النشر (Deploy)

### الخيار 1 — Cloudflare Pages (مجاناً، CDN عالمي)

```bash
# مرة واحدة
npm i -g wrangler
wrangler login

# نشر
cd landing
wrangler pages deploy . --project-name mindora-landing
```

أول مرة بيسأل تختار branch + git integration؛ ممكن تتخطى.

### الخيار 2 — Vercel

```bash
npm i -g vercel
cd landing
vercel deploy --prod
```

ابعتلك الـ URL لما يخلص.

### الخيار 3 — GitHub Pages

1. ادفع المجلد `landing/` كـ subdirectory في الـ repo
2. Settings → Pages → Source: `Deploy from a branch` → branch `main` → folder `/landing`
3. الـ URL: `https://<username>.github.io/<repo>/`

## قبل النشر للـ Production

### استبدل الـ placeholders
- `MINDORA_OWNER` في كل الـ download links → اسم حسابك على GitHub
- `<meta property="og:image">` → URL صورة Open Graph (1200×630)

### استبدل Tailwind CDN بـ build محلي
الـ CDN كويس للـ MVP لكن بطئ شوية. للـ production:

```bash
cd landing
npm init -y
npm i -D tailwindcss @tailwindcss/cli
npx @tailwindcss/cli -i input.css -o style.css --minify
```

ثم في `index.html`، شيل سطر `<script src="https://cdn.tailwindcss.com">` وضيف:
```html
<link rel="stylesheet" href="/style.css">
```

### Open Graph image
صورة 1200×630 بشعار Mindora + tagline. ممكن تعملها في Canva في 5 دقايق.
احفظها كـ `landing/og.png`.

### Screenshots
لو هتضيف قسم screenshots للأبلكيشن لاحقاً، حطهم في `landing/screenshots/` وضيف section جديدة في الـ HTML.

## التحديث للـ Auto-download Latest Version

دلوقتي الـ download links بتـ redirect لـ `releases/latest` (آخر release). الـ GitHub auto-redirect بياخد المستخدم للصفحة، ومنها يحمل الملف. لو عايز direct download:

```html
<!-- Mac -->
href="https://github.com/USER/REPO/releases/latest/download/Mindora_universal.dmg"

<!-- Windows -->
href="https://github.com/USER/REPO/releases/latest/download/Mindora_x64.msi"

<!-- Linux -->
href="https://github.com/USER/REPO/releases/latest/download/Mindora_amd64.AppImage"
```

اسم الملف لازم يبقى ثابت في كل release عشان الـ link يفضل شغال.
