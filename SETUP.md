# Getting ALLSTAR Executive Ops online

About 15–20 minutes, one time. You'll do everything in your web browser. No coding.

You need three free accounts: **GitHub**, **Supabase** and **Vercel**. Never paste passwords or keys into a chat with anyone, including Claude.

---

## Step 1 — Set up the database (Supabase)

1. Open your Supabase project (the one named `allstar-executive-ops`, region Central US).
2. In the left sidebar, click **SQL Editor**, then **New query**.
3. Open the file `supabase/setup.sql` from this folder in any text editor, copy **all** of it, and paste it into the query box.
4. Click **Run**. You should see "Success. No rows returned."

This creates every table (including the ones for Recruiting, Debt, Finance and the other Phase 2 modules) and locks each one so only your account can read it.

## Step 2 — Create your login

1. In Supabase, go to **Authentication → Sign In / Providers** (on some versions: **Authentication → Providers → Email**).
2. Turn **off** "Allow new users to sign up." This keeps strangers from creating accounts.
3. Go to **Authentication → Users** and click **Add user → Create new user**.
4. Enter your email and a strong password. Leave **Auto Confirm User** checked. Click **Create user**.

## Step 3 — Copy your two keys

1. In Supabase, go to **Project Settings → API** (on some versions: **Project Settings → Data API** and **API Keys**).
2. Keep this tab open. You need two values:
   - **Project URL**, which looks like `https://abcdefgh.supabase.co`
   - The **anon / public** key (newer projects call it the **publishable** key). It's a long string.

Do **not** use the `service_role` or **secret** key anywhere.

## Step 4 — Put the code on GitHub

1. Unzip `allstar-executive-ops.zip` on your computer.
2. On github.com, click **+ → New repository**.
   - Name: `allstar-executive-ops`
   - Choose **Private**
   - Click **Create repository**.
3. On the next page, click the link **uploading an existing file**.
4. Open the unzipped `allstar-executive-ops` folder, select **everything inside it** (not the folder itself), and drag it into the browser window.
5. Wait for all files to finish uploading, then click **Commit changes**.

## Step 5 — Launch it (Vercel)

1. On vercel.com, click **Add New → Project**.
2. Find `allstar-executive-ops` in the list and click **Import**.
3. Open **Environment Variables** and add these two:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL from Step 3 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon / publishable key from Step 3 |

4. Click **Deploy**. It takes about two minutes.
5. When it finishes, Vercel shows your site address, something like `allstar-executive-ops.vercel.app`.

## Step 6 — Final connection

1. Back in Supabase, go to **Authentication → URL Configuration**.
2. Set **Site URL** to your Vercel address from Step 5 (including `https://`). Click **Save**.

## Step 7 — Sign in

Open your Vercel address and sign in with the email and password from Step 2.

The first time you sign in, the app loads your 12 starting items, 5 projects, your daily schedule and Wylie's preferences. That only happens once.

---

## Good to know

- **Bookmark it** on your computer and phone. On iPhone, open it in Safari, tap Share → **Add to Home Screen** for an app icon.
- **Custom address** (like `ops.allstarlifegroup.com`): in Vercel go to your project → **Settings → Domains**. Whoever manages Allstar's domain adds one DNS record that Vercel shows you.
- **Backups:** Supabase backs up the database daily. You can also export everything from **Settings → Export as JSON** inside the app.
- **Updates:** when Claude sends a new version, upload the changed files to the same GitHub repository. Vercel redeploys automatically within a couple of minutes. If an update includes a new `.sql` file, run it in the SQL Editor first.
- **Free plan note:** Supabase pauses free projects after 7 days with no activity. Using the app daily keeps it awake; if it ever pauses, click **Restore** in Supabase.

## If something goes wrong

| What you see | Fix |
|---|---|
| "That email and password don't match an account" | Re-check Step 2. Make sure the user shows as confirmed. |
| Red banner: "relation … does not exist" | The SQL in Step 1 didn't run fully. Run `supabase/setup.sql` again on a fresh project. |
| Vercel build fails mentioning `SUPABASE` | One of the two environment variables is missing or misspelled. Fix it in Vercel → Settings → Environment Variables, then **Redeploy**. |
| Page loads but stays on "Loading your workspace…" | The anon key is wrong. Copy it again from Supabase, update it in Vercel, redeploy. |
