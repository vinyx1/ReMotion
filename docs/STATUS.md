# Status

What we've learned and decided. **Work in progress lives in GitHub Issues**; this file is for findings and decisions. Read it at the start of a session, add to it before you stop. Newest entries at the top of each section.

Deadlines: fully working **Nov 20** · symposium demo **Wed Nov 25**.

## Where things stand

| Area | State |
|---|---|
| Hardware / firmware | Schematic done (`hardware/kicad/`), bring-up sketches in `firmware/tests/` |
| Signal processing | Logger, protocol parser and fake-session generator in `software/tools/` |
| Dashboard | React app in `software/web/` (overview, rep detail, 3D replay); Streamlit fallback in `software/dashboard/app.py` |
| Testing | Validation plan in `AGENTS.md` section 9; `docs/TESTING.md` not written yet |

## Findings

Things that turned out to be true (or false) and that others should know. Date and name each one.

- _2026-11-18 (vinyx1):_ Set up `AGENTS.md`, this file, and pinned Claude skills in `.claude/skills/`.

## Decisions

Choices between options, with the reason. Date and name each one.

- _2026-11-18 (vinyx1):_ The dashboard is the React app in `software/web/`; Streamlit stays as a fallback only.

## Blocked / needs someone else

Requests for changes in another person's area. Tag the owner.

- _none yet_
