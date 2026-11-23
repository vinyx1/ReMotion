# Web dashboard

The landing page and the therapist dashboard: React + TypeScript + Tailwind v4, Recharts for
charts, React Three Fiber for the 3D replay, and a small Node server (`server/`) for accounts and
the API. The data logic stays in Python: the server runs the logger and the export.

```
logger CSVs (data/raw, data/sample, data/fake, data/phone…)
   │  python -m software.dashboard.export --data <folder>   ← the server runs this per account
   ▼
<account>/sessions.json  →  GET /api/sessions  →  the dashboard (re-read every 5 s)

http://localhost:5173            the landing page ("Try the demo")
http://localhost:5173/dashboard  sign in, then the dashboard
```

## Run it

```bash
# from the repo root, with the Python venv active
python -m software.dashboard.fake_history      # optional: three simulated patients' sessions, in data/fake/<id>/

cd software/web
npm install                                    # once
node server/set-owner.ts vincent@remotion.demo # once: the owner's account; prints a password (only its hash is kept)
npm run dev                                    # development, with the API
npm run build && npm start                     # production: the built site + API on PORT (default 8080)
```

The API (`server/api.ts`) runs inside `npm run dev` and `npm run preview` as a Vite plugin, and in
`npm start` (`server/index.ts`, Node 24 runs the TypeScript directly).

## Accounts and demos

- **The owner's account** sees the repo's `data/` folder (the simulated patients, the sample
  session, everything the phone app sent). Create it, or change its password, with
  `node server/set-owner.ts <email> [password]`; a changed password signs it out everywhere.
- **Demo accounts:** "Try a 1-hour demo" on the sign-in page makes a temporary account
  and fills its email and password into the form. It starts with two example patients
  (Margaret Chen, Elena Rossi) and is deleted, with anything added to it, an hour after it was
  requested. **End demo** deletes it straight away (for the next visitor at the table). **One
  live demo per browser:** requesting again while one runs opens that demo (an
  HttpOnly `rm_demo` cookie holds a claim token; the server keeps its hash) instead of a second
  account; End demo frees the browser. At most 100 live demos, 20 requests per address per
  hour, and 15 new Claude summaries per demo.
- **Signing in** sets an HttpOnly, SameSite=Lax cookie (Secure over https). The server keeps
  only a hash of its token. "Keep me signed in" lasts 30 days; otherwise until the browser
  closes. A demo's sign-in ends with the demo.
- **Patients:** Add patient (patients page) gives a profile with no sessions. Each patient's
  Profile & settings has a **Connect a phone** QR code with a 6-letter code (valid 10 minutes);
  the phone app's side of it, signing in by scanning, comes next. Until then, phone uploads
  without a sign-in go to the owner's account.
- **Deleting a patient** (bottom of Profile & settings, after a confirmation) takes them and
  their sessions off the dashboard. Recordings only that account holds (`phone/`, `phone-demo/`,
  `fake/`, the phone's raw lines) are moved to `<account>/deleted/<id>-<time>/` on the server, so
  a slip can be recovered; sessions in shared files (the committed `data/sample`, `data/raw`)
  can't be removed for one account, so that patient is hidden instead (`hidden.json`).
- State lives in `data/state/` (git-ignored; `REMOTION_STATE` to move it): `accounts.json`,
  `signins.json`, and one folder per account. No database: demos only have to last an hour.

### Environment

| Variable | What |
|---|---|
| `ANTHROPIC_API_KEY` | For the Overview summaries (or `ANTHROPIC_AUTH_TOKEN`, or `ant auth login`). `npm run dev` and `npm start` read it from `software/web/.env`. Keep it out of git and chat. |
| `PORT` | `npm start`'s port (default 8080) |
| `REMOTION_STATE` | Where accounts and demos live (default `data/state`) |
| `REMOTION_OWNER_DATA` | The owner's data folder (default the repo's `data/`) |
| `REMOTION_PYTHON` | The Python to run (default `.venv/bin/python`, else `python3`) |

### The summary (optional)

The Overview writes a few plain bullet points about the patient's sessions with Claude
(`server/summary.ts`), cached by the exact figures sent, so the same data never calls Claude
twice. Only the figures the Overview shows are sent (per-session counts, percentages, lean and
reach times, by-target counts).

## Where things are

| File | What it does |
|---|---|
| `src/main.tsx` | Picks the page from the URL: `/` landing, `/dashboard` dashboard |
| `src/landing/Landing.tsx` | Landing page: the sticky 3D story, then progress, evidence, hardware |
| `src/landing/LeanScene.tsx` | The landing page's 3D room; the visitor leans the figure (same 10° / 200 ms rule as the firmware) |
| `src/landing/landing.css` | Landing page styles (Rehab Studio tokens live in `src/index.css`) |
| `src/App.tsx` | Dashboard page: header, headline numbers, tabs |
| `server/api.ts` | The API under `/api` (sign-in, demos, patients, sessions, summary, phone) |
| `server/accounts.ts` | Accounts, sign-ins, 1-hour demos and their clean-up, patients, phone codes |
| `server/index.ts` | The production server (`npm start`): the built site and the API |
| `server/summary.ts` | `POST /api/summary`: the Overview summary with Claude |
| `server/phone.ts` | `POST /api/phone/lines`: the phone app's lines, turned into sessions |
| `src/components/SignIn.tsx` | The sign-in page and "Request a 1-hour demo login" |
| `src/components/Replay.tsx` | Clean vs compensated replay on one shared clock |
| `src/components/Figure3D.tsx` | The 3D seated figure (fixed camera) |
| `src/lib/figure.ts` | Figure geometry: real trunk tilt and timing, illustrative arm |
| `src/components/Overview.tsx` | Peak lean per target, reach time trend |
| `src/components/RepDetail.tsx` | Trunk and wrist traces for one rep |
| `src/components/AllSessions.tsx` | Session table |
| `src/index.css` | Design tokens (colours, fonts) |

## Design rules

- **Landing page:** Literata headlines, Atkinson Hyperlegible Next text, its Mono for numbers. Terracotta appears only when the trunk is past the limit. Direction and rules: `.impeccable/surfaces/` and `DESIGN.md`.
- **Dashboard:** Blue = clean, orange = compensated. Nothing else uses those colours.
  Every result also has an icon or a shape (circle / diamond), so colour is never the only signal.
- Numbers are IBM Plex Mono with `tabular-nums`; text is IBM Plex Sans.
- The data logic (finding reps in the samples) lives in Python (`software/dashboard/data.py`, tested).
  The web app only displays `sessions.json`; don't re-implement it in TypeScript.
