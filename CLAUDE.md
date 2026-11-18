@AGENTS.md

---

# Claude-specific notes

Everything about the project and how we work is in `AGENTS.md`, imported above, including the session routine (pull, read `docs/STATUS.md` and open issues, claim an issue, update before you stop) and how to report problems as GitHub issues. This file only covers what's specific to Claude.

## Skills

10 skills live in `.claude/skills/`, installed with `npx skills` and pinned in `skills-lock.json` so every teammate's Claude gets the same set. Audited on install: none declare hooks; the only bundled script is a Tailwind docs sync.

**Load the matching skill instead of improvising. That's the point of having them.**

### Dashboard (`software/web/`)

- **Before writing UI:** `baseline-ui` (Tailwind MUST/NEVER rules) and `better-typography`. Every number on screen (lean angles, reach times, percentages) uses `tabular-nums`.
- **Colour:** `better-colors`. Clean vs compensated must never be shown by colour alone; always pair it with a label or icon.
- **Surfaces, radius, shadows:** `better-ui`.
- **Tailwind config or `@theme`:** check `tailwind-4-docs` first. v4 differs sharply from the v3 most training data uses.
- **Motion** (3D replay, transitions): `emil-design-eng` to decide, then `animate` to build. Respect `prefers-reduced-motion`.
- **Performance:** `vercel-react-best-practices`.
- **Before the demo, or before saying a UI task is done:** run `better-interface` (it pulls in `better-ui`, `-typography`, `-colors` and `-accessibility`) and fix the top issues. `better-accessibility` alone for a WCAG pass.

### Not for firmware or Python tools

These skills are for the dashboard. Firmware and `software/tools/` follow the ground rules in `AGENTS.md` (readable for first-years, no `delay()` in the main loop, compile with `arduino-cli`, `python -m pytest`).

### Maintenance

- Restore skills on a fresh clone: `npx skills experimental_install`
- Update: `npx skills update -p`
- Add: `npx skills add owner/repo -s <skill> -a claude-code --copy -y`, then add a line here.
