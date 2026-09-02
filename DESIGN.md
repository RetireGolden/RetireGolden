---
name: RetireGolden
description: Privacy-first retirement planner that shows its work — an exact ledger with a golden thread.
colors:
  ledger-gold: "#84620F"
  gold-soft: "#D9A521"
  lamplit-gold: "#E3B341"
  lamplit-gold-soft: "#F0C75E"
  ink: "#161A1F"
  slate-muted: "#5B6470"
  cool-slate-bg: "#F4F6F8"
  surface-white: "#FFFFFF"
  cool-slate-2: "#EEF1F4"
  slate-border: "#DDE2E8"
  night-bg: "#0E1116"
  night-surface: "#161B22"
  night-surface-2: "#1D242D"
  night-ink: "#EEF1F4"
  night-muted: "#97A1AD"
  night-border: "#283038"
  good-green: "#157A3A"
  warn-umber: "#A84E08"
  bad-red: "#B91C1C"
typography:
  headline:
    fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 650
    lineHeight: 1.3
  body:
    fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.07em"
  data:
    fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  card: "10px"
  pill: "999px"
spacing:
  xs: "0.35rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.ledger-gold}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.bad-red}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  card:
    backgroundColor: "{colors.surface-white}"
    rounded: "{rounded.card}"
    padding: "1rem 1.1rem"
  input:
    backgroundColor: "{colors.cool-slate-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.45rem 0.5rem"
  trust-chip:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.slate-muted}"
    rounded: "{rounded.pill}"
    padding: "0.3rem 0.65rem"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.slate-muted}"
    rounded: "{rounded.sm}"
    padding: "0.35rem 0.65rem"
  kpi-label:
    textColor: "{colors.slate-muted}"
    typography: "{typography.label}"
---

# Design System: RetireGolden

## 1. Overview

**Creative North Star: "The Candid Ledger"**

RetireGolden looks like what it is: an exact, honest account book with a golden thread running
through it. The surface is a cool, slate-tinted workspace — quiet grays, generous 1px rules,
tabular numerals — and the single voice of color is gold, used the way a ledger uses red ink:
sparingly, and always meaning something. Trust is built the way the engine builds it, by showing
its work: provenance panels, source citations, uncertainty bands, and a help ladder that educates
in place. Nothing decorates; everything accounts.

Density is planner-grade. Forms, KPI bars, year tables, and charts sit close together because the
user is doing real work — but hierarchy stays legible for 50+ eyes: body text at 1rem minimum,
strong contrast (guarded in CI by `tokenContrast.test.ts`), generous touch targets on coarse
pointers, and familiar affordances everywhere. This system explicitly rejects **retirement
clichés** (no beaches, golf, or condescending oversized "senior" UI) and **AI-SaaS gloss** (no
gradient heroes, no gradient text, no glassmorphism-as-decoration, no dark-default startup
styling). The one blur in the app — the sticky KPI bar — is functional, not fashionable.

**Key Characteristics:**
- Cool slate neutrals; gold as the single accent voice (action, selection, focus)
- One type family (system-ui) doing everything; tabular numerals on all figures
- Borders structure, shadows whisper: 1px rules draw the UI, one soft shadow lifts true surfaces
- Quiet and exact components — precision instruments, not ornaments
- Light and dark themes are peers, both AA-contrast enforced by tests

## 2. Colors

A restrained cool-neutral field where gold is the only voice and verdict colors speak only for
computed outcomes.

