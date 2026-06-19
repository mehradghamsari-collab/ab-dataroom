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

---

# v2 — What's new & how to set it up

This version adds work packages, two‑step samples, units (g/mL), discontinued experiments, costing, benchmarks, a richer plotting suite, a dashboard, weekly Excel backups, and an optional AI assistant.

## ⚠️ One‑time database update (required)

Open Supabase → **SQL Editor** and run **`supabase/migration_v2.sql`** once. It adds the new columns and the `benchmarks` table. It's safe to run more than once. (Fresh installs that run `schema.sql` already include everything.)

You don't need to touch anything else — Vercel reinstalls dependencies automatically on the next deploy.

## New features

- **Overview dashboard** (now the home page): weekly summary, this‑week bar chart, by‑owner breakdown, recently logged, and **best‑performing samples** ranked by FSC / CRC / AUP.
- **Work packages**: every experiment can be tagged to a project — Project 1 (Network refinement), 1b (Synthetic biopolymer), 2 (Biopolymer modification & linking), 3 (Surface linking), 4 (Scale up), 5 (IP). Filter and colour‑code by project.
- **Material units**: each material can be entered in **g or mL**.
- **Two‑step samples**: toggle on an experiment to capture **Step 1 · Bulk** and **Step 2 · Surface crosslinking** in a single row.
- **Discontinued experiments**: mark experiments that have no results; filter them in/out.
- **Costing (optional)**: add a price per g/mL to chemicals in the Library; each experiment then shows an estimated formulation cost. This is preliminary and will refine automatically once a TEA file is imported.
- **Benchmarks**: in Library → Benchmarks, enter your synthetic reference samples (FSC, CRC, AUP, price/kg).
- **Plot & analyse**:
  - **Compare samples** — pick experiments and get a grouped bar chart of FSC/CRC/AUP (choose which metrics).
  - **Matrices** — CRC × AUP scatter (with benchmark overlay) and a **cost‑vs‑performance parity** chart against a chosen benchmark.
  - **Explore** — flexible scatter / bar / trend over any numeric result.
  - The company logo sits subtly in the corner of every chart.
- **Weekly Excel backup**: on the Overview page, anyone can download a full multi‑sheet `.xlsx` backup of all data. The card reminds you when it's been over a week.

## AI reports (optional, bring your own key)

In **AI reports** you can plug in your own model and generate a **lab report** for any experiment or **weekly slide content**.

- Supported: **Ollama** (local), **Grok (xAI)**, or any **OpenAI‑compatible** endpoint.
- Your API key is stored **only in your browser** (localStorage). It is never saved to the dataroom or shared with the team, and these tools never modify any experiment — they only read data to draft documents.
- **Ollama note:** browsers block an `https://` site from calling `http://localhost`. To use a local Ollama with the hosted app, start it allowing the origin, e.g. `OLLAMA_ORIGINS=* ollama serve`, or run the app locally. Hosted APIs (xAI/OpenAI) may also require their CORS to permit browser calls.

## Is the data safe? Where is it stored?

- All experiment data lives in your **Supabase Postgres database** on the server — **not** in the browser. Logging out, closing the tab, or switching devices never deletes anything; your data persists.
- Access is gated by **Supabase Auth** plus **Row‑Level Security**: only approved accounts can read, and only admins can do admin actions. These rules are enforced on the server, so they can't be bypassed from the browser.
- The only things kept in your browser are your UI preferences, the "last backup" date, and (if you use it) your personal AI key.
- For maximum security we recommend turning email confirmation back on (or moving to magic‑link / password login) once everyone has joined — see the note in the login section above.

---

# v2.2 — Named team, Word/PowerPoint, polished backup

## ⚠️ One‑time database update (required)

Open Supabase → **SQL Editor** and run **`supabase/migration_v2_2.sql`** once (safe to re‑run).
- If you already ran `migration_v2.sql`, you only need this new one.
- Fresh installs that run `schema.sql` already include everything.

This adds a **job title** to profiles and seeds the team so each person is recognised the moment they sign in.

## Your team (pre‑set)

Everyone signs in with **their own email** (passwordless — see the login section). On first sign‑in they're automatically approved with the right name and title:

| Email | Name | Title | Access |
|---|---|---|---|
| reza@absmartmaterials.com | Reza | Researcher | Admin |
| giulia@absmartmaterials.com | Giulia | Researcher | Member |
| ben@absmartmaterials.com | Ben | Researcher | Member |
| mantas@absmartmaterials.com | Mantas | Researcher | Member |
| fabiola@absmartmaterials.com | Fabiola | Associate Founder | Admin |
| amaury@absmartmaterials.com | Amaury | Founder | Admin |

