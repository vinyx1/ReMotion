---
name: ReMotion
description: A wearable that measures how a reach was done, shown as a daylit rehab room you can lean in.
colors:
  plaster: "#eef0ec"
  panel: "#f7f8f5"
  wash: "#e2e8e1"
  grid: "#dbe1da"
  wall: "#c9d3cb"
  folder: "#a9b9ad"
  folder-shut: "#34443c"
  eucalyptus: "#4f6f5f"
  forest: "#1f2d27"
  forest-deep: "#14201b"
  forest-2: "#4a5a52"
  lake: "#3f6a8a"
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
  dashboard-headline:
    fontFamily: "Literata Variable, Iowan Old Style, Georgia, serif"
    fontSize: "2rem"
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: "-0.015em"
  panel-title:
    fontFamily: "Literata Variable, Iowan Old Style, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.25
  control:
    fontFamily: "Atkinson Hyperlegible Next Variable, Avenir Next, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
  dashboard-label:
    fontFamily: "Atkinson Hyperlegible Next Variable, Avenir Next, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
  readout-dashboard:
    fontFamily: "Atkinson Hyperlegible Mono Variable, ui-monospace, monospace"
    fontSize: "2.5rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  readout-md:
    fontFamily: "Atkinson Hyperlegible Mono Variable, ui-monospace, monospace"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "tnum"
  axis-tick:
    fontFamily: "Atkinson Hyperlegible Mono Variable, ui-monospace, monospace"
    fontSize: "13px"
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
  dashboard-container: "1360px"
  dashboard-gutter: "32px"
  panel-pad: "24px"
  change-column: "8.5rem"
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
  dashboard-top-bar:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.plaster}"
    padding: "12px 32px"
  simulated-chip:
    textColor: "{colors.plaster}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  dashboard-tab:
    textColor: "{colors.forest-2}"
    padding: "14px 0 12px"
  dashboard-tab-active:
    textColor: "{colors.forest}"
  dashboard-panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.forest}"
    rounded: "{rounded.md}"
    padding: "24px"
  dashboard-panel-title:
    textColor: "{colors.forest}"
    typography: "{typography.panel-title}"
  dashboard-readout:
    textColor: "{colors.forest}"
    typography: "{typography.readout-dashboard}"
  dashboard-readout-compensated:
    textColor: "{colors.terra}"
  result-tag-clean:
    textColor: "{colors.eucalyptus}"
    typography: "{typography.dashboard-label}"
  result-tag-compensated:
    textColor: "{colors.terra-deep}"
    typography: "{typography.dashboard-label}"
  dashboard-button:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.forest}"
    typography: "{typography.control}"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 16px"
  dashboard-button-hover:
    backgroundColor: "{colors.wash}"
  dashboard-button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.plaster}"
    typography: "{typography.control}"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 16px"
  dashboard-button-primary-hover:
    backgroundColor: "{colors.forest-deep}"
  select-trigger:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.forest}"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 12px"
  select-item-highlighted:
    backgroundColor: "{colors.wash}"
  segmented:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.sm}"
    padding: "2px"
  segmented-option:
    textColor: "{colors.forest-2}"
    rounded: "{rounded.focus}"
    height: "36px"
    padding: "0 12px"
  segmented-option-hover:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.forest}"
  segmented-option-pressed:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.plaster}"
  table-row-selected:
    backgroundColor: "{colors.wash}"
  change-better:
    textColor: "{colors.eucalyptus}"
  change-worse:
    textColor: "{colors.terra-deep}"
  change-same:
    textColor: "{colors.forest-2}"
---

# Design System: ReMotion

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
- **Wordmark**: "ReMotion" in Literata 600, 1.6rem, -0.02em. It is the one display use above 500.

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

### Cards / Containers
The system avoids cards. Content sits in full-bleed bands: plaster, forest-drenched (evidence) or wall (close). Lists are divided by top hairlines. The only framed containers are the schematic image (white, 1px wall border, 12px) and the dashed placeholder slots.

### Navigation
- **Style:** the ReMotion wordmark at top left. On the right, plain text links with no underline at rest and an underline on hover, plus the forest Dashboard button. Transparent over the stage, solid plaster with a wall hairline after it. Padding goes from 20px to 12px vertically as it turns solid (200ms).
- **Mobile:** below 760px only the wordmark and the Dashboard button remain.

