# Auth gate setup (post-deploy)

The site is now gated: no UI renders until the user signs in via Supabase.
Signups are restricted to the `allowed_emails` invite list.

## 1. Update the Supabase schema

Open your Supabase project → SQL editor → New query →
paste the contents of `supabase-schema.sql` → Run.

This is idempotent: the `create table if not exists`, `drop trigger if exists`,
and `drop policy if exists` statements let you re-run the schema safely.

The new block that enables invite-only access:

```sql
create table if not exists public.allowed_emails (...);
create function public.check_email_allowlist() ...;
create trigger enforce_email_allowlist before insert on auth.users ...;
```

## 2. Seed your own email

In SQL editor, run:

```sql
insert into public.allowed_emails (email, note)
values ('yungcortex@gmail.com', 'owner')
on conflict (email) do nothing;
```

(Adjust for whatever email you use to sign in.)

## 3. Create the watchdog account

Two options — either works:

**A. Sign up via the site after seeding the email**

```sql
insert into public.allowed_emails (email, note)
values ('watchdog@c0r7x.local', 'monitoring bot')
on conflict (email) do nothing;
```

Then visit the site, switch to PASSWORD tab, click the "no account" flow —
wait, that's not exposed on the gate by design.

So use option B:

**B. Create user via Supabase dashboard (preferred)**

1. Seed the email in `allowed_emails` (as above).
2. Dashboard → Authentication → Users → Add user → Create new user.
3. Set a strong random password (save it).
4. Email confirmation: set to confirmed if you want to skip the confirm flow.

## 4. Give the watchdog its credentials

```bash
cd ~/site/watchdog
cp .env.example .env
# Fill in:
#   WATCHDOG_EMAIL=watchdog@c0r7x.local
#   WATCHDOG_PASSWORD=<the password from step 3>
#   TELEGRAM_BOT_TOKEN=<reuse liqtg creds if you want>
#   TELEGRAM_CHAT_ID=<same>
```

Test: `npm run once`
- `auth gate did not clear` → allowlist missing or creds wrong
- no errors → loop is ready: `npm run loop`

## 5. Inviting more people

```sql
insert into public.allowed_emails (email, note)
values ('friend@example.com', 'beta tester')
on conflict (email) do nothing;
```

They can now sign up with magic link from the gate. Anyone not in the list
gets `email_not_on_allowlist` and the gate surfaces it as "email not on the
invite list".

## 6. Removing someone

```sql
delete from public.allowed_emails where email = 'friend@example.com';
-- Optionally disable the existing user:
update auth.users set banned_until = 'infinity' where email = 'friend@example.com';
```

## Troubleshooting

- **Gate won't dismiss after signing in** — hard refresh. The session lives
  in localStorage key `sb-xzxxhsjwzkgxhdbvyaud-auth-token`.
- **Magic link email not arriving** — check Supabase SMTP settings. Free
  tier uses their shared pool and can be rate-limited.
- **Watchdog logs "warning: no supabase session"** — `.env` missing creds.
  The watchdog still runs `--health-only` without creds.
- **Watchdog logs "auth gate did not clear"** — either the creds are wrong,
  or the watchdog email isn't in `allowed_emails`, or the user isn't
  confirmed yet.
