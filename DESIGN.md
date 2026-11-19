---
name: Re:Motion
description: A wearable that measures how a reach was done, shown as a daylit rehab room you can lean in.
colors:
  plaster: "#eef0ec"
  wall: "#c9d3cb"
  eucalyptus: "#4f6f5f"
  forest: "#1f2d27"
  forest-deep: "#14201b"
  forest-2: "#4a5a52"
  terra: "#b4532f"
  terra-deep: "#9a4526"
  clay: "#cfc6ba"
typography:
  display:
    fontFamily: "Literata Variable, Iowan Old Style, Georgia, serif"
    fontSize: "clamp(3rem, 6.2vw, 6rem)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Literata Variable, Iowan Old Style, Georgia, serif"
    fontSize: "clamp(2rem, 3.6vw, 3.25rem)"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Literata Variable, Iowan Old Style, Georgia, serif"
    fontSize: "1.4rem"
    fontWeight: 500
  body:
    fontFamily: "Atkinson Hyperlegible Next Variable, Avenir Next, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Atkinson Hyperlegible Next Variable, Avenir Next, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 700
  readout:
    fontFamily: "Atkinson Hyperlegible Mono Variable, ui-monospace, monospace"
    fontSize: "clamp(3rem, 5vw, 4.25rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  readout-small:
    fontFamily: "Atkinson Hyperlegible Mono Variable, ui-monospace, monospace"
    fontSize: "0.95rem"
    fontWeight: 400
    fontFeature: "tnum"
rounded:
  focus: "6px"
  sm: "8px"
  nav: "10px"
  md: "12px"
  plate: "14px"
  pill: "999px"
spacing:
  gutter: "clamp(20px, 5vw, 64px)"
  container: "1200px"
  section-top: "clamp(104px, 15vh, 184px)"
  section-bottom: "clamp(88px, 12vh, 152px)"
  split-gap: "clamp(40px, 6vw, 96px)"
  stack: "16px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.plaster}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "16px 26px"
  button-primary-hover:
    backgroundColor: "{colors.forest-deep}"
  nav-button:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.plaster}"
    rounded: "{rounded.nav}"
    padding: "9px 18px"
  nav-button-hover:
    backgroundColor: "{colors.forest-deep}"
  toggle-pill:
    textColor: "{colors.forest}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  toggle-pill-pressed:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.plaster}"
  readout-plate:
    backgroundColor: "{colors.plaster}"
    textColor: "{colors.forest}"
    typography: "{typography.readout}"
    rounded: "{rounded.plate}"
    padding: "16px 20px 14px"
  readout-plate-flagged:
    backgroundColor: "{colors.plaster}"
    textColor: "{colors.terra}"
  placeholder-slot:
    textColor: "{colors.forest-2}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: Re:Motion

## Overview

**Creative North Star: "Rehab Studio"**

Clinical but humane. The page is a daylit rehab room painted in CSS: a eucalyptus wall meets a plaster floor at a level horizon, and a clay-soft figure sits at the four-target mat in front of it, rendered in a transparent React Three Fiber canvas laid over that painted room. The instrument is the hero. A plaster readout plate on the wall shows the live trunk angle and the limit, and the measurement stays the sharpest thing on screen so the room never reads as a wellness app.

Colour is quiet and committed. Wall green and deep forest own whole regions: the sticky stage is wall, the evidence band is drenched in forest, the close sits on wall. Terracotta isn't part of the palette at rest. It is a state. When the trunk holds past the limit (10°, for at least 200 ms, the same rule as the firmware) the room's light warms, a warm glow rises from the figure, and the readout turns terracotta. When the lean ends, all of it goes away.

Type pairs an upright Literata for display with Atkinson Hyperlegible Next for reading, and its Mono for every measured number. Density is low: one idea per viewport in the story, generous section padding after it.

**Key Characteristics:**
- A painted room (wall over plaster floor, horizon at 78%) behind a transparent 3D canvas
- Matte clay figure and ceramic mat, soft daylight, soft floor shadows
- Terracotta appears only as the flagged-lean state, never as decoration
- Every number is set in Atkinson Hyperlegible Mono with tabular figures
- Clean vs compensated is always an icon plus a label, never colour alone
- Forest-drenched and wall-drenched full-width passages rather than cards