### Readout Plate (signature)
The instrument on the wall. A plaster plate 17rem wide (13.5rem on phones) with an 18px radius, lifted by shadow rather than outlined: a 1px forest ring at 10%, a 1px/2px contact shadow and a 16px/36px forest drop at 45%, over a 1px transparent border so forced-colors mode keeps an edge. The top row has "Trunk lean" (700, forest) on the left and the state as a pill on the right: CircleCheck (Timer while calibrating) and the word, eucalyptus on a 10% eucalyptus wash. Below it the large Mono value (up to 4.75rem, -0.03em, left-aligned) with a raised degree sign. Under the number a scale from 0 to 30°: an 8px track in 16% eucalyptus, the zone past the limit hatched in forest, a 2px forest limit mark, a fill up to a 6px needle at the live angle (moved every frame through the `--lean` custom property, no React render), and Mono labels "0°", "limit 10°" ("10°" on phones) and "30°". When flagged, the value, the fill and the needle turn terra, the hatching warms, and the pill turns terra-deep on a terra wash with CircleX and "Compensated". Colour and background transitions run 150ms ease-out on named properties only, off under reduced motion. It is a focusable slider (`role` slider, `aria-valuetext` says the angle and the state; 3px forest focus ring at 4px), and the arrow keys lean the figure. There is no sound toggle.

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


## Dashboard surface: Rehab Studio at working density

The therapist dashboard (`software/web/src/App.tsx`, routed at `/dashboard` through `Dashboard.tsx`, with `components/` and `lib/stats.ts`) is a Rehab Studio surface. It shares the `@theme` block in `src/index.css` with the landing page and uses the same three faces, the same forest and eucalyptus, and the same terracotta-as-state. What changes is density: no stage, no painted room, no one-idea-per-viewport. A forest top bar sits over a plaster ground, and the working content lives in flat paper panels. Everything above governs the dashboard except where this section names a scoped exception.

