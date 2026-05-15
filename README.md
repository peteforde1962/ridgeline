# RidgeLine — setup guide

This is the real-app version of the RidgeLine prototype. Built with Next.js, Supabase, and Tailwind. You'll get it running locally in about 30 minutes, then deploy to Vercel in another 10.

The old static prototype is still in `/prototype/index.html` for reference.

---

## Step 1 — Install project dependencies

Open Cursor and use its built-in terminal (View → Terminal, or `` Ctrl+` ``). In the project folder, run:

```bash
npm install
```

That downloads Next.js, React, Supabase, Tailwind, and friends into `node_modules/`. Takes ~1 minute.

---

## Step 2 — Create your Supabase project

1. Go to https://supabase.com and create a new project. Name it **ridgeline**, choose the closest region, set a database password (Supabase will save it for you).
2. Wait ~1 minute for the project to spin up.
3. In the sidebar, click **SQL Editor** → **New query**.
4. Open `supabase/schema.sql` from this project. Copy the **entire contents**. Paste into Supabase's SQL editor. Click **Run**.
5. You should see "Success. No rows returned." That's good.

What you just did: created tables for profiles, plans, rides, check-ins, etc., and turned on row-level security so each user only sees their own data.

---

## Step 3 — Copy your Supabase keys

1. In Supabase, sidebar → **Project Settings** → **API**.
2. Copy two values:
   - **Project URL** (looks like `https://abcdefg.supabase.co`)
   - **anon public key** (a long string starting with `eyJ…`)
3. In this project folder, rename `.env.local.example` to `.env.local` (just delete the `.example`).
4. Open `.env.local` and paste your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-key...
```

Save the file. Important: `.env.local` is in `.gitignore` so your keys never get committed.

---

## Step 4 — Run it locally

In the terminal:

```bash
npm run dev
```

You should see something like:

```
  ▲ Next.js 14.2.15
  - Local:        http://localhost:3000
```

Open http://localhost:3000 in your browser. Click **Create account**, sign up with any email and a 6+ character password.

> **Supabase Auth note:** By default Supabase requires email confirmation. For local development, in Supabase go to **Authentication → Providers → Email** and turn off "Confirm email" — or just check your email inbox for the confirmation link.

Once signed up, you'll land on the **Dashboard** showing your name pulled from the `profiles` table. **That's the "it's real now" moment.**

---

## Step 5 — Test on your phone

In Supabase, sidebar → **Authentication** → **Users**. You should see your account.

To open this on your phone, you have two choices:

- **Easy:** deploy to Vercel (see Step 6), then visit your URL on your phone.
- **Local:** find your computer's local IP (Mac: System Settings → Network → Wi-Fi → Details, look for IP Address), then on your phone (same Wi-Fi) visit `http://YOUR-IP:3000`. Sign in with the same account.

Either way, you'll see the same data on both devices. That's the real test that this is no longer browser-only.

---

## Step 6 — Deploy to Vercel

1. Create a GitHub repo for this project. In Cursor's terminal:

   ```bash
   git init
   git add .
   git commit -m "Initial Next.js + Supabase scaffold"
   ```

   Then on github.com, create a new empty repo named `ridgeline`. Copy the commands GitHub shows you (the ones starting with `git remote add origin…`) and paste them into your terminal.

2. Go to https://vercel.com → **Add New** → **Project**.
3. Import the GitHub repo you just created.
4. Vercel will auto-detect Next.js. Before clicking Deploy, expand **Environment Variables** and add the two from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Click **Deploy**. Wait ~90 seconds.

You now have a public URL like `ridgeline-pete.vercel.app`. Open it. Sign up. It works. **You shipped.**

---

## Step 7 — Custom domain (optional)

When you're ready: buy a domain at https://porkbun.com or https://cloudflare.com/products/registrar/ (~$10–15/year). In Vercel → Project → Settings → Domains, add it. Vercel will tell you the DNS records to set at your registrar. ~10 minutes once the records propagate.

---

## What's here so far

```
.
├── app/
│   ├── layout.js              ← root layout, loads globals.css
│   ├── globals.css            ← Tailwind + brand styles
│   ├── page.js                ← landing page (redirects if signed in)
│   ├── login/page.js          ← real Supabase login
│   ├── signup/page.js         ← real Supabase signup
│   └── dashboard/page.js      ← shows your name from the database
├── components/
│   └── SignOutButton.js
├── lib/supabase/
│   ├── client.js              ← Supabase in the browser
│   ├── server.js              ← Supabase on the server
│   └── middleware.js          ← refreshes auth on every request
├── middleware.js              ← protects /dashboard
├── supabase/
│   └── schema.sql             ← run this in Supabase once
├── prototype/
│   └── index.html             ← the original single-file prototype
├── package.json
├── next.config.js
├── tailwind.config.js
├── .env.local.example
└── README.md
```

---

## What's next (suggested next sprint)

Once accounts work end-to-end, the natural next steps:

1. **Onboarding screen** — port the prototype's preset/level/hours/goal form. Saves to `profiles`.
2. **Body check-in page** — saves to `check_ins`. (Easiest screen — start here.)
3. **Today / Plan pages** — generates from `profiles.plan_weeks` + `profiles.preset`, stores per-session state in `plan_sessions`.
4. **Trails + Rides** — saves to `trails` and `rides`.
5. **AI Coach** — server-side Anthropic API call. Pete's key in Vercel env vars, never sent to the browser.
6. **Strava import** — OAuth + a webhook that auto-fills new rides.

Each of these is a 1–2 evening job with Cursor + Claude doing most of the typing. You direct, it writes.

---

## Stuck? Read this first.

- **"`npm install` errors out"** — make sure you're in the project folder (`cd "web applications for mtb training"`) and Node version is 18+ (`node --version`).
- **"Supabase URL/key invalid"** — make sure `.env.local` is in the project root, not in a subfolder, and has no quotes around the values.
- **"Email not confirmed"** — Supabase → Authentication → Providers → Email → turn off "Confirm email" for dev.
- **"Dashboard says undefined for my name"** — make sure you ran `supabase/schema.sql`. The trigger that creates the profile row only runs for users who sign up *after* you ran the SQL.
