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

- _2026-11-18 (vinyx1):_ Dropped Streamlit entirely. The dashboard is the React app in `software/web/`; `software/dashboard/` keeps only the tested Python data layer (`data.py`, `export.py`).
- _2026-11-18 (vinyx1):_ Problems go in GitHub Issues (label `found-by-agent` when an agent found them); see `AGENTS.md` section 0.
- _2026-11-18 (Yousuf-Hamoda):_ Level shifter moved to the wrist board; cable chain is mat → wrist → chest. Addresses swapped: wrist 0x69, chest 0x68. Arduino sits on the mat unsoldered. Perfboard layouts in `hardware/kicad/perfboard/BUILD.md`.
- _2026-11-19 (Yousuf-Hamoda):_ Red/green result LEDs removed; the buzzer is the only feedback. Pins re-mapped: START D2, HOME D3, GREEN D4, BLUE D5, RED D6; button LEDs HOME D10, GREEN D11, BLUE D12, RED D13; buzzer D9. Keeps 5 buttons.

## Blocked / needs someone else

Fallback only, for when you can't open a GitHub issue. Prefer issues (`AGENTS.md` section 0).

- _none yet_