### Colors at working density
- **Panel** (panel): the dashboard's paper, a step lighter than plaster. Panels, the tab bar, select triggers and menus, segmented controls, plain buttons, tooltips. Forest is 13.5:1 on it, muted ink 6.9:1, eucalyptus 5.2:1, terra-deep 6.1:1.
- **Wash** (wash): the selected row in the sessions table, the highlighted item in a select menu, hover on plain buttons and unpressed segments, the shaded reach band behind a trace, and inline code. Muted ink stays 5.9:1 on it.
- **Grid** (grid): chart gridlines, the empty track of the compensated-share bar, and the non-limit rules in the rep strip. Axis baselines use wall.
- **Folder** (folder, #a9b9ad): the back and tab of the open patient folder in the sidebar, a step darker than wash so the folder's front and the sheets read against it. Forest text on it.
- Muted ink (forest-2) is allowed on panel and wash as well as plaster.

**The Measured Terracotta Rule.** On the dashboard, terracotta appears in exactly these places: the filled diamond of a compensated rep, the compensated-share bar in the sessions table (it encodes that share, so it is a mark; decision 2026-11-19), compensated values (terra for large readouts such as a compensated rep's peak lean or the replay's live angle past the limit; terra-deep for small text such as a compensated row's peak lean), the replay playhead dot while past the limit, and the 3D replay trunk while past the limit. Nothing at rest is terracotta.

**The Direction In Words Rule.** A change between sessions is a signed Mono delta, a direction icon (ArrowDown, ArrowUp, or Minus when about the same) and words ("fewer compensated", "less lean", "slower"). Better is eucalyptus, worse is terra-deep, about the same is forest-2. Colour never carries the direction alone.

### Type at working density
Literata 500 appears only in the page headline and panel titles. The Progress headline is written from the data ("Compensation fell from 64% to 10% of reps", "Compensation held at about 12% of reps") at 2rem, 1.12, -0.015em; the Rep detail headline ("Rep 5 of 10") matches it, and the chosen session's name on the Sessions view runs a step down at 1.75rem. Panel titles are 1.25rem, with an Atkinson caption in muted ink at 15px beneath. The wordmark in the top bar is Literata 600 at 1.45rem.

Atkinson Hyperlegible Next sets every label and control: tab labels (15px, 700), readout labels and table headers (14px, 700, muted ink), session pickers (17px, 700 in the Progress columns), select triggers, buttons and segments (15px or 14px, 600), notes under readouts (14px, muted ink) and sentences under the headline (17px, muted ink).

Atkinson Mono with tabular figures sets every number: readout values (2.5rem at sm and xl, 2rem at lg, 1.45rem on phones; 1.5rem for the readout strips), change deltas (1.25rem), table cells, axis ticks (12 to 13px, muted ink, with the limit tick in forest), the top bar's session range, and tooltip values.

### Layout at working density
The frame is a clinic tool. A forest sidebar (272px, from lg) holds the wordmark, "All patients", and the **patient files** under "Patient files": each patient is a paper folder. The open one (the patient you are viewing) has a folder-coloured back and tab with the name, two sheets sticking up behind its wash-coloured front, and the patient's sessions inside as files, newest first (day and time in Mono, a terra diamond or open circle and the compensated count, the open session raised on panel). Other patients show as closed folders in solid `folder-shut` (#34443c, #3e5047 on hover): a short 64px tab flush with the face's square top-left corner, and on the face a Folder icon with the name (15px 700), then the exercise and the last session's date in 13px plaster at 75%. The foot carries the data chip and the sensor line. Below lg a compact forest bar replaces it (wordmark, Patients link, data chip). **The Wall.** Every dashboard page opens on a full-bleed band of the landing page's eucalyptus wall (`.dash-wall` in `index.css`): wall at the top, lit from the upper left (a 22% white radial), shading to wall mixed 30% with eucalyptus toward the bottom, where it meets the plaster floor at a horizon (a 1px forest hairline at 22%). Its surface is a faint low-poly field (`WallFacets.tsx`, echoing the landing's low-poly figure): a seeded, jittered 18×6 grid split into triangles, each tinted white (up to 20%) toward the lit upper left or forest (up to 9%) toward the lower right, with 0.8px white seams at 16%. It sits under the warm or cool light and the content, and is the same on every load. Breadcrumbs (Patients › patient › section › item) and the page or patient header hang on it; the working content sits on the floor below. Copy on the wall is forest only (the Stage Ink Rule); anything coloured sits on a panel or plaster pill. **The Warm Wall Rule:** when a patient's trend is worsening (`trendOf` = worsening), the wall warms as the landing room does on a lean: mostly as a light, a terracotta radial (20% at the upper right, fading out by 70%) that fades in over 500ms, over a base mixed 9% with terra (both instant with reduced motion). It is the one place terracotta tints a surface on the dashboard. **The Cool Wall Rule:** when a patient's trend is improving, the wall takes the same light in blue instead: a sky-blue radial (rgb 104 158 204 at 42%, fading out by 72%) over a base mixed 12% with lake. Steady or too-early patients get neither. Content runs in a 1240px container with a 20px gutter (32px from sm).

Every patient view opens with the **patient header**, hung on the wall: the name in Literata (no avatar) (1.75rem, 2.5rem from sm), a flat trend tag: the trend in words and the figures behind it ("Leaning less · 64% → 10%"), 6px radius, no outline and no icon, on a 14% tint of its hue (lake blue for less, terra for more, plaster for about the same), a fact row in forest (exercise, lean limit, sessions, last session), on the Overview the measure plates, then the tabs **Overview / Sessions / Rep replay / Profile & settings** sitting on the horizon. Sessions and reps open on their own pages with breadcrumbs back; where you are lives in the URL hash (`#/patients`, `#/p/<id>`, `…/sessions/<id>`, `…/reps/<n>`, `…/profile`).

- **Patients:** a page title, an "Add patient" button (a popover explains real patients arrive with the logger update that records who did each session), and a table: patient, exercise, trend pill, compensated in the latest session, sessions, last session.
- **Overview:** two parts on the floor; the wall holds only the patient header. **Summary**, on the floor with no card: on the left an "Overview" heading in Literata, a key (a solid forest swatch "Latest session" with its date; a pale lake swatch naming what the light bar shows) beside a segmented toggle "Show average / Show previous", then a compact row per measure (compensated reps, clean-rep lean, reach time): label, two overlapping square-ended bars (no rounded corners) on a 0-based scale over a 1px wall baseline: a light bar behind (taller, lake at 15%; the average of all sessions, or the previous session, per the toggle) and the latest session on top (solid forest, terra when worse than the previous session; thinner); the lean limit as a dashed forest line; the latest value in Mono on the right. Hovering a bar shows a small forest tooltip at its end with that bar's figure ("Average of all 6 sessions: 35%" or "Previous session, Nov 16: 21%"); focusing the row lists both; a line under the rows says to hover. On the right, a forest **Generate summary** button; the summary Claude writes appears beneath it on a panel, with a line saying it was written by Claude from the figures on the page. **Graphs:** a row of five graph buttons (two across on phones, three from sm, five from lg), each asking the question its graph answers ("Is the leaning going down?", "How far do clean reps lean?", "Are reaches getting quicker?", "How did the last session go?", "Where does the leaning happen?") with what it plots beneath in muted ink, under a 120×40 thumbnail drawn from the same data (the trend line with a eucalyptus wash and the lean limit dashed; the latest session's rep marks; three terra target bars). Pressed is a 1.5px forest edge on panel; the others are plaster with a wall edge and lift 2px on hover. Below, one panel titled with the chosen question, a sentence on how to read it, then the graph: the trend chart (first and latest tagged, eucalyptus wash 55% to 6%, 300px), the latest session's rep strip (220px, legend, open link), or compensated reps by target (terra bars).
- **Compare** (archived 2026-11-20): two chosen sessions side by side with the change between them. Kept in `src/archive/Compare.tsx`, not routed.
- **Sessions:** the session table; a session opens on its own page. Its five numbers hang on the wall as static plates (reps, compensated, clean-rep lean, highest lean in terra when past the limit, reach time; three across on phones, five from sm), and the floor carries previous / next buttons beside its name, the legend, two charts side by side from lg (peak lean per target, reach time across the session), and the rep table.
- **Rep detail:** pickers (session select, previous / rep select / next), the headline with its result tag, a four-readout strip between hairlines, then the 3D replay panel (5fr) beside the trunk and wrist traces (7fr) from xl, stacked below.
- Simulated data is always labelled twice: the chip in the top bar ("Simulated data", FlaskConical; "Recorded sessions", Radio, for real logs) and a footer note above a wall hairline.

### Depth and shape at working density
**The Flat Panel Exception.** On the dashboard only, content sits in panels: panel fill, a 1px wall hairline, 12px radius, no shadow, 20px padding (24px from sm on the Progress panels), or none for tables, which clip to the radius. This is the one place the "avoid cards" stance yields, and it yields to flat paper, not lifted cards. Tables inside panels divide rows with wall hairlines at 70% alpha.

Floating layers lift, and only they do: the select menu uses the Plate hang shadow, and chart tooltips use a tighter forest-tinted pair (`0 2px 4px rgb(31 45 39 / 0.08), 0 10px 24px -14px rgb(31 45 39 / 0.5)`). Controls are 8px (buttons, select triggers, segmented track, menus, tooltips) with 6px inner segments and menu items; chips and the replay's phase label are pills.

### Chart grammar
**The One Mark Rule.** A rep is drawn the same way in every chart, strip and table cell by one shared mark: a clean rep is an open circle (panel fill, 1.8px forest stroke), a compensated rep a filled terracotta diamond (with a thin panel edge). Shape tells clean from compensated before colour does.

**The One Limit Rule.** The limit is a 1.5px forest line dashed 6/5 in every plot: the rep strip, the per-target scatter, the trend's lean view and the trunk trace. The legend's swatch uses the same dash.

Gridlines are grid and horizontal only. The x baseline is wall; there are no tick lines. Data lines are forest (3px in the trend, 2.5px in traces); the reach-time line is wall at 2.5px so the marks on it carry the reading. In the trend, the two marked sessions are filled forest dots at 6.5px labelled "First" and "Latest" (Overview) or "Baseline" and "Compared" in 13px Atkinson 700 with a panel halo; other sessions are open dots. Trace playheads are a 1.2px muted-ink rule with a dot that turns terra past the limit. Every point a therapist can open is a real button with a word label and a eucalyptus ring on hover and focus.

### Components
- **Sidebar:** forest, plaster text; nav items are 15px Atkinson 600 at 75% plaster, active on a 12% plaster wash; focus is a 3px plaster outline. The wordmark links home.
- **Simulated chip:** a pill with a 1px plaster border at 45% alpha, 14px Atkinson 600, an icon and words.
- **Tabs:** Overview / Sessions / Rep replay / Profile & settings, links on the horizon at the foot of the wall, 15px Atkinson 700 in forest, 16px padding, 10px top corners. The active tab is plaster and runs into the floor (it covers the horizon hairline), so the page reads as its continuation; others take a 45% plaster wash on hover. Focus is a 3px forest outline inset. On phones the tabs use short labels (Overview, Sessions, Replay, Profile) so all four fit. The tab is mirrored in the URL hash.
- **Readout:** a definition-list trio, label (14px 700 muted ink), Mono value, optional note (14px Atkinson, muted ink). A compensated value takes terra.
- **Result tag:** the rep's own mark (open circle or terracotta diamond) then "Clean" in forest or "Compensated" in terra-deep, 14px Atkinson 700. No generic check or cross icons.
- **Segmented control:** a panel track with a wall hairline and 2px inset; segments 36px tall, 14px 600. Pressed is forest with plaster text; unpressed is muted ink with a wash hover. On phones the control spans the full width as an even grid and shows short labels ("Lean" for "Clean-rep lean").
- **Change column:** three stacked changes, each icon over Mono delta over words, toned by the Direction In Words Rule.
- **Rep strip:** one session's reps in order at their peak lean, laid out in HTML with percentage positions (no measuring) at 128px tall, with Mono ticks at 0, the limit and the top. Each mark is a 28px round button that opens the rep, with a 15% eucalyptus wash on hover.
- **Chart box:** every Recharts chart sits in a fixed-height box (256px for the trend, 288px for the session charts) that measures its own width and draws only once it has one, instead of a responsive container that can measure zero.
- **Buttons and selects:** 40px tall, 8px radius, 15px Atkinson 600. Plain buttons are panel with a wall hairline and a wash hover; the primary (Play / Pause) is forest with a forest-deep hover. Both nudge down 1px when pressed and fade to 45% when disabled. Select triggers are panel with a wall hairline that darkens toward muted ink on hover; the open menu is panel with wash highlight and a eucalyptus check. Focus everywhere is a 3px eucalyptus outline at a 2px offset.
- **3D replay (hologram):** `HoloReplay.tsx`. The landing page's rigged low-poly man (`SkinnedHumanoid`, look `holo`) rendered as a hologram: a light-lake (#9cc9e6) see-through fill at 20% with the same skinned mesh again as wireframe at 55%, the trunk's vertices warming to light terracotta (#ee8a5f) past the limit; the chest and wrist sensors stay solid. A second copy (look `ghost`, 5% / 12%, no sensors) holds the rep's peak lean. On a forest-deep stage with a fading grid floor; the chair, table and mat as faint eucalyptus wireframe, the cued target lit. The trunk bends by the logged angle sample by sample; the reaching arm solves (two-bone IK) to the drawn hand path, timed by the button presses, plus a tremble whose size is the measured wrist rotation speed (direction drawn, deterministic), with a 0.6 s fading trail. Overlays in plaster: the live trunk angle (terracotta past the limit) and the live wrist speed in lake; the phase top right. Drag turns the view around the figure (drei `OrbitControls`: rotation only, kept above the floor, damped; no zoom, so the wheel still scrolls the page, and no pan), with a grab cursor and a small "Drag to turn the view" note bottom left. The table and mat sit 3 cm below `lib/figure`'s table height so the fingertips meet the top at the press. A caption under the transport says what is measured and what is drawn.


### Anti-template rules (2026-11-20)
Taken from a pass with the taste skill's app-screen rules, to keep the dashboard from reading as a generated template:
- **Figures sit in one strip, not a card each.** Summary figures (Overview) and a session's figures (on the wall) share one container split by 1px hairlines (`FigureStrip` in `ui.tsx`): label in muted ink over a Mono value with its unit raised, a short note beneath. No shadow, no card per figure, never a card inside a card.
- **No initials avatars.** Patients are named, not badged.
- **No icon in front of a sentence**, no icon-and-outline status pills. Status is words (and figures) on a flat tint.
- **No hover lift** on cards or buttons; hover changes tone only.
- **Plain words for data provenance**: "Simulated data" as text in the sidebar foot, not a chip.