Two things to check:
- **Amaury's email is assumed to be `amaury@absmartmaterials.com`.** If it's different, change it in the `insert into public.allowed_emails …` block of `migration_v2_2.sql` before running, or just add the correct email in **Team & access** afterwards.
- **The two founders are set as Admins** (they can manage the team). To make them regular members, change `make_admin` to `false` for those rows, or flip their role in **Team & access**.

## Reports & slides (new tab)

The old "AI reports" tab is now **Reports & slides**, with three tools:

- **Lab report (Word)** — pick any experiments (or use *This week* / *Top performers* / *All with results*) and download a formatted **`.docx`**: a section per experiment with metrics, formulation and process tables (split by Step 1/Step 2 for two‑step samples), results, estimated cost, and recommended next steps.
- **Slides (PowerPoint)** — the same picker produces a **`.pptx`** with a title slide and **one slide per experiment**: *what was done · results · next step*, in the brand colours.
- **AI draft** — the optional bring‑your‑own‑key drafting from before.

The Word and PowerPoint files are built **in your browser and need no AI key** — they work offline.

## Polished Excel backup

The weekly backup (Overview page) is now a fully styled workbook with a navy title banner, coloured headers, zebra striping, frozen headers and filters, across seven sheets: **Experiments, Formulations, Processes, Results, Chemicals, Benchmarks, About**. Formulations and processes are now included in full.

## Look & feel

- More colour throughout, drawn from the logo — pastel action buttons, colour‑coded work packages, and tinted Step 1 (teal) / Step 2 (orange) blocks in the experiment form.
- Charts now render reliably on phones, including **Compare samples**.

---

## v3 — Team super-app

Run **`supabase/migration_v3.sql`** once in the Supabase SQL Editor (safe to re-run), in addition to the earlier migrations. It adds four tables (`checkins`, `external_tests`, `leave_requests`, `weekly_goals`), a manager role, and tighter edit permissions, and turns on realtime for them.

**What's new**

- **Daily check-ins (Overview → "Team today").** Each person posts a *morning goal* and an *afternoon update*; everyone sees the feed with timestamps. Because every post is time-stamped, the morning/afternoon entries double as a lightweight record of when people start and wrap up.
- **Weekly goals (Overview banner).** Managers add the week's goals each Monday; they show at the top of everyone's landing page for the current week.
- **External testing (new "External tests" tab).** Log samples sent out — linked experiment, sample label, destination lab, delivery company, reference/tracking code, date sent, and status. Results (summary + date) are stored in the app so the whole team stays updated.
- **Team calendar (new "Team calendar" tab).** Anyone can request **holiday**, **remote**, or **sick** leave. Managers (**Ben** and **Amaury**) approve or decline; approved leave appears on a shared month calendar colour-coded by type. A side panel shows approved holiday weekdays used per person for the current year. Managers can file leave on behalf of someone, and their own requests are auto-approved.
- **Owner-only editing.** Only the experiment's creator or an admin can edit or delete it (enforced in the UI and in the database). Imported historical experiments have no creator, so only admins can edit those.
- **Smarter plotting.** The Overview shows *suggested comparisons* — experiment sets logged on the same day — with a one-click "Plot" button. In **Plot & analyse**, the old "Explore" tab is replaced by **Breakdown**: average FSC/CRC/AUP by work package, synthesis method, or researcher (click a bar to drill into its samples), plus a raw-material view that charts every sample using a chosen material. A dashed line marks the SYNTHETIC benchmark.
- **Roster visibility.** Approved teammates can now see each other's names/titles (needed for the check-in, calendar, and goals boards). Only admins can change roles/approvals.

**Manager vs admin.** *Admins* (Reza, Fabiola, Amaury) manage accounts and access. *Managers* (Ben, Amaury) approve leave. The two are independent — Ben is a manager but not an admin.

**Series logging (varying factor).** In the new-experiment panel, each material and each process step has a small **vary** button (the *x* icon). Turn it on for the one factor you're testing — say the mass or volume of a material — and enter several values (e.g. 1, 2, 3 g). On submit the app creates a **separate experiment for each value** (consecutive EN numbers), identical apart from that factor, so a whole series goes in with one form. Only one varying factor is allowed per series, and it's available when creating new experiments (not when editing an existing one).

When a varying factor is set, the **Absorbency** section turns into one row per value, so you record the FSC, CRC and AUP test masses for each sample in the series as you log it. Each row's readings are saved to that sample's own experiment, giving you a separate FSC/CRC/AUP per amount — ready to plot as a dose–response in Compare or Breakdown.

---

## v4 — Supplier samples + multi-line check-ins

Run **`supabase/migration_v4.sql`** once in the Supabase SQL Editor (safe to re-run) — it adds the `supplier_samples` table.

