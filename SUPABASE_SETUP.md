# Cortex · Terminal — Cloud Sync Setup

Real user accounts, cross-device sync, realtime ideas + comments. ~5-minute setup.

## 1. Create a Supabase project

1. Go to https://supabase.com and sign up (free tier is plenty).
2. Click **New project**, give it a name, set a strong DB password, pick a region.
3. Wait ~2 minutes for the project to provision.

## 2. Run the schema

1. Open your project → **SQL Editor** (left nav)
2. Click **+ New query**
3. Paste the entire contents of `supabase-schema.sql` (in this repo)
4. Hit **Run**
5. You should see `cortex · schema ready ◆` at the bottom.

This creates: `profiles`, `ideas`, `idea_likes`, `comments`, `watchlists`
with row-level security + realtime publishing.

## 3. Paste your keys into the site

1. In Supabase: **Settings → API**
2. Copy **Project URL** and your **publishable** key (`sb_publishable_…`).
   If you still see the old **anon** key (long JWT starting with `eyJ…`),
   that works too — both formats are supported by the SDK pinned here.
3. Open `index.html` in this repo
4. Find this block (near the top):

   ```js
   window.CORTEX_CLOUD = {
     url: "",
     anonKey: ""
   };
   ```

5. Paste your URL + publishable key into the quotes.
6. Commit + push. Vercel auto-deploys.

**Why the publishable key is safe in client code:** it's rate-limited and
RLS policies (in the schema) control what it can actually read/write.

## 4. Enable email confirm (optional, recommended)

- **Authentication → Providers → Email**: enable **Confirm email** so
  people can't sign up with throwaway addresses. Supabase sends the
  confirm mail automatically — works on free tier.

For passwordless sign-in: **Authentication → Providers → Email** →
enable **Magic link**. The site already has a "Magic link" tab in the
auth modal that'll use it.

## 5. (Optional) custom email template branding

- **Authentication → Email Templates** — edit the "Confirm signup",
  "Magic link", and "Reset password" templates to match the Cortex brand.

## Done

Reload the site. You should see:
- `SIGN IN / SIGN UP` button in the sidebar
- Sidebar subtitle reads "local only · sign in to sync"
- Create an account → ideas + comments + watchlists sync to cloud
- Open the site on another device with same login → same data

---

## Verifying the setup

Open the browser console on c0r7x.com and run:

```js
CortexCloud.isConfigured()  // → true (cloud detected)
CortexCloud.isActive()      // → true after sign-in
CortexCloud.ideas.list()    // → current ideas in cloud
```

## Troubleshooting

- **"Cloud sync not configured"** — the anon key/URL is empty in
  `window.CORTEX_CLOUD`. Double-check step 3.
- **Sign-up returns "email not confirmed"** — user needs to click the
  link in the confirmation email Supabase sent them.
- **Can't see other users' ideas** — make sure you ran the schema
  *entirely* (views `ideas_with_author` and `comments_with_author`
  must exist and have `grant select ... to anon` applied).
- **Realtime not updating** — the `alter publication supabase_realtime
  add table ...` lines must succeed. Run them manually if needed.

## Data model

- **profiles** — public, keyed by `auth.users.id`, handle unique
- **ideas** — public readable, author-writable, with `like_count`
  kept fresh by trigger
- **idea_likes** — join table, one row per (user, idea)
- **comments** — public readable per symbol, author-writable
- **watchlists** — private per user

All tables enforce ownership via Row-Level Security policies; the
anon key cannot bypass them.
