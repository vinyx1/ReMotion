---
version: 1
slug: "software-web-src-landing-landing-tsx"
primary_target: "software/web/src/landing/Landing.tsx"
related_targets: ["software/web/src/App.tsx"]
---

# Surface brief: landing page (`/` in software/web)

Status: confirmed by the user 2026-11-18. Visual system: **Rehab Studio** (chosen 2026-11-18 on the decision page).

- **Mode:** Persuade. Audience: anyone, symposium judges first; they judge seriousness in about a minute and visual standout is part of the argument.
- **Primary action:** Open the dashboard (first viewport and the close). The dashboard moves to `/dashboard`.
- **Direction (user-pinned, supersedes rounds 1-4 of seed:1628258be9b2c7d2):** "the direction should be a medical device"; award-winning craft; hero "3D device + figure"; motion "scroll-driven story". No metaphor: the device as itself. Clinical is acceptable (user withdrew "too clinical" as an anti-goal).
- **Story:** first viewport 3D seated figure at the four-target mat with sensors + headline + CTA → calibration → clean reach (~3°) → lean past 10° with buzzer as visual pulse (sound opt-in) → rep becomes its trace → dashboard preview (simulated, labelled) → evidence (Gabler 2026 arXiv preprint, Ranganathan 2017, Seo 2024; our validation "to be measured") → hardware (2 IMUs, 100 Hz, ~$150; photo/video slots) → credits (ECE 198 Group 19, CCCARE) → Open the dashboard.
- **Anti-goals:** SaaS template; metaphor/costume worlds; overclaiming (no clinical use, patient testing, unmeasured numbers).
- **States:** reduced motion = still frame per step; no WebGL = 2D SVG figure; mobile = shorter scroll, lighter scene; simulated data always labelled; photo/video slots until real assets land.
- **Constraints:** WCAG 2.2 AA; 3D performance budget; reuse the dashboard's Figure3D; clean vs compensated never colour alone.
- **Open:** headline wording; real buzzer sound; whether the dashboard adopts the landing page's look.

## Selected world: Rehab Studio
- **Thesis:** clinical but humane: a clay-soft 3D figure in a quiet eucalyptus-and-bone room, terracotta reserved for the lean.
- **Palette (direction, not final tokens):** bone #f2f1ec, eucalyptus wall #c9d3cb, eucalyptus #5f7f6e, deep forest #1f2d27 (text, primary action), terracotta #c4623f (lean / compensated only).
- **Materials:** soft clay 3D render, daylight, wall/floor plane as the room.
- **Type:** humanist sans for body and labels, a roman (non-italic) serif for display.
- **Composition to match:** `.impeccable/mocks/decision/w-rehab-studio.html`: headline and lede left on the eucalyptus wall, the figure at the mat right, a lean readout tag on the wall, Open the dashboard in deep forest.
- **Known risk:** could read as a wellness app; the measurement (angle, limit, flagged rep) must stay crisp and prominent.
- **Build path:** code-led (no image generation available).

## Hero (user-chosen 2026-11-18): "Try the lean"
The MAIN landing is one full-viewport interactive scene: a soft clay 3D figure seated at the four-target mat in the eucalyptus room. The visitor drags (or moves the pointer) to lean the figure's trunk; the angle reads out live; past 10° (held ≥ 200 ms, as in the firmware) the room warms to terracotta, the buzzer pulses visually, and the rep is marked. Headline, lede and Open the dashboard sit inside the scene. Scrolling leaves the scene and enters the information story. Keyboard: arrow keys lean the trunk; reduced motion: no autoplay, the scene still responds to direct input; no WebGL: 2D SVG figure with the same interaction.

## Approved type and colour (2026-11-18)
- **Display:** Literata (upright, never italic for headlines).
- **Text:** Atkinson Hyperlegible Next; readouts and numbers in Atkinson Hyperlegible Mono (tabular).
- **Tokens:** plaster ground #eef0ec · eucalyptus wall #c9d3cb · eucalyptus #4f6f5f · forest ink #1f2d27 (text, primary action; 12.5:1 on plaster) · muted ink #4a5a52 · terracotta #b4532f (lean glow, large readouts) · terracotta deep #9a4526 (any small terracotta text).
- **Contrast rules:** small text on the wall uses forest or muted ink only (eucalyptus 3.6:1 and terracotta 3.2:1 on the wall pass only at large sizes); terracotta appears only when something leans past the limit.

## Direction contract
- **THESIS:** The visitor leans the trunk themselves and the device catches it. Refuses the category's split hero (headline left, product photo right, feature cards below): the first viewport is the instrument working, not a picture of it.
- **OWN-WORLD:** A daylit rehab room as the page's ground: eucalyptus wall #c9d3cb owns the first viewport, a plaster floor plane, a clay-soft figure and mat in matte warm-grey ceramic, deep forest ink. Terracotta exists only as a state: when the lean holds past the limit the whole room's light warms, never as decoration. Literata (upright) for display, Atkinson Hyperlegible Next for text, its Mono for every measured number. Committed colour strategy: the wall and forest-drenched passages own whole regions; physical scene: judges at a symposium table under fluorescent light and visitors at daytime desks, so light.
- **STORY:** Understand that rehab scores whether, not how; feel the lean cross the limit; see that rep become data; believe it through the research and the honest prototype status; open the dashboard.
- **FIRST VIEWPORT:** Full-bleed 3D room. Figure seated at the four-target mat, center-right at life-like scale. Top-left: ReMotion wordmark and a Dashboard link. Left on the wall: Literata headline, one-line lede, Open the dashboard (forest, primary) and a quiet "drag the figure to lean" cue. A live readout plate on the wall reads TRUNK LEAN 00.0° / LIMIT 10°; past the limit it turns terracotta-deep with a circled-cross mark and the buzzer pulse. Scroll cue at the foot.
- **FORM:** seed: none (pinned) — "the direction should be a medical device"; "3D device + figure"; "scroll-driven story"; world chosen on the decision page: Rehab Studio; hero chosen: "Try the lean".
- **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