## Colors

A low-chroma green room with dark forest ink, and one warm hue held back for the moment something goes wrong.

### Primary
- **Deep Forest** (forest): all copy over the stage and on wall, the primary action fill, chart lines, and the ground of the evidence band. 12.5:1 on plaster and 9.3:1 on wall.
- **Forest Shadow** (forest-deep): hover fill for forest buttons only.

### Secondary
- **Eucalyptus** (eucalyptus): the instrument's outline and its at-rest state text, focus rings, dashed placeholder borders, selection highlight, scrollbar thumb. 4.9:1 on plaster, so it can carry bold small text there. On wall (3.6:1) it is only for strokes and large type.

### Tertiary (state only)
- **Terracotta** (terra): the flagged readout's value and border, the stage glow, the warm tint mixed into the room, and the peak dot on the trace. At 4.3:1 on plaster it is only for large readouts and marks.
- **Terracotta Deep** (terra-deep): any small terracotta text, such as the "Compensated" state line on the plate (5.6:1 on plaster).

### Neutral
- **Plaster** (plaster): the page ground, the floor plane, the readout plate, and reversed text on forest.
- **Eucalyptus Wall** (wall): the room's wall, the close section, hairline dividers on plaster, and body text on the forest band (9.3:1).
- **Muted Ink** (forest-2): secondary copy, captions, spec values, chart axes. Only on plaster (6.4:1). It is never used over the stage.
- **Clay** (clay): the 3D figure's skin, with a darker clay (#bcb1a4) for limbs. Matte (roughness about 0.88).

### Named Rules
**The Terracotta Is a State Rule.** Terracotta appears only while something is past the limit, or as the mark of a rep that was. A surface at rest has no terracotta on it.

**The Stage Ink Rule.** Copy over the stage (wall or the painted room) is always forest. Muted ink appears only on plaster.

**The Small Terracotta Rule.** Terracotta text below large size uses terra-deep. Plain terra is for large readouts, glows and marks.

**The Warm Room Rule.** The flagged state tints the room itself, not just a badge. The wall mixes in 9% terra and the floor 6% (in oklab), through the registered `--room-wall` / `--room-floor` properties over 500ms ease-out. The 3D lights warm with it: sky, ground and key light lerp toward warm values.

## Typography

**Display Font:** Literata Variable, opsz axis (with Iowan Old Style, Georgia)
**Body Font:** Atkinson Hyperlegible Next Variable (with Avenir Next, system-ui)
**Label/Mono Font:** Atkinson Hyperlegible Mono Variable (with ui-monospace)

**Character:** A bookish, upright roman serif for statements, paired with a typeface designed for low-vision legibility. The pairing says "considered" and "readable by everyone" at once, and the mono makes every number look measured.

### Hierarchy
- **Display** (500, clamp(3rem, 6.2vw, 6rem), 1.0, -0.025em, balanced wrap): the hero headline. The close headline is a sibling at clamp(2.6rem, 5.4vw, 5rem), 1.02.
- **Headline** (500, clamp(2rem, 3.6vw, 3.25rem), 1.08): story step and section headings.
- **Title** (500, 1.4rem): study names in the evidence band.
- **Body** (400, 1.125rem, 1.6, max 62ch): section copy. Story-step copy runs larger (1.2rem, 1.55, max 34ch) and the hero lede runs clamp(1.15rem, 1.5vw, 1.35rem) at 40ch. The base text size is 1.0625rem, 1.55.
- **Label** (700, 0.95rem): readout label, spec terms, small headings inside bands.
- **Readout** (Mono 400, clamp(3rem, 5vw, 4.25rem), 1.0, tabular): the live angle. The degree sign is set at 0.6em, raised. Small mono (0.9 to 0.95rem, or 14 to 15px in SVG) carries limits, axis ticks and paper IDs.
- **Wordmark**: "Re:Motion" in Literata 600, 1.6rem, -0.02em. It is the one display use above 500.