- **Multi-line check-ins.** The morning-goal / day-update box is now a proper text area: **Enter** starts a new line, and you post with the **Post** button (or ⌘/Ctrl + Enter). Line breaks are preserved in the feed.
- **Supplier samples (Library → Supplier samples).** A catalogue of raw materials received from external suppliers. For each one you record **cost per ton, degree of substitution, purity %, viscosity, and colour**, and link the experiments that represent it — the app then shows that material's **performance** (FSC / CRC / AUP) averaged from those experiments. Everyone sees the same catalogue, and it updates live.

---

## v4.1 — Import experiments from Excel

The **Experiments** page has an **Import** button. It reads an `.xlsx`/`.xls`/`.csv` on your device (nothing leaves the browser until you confirm), lets you **match each spreadsheet column** to an experiment field (it auto-guesses from the headers), shows a **preview** of what's new vs. already present, and then creates the new experiments. It de-duplicates on the **EN number**, so re-importing the same file is safe — only genuinely new rows are added. No database change is needed.

Mappable fields: EN (key), date, owner, type/synthesis method, work package, description, repeat, method, and absorbency — either the **raw test masses** (the app calculates FSC/CRC/AUP) or **final g/g values**. Materials and process steps aren't imported yet (they need an agreed column layout — share your sheet and they can be added).

---

## v5 — Batches, richer analysis, legend fix

Run **`supabase/migration_v5.sql`** once in the Supabase SQL Editor (safe to re-run) — it adds the `batches` table and a batch link on materials.

**Batches (make once, use in many experiments).** In **Library → Batches** you create a stock batch — e.g. *"4% Xanthan gum in water"*, composition XG 200 g + water 5000 g, total made 5 L, dried yield 190 g. Then in any experiment's **Materials** section, click **"Use a batch"**, pick the batch, and enter the **portion used** (e.g. 1.5 g) for that step (like surface linking). Each batch shows **how many experiments drew from it**, giving full traceability from a big prep down to every sample that used a piece of it.

**More analysis tools.** The **Plot & analyse** section now has six views: **Compare**, **Breakdown** (averages by group), **Relationships** (scatter of any result vs a formulation factor — a material's amount, cost/kg, or another metric — with a best-fit trend line and R²), **Distribution** (pie of the experiment mix + histogram of a result), **Trends** (average performance and activity per month), and **Matrices** (CRC×AUP and cost-vs-performance).

**Legend fix.** Chart legends (e.g. *Bulk processing / Surface processing / Oven Poly-Condensation / Benchmarks*) now sit above the plot instead of overlapping the x-axis label, across all charts.


---

## v5.1 — Paste experiments straight from Excel

The **Experiments → Paste import** button now takes a **copy-paste** from the spreadsheet (no file upload). Select your rows in Excel *including the header row*, copy, and paste into the box. The app understands the wide tracker layout natively:

- **EN, Date, Owner, Repeat?, Experiment type, Description, Method** map automatically.
- All **7 chemical slots** (Name / Mass / Ratio) become materials; surface-linking rows where a chemical is a prior EN (e.g. `EN1, 1.5 g`) import exactly as written, keeping the lineage visible.
- All **12 process slots** (Process / Measure / Value) become process steps.
- **FSC / CRC / AUP / FSC-DI** and the **3 extra result slots** become results.

It then asks for the few things the sheet doesn't carry (mainly **Work package**, applied to all pasted rows), shows new-vs-existing by EN, and imports — bringing each experiment's materials, processes and results in one go. De-dupes on EN, so re-pasting is safe.

**Make paste need zero extra input** — add a **`Work package`** column to the tracker (the app auto-detects `Work package` / `Project` / `WP`). With that one column, a paste needs no further input at all.

---

## v6 — Qualitative observations + Overview diary

Run **`supabase/migration_v6.sql`** once in the Supabase SQL Editor **before deploying** (it adds the `experiment_observations` table, which the experiments query now reads).

**Qualitative observations.** Every experiment now has a **Qualitative observations** section (colour, texture, final structure, consistency, general evaluation, outcome… — type your own too). It's for describing a product when it isn't good enough to run quantitative absorbency tests, or just to record what it looked/felt like. Observations show on the experiment view as tags.

**Qualitative analysis.** Plot & analyse has a new **Qualitative** tab: pick an attribute (Colour, Texture…) and see a **frequency bar chart** and a **share pie** of the values recorded across all experiments — e.g. how many batches came out "brittle" vs "rubbery".

**Overview diary.** The **Team today** check-ins and **weekly goals** are now a readable diary:
- Each morning goal / day update / weekly goal has **edit and delete** controls (you can edit your own entries; admins can remove any check-in; managers manage goals).
- **Team today → "Earlier days"** expands the full history of past check-ins, grouped by day.
- **Goals → "Previous weeks"** shows every past week's goals.
