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
- **Ledger Gold** (#84620F): the light-theme accent — primary buttons, links, focus rings, active
  rail items, the selected theme toggle. Deep bronze-gold chosen to hold 5.6:1 against white so
  white-on-gold buttons and gold-on-light text both clear WCAG AA.
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
- **States:** disabled is opacity 0.45 + not-allowed; focus is always `outline: 2px solid
  var(--accent); outline-offset: 2px` — the app-wide focus signature.

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

### Inputs / Fields
- **Style:** 1px Slate Border, 6px radius, page-background fill, Ink text, 1rem size; labels
  stack above with 0.35rem gap; hints run 0.88rem muted below, capped at 75ch.
- **Focus:** the 2px gold outline signature. The plan-name input is borderless until
  hover/focus reveals its field chrome — inline editing without a form feel.
- **Help ladder:** label → one-line hint → a single `HelpTip` (ⓘ) → "Learn more" link. Never
  stack more than one tip on a field.

### Navigation
- **Top nav** (`.nav-link`): muted text, 6px radius, hover tints 6% Ink; active is 600 weight on
  a 10% Ink tint. No hamburger — the header wraps to two rows on phones, DOM order = visual
  order = tab order.
- **Workspace rail** (`.rail-link`): the planner's left spine; sticky at 13.5rem wide, collapsing
  to a horizontal chip strip under 880px. Active item is Ledger Gold at 650 on a 12% gold tint.
  Group headers use the Label style.
- **Breadcrumbs:** muted with `/` separators; current page is Ink at 550.

### The KPI Bar (signature component)
Sticky verdict strip at the top of every planner page: auto-fit grid of KPIs, each an uppercase
Label over a bold tabular value in clamp(1.15rem–1.5rem). Values wear verdict colors —
good/bad/pending — and KPI values that route somewhere underline in their own tone at 55%
opacity, sharpening on hover. Translucent surface with 8px backdrop blur so the ledger stays
readable while the plan scrolls beneath. On phones it becomes one horizontally scrollable row.

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
