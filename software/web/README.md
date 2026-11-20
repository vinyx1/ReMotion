# Web dashboard

The therapist dashboard: React + TypeScript + Tailwind v4, Recharts for charts,
React Three Fiber for the 3D replay. Post-session only; it reads one JSON file.

```
logger CSVs (data/raw, data/sample)
   │  python -m software.dashboard.export        ← run from the repo root
   ▼
software/web/public/sessions.json
   │  npm run dev
   ▼
http://localhost:5173            the landing page
http://localhost:5173/dashboard  the therapist dashboard
```

## Run it

```bash
# from the repo root, with the Python venv active
python -m software.dashboard.fake_history      # optional: three simulated patients' sessions, in data/fake/<id>/
python -m software.dashboard.export            # add --no-sample for real recordings only

cd software/web
npm install                                    # once
npm run dev
```

Run the export again after every new recording, then reload the page.

### The "Generate summary" button (optional)

The Overview's **Generate summary** button asks Claude (`claude-opus-5-5`, low effort) for a
few plain sentences about the patient's sessions. It goes through `POST /api/summary`, served by
the dev and preview servers (`server/summary.ts`), so the API key never reaches the browser.
Give the server credentials before starting it:

```bash
export ANTHROPIC_API_KEY=...    # or: ant auth login
npm run dev
```

Only the figures the Overview shows are sent (per-session counts, percentages, lean and reach
times, by-target counts). The static `npm run build` output has no server, so the button only
reports that it needs `npm run dev` or `npm run preview`.

## Where things are

| File | What it does |
|---|---|
| `src/main.tsx` | Picks the page from the URL: `/` landing, `/dashboard` dashboard |
| `src/landing/Landing.tsx` | Landing page: the sticky 3D story, then progress, evidence, hardware |
| `src/landing/LeanScene.tsx` | The landing page's 3D room; the visitor leans the figure (same 10° / 200 ms rule as the firmware) |
| `src/landing/landing.css` | Landing page styles (Rehab Studio tokens live in `src/index.css`) |
| `src/App.tsx` | Dashboard page: header, headline numbers, tabs |
| `server/summary.ts` | `POST /api/summary` for the dev/preview server: writes the Overview summary with Claude |
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
