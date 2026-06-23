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

---

## v7 — Security hardening

Run **`supabase/migration_v7_security.sql`** once in the Supabase SQL Editor (safe to re-run, no app/deploy change needed). It adds defense-in-depth on top of the existing Row Level Security:

- **Pins the `search_path` of every privileged (SECURITY DEFINER) function** (`is_approved`, `is_admin`, `is_manager`, `can_edit_experiment`, `get_next_en`, `handle_new_user`). This closes a search-path-shadowing class of attack and clears Supabase's "Function Search Path Mutable" linter warning. Function logic is unchanged.
- **Restricts the email allow-list table to admins only** — members no longer see who's admin/approved. The signup trigger still works (it runs privileged and bypasses RLS).
- **Optional** (commented in the file): revoke table privileges from the logged-out `anon` role — pure belt-and-suspenders, since RLS already blocks logged-out access.

**On column encryption:** intentionally *not* added. Supabase has deprecated pgsodium/Transparent Column Encryption (operational complexity, easy to misconfigure), databases are already encrypted at rest by default, and encrypting experiment columns would break search/sort/filtering and the analysis charts while protecting only against disk theft (already covered). The data is protected by RLS + at-rest encryption + TLS. For any future *secret* value (e.g. an API key) use Supabase Vault, not column encryption on the dataset.

**Biggest remaining gap (not code):** the login still derives its password from the email address, so anyone who knows a staff email could sign in as them. The real fix is switching to magic-link / one-time-code email login (verifies the person owns the inbox). That's a login-UX change requiring email to be configured in Supabase — recommended as the next security step.

---

## v5.2 — Paste import: all rows + shared batches

Fixes and additions to **Experiments → Paste import**:

- **No more dropped rows.** Previously, pasting *without* a header row made the importer treat the first experiment as a header and silently skip it (4 pasted → 3 read). It now detects whether a header row is present; if not, every row is treated as data and columns are mapped **by position** (EN · date · owner · repeat · type · description), with the **purely-numeric columns read as FSC/CRC/AUP** results. Pasting *with* the header row is still recommended (it also brings in materials and processes).
- **Shared batch for an optimisation set.** Pasted sets usually share one big batch. In the "Fill rest" step the importer now handles this:
  - If one of the pasted rows is **Bulk processing**, it's recognised as the **big batch** — the importer offers to create a batch from it and link the other pasted experiments (the continuations) to it.
  - If there's **no** bulk row, you can tick "These came from a shared batch" and enter the batch once (name, total made, dried yield, composition); all pasted experiments link to it. The batch amount/drying isn't in the spreadsheet, so this is where you supply it.

---

## v5.3 — Header-less pastes map the full tracker layout

The paste importer now knows the lab's exact fixed column order, so a paste **without** a header row brings in everything (not just base + results):

`EN · Date · Owner · Repeat? · Experiment type · Description` (cols 1–6), then **7 chemical triplets** (Name / Mass / Ratio), **12 process triplets** (Process / Measure / Value), **Method**, and **FSC / CRC / AUP / FSC-DI**.

So whether you copy with or without the header row, materials, process steps and results all come in. (If you paste a *trimmed* set of columns without a header, it still reads the base fields and treats the rightmost numeric columns as FSC/CRC/AUP.) Pasting with the header row remains the most robust, since it tolerates any column subset or reordering.

---

## v5.4 — Paste import can enrich experiments that already exist

Previously the importer could only **add new** experiments — if a pasted EN already existed (e.g. it was imported earlier as a bare record), the row was skipped, so its chemicals/processes/results never landed. (The parsing itself was fine, including rows full of empty cells.)

Now, when a pasted EN already exists, the "Fill rest" step offers **"these experiments already exist — fill in their details"** (ticked by default). It updates each existing experiment's **chemicals, processes and results** from the paste; base fields are only overwritten where the paste actually has a value (blank cells don't wipe existing data). The preview tags every row **new** or **update**, and the import can do both at once. So you can paste the full detail rows for already-logged experiments and have them filled in.

---

## v5.5 — Grid import (fill a table, one row = one experiment)

The paste import now opens on a **"Fill a table"** mode by default — a spreadsheet-style grid with your **exact 69 tracker columns** as headers (EN, Date, Owner, Repeat?, Experiment type, Description, 7 chemical Name/Mass/Ratio sets, 12 process Process/Measure/Value sets, Method, and the five results incl. **AUP at 0.3 PSI**), grouped and colour-banded across the top.