### Primary
- **Ledger Gold** (#84620F): the light-theme accent — primary buttons, links, focus rings, and
  active rail items. Deep bronze-gold chosen to hold 5.6:1 against white so white-on-gold buttons
  and gold-on-light text both clear WCAG AA. The header theme segment does **not** use this fill
  when selected — a 14px chip must not read as the page's primary CTA.
- **Lamplit Gold** (#E3B341): the dark-theme accent, brightened to carry the same roles against
  Night surfaces with dark text (#241A03) on filled controls.
- **Gold Soft** (#D9A521 light / #F0C75E dark): the supporting gold tint for soft emphasis.

### Neutral
- **Ink** (#161A1F): all body text and headings in light theme.
- **Slate Muted** (#5B6470): secondary text — labels, hints, metadata. Meaningful content never
  drops below this contrast level.
- **Cool Slate** (#F4F6F8): the light body background; a true cool gray-blue, not cream.
- **Surface White** (#FFFFFF) and **Cool Slate 2** (#EEF1F4): card surface and second-layer panel.
- **Slate Border** (#DDE2E8): the 1px rule that draws the entire interface.
- **Control Border** (#767F8B light / #727D8B dark): the edge of an unchecked check or radio box
  only — the one 1px rule that has to be seen on its own, so it clears 3:1 against both surfaces.
- **Night set** (#0E1116 bg, #161B22 / #1D242D surfaces, #EEF1F4 ink, #97A1AD muted, #283038
  border): the dark theme mirrors every role one-for-one; no role exists in only one theme.

### Tertiary
- **Good Green** (#157A3A / #4ADE80 dark), **Warn Umber** (#A84E08 / #FBBF24 dark), **Bad Red**
  (#B91C1C / #F87171 dark): verdict colors for computed outcomes — plan success, depletion,
  save-state errors. Both light values were deliberately darkened past the 4.5:1 line on
  Cool Slate 2 and are regression-guarded.
- **Chart palette** (chart-1 gold #B8860B through chart-8, eight slots): series colors for
  Recharts. Gold is always series 1. Green (#0C8F66) replaced amber at slot 3 because amber was
  indistinguishable from gold in 1-vs-3 pairings.

### Named Rules
**The Golden Thread Rule.** Gold marks action, current selection, and focus — nothing else. It is
never a background wash, never decoration, and never exceeds roughly 10% of a screen. Its rarity
is what makes it legible.

**The Verdict Rule.** Good/Warn/Bad colors appear only on computed outcomes the engine produced
(success rates, depletion years, errors). Chrome, navigation, and static content never wear them.

**The Contrast Gate Rule.** No token value changes without passing `tokenContrast.test.ts`. If a
new pairing is close to 4.5:1, darken the foreground — never lighten it for elegance.

## 3. Typography

**Body Font:** system-ui (with 'Segoe UI', Roboto, sans-serif fallbacks)

**Character:** One native family carries everything — headings, labels, data, prose. It renders
in each user's OS voice, loads instantly, and disappears into the task. Personality comes from
weight, spacing, and tabular numerals, not from a display face.

### Hierarchy
- **Headline** (700, 1.75rem, 1.2): page titles (`.page h1`); workspace pages step down to
  1.45rem, the home hero flexes `clamp(1.5rem, 4vw, 2rem)`.
- **Title** (600–650, 1.05–1.35rem): section and card headings, plan names.
- **Body** (400, 1rem, 1.5): all prose and controls. Hints and long-measure text cap at 75ch
  (`.field-hint`), ledes at 42em. Never below 16px for meaningful content.
- **Label** (700, 0.72rem, 0.07–0.08em tracking, uppercase): KPI labels and rail group headers
  only — the two places the system allows small caps-style labeling.
- **Data** (400, 0.9–0.95rem, `font-variant-numeric: tabular-nums`): year tables, compare tables,
  KPI values (which scale up to clamp(1.15rem, 2.2vw, 1.5rem) at 700). Monospace
  (ui-monospace/Cascadia/Consolas) appears only in the earnings-paste textarea and error stacks.

### Named Rules
**The Tabular Numbers Rule.** Every dollar figure, year, and percentage that can be compared
vertically sets `tabular-nums`. Money that wiggles as it updates reads as sloppy accounting.

**The One Family Rule.** No second typeface. No display font. Emphasis is weight (650/700) or the
verdict colors — never a new family, never gradient text.

## 4. Elevation

**Borders structure, shadows whisper.** Depth in this system is drawn, not cast: 1px
Slate Border rules define every card, field, table cell, and panel. A single soft two-layer
shadow (`--shadow-card`) lifts true surfaces — plan cards, the sticky KPI bar — just off the
page. The one glass surface in the app is the sticky KPI bar (88% surface + 8px backdrop blur),
and it exists so numbers stay readable while content scrolls beneath; it is a functional
exception, not a pattern to extend.

### Shadow Vocabulary
- **Card whisper** (`box-shadow: 0 1px 2px rgb(15 23 42 / 0.06), 0 2px 8px rgb(15 23 42 / 0.06)`;
  dark: `0 1px 2px rgb(0 0 0 / 0.4), 0 2px 8px rgb(0 0 0 / 0.3)`): the only shadow. Cards,
  KPI bar, modals.

### Named Rules
**The One Shadow Rule.** There is exactly one shadow token. New components either use
`--shadow-card` or stay flat with a border. Nobody invents a third depth.

## 5. Components

Quiet and exact — controls feel like precision instruments. Small radii, 120ms color-only
transitions, restrained hover states that shift a border or tint a background by 6–12%.

### Buttons
- **Shape:** gently rounded (8px), inline-flex, 0.5rem × 1rem padding, 1rem text.
- **Primary:** Ledger Gold fill, white text, transparent border. Hover mixes 12% Ink into the
  gold. One per view — the single most important action.
- **Secondary:** transparent fill, Ink text, Slate Border. Hover deepens the border and tints the
  background 6% Ink.
- **Danger:** secondary shape with Bad Red text; hover tints background 10% red. Ghost variants
  (`.btn-ghost`) drop the border for inline row actions.
- **States:** a disabled *filled* button (`.btn`, primary/secondary/danger) swaps to the flat
  disabled treatment — `--surface-2` fill, `--muted` label, `--border` edge, not-allowed —
  rather than dimming the live fill with opacity, which composited the gold primary to ~2.8:1 in
  dark and failed AA. Ghost buttons are the carve-out: with no fill to composite against they keep
  the faded `opacity: 0.45` treatment. Focus is the 2px gold outline signature, `outline: 2px
  solid var(--accent)`, normally at `outline-offset: 2px`; a few compact controls (the plan-name
  input, ghost buttons) sit it at 1px. No ancestor may clip the ring: a container that needs a clip
  pads for it or rounds its end children instead.

### Chips
- **Trust chips** (pill, 999px): 0.85rem muted text on faintly Ink-tinted surface with border;
  the privacy promises under the home hero.
- **Type chips** (`.type-chip--good/--warn/--muted`): verdict-tinted classification tags.

### Cards / Containers
- **Corner Style:** 10px (`--radius`).
- **Background:** Surface White (Night Surface in dark) with Slate Border and the card whisper
  shadow; internal padding 1rem × 1.1rem.
- **Interaction:** clickable cards (plan cards) hover to a gold border and a 1px lift
  (`translateY(-1px)`, 120ms); non-clickable cards never lift.
- **Callouts** (`.callout--info/--warn`): full 1px borders and background tints — never a colored
  side-stripe.
- **Empty states** (`.empty-state`): a bounded well — 1px dashed border, page radius, and a 3% ink
  tint — so an empty list reads as a deliberate placeholder instead of a gap where content failed
  to render. An element that is itself a card (`.card.empty-state`: the plan-load error card, the
  Insights no-results card) keeps its card chrome; the well is for placeholders inside a card.

### Inputs / Fields
- **Style:** 1px Slate Border, 8px radius, Surface White fill, Ink text, 0.98rem size, one
  shared height (`--control-height`); labels stack above with 0.35rem gap; hints run 0.88rem
  muted below, capped at 75ch.
- **Focus:** the 2px gold outline signature. The plan-name input is borderless until
  hover/focus reveals its field chrome — inline editing without a form feel.
- **Help ladder:** label → one-line hint → a single `HelpTip` (ⓘ) → "Learn more" link. Never
  stack more than one tip on a field.
- **Three levels of feedback under a field, and only one shows at a time.** `.field-error` is what
  the engine refused: danger token, the control `aria-invalid`, the save chip jumps to it.
  `.field-note` is what the field did not keep: muted token, `role="status"`, the plan's own value
  came back. `.field-warning` is a value the engine accepts that is almost certainly not what was
  meant — a 999% rate, a $100M balance, a goal year in the past: the `callout--warn` treatment
  (1px warn-tinted border and ground, never a side-stripe) at field scale, `role="status"`, and the
  control is **never** `aria-invalid`, because the plan holds the value. The thresholds are a
  product decision, recorded in `planner/warnings.ts`, not a bound the engine enforces.
- **Native control chrome is styled once, app-wide.** Checkboxes, radios, selects, range
  sliders, and number inputs take the shared treatment in `index.css`: `appearance: none`
  (number inputs keep `textfield` and only drop the spin buttons), a box on Surface White edged
  with the control-border token (`--control-border`, #767F8B light / #727D8B dark — an unchecked
  box has no text to carry its contrast, and Slate Border alone sat at ~1.3:1; the token clears
  the 3:1 non-text floor on both surfaces in both themes), Ledger Gold fill when checked or as the slider thumb, the
  muted-color chevron on selects (an inline SVG token, mirrored per theme and pinned equal to
  `--muted`), no UA spin buttons, the 2px gold focus ring, the flat disabled tokens, and a
  `forced-colors` fallback that hands the controls back to the UA. Text inputs, selects, and
  affixed inputs share one height (`--control-height`) so a row of mixed fields sits on one
  baseline. A context may still set a control's *size and placement* (a field's full width, the
  allocation row's grid, a toolbar's inline flow); what it never does is restyle the control's
  chrome. If a control looks native, the shared rule is where the fix goes.

### Navigation
- **Top nav** (`.nav-link`): muted text, 6px radius, hover tints 6% Ink; active is 600 weight on
  a 10% Ink tint. No hamburger — the header wraps to two rows on phones, DOM order = visual
  order = tab order. The theme control sits beside the nav with a visible **Theme** group label;
  the selected Light/Dark/System segment uses the same ink-tint treatment as an active nav
  link, not the gold primary-button fill.
- **Workspace rail** (`.rail-link`): the planner's left spine; sticky at 13.5rem wide, collapsing
  to a horizontal chip strip under 880px. Active item is Ledger Gold at 650 on a 12% gold tint.
  Group headers use the Label style. The strip shows the shared scroll cue (page-colored covers
  that move with the chips, ink-tinted edge shadows that stay), snaps to chip starts, renders group
  headers after the first as separators with a left rule, and scrolls itself, never the window, to
  bring the active chip into view after a navigation or a resize (the snap then settles it).
- **Header between 641px and 880px:** the header is top-aligned so the brand stays the top-left
  anchor whatever else moves; the nav sits beside it and may wrap or shrink at the low end of the
  range, and the theme cluster wraps below. Under 640px the phone layout applies.
- **Breadcrumbs:** muted with `/` separators; current page is Ink at 550.

### Forms and figures
- **One column rhythm** (`.form-grid`): tracks are `repeat(auto-fill, minmax(11.5rem, 1fr))` and
  keep filling the row, so a child spanning `1 / -1` reaches both edges. Equal field widths come
  from equal CONTAINERS, not from fixing the track: `.item-row` cancels its own inset with
  `margin-inline: calc(-1rem - 1px)`, so a card's heading, a top-of-form field, and a field inside
  a row all start on one left edge and resolve one track width. Never fix the track to line the
  grids up — the row's remainder then falls outside the grid box and full-row panels stop short.
- **Compound field with actions** (`.field-with-action`): input plus its buttons in one cell.
  Add `.field-with-action--wide` to span two grid columns beside sibling fields; use
  `.field-span-full` only when the row really belongs to it.
- **Wide field** (`.field--wide`, `SelectField wide`): a plain field that needs the same two
  columns, for a select whose option labels outrun one column (Goal Flexibility). A select cannot
  wrap its options, so it takes two columns beside its peers instead of clipping the selected
  label to an ellipsis; it collapses to the full row on phones like the compound field.
- **Read-only values** (`ReadonlyField`): a caption and a value with no visible border or fill
  (a transparent border keeps an input's box rhythm), sitting on the row's baseline. Not a
  `<label>` (nothing to label) and not an `<output>` (a live region).
- **Chart frames** (`.chart-frame`): every one is `role="figure"`, and exactly one name applies:
  an `aria-label` on the frame saying what is plotted and over what, or, where the chart element
  inside already carries its own `aria-label`, that one alone. The figure role keeps the chart's own
  keyboard layer meaningful. A pin enforces this on Monte Carlo, Results, and the bucket lens.
- **Help bubbles** (`HelpTip`): fixed-positioned and clamped to the viewport, treating the KPI
  bar's bottom edge as the top inside a plan while the bar is holding that edge; where it is not
  — a phone, where the bar scrolls away — the clamp falls back to the viewport's own margin.
  Escape and re-click dismiss a pinned bubble.

### The KPI Bar (signature component)
Sticky verdict strip at the top of every planner page: auto-fit grid of KPIs, each an uppercase
Label over a bold tabular value in clamp(1.15rem–1.5rem). Values wear verdict colors —
good/bad/pending — and KPI values that route somewhere underline in their own tone at 55%
opacity, sharpening on hover. Translucent surface with 8px backdrop blur so the ledger stays
readable while the plan scrolls beneath. Two narrow-viewport steps, and they are separate:
under 880px the grid becomes one horizontally scrollable row, still sticky; under 640px that row
also stops sticking, because at phone width the strip is ~100px tall and shows two of the five
KPIs at a time, so holding the top of the screen cost more of the form than the verdict it kept.
Stickiness is the rule wherever the viewport can afford it, not a property of the component.

## 6. Do's and Don'ts

### Do:
- **Do** run every new or changed color pairing through `tokenContrast.test.ts`; body text ≥4.5:1
  in both themes, no exceptions for "elegance."
- **Do** set `tabular-nums` on any column of money, years, or percentages.
- **Do** use the 2px gold outline (`outline-offset: 2px`) as the focus treatment on every
  interactive element — it is the app's focus signature.
- **Do** keep gold under ~10% of any screen: primary button, active nav, focus, selection.
- **Do** mirror every new token into the dark theme (both `[data-theme='dark']` and the
  `prefers-color-scheme` block) and both theme mechanisms.
- **Do** provide `prefers-reduced-motion: reduce` alternatives for every transition, and keep
  motion at 120–150ms color/border shifts (the 1px card lift is the ceiling).
- **Do** grow tap targets to ~44px under `pointer: coarse` without changing desktop glyph sizes.
- **Do** show uncertainty: bands, ranges, and percentiles over single confident numbers.

### Don't:
- **Don't** use retirement clichés — no stock-photo beaches, golf, sailboats, or condescending
  oversized "senior-friendly" UI. The audience is older, not less capable.
- **Don't** add AI-SaaS gloss — no gradient heroes, no gradient text (`background-clip: text` is
  banned), no glassmorphism beyond the one functional KPI-bar blur, no dark-mode-default styling.
- **Don't** add urgency banners, cross-sells, or gamified net-worth widgets. There is nothing to
  sell.
- **Don't** use colored side-stripes (`border-left` > 1px) on callouts or cards; use full borders
  and background tints as `.callout` already does.
- **Don't** introduce a second font family, a second shadow, or an arbitrary z-index (the scale
  tops out at toast/skip-link levels; no 999s).
- **Don't** put verdict colors (green/umber/red) on anything the engine didn't compute.
- **Don't** pair gold with amber in charts — they are indistinguishable; slot 3 is green for that
  reason. Never rely on color alone to distinguish series.
- **Don't** compute or round money in the UI layer; components render what the engine returns.
