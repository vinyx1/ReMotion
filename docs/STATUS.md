# Status

What we've learned and decided. **Work in progress lives in GitHub Issues**; this file is for findings and decisions. Read it at the start of a session, add to it before you stop. Newest entries at the top of each section.

Deadlines: fully working **Nov 20** · symposium demo **Wed Nov 25**.

## Where things stand

| Area | State |
|---|---|
| Hardware / firmware | Schematic done (`hardware/kicad/`), bring-up sketches in `firmware/tests/` |
| Signal processing | Logger, protocol parser and fake-session generator in `software/tools/` |
| Dashboard | React app in `software/web/` (overview, rep detail, 3D replay), fed by `software/dashboard/export.py` |
| Testing | Validation plan in `AGENTS.md` section 9; `docs/TESTING.md` not written yet |

## Findings

Things that turned out to be true (or false) and that others should know. Date and name each one.

- _2026-11-18 (vinyx1):_ Set up `AGENTS.md`, this file, and pinned Claude skills in `.claude/skills/`.

## Decisions

Choices between options, with the reason. Date and name each one.

- _2026-11-20 (vinyx1):_ Generate summary now uses Claude Haiku 5.5 (`claude-haiku-5-5`, low effort) instead of Opus 5.5: a few sentences from a handful of numbers doesn't need the bigger model, and it costs a fraction. Haiku has no server-side refusal fallback, so that beta is dropped. The "Written by Claude (model)" line under the summary is removed. Overview motion: the measure bars grow in on load (staggered; the average/previous bar first, the latest on top) and slide when Show average / Show previous switches; the chosen graph rises in, trend lines draw in, the latest-session rep marks pop in, and the by-target bars grow. All of it is off under `prefers-reduced-motion`.
- _2026-11-20 (vinyx1):_ Rep replay: the peak-lean ghost no longer stands there for the whole replay. It appears when the logged trunk reaches its peak, holds for 0.35 s as the figure straightens up, then fades out over 0.6 s (`GHOST_HOLD_S` / `GHOST_FADE_S` in `HoloReplay.tsx`; `SkinnedHumanoid` takes an optional `fade` for its hologram looks). Scrubbing back brings it back.
- _2026-11-19 (vinyx1):_ Added three exercises to the scope, to build **after** the forward reach works: sideways reach (mat turned 90°, buttons), hand to mouth (wrist-angle completion, no button) and forearm rotation (wrist-gyro completion, no button). Forward reach stays the only demo exercise. Reach exercises keep the button press because the IMUs can't confirm hand position. Details in `AGENTS.md` section 1, Exercises.
- _2026-11-19 (vinyx1):_ Landing-page figure is now a rigged CC0 male base mesh (`software/web/public/models/man-base.glb`, BoQsc), posed in code by `SkinnedHumanoid.tsx`, instead of the lofted figure. Picked from five options (lofted, base mesh, Quaternius sculpted at 2k / slimmer with hair / 0.9k) for its clean, faceless mannequin look.
- _2026-11-19 (vinyx1):_ The therapist dashboard (`/dashboard`) adopts the landing page's Rehab Studio look (Literata / Atkinson Hyperlegible, forest and plaster, terracotta only for compensated reps) and opens on **Progress**: a baseline session against a later one (default first vs latest, both pickable) with the change spelled out, then the trend across sessions. Sessions and Rep detail (with the 3D replay) sit one level down. IBM Plex and the blue/orange clean/compensated colours are gone. `sessions.json` is unchanged. Issue #5.
- _2026-11-20 (vinyx1):_ Landing page: the opt-in buzzer sound and its "Buzzer sound off" toggle are removed. (A goniometer version of the trunk-lean readout was tried and reverted; the plaster readout plate stays, reworked: shadow instead of an outline, the state as a pill, and a 0–30° scale under the number with the limit marked and a needle at the live angle.)
- _2026-11-20 (vinyx1):_ Rep replay is now a hologram of the landing page's 3D man (`components/HoloReplay.tsx` drives `landing/SkinnedHumanoid.tsx` with a new `holo` / `ghost` look; replaces the clay `Figure3D.tsx`): trunk tilt from the logged samples, the hand's tremble scaled by the logged wrist rotation speed, a ghost at the peak lean. Hand position and tremble direction are still drawn: the IMUs give angles and speeds, not positions; the caption says so.
- _2026-11-20 (vinyx1):_ Overview: heading is now "Overview" with a line explaining the bars; bars are compact rows (latest solid, previous a dashed outline, average a blue tick) with exact figures on hover. A **Generate summary** button asks Claude (`claude-opus-5-5`, low effort, server-side fallback on) through `POST /api/summary`, a Vite dev/preview middleware in `software/web/server/summary.ts`, so the key stays server-side (`ANTHROPIC_API_KEY` or `ant auth login`). New dev dependency `@anthropic-ai/sdk`. The static build has no endpoint.
- _2026-11-20 (vinyx1):_ Tried an Inbox of generated messages in the Overview's right column; removed. The summary is now a single column, and the latest session's rep graph is back as a graph button.
- _2026-11-20 (vinyx1):_ Overview summary: the figure cards are replaced by bars on the left (latest session solid, previous session as a ghost bar, average of all sessions as a tick, the lean limit dashed); the latest session's reps fill the right column, so its graph button is dropped.
- _2026-11-20 (vinyx1):_ Anti-template pass (taste skill): trend pill → flat tag with the figures ("Leaning less · 64% → 10%"); initials avatars removed; summary and session figures in one hairline-split strip instead of shadowed cards (no card-in-card); icons before sentences, the "Simulated data" chip and card hover-lift removed; result tags use the rep marks instead of check/cross icons; landing readout state has no icon.
- _2026-11-20 (vinyx1):_ Dashboard wall now has a faint low-poly triangle pattern (`components/WallFacets.tsx`), echoing the landing figure, under the warm/cool trend light.
- _2026-11-20 (vinyx1):_ Added lake blue (#3f6a8a) to the palette for a patient leaning less: the "Leaning less" pill, and a cool blue light on the wall, mirroring the warm terracotta light for leaning more. Better changes on the plates stay eucalyptus.
- _2026-11-20 (vinyx1):_ `sessions.json` sessions now carry an optional `patient` id (export.py and `types.ts` changed together). The logger still doesn't record who did a session, so the id comes from the folder: `data/raw` → `recorded`, `data/fake/<id>/` → `<id>`, loose `data/sample` and `data/fake` files → `sim-a`. `fake_history.py` now makes three simulated patients: A improves, B holds steady, C leans more. The dashboard lists them as Simulated patient A, B and C. Landing nav button renamed Dashboard → Demo.
- _2026-11-20 (vinyx1):_ Overview graphs are now a row of buttons, each asking the question its graph answers with a thumbnail drawn from the data, instead of a dropdown. Compare (two chosen sessions side by side) is archived in `software/web/src/archive/Compare.tsx` and no longer routed.
- _2026-11-19 (vinyx1):_ Overview simplified after feedback that the clickable plates were confusing: a summary (verdict, practice, where the leaning is, four static plates) then one Graphs panel with a "Show" dropdown (three trends, latest session rep by rep, compensated reps by target).
- _2026-11-19 (vinyx1):_ Dashboard refresh, "bring the room in": every page opens on the landing page's eucalyptus wall (breadcrumbs, patient header), the Overview's three measures hang there as readout plates that switch the trend chart, tabs sit on the horizon with the active one rising out of the plaster floor, and the wall warms toward terracotta when a patient is leaning more. Picked over "clinic chart paper" and "mat colours as data".
- _2026-11-19 (vinyx1):_ Dashboard Overview is now status at a glance: the verdict line, three measures (latest value and change since the first session) that switch the one trend chart, then the latest session and where the leaning happens per target. The first-vs-later comparison moved to Sessions › Compare. The sidebar shows each patient as a paper folder holding their sessions as files.
- _2026-11-19 (vinyx1):_ Dashboard restructured as a clinic tool: sidebar of patients, a page per patient (Overview, Sessions, Rep replay, Profile & settings), sessions and reps on their own pages, hash routes. Only one patient exists ("Simulated patient") because `sessions.json` has no patient field; "Add patient" is shown but explains it arrives when the logger tags sessions with a patient (a contract change: logger, export, `types.ts`).
- _2026-11-18 (vinyx1):_ Dropped Streamlit entirely. The dashboard is the React app in `software/web/`; `software/dashboard/` keeps only the tested Python data layer (`data.py`, `export.py`).
- _2026-11-18 (vinyx1):_ Problems go in GitHub Issues (label `found-by-agent` when an agent found them); see `AGENTS.md` section 0.

## Blocked / needs someone else

Fallback only, for when you can't open a GitHub issue. Prefer issues (`AGENTS.md` section 0).

- _none yet_