### Named Rules
**The Measured Number Rule.** Any number the device measures, or any limit it applies (angles, limits, percentages on axes, chart ticks), is set in Atkinson Hyperlegible Mono with tabular figures.

**The Upright Display Rule.** Literata headlines are always roman, never italic, at weight 500.

## Layout

The story is a sticky stage that is 100svh tall, inside a section that is as many viewports tall as there are steps. The 3D camera moves between shots (hero, chest, mat, wide) as the steps scroll. Text steps sit on the left of the wall, high and clear of the horizon (top padding clamp(150px, 24vh, 240px); the hero uses clamp(120px, 17vh, 170px)), with widths capped at min(36rem, 46vw), or min(44rem, 52vw) for the hero. The readout plate sits top-right on the wall.

After the story come full-width sections on a 1200px container with a clamp(20px, 5vw, 64px) gutter. Section padding is clamp(104px, 15vh, 184px) on top and clamp(88px, 12vh, 152px) below. Two-column passages use a 5fr / 7fr split with a clamp(40px, 6vw, 96px) gap, and collapse to one column below 900px. The studies list is three columns divided by top hairlines, also collapsing below 900px.

At 760px and below the room changes shape: the horizon moves to 50%, the scene owns the top half, and step text sits on the plaster lower half (50svh top padding). The readout plate shrinks to 11rem with a 2.6rem value, secondary nav links hide, and the scroll cue disappears.

The nav is fixed and transparent over the stage. Once the page leaves the stage it turns solid plaster with a 1px wall hairline beneath.

## Elevation & Depth

Depth comes from the room, not from stacked cards. The painted wall and floor plus the 3D scene's soft shadows (soft shadow map, radius 8, cast forward onto an invisible floor) set the space. Only two things in the 2D layer lift: the primary button and the readout plate. Both use forest-tinted, diffuse, two-layer shadows. Everything else is flat and divided by hairlines.

### Shadow Vocabulary
- **Button lift** (`box-shadow: 0 1px 2px rgb(31 45 39 / 0.18), 0 6px 18px -8px rgb(31 45 39 / 0.45)`): the primary action.
- **Plate hang** (`box-shadow: 0 2px 4px rgb(31 45 39 / 0.08), 0 14px 32px -18px rgb(31 45 39 / 0.5)`): the readout plate, mounted on the wall.
- **Lean glow** (`radial-gradient(ellipse 46% 60% at 68% 42%, rgb(180 83 47 / 0.17), transparent 70%)`): a stage overlay that fades in over 360ms while flagged. On mobile it is stronger and higher: 70% 40% at 55% 32%, 0.26 alpha.

### Named Rules
**The Forest-Tinted Shadow Rule.** Shadows are tinted with forest (rgb 31 45 39), never neutral black, and only the instrument and the primary action cast them.

## Shapes

Soft but not bubbly. Corners step from 6px (focus ring), 8px (skip link), 10px (nav button) and 12px (primary button, placeholder slots, schematic frame, empty chart) up to 14px (readout plate). Toggles are full pills. Borders are hairlines: 1px wall on plaster, 1px wall at 35% alpha on forest, and 1px forest at 20% alpha on the wall close. The instrument and placeholders take a heavier 1.5px eucalyptus stroke, which is solid on the plate and dashed where real media is still to come. In 3D, forms are rounded clay capsules and ceramic slabs, matte throughout. Only the mat's button caps carry a slight sheen.

## Components

### Buttons
Solid, calm and plainly clickable.
- **Shape:** gently rounded (12px).
- **Primary:** forest fill, plaster text, Atkinson 700 at 1.125rem, 16px 26px padding, with a trailing arrow icon and a 10px gap. Uses the Button lift shadow.
- **Hover / Focus:** fill darkens to forest-deep (160ms ease-out). Active nudges down 1px. Focus is the global 3px eucalyptus outline at a 3px offset.
- **Nav button:** the same forest fill at 9px 18px, 10px radius, weight 600, no shadow.