- **Each row is one experiment.** Type into cells, or **copy a block of cells straight from Excel and paste** — it spreads across the grid from the focused cell and adds rows as needed. Empty cells are fine.
- **Add row** / **+5 rows** buttons; hover a row to delete it. The column headers and row numbers stay pinned while you scroll the wide table.
- Continuing flows into the same **Fill rest → Preview** steps as before, so grid rows get the new/update, work-package and shared-batch handling automatically.
- The old free-text paste is still available under **"Paste raw text"**.

No new migration.

---

## v5.6 — Select & delete experiments + wider, clearer import table

**Select & delete.** The Experiments page has a **Select** button (top right). Turn it on to get checkboxes on every row (and a "select all shown" box in the header); tick the experiments you want, then use the floating **Delete** bar at the bottom. It asks for confirmation and permanently removes those experiments together with their chemicals, processes, results and observations. (You can only delete experiments you're allowed to — admins can delete any.) **Done** exits select mode.

**Import table now wider and clearer.** In *Paste import → Fill a table*, the modal opens extra-wide for the grid, with zebra-striped rows and pinned headers, so the 69-column table is easy to see and scroll. Paste a block of cells from Excel anywhere in the grid and it fills across rows; each row becomes one experiment.

_If the table still doesn't appear after deploying, do a hard refresh (Ctrl/Cmd+Shift+R) so the browser loads the new build._

---

## v5.7 — Results your way, single-metric comparison, owner-filtered plotting, newest-first list

**Final values vs. readings (editor).** The Absorbency box in New/Edit experiment now has a toggle:
- **Final values** — type the FSC/CRC/AUP you already calculated (g/g); they save straight as the experiment's results, untouched.
- **From readings** — type the measured masses and the app computes g/g live (the formula is shown on each box).
Existing experiments open in whichever mode their data was saved in. *(The paste-import table already treats FSC/CRC/AUP as final, already-calculated values and saves them as-is — no change there.)*

**Compare any single metric.** In Graphs → Compare, the metric buttons now include **FSC saline, CRC saline, AUP saline 0.7, FSC DI, and AUP 0.3**. Turn on just one to compare only that metric across samples (e.g. CRC-only, or FSC-in-DI-only), or several for a side-by-side.

**Filter by owner, then pick to plot.** The experiment picker has an **owner** dropdown plus **Select all shown**, so you can narrow to one person's experiments and add them all to the chart in one click.

**Experiments list defaults to newest-first** (by date, then EN). You can still re-sort from the dropdown.

No new migration.

> Note on the readings calculator: the built-in formulas use the lab constants currently set in the app (shown under each input). If those tare/dry-mass constants don't match your exact protocol, tell me the correct formula and I'll set it precisely.

---

## v5.8 — Export selected experiments to Excel (tracker format) and a Word report

With **Select** on (Experiments page), the floating bar now has two export buttons next to Delete:

**Excel** — downloads an `.xlsx` in the **exact 69-column logging layout** (EN, Date, Owner, Repeat?, Type, Description, 7 chemical Name/Mass/Ratio sets, 12 process Process/Measure/Value sets, Method, FSC saline, CRC saline, AUP 0.7, FSC DI, AUP 0.3). One row per selected experiment, header colour-banded to match the import grid. This file can be reviewed, archived, or pasted straight back into the import table.

**Report** — generates a Word **lab report** for the selected experiments. When two or more are selected it opens with a **comparison section**: an absorbency bar chart (FSC/CRC/AUP per experiment), a CRC-vs-AUP positioning scatter, and a summary table — followed by a full per-experiment write-up (materials, procedure, results, cost, method, next steps). Charts are drawn into the document as images.

No new migration.

---

## v5.9 — Template-based weekly report, industry classification, and a visual batch connector

**Report now follows your Word template.** The **Report** button (Select → Report) fills `tempelate_report.docx` directly: the report date, the Project / Work-package line, the **2. Experimental Work** section (an "Experiments performed" table) and the **4. Results & Data Summary** section (a results table + graphs). Everything else in the template is left exactly as-is. The report is intentionally concise — a table of experiments done, a results table, the graphs, and a short line of explanation each. *(The template lives at `public/report-template.docx` — keep it in the repo when you deploy.)*

**Industry classification + separate graphs.** Experiments are split automatically:
- **Agricultural SAP** — only FSC in DI water recorded.
- **Hygiene SAP** — FSC in saline + CRC + AUP recorded.
Each class gets its own chart in the report (agricultural: FSC-DI; hygiene: FSC/CRC/AUP), and the tables tag every experiment with its class.

**Visual batch connector in the importer.** In Paste import → Fill rest, when two or more new experiments are detected you now get a **mind-map linker**: mark the experiment that is the *batch* (box icon), then click the others to link them — branches draw out as **arrows** from the batch to its experiments. You can have several batches, switch the active one, or hit **Auto** to link a detected bulk run to the rest. On import each batch is created from its source experiment and the linked experiments are attached to it. The old "shared batch not in the paste" option remains as a fallback.

No new database migration. **Remember to upload `public/report-template.docx` with the rest of the files.**

---

## v6.0 — Industry classes, easier logging, and clearer experiment structure

**Run `migration_v8.sql` once in Supabase before deploying** (adds `industry` and `step2_label` columns; the editor now writes to them).

- **Liquid unit shows "ml".** The material amount unit toggle now reads **g / ml** (the droplet icon is gone).
- **Ovens in one row.** Add an **oven step** and enter temperature and time (min / hour / days) together in a single row. On save it's split back into the proper separate Temperature and Time columns, so the **Excel export and all columns are unchanged** — this is purely to make logging faster. Editing an oven step shows the combined row again.
- **Sample industry on every new experiment.** Logging now asks **Agricultural** or **Hygiene**. Agricultural samples capture **FSC in DI water**; hygiene samples capture **FSC / CRC / AUP**. The absorbency inputs switch to match.
- **Experiments list distinguishes the two.** Agricultural rows are tinted green and tagged "agri", and show their **FSC-DI** value; FSC/CRC/AUP show for hygiene samples only. (Falls back to auto-detection for older records.)
- **Choose the second step.** For two-step samples you pick what step 2 is — **Surface crosslinking, Bulk crosslinking, Surface coating**, or your own label — and it shows through in the editor, the experiment view, and reports.
- **Add your own qualitative results.** The observation attribute field now accepts new, free-typed attributes (not just the presets), and you can add as many as you like.
- **Structure mind-map.** The editor shows a small diagram with arrows from the experiment to its steps, qualitative observations and results, so the connections are visible at a glance.

Reports keep the same template and style. No change to the export layout.

---

## v6.1 — Recycle bin, drafts, quick result plot, and Characterization

**Run `migration_v9.sql` once in Supabase before deploying.** It adds `deleted_at` and `is_done` to experiments and a new `instrument_tests` table. The editor now writes `is_done`, so this migration is required before the new build goes live.

- **Recently deleted (recycle bin).** Deleting experiments no longer removes them immediately — they move to a **Recently deleted** tab. From there you can **Restore** them or **Delete forever** (which finally removes them and all their data from the database). Select one or many, as before.
- **Unfinished tab + "Experiment is done".** The editor has an **Experiment is done** switch. Leave it off to save a work-in-progress; it lands in the **Unfinished** tab instead of the main list. Tick it (in the editor, or select rows and **Mark done**) and it moves into Experiments.
- **Quick result plot.** Opening an experiment now shows a **Results at a glance** bar chart — FSC / CRC / AUP for hygiene samples, FSC-in-DI for agricultural, plus any other numeric results (AUP 0.3, gel fraction, etc.).
- **Qualitative results in the list.** Samples with only qualitative observations (no absorbency numbers) now show those observations as chips right in the Experiments list, instead of a dash.
- **Characterization tab.** A new section for instrument tests — **FTIR, TGA, DSC, NMR, GPC, SEM** (and you can add your own techniques). Pick the experiment, choose the technique, and write a short explanation of the result. Filter by technique and search across results.

Tabs in Experiments: **Experiments · Unfinished · Recently deleted**. Reports and exports are unchanged.

---

## v6.2 — Raw-material cost: lab vs large scale

A material cost database (`material_cost_database.xlsx`) is now built into the app, with a **lab/catalog price** and a **large-scale/bulk price** for each material (USD per g or per mL).

- **Every experiment now shows two formulation costs** — *Lab scale* (catalog) and *Large scale* (bulk) — with totals and cost-per-kg for each, in the experiment view.
- **Smart name matching.** Materials are matched to the price list even when names differ: supplier/date qualifiers in brackets are ignored, while concentration/MW (NaOH 1M vs 5M, PEG 300 vs 4000) are respected. As requested, **Xanthan gum logged as XG or XN all use the xanthan price, and CMC variants all use the CMC price** (CMS likewise).
- **Sub-batches** (a material that points to another EN) are excluded from raw-material cost and flagged — that batch is costed under its own EN.
- **Excel export** now includes Lab cost, Lab $/kg, Bulk cost and Bulk $/kg columns.
- No database migration is needed for this feature — prices live in the app. DENACOL EX-614B and FAVOR Bio T180 aren't in the file yet, so they currently add $0.

A standalone **`formulation_costs.xlsx`** report is also provided: a per-experiment lab-vs-bulk cost for all 522 experiments, a full material-line breakdown (with SUMIF formulas), the cost database, and notes.
