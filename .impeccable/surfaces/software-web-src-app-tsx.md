---
version: 1
slug: "software-web-src-app-tsx"
primary_target: "software/web/src/App.tsx"
related_targets: ["software/web/src/Dashboard.tsx","software/web/src/components"]
---

# Therapist dashboard (/dashboard)

**Mode:** Operate. Primary target `software/web/src/App.tsx` (dashboard shell) with `src/components/`.

**Audience and job:** a physio or OT reviewing one patient after home sessions, at a desk between appointments. Question: "Is this person improving, and are they still compensating?" Post-session only.

**Content:** `public/sessions.json` (contract unchanged). Today all sessions are simulated and must stay labelled. No patient names in the data: the shell says "Simulated tester".

**Decisions (2026-11-19):** progress first; Rehab Studio tokens adapted for a working screen; 3D replay lives in Rep detail; baseline vs comparison sessions are pickable, default first vs latest; flat hairline panels (no shadows) allowed on this surface only.

**Open:** none.

## Direction contract

THESIS: The first screen answers one question, "is the leaning going down?", by setting a baseline session against the latest one with the change spelled out between them. It refuses the category default: a wall of KPI tiles over a chart grid.

OWN-WORLD: Rehab Studio at working density. Forest top bar over plaster; paper panels with 1px wall hairlines, no shadows; Literata 500 only for the page headline and panel titles; Atkinson Hyperlegible Next for every label and control; Atkinson Mono with tabular figures for every number; eucalyptus for focus, selection and improvement words; terracotta only on compensated marks (diamonds), never at rest.

STORY: The therapist reads a data-written headline ("Compensation fell from 64% to 10% of reps"), checks the two sessions side by side, scans the trend for a bad week, then opens a session or a rep to see why it was flagged.

FIRST VIEWPORT: Top bar (wordmark, Simulated tester, simulated chip, session range); tabs Progress / Sessions / Rep detail. Headline sentence and legend. Two equal session columns, each with three readouts and a rep strip against the 10° limit, a narrow change column between them with signed deltas in words. The across-sessions trend band starts above the fold.

FORM: Structure "First session vs latest", list position 4 of 7, seed: 96d9ee35b64b646e.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