### Chips (toggle pill)
- **Style:** a transparent pill with a 1px border of forest at 35% alpha, forest text at 0.9rem, and a speaker icon. Hover gives a faint plaster wash.
- **State:** pressed (`aria-pressed="true"`) fills forest with plaster text. The label always says the state in words ("Buzzer sound on" / "off", or "Sound on" / "off" on mobile).

### Cards / Containers
The system avoids cards. Content sits in full-bleed bands: plaster, forest-drenched (evidence) or wall (close). Lists are divided by top hairlines. The only framed containers are the schematic image (white, 1px wall border, 12px) and the dashed placeholder slots.

### Navigation
- **Style:** the Re:Motion wordmark at top left. On the right, plain text links with no underline at rest and an underline on hover, plus the forest Dashboard button. Transparent over the stage, solid plaster with a wall hairline after it. Padding goes from 20px to 12px vertically as it turns solid (200ms).
- **Mobile:** below 760px only the wordmark and the Dashboard button remain.

### Readout Plate (signature)
The instrument on the wall. A plaster plate with a 1.5px eucalyptus border and 14px radius, using the Plate hang shadow and 16px 20px 14px padding. The top row has the "Trunk lean" label (700) and the "limit 10°" small mono in muted ink. Below it is the large mono value with a raised degree sign. A wall hairline separates the state line at the bottom: an icon plus a word in eucalyptus 700 (CircleCheck for within the limit, Timer while calibrating). When flagged, the border and value turn terra, and the state line turns terra-deep with CircleX and "Compensated". It is a focusable slider (`role` slider, `aria-valuetext` says the angle and the state), and the arrow keys lean the figure.

### Lean Trace (signature)
One reach drawn as an SVG line: a 3.5px forest stroke, a 1.5px muted-ink axis, the limit as a 1.5px forest dash (6 6), mono tick labels, and a single terra dot at the peak. Progress charts use the same grammar: 3px forest line, plaster-filled dots with a forest stroke, wall gridlines, mono muted axes. Simulated data is labelled in the caption in forest 700.

### Placeholder Slot
Where real media hasn't landed yet: 4:3, a 1.5px dashed eucalyptus border, 12px radius, centred muted text saying what will go there.

## Do's and Don'ts

### Do:
- **Do** keep terracotta behind the flagged state: readout value and border in terra, the state line in terra-deep, the room tint at 9% (wall) and 6% (floor) terra, the glow at 0.17 alpha.
- **Do** pair every clean or compensated signal with an icon and a word (CircleCheck "Within the limit", CircleX "Compensated").
- **Do** set every measured number and limit in Atkinson Hyperlegible Mono with tabular figures.
- **Do** keep copy over the stage in forest (#1f2d27). Use muted ink (#4a5a52) only on plaster.
- **Do** tint shadows with forest, and keep them for the primary button and the readout plate.
- **Do** label simulated data in the caption every time it appears.
- **Do** keep reduced motion working: no smooth scroll, no transitions, and the scene still responds to direct input. Without WebGL, the 2D SVG figure follows the same lean rule.

### Don't:
- **Don't** use terracotta as an accent, a link colour or a decoration on a surface at rest.
- **Don't** set eucalyptus or terracotta as small text on the wall (3.6:1 and 3.2:1). On the wall, use them for strokes and large type only.
- **Don't** set Literata headlines in italic or above weight 500. The wordmark is the one exception, at 600.
- **Don't** put muted ink over the painted stage.
- **Don't** wrap sections in shadowed cards. Use full-bleed bands and hairlines.

## Incumbent surface outside this world

The therapist dashboard (`software/web/src/Dashboard.tsx`, routed at `/dashboard` from `App.tsx`, with `components/`) still uses its own earlier system: IBM Plex Sans and Mono, a paper and white-card ground, ink-navy structure (`--color-brand` #13243d), and blue/orange for clean/compensated (`--color-clean` #2a78d6, `--color-comp` #eb6834). Its tokens share the same `@theme` block in `src/index.css`, but they are not part of Rehab Studio and nothing above governs that surface. **Open decision:** whether the dashboard adopts Rehab Studio. Until that is decided, don't mix the two token sets on one surface.
