# A&B Smart Materials · Dataroom

A shared, live web app for logging lab experiments and plotting results — built with React + Vite on the front end and **Supabase** (Postgres database + authentication) on the back end. Real access control: only emails you approve can read or write, with `reza@absmartmaterials.com` as the founding admin.

It works on desktop and mobile (it's a normal website — open the link on any phone or laptop), and every change is **live for the whole team in real time**.

---

## What you'll set up (one time, ~20 minutes)

Two free accounts, no credit card:

1. **Supabase** — holds your data and logins.
2. **Vercel** — hosts the website.

You do **not** need to know how to code. Follow the steps in order.

---

## Step 1 — Create the database (Supabase)

1. Go to **https://supabase.com** → *Start your project* → sign in with GitHub or email.
2. Click **New project**. Pick a name (e.g. `ab-dataroom`), set a strong **database password** (save it somewhere), choose the region closest to your team, and create it. Wait ~2 minutes for it to finish provisioning.

## Step 2 — Load the schema and your 522 experiments

1. In your project, open **SQL Editor** (left sidebar) → **New query**.
2. Open the file **`supabase/schema.sql`** from this project, copy *everything*, paste it into the editor, and click **Run**. You should see *Success*. (This creates all the tables, the security rules, and loads your chemical list + vocabularies.)
3. **New query** again. Open **`supabase/seed_experiments.sql`**, copy everything, paste, and **Run**. This imports all 522 experiments with their materials, processes, and results. It may take 10–30 seconds.
   - *If the editor complains the script is too large,* paste and run it in two halves — it's just a long list of inserts and can be split anywhere between two `insert` statements.

## Step 3 — Turn off email confirmation (required)

The app currently uses **email-only login** (no passwords — see *Login mode* below), which needs this turned off:

- Go to **Authentication → Sign In / Providers → Email** and turn **Confirm email** *off*, then save.

That's it — people sign in by just typing their email.

## Step 4 — Copy your two keys

Go to **Project Settings → API** and copy these two values — you'll paste them into Vercel next:

- **Project URL** (looks like `https://abcd1234.supabase.co`)
- **anon public** key (a long string)

> The `anon` key is meant to be public — it's safe in the browser. Your data is protected by the database security rules (Row Level Security), not by hiding this key.

---

## Step 5 — Put the website online (Vercel)

The easiest path uses GitHub:

1. Create a free **GitHub** account if you don't have one, and create a new empty repository (e.g. `ab-dataroom`).
2. Upload this whole project folder to that repo. *(On GitHub: open the repo → **Add file → Upload files** → drag in everything **except** the `node_modules` folder → Commit.)*
3. Go to **https://vercel.com**, sign in with GitHub, click **Add New → Project**, and **Import** your `ab-dataroom` repo.
4. Vercel auto-detects Vite. Before deploying, expand **Environment Variables** and add the two keys from Step 4:

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | your Project URL |
   | `VITE_SUPABASE_ANON_KEY` | your anon public key |

5. Click **Deploy**. After a minute you'll get a live link like `https://ab-dataroom.vercel.app`. That's the app — share it with the team.

---

## Step 6 — First sign-in and adding your team

1. Open the live link and enter **`reza@absmartmaterials.com`**, then click **Continue**. This account is automatically the **admin** and is approved instantly — no password to set.
2. Sign in. You'll land on the experiments list with all 522 records.
3. To add teammates, go to **Team & access** (admin-only, in the sidebar). Two ways:
   - **Pre-authorize (smoothest):** add a teammate's email under *Pre-authorized emails*. When they enter that email, they're approved automatically.
   - **Approve on request:** let them enter their email first (they'll see an "access pending" screen), then click **Approve** next to their name.
4. You can promote anyone to **admin** or **revoke** access from the same page.

That's it — you're live.

---

## Login mode (passwordless)

Right now login is **email-only**: people type their email and they're in — no password. It's the simplest way to get the team started.

- New emails still land **pending** until an admin approves them, and `reza@absmartmaterials.com` is still the admin, so you keep control over *who* can see data.
- It is **not** strong security: anyone who has the app link and knows an approved email could sign in as that person. Fine for an internal tool among colleagues; not something to make public.
- It requires **Confirm email** to be off (Step 3).

**To switch to real passwords later:** open `src/config.ts`, change `PASSWORDLESS` to `false`, and redeploy (commit the change on GitHub — Vercel rebuilds automatically). After that, the login screen asks for a password. Accounts created during passwordless mode will need a password reset to sign back in (an admin can trigger this from the Supabase dashboard under *Authentication → Users*).

## How access control works

- Anyone can create an account, but a new account starts **pending** and can see **nothing** until an admin approves it (or their email was pre-authorized).
- `reza@absmartmaterials.com` is always admin. Admins approve members, manage roles, and curate the email allow-list.
- Every read and write is enforced **server-side** by Postgres Row Level Security — the rules can't be bypassed from the browser.
- Admins can delete library items and any experiment; members can add and edit experiments and delete the ones they created.

---

## Using the app

- **Experiments** — search across EN / description / chemical / owner, filter by type or owner, sort, and click any row to view full detail. **New experiment** opens a form where materials, process steps, and results are all **add-as-many-as-you-need** rows. Typing a chemical, process, measure, or result that doesn't exist yet lets you add it on the spot.
- **Graphs** — pick scatter, bar, or trend; choose any numeric result for the axes; colour or group by owner or type; filter; and export the plotted points to CSV.
- **Library** — manage the shared chemical list (with supplier, full name, CAS no., comments) and the experiment-type / process / measure / result vocabularies. Anything added here becomes selectable when logging.

---

## Run it on your own computer (optional)

Only needed if you want to develop or preview locally. Requires [Node.js 18+](https://nodejs.org).

```bash
npm install
cp .env.example .env      # then paste your two keys into .env
npm run dev               # opens http://localhost:5173
```

Other commands: `npm run build` (production build), `npm run preview` (serve the build), `npm run typecheck`.

---

## Good to know

- **Backups & SQL access:** all your data lives in your own Supabase Postgres database — you can browse it under *Table Editor*, query it in *SQL Editor*, and export anytime. Supabase keeps automatic backups on paid tiers.
- **Scale:** the app loads all experiments into the browser for instant search and plotting, which is ideal at a few thousand records. If the dataset grows much larger, the experiments list can be switched to server-side pagination — ask and it's a small change.
- **Original spreadsheet:** the import preserves your data faithfully, including free-text values (e.g. ratios like "usual" or sizes like "0.3 to 0.6"). Numeric results are also stored as numbers so they can be plotted.

---

## Project structure

```
supabase/
  schema.sql              Tables, security rules, triggers, vocab seed — run first
  seed_experiments.sql    Your 522 experiments — run second
src/
  context/                Auth + shared data (with live realtime sync)
  components/             Layout, reusable UI, combobox
  pages/                  Login, Experiments, Graphs, Library, Admin
  lib/                    Supabase client, types, helpers
```
