# Learning Center

The in-app Learning Center turns RetireGolden from a calculator into a guided
retirement-planning education tool: as the app gets more powerful, it needs a
durable place to explain the concepts behind the numbers. It is content-first and
engine-light — it adds no financial calculations or runtime services, only a
navigation surface, a content authoring/rendering pattern, article standards,
contextual links from the planner, and the body of educational content itself.

**Code:** [packages/planner-ui/src/learn/](../../packages/planner-ui/src/learn/) — pages (`LearningCenterPage`,
`ArticlePage`, `GlossaryPage`, `SourcesPage`), the article registry
([learningRegistry.ts](../../packages/planner-ui/src/learn/learningRegistry.ts)), reusable blocks under
`components/`, and ~100 articles authored as structured TypeScript under `content/`.

This document is the **authoring standard**: the product stance, information
architecture, the article style guide, the topic inventory, and how the planner
links into articles. Read it before writing or revising Learn content. Rule-heavy
content carries `lastReviewed` / `reviewCadence` metadata — re-review cadence is in
[maintenance-schedule.md](../maintenance-schedule.md).

## 1. Goals

Primary goal: help a user with roughly a high-school education understand the
financial-planning concepts that RetireGolden models, without making them read a
wall of text.

Success means:

1. A user can start from a planner screen, open a relevant explanation, and come
   back with a better mental model for the choice they are making.
2. Articles use plain language, concrete examples, charts, worked math,
   scenarios, and visual structure.
3. Rule-heavy topics stay accurate and date-stamped, with sources and annual
   refresh hooks.
4. Content feels cohesive even when written over many AI-assisted batches.
5. The first V9 PRs set up the framework so later content batches are mostly
   writing, review, and visual polish.

## 2. Product stance

### 2.1 Audience

- Assume the reader is smart but not financially fluent.
- Target approximately grade 9-10 reading level for body text.
- Explain every acronym on first use.
- Prefer "what this means in your plan" over textbook definitions.
- Treat uncertainty honestly. The app is educational, not tax, legal, investment,
  insurance, or medical advice.

### 2.2 What the Learning Center is

- A searchable in-app reference library.
- A bridge between planner screens and durable conceptual explanations.
- A source for plain-language methodology notes behind app features.
- A reusable content system that can grow article by article.

### 2.3 What it is not

- Not a blog, news feed, or external CMS.
- Not a personalized recommendation engine.
- Not a replacement for the disclaimer or assumption provenance UI.
- Not a second implementation of calculations already done by the engine.
- Not a dumping ground for long-form docs copied directly from `DOCS/`.

Pushback on the initial plan: "build the content" should be treated as many
small releases, not one final giant release. The right first milestone is the
content shell, registry, link framework, style guide, and empty/stub article
inventory. After that, articles can land in small batches as token budget allows.

## 3. Principles

1. **Offline, bundled content.** Content ships with the static app and works with
   the PWA. No external CMS, runtime API, or remote content dependency.
2. **Use app navigation, not hidden docs.** Add a visible Learning Center entry
   in the primary nav and contextual "Learn more" links inside planner screens.
3. **Stable slugs.** Articles get stable IDs/slugs so app links, report links,
   and future search indexes do not break.
4. **Date-stamped rule content.** Any article with tax, Medicare, Social
   Security, contribution-limit, or ACA numbers must carry `lastReviewed`,
   `sourceUrls`, and a "uses current-year values" flag.
5. **Framework first, content second.** Ship the page structure and article
   standards before writing the full library.
6. **No dynamic plan math inside static articles.** Contextual links can
   originate from plan screens. Articles can explain how to interpret the app's
   numbers, but should not compute user-specific answers.

## 4. Current app context

- `packages/planner-ui/src/App.tsx` has primary navigation for Planner and Disclaimer.
- Planner routes live under `/plan/:planId/*` with `PlanWorkspace` as the shell.
- `PlanWorkspace` has a rail for Household, Social Security, Accounts,
  Insurance, Income, Spending, Strategy, Assumptions, Results, Social Security
  analysis, Monte Carlo, Scenarios, Optimize, Compare, and Report.
- Existing lightweight help patterns:
  - `HelpTip` in `planner/fields.tsx`.
  - `.ss-explainer` details panels in Social Security.
  - Several inline links between planner pages.
- The break-even split: interactive Social Security break-even
  charts live in the planner, while the conceptual narrative belongs in the Learning Center.

The Learning Center reuses the existing React Router shell and planner visual
language, while giving content its own structure under `packages/planner-ui/src/learn/`.

## 5. Scope

### 5.1 In scope

- New Learning Center route(s), nav entry, and responsive layout.
- Article registry with metadata, categories, tags, related articles, related
  planner routes, sources, and review dates.
- Initial home/search/category/article pages with no full content required in
  the first framework PR.
- Content style guide and article template.
- Topic inventory and prioritization.
- Contextual links from planner/results/optimizer screens to article slugs.
- First content batches after the framework lands.
- Tests for routing, article registry integrity, and broken link detection.

### 5.2 Out of scope

- Personalized article text based on the user's plan data.
- External content management.
- User accounts, comments, bookmarks synced across devices, or analytics.
- AI-generated content at runtime.
- New engine calculations.
- Professional advice workflows.

### 5.3 Possible follow-ons

- "Your plan lens" cards that show user-specific examples beside static
  articles.
- Bookmarks or "learning path" progress.
- Lightweight quizzes.
- Printable learning handouts.
- Content translation/localization.

## 6. Information architecture

### 6.1 Routes

Recommended first route set:

| Route | Purpose |
| --- | --- |
| `/learn` | Learning Center home: search, categories, featured paths, recently updated |
| `/learn/:slug` | Article page |
| `/learn/glossary` | Glossary index; can also be generated from article terms |
| `/learn/sources` | Source and review methodology |

Optional later routes:

| Route | Purpose |
| --- | --- |
| `/learn/category/:categoryId` | Category landing page if the home gets dense |
| `/learn/path/:pathId` | Guided learning path, such as "New to retirement planning" |

### 6.2 Primary nav

Add **Learning Center** or **Learn** to the app's primary nav. Recommendation:
use **Learn** in the header for brevity, while the page H1 says **Learning
Center**.

### 6.3 Learning Center home

No long copy. The home should be a fast index:

- Search input.
- Category list with article counts.
- "Start here" path for new users.
- "Using RetireGolden" path for app-specific help.
- Featured high-value topics:
  - Roth conversions.
  - Social Security claiming.
  - Monte Carlo success rate.
  - IRMAA and Medicare premiums.
  - Withdrawal order.
- Recently reviewed/updated articles.

### 6.4 Article page layout

Every article should use a consistent layout:

1. Title.
2. One-sentence promise: what the reader will understand after reading.
3. Quick takeaways, 3 bullets max.
4. Main explanation in short sections.
5. At least one non-wall-of-text element:
   - chart,
   - comparison table,
   - scenario,
   - worked math,
   - formula block,
   - timeline,
   - decision map.
6. "Where this shows up in RetireGolden."
7. Common mistakes or watch-outs.
8. Related articles.
9. Sources and last-reviewed date.

### 6.5 Categories

Initial category set:

| Category | Scope |
| --- | --- |
| Start Here | Basics, vocabulary, how to read a retirement plan |
| Using RetireGolden | Tool-specific workflows and screen explanations |
| Assumptions | The forward-looking defaults behind your plan — inflation, returns, longevity — and the sources for each |
| Example Plans | Worked example households paired with library demos (open in the planner) |
| Accounts and Saving | Account types, contributions, savings order, employer match |
| Taxes | Tax brackets, deductions, MAGI, capital gains, state tax, cliffs |
| Social Security | PIA, claiming, spousal/survivor, earnings test, break-even |
| Healthcare | ACA, Medicare, IRMAA, HSA, LTC costs |
| Withdrawals and Roth | Withdrawal order, Roth conversions, optimizer, RMDs, QCDs |
| Risk and Uncertainty | Monte Carlo, sequence risk, inflation, longevity |
| Insurance and Estate | LTC insurance, permanent life, survivor planning, heirs |
| Glossary | Terms used across the app |

## 7. Authoring model

### 7.1 File structure

Articles are authored as **structured TypeScript** so prose, visuals, and metadata
live together, bundle for offline use, and stay type-safe. The content lives under
`packages/planner-ui/src/learn/`:

```text
packages/planner-ui/src/learn/
  LearningCenterPage.tsx
  ArticlePage.tsx
  GlossaryPage.tsx
  learningRegistry.ts
  learn.css
  content/
    articles/
      roth-conversion-basics.md
      social-security-claiming-age.md
      monte-carlo-success-rate.md
    glossary.ts
  components/
    ArticleShell.tsx
    ArticleFigure.tsx
    FormulaBlock.tsx
    ScenarioCard.tsx
    SourceList.tsx
    LearnLink.tsx
```

The structured-TypeScript decision is settled: it avoids new MDX/Markdown build
tooling and keeps every article type-checked against the registry.

### 7.2 Article metadata

Article metadata is defined in [learningRegistry.ts](../../packages/planner-ui/src/learn/learningRegistry.ts) (the source of truth):

```ts
type LearningArticle = {
  slug: string
  title: string
  description: string
  category: LearningCategoryId
  tags: string[]
  audience: 'beginner' | 'intermediate'
  status: 'stub' | 'draft' | 'ready' | 'needs-review'
  lastReviewed: string
  reviewCadence: 'annual' | 'rule-change' | 'stable'
  sourceUrls: string[]
  relatedArticles: string[]
  relatedPlannerRoutes: string[]
  currentYearSensitive: boolean
}
```

### 7.3 Stub records

The framework PR should include stub records for the full topic inventory. Stubs
should render as "Planned article" cards in the Learning Center, but the app
should not route users to empty pages unless the article is marked `ready`.

## 8. Content style guide

### 8.1 Voice

- Plainspoken, warm, practical.
- Teach the mental model before the rule details.
- Use second person sparingly and concretely: "If you convert too much at 63..."
- Avoid hype and fear.
- Avoid "always" and "never" unless the rule is genuinely absolute.
- Say "may", "often", or "can" when outcomes depend on the user's plan.

### 8.2 Reading level

- Short paragraphs, usually 2-4 sentences.
- One idea per paragraph.
- Prefer familiar words:
  - "money you pay tax on" before "taxable income".
  - "today's dollars" before "real dollars", then define real dollars.
- Define acronyms: required minimum distribution (RMD), modified adjusted gross
  income (MAGI), premium tax credit (PTC).
- Do not assume users know brokerage, IRA, Roth, marginal tax rate, or COLA.

### 8.3 Article anatomy

Use this template for most articles:

```markdown
# Title

One-sentence promise.

## Quick Takeaways

- ...
- ...
- ...

## The Basic Idea

## Why It Matters In RetireGolden

## Worked Example

## Common Mistakes

## Where To Use This In The App

## Related

## Sources
```

Vary the section names when a topic needs it, but keep the same rhythm.

### 8.4 Visual and interaction standards

Each ready article should include at least one of:

- A chart with clear axes and an adjacent text explanation.
- A small table comparing choices.
- A scenario card with named household assumptions.
- A formula block with variables explained.
- A step-by-step timeline.
- A "what changes the answer" list.

Do not rely on decorative images. If an image is used, it must teach something:
account-flow diagram, tax-stack diagram, claiming-age timeline, sequence-risk
chart, healthcare cliff illustration, etc.

All visuals need:

- Descriptive caption.
- Alt text or text equivalent.
- No color-only meaning.
- Mobile-safe layout.
- Source note when based on rules or data.

### 8.4.1 Generated image standard

Generated images are allowed when they make a concept easier to understand, not
as decoration. Good uses include:

- A conceptual visual anchor for an article introduction.
- A metaphor that helps explain a model boundary, risk range, or cash-flow
  pattern.
- A simple scene that makes an abstract planning idea feel concrete.

Do not use generated raster images for:

- Exact charts, axes, labels, tables, current-year values, or rule thresholds.
- App screenshots or UI states that should reflect the real product.
- Any visual where precise text, numbers, or source-backed data carry the
  meaning.

For those, build the visual as native React, SVG, HTML/CSS, or a structured
article block so labels and values stay exact. If a generated image needs labels,
generate the unlabeled image and add labels in code.

House direction:

- Flat editorial financial-education illustration.
- Warm off-white paper background with subtle grain.
- Rounded geometric forms, clean vector-like edges, soft matte texture.
- Layered ribbon/flow shapes for money, time, risk, or choices.
- Simple timelines, stacked containers, buckets, paths, and checkpoints.
- Circular icon badges with simple white pictograms for supporting concepts.
- One main teaching metaphor per image; no more than 3-5 supporting symbols.
- Mostly abstract/system-focused. People may appear only as small simplified
  silhouettes when the article needs human context.

Use this style to make abstract planning concepts feel concrete. Do not force
every image into the same literal timeline composition; the subject can change,
but the visual language should stay consistent.

Base visual prompt:

```text
Use case: scientific-educational
Asset type: RetireGolden Learning Center article figure
Primary request: <one teaching goal for this article>
Scene/backdrop: warm off-white paper field with subtle grain; use a simple abstract planning landscape, flow map, timeline, stack, or boundary map that fits the topic
Subject: <main concept, such as retirement projection, Monte Carlo paths, tax stack>
Style/medium: flat editorial illustration; crisp vector-like raster shapes; rounded geometric forms; soft matte paper texture; modern financial education, warm, practical, trustworthy; not cartoonish, not photorealistic, not corporate stock art
Composition/framing: 16:9 landscape; one clear focal metaphor; large mobile-readable shapes; balanced whitespace; use layered ribbons, containers, circular icon badges, simple paths, or timeline dots when they teach the concept
Lighting/mood: calm, practical, reassuring, analytical without feeling cold
Color palette: warm cream/off-white background, deep navy ink, muted teal, sage green, pale aqua, warm amber, restrained coral risk accent; avoid high-saturation neon or one-note blue/purple palettes
Icon style: simple filled or line pictograms in white or navy, inside circular badges; icons should clarify categories, not become decoration
Text (verbatim): no text, no numbers, no letters; add required labels in React/HTML/SVG instead
Constraints: teaches the article concept without readable text; no logos; no UI screenshots; no decorative-only background; no personal advice language; no source-backed values inside the bitmap; no more than 3-5 supporting symbols
Avoid: photorealistic stock imagery, luxury retirement cliches, dollar-sign clutter, market-ticker imagery, fear-based imagery, dense infographic text, pseudo-readable labels, tiny UI details, watermark
```

### 8.5 Worked math standards

Use simple round numbers first, then point users to their exact app result.

Good pattern:

```text
Example: You need $80,000 for spending. Social Security and pensions cover
$50,000. The gap is $30,000. If taxes on the withdrawal add $6,000, the plan may
need to withdraw about $36,000 before tax to cover the same spending.
```

For formulas:

- Define each variable.
- State whether dollars are nominal or today's dollars.
- Say which details the simple formula ignores.
- Link to the app screen where the precise model appears.

### 8.6 Accuracy and source standards

Use primary sources for rule statements whenever practical:

- IRS for tax brackets, deductions, retirement-account limits, RMD/QCD rules.
- SSA for Social Security benefit rules and actuarial assumptions.
- CMS/Medicare for Medicare and IRMAA.
- HealthCare.gov / CMS for ACA premium tax credit rules.
- State revenue departments or vetted parameter-pack research for state taxes.

Use secondary sources only for framing, examples, or research context, not as the
sole basis for legal/tax rules.

Every rule-heavy article must include:

- `lastReviewed`.
- Source list.
- Whether the article depends on current-year numbers.
- A short note when rules are simplified in RetireGolden.

Avoid hard-coding current-year dollar limits in evergreen prose when possible.
Prefer:

- Pulling current values from parameter packs in UI callouts, or
- Date-stamping the value clearly: "For 2026..." and marking the article
  annual-review.

### 8.7 Disclaimers

Do not paste a full disclaimer into every article. Use a compact article footer:

```text
Educational only. Tax, legal, investment, insurance, and healthcare rules can
change. Use this to understand the model, not as personal advice.
```

The full disclaimer remains the authoritative legal copy.

### 8.8 Linking style

- Link terms to glossary entries only the first time they appear in an article.
- Link to planner screens from the "Where this shows up" section.
- Link to related articles by concept, not by keyword stuffing.
- Avoid circular "see also" clutter. Three to five related links is enough.

## 9. Topic inventory

Priorities:

- **P0:** needed for framework launch or high-value planner links.
- **P1:** important for full V9 content coverage.
- **P2:** valuable but can wait.

### 9.1 Start Here

| Priority | Article |
| --- | --- |
| P0 | How to read a retirement projection |
| P0 | Today's dollars vs future dollars |
| P0 | The three big questions: spending, time, and risk |
| P0 | What RetireGolden models and what it does not |
| P1 | How assumptions change the answer |
| P1 | Planning for couples and survivor years |
| P1 | Why small tax cliffs can matter |

### 9.2 Using RetireGolden

| Priority | Article |
| --- | --- |
| P0 | Planner overview: from household to results |
| P0 | Reading the Results page |
| P0 | Understanding Monte Carlo success rate |
| P0 | Using Scenarios to compare choices |
| P0 | How the Optimize tab thinks about Roth conversions |
| P0 | Understanding your plan's assumptions |
| P1 | Reading the Social Security analysis page |
| P1 | How to use assumptions and provenance |
| P1 | Reports, CSV exports, and sharing results |
| P1 | Privacy: what stays in your browser |
| P1 | Building a retirement spending budget |
| P2 | Troubleshooting surprising results |

### 9.3 Accounts and Saving

| Priority | Article |
| --- | --- |
| P0 | Account types: taxable, traditional, Roth, HSA, cash |
| P0 | Traditional vs Roth contributions |
| P1 | Employer match and contribution order |
| P1 | HSAs as retirement accounts |
| P1 | Taxable brokerage cost basis and capital gains |
| P1 | Pensions and annuities |
| P1 | Real estate, home equity, and debt in a plan |
| P2 | RSUs and ESPP in retirement planning |
| P2 | Fees, expense ratios, and compounding drag |

### 9.4 Taxes

| Priority | Article |
| --- | --- |
| P0 | Marginal vs effective tax rate |
| P0 | Ordinary income vs capital gains |
| P0 | What AGI, MAGI, and taxable income mean |
| P0 | Why Roth conversions can raise other costs |
| P1 | Standard deduction, senior deduction, and itemizing |
| P1 | How Social Security is taxed |
| P1 | NIIT and high-income investment tax |
| P1 | State income taxes in retirement |
| P1 | Tax cliffs and bracket edges |
| P2 | Tax-loss harvesting and gain harvesting |

### 9.5 Social Security

| Priority | Article |
| --- | --- |
| P0 | Social Security claiming age basics |
| P0 | PIA, AIME, and bend points |
| P0 | Break-even: useful lens, incomplete answer |
| P0 | Spousal and survivor benefits |
| P1 | Earnings test before full retirement age |
| P1 | COLA and inflation protection |
| P1 | Divorced-spousal and survivor records |
| P1 | Trust fund haircut scenarios |
| P2 | Mortality-weighted Social Security analysis |

### 9.6 Healthcare

| Priority | Article |
| --- | --- |
| P0 | Medicare, IRMAA, and the two-year lookback |
| P0 | ACA premium tax credits and MAGI |
| P1 | Healthcare before age 65 |
| P1 | Healthcare after age 65 |
| P1 | What retirement healthcare really costs |
| P1 | HSAs and qualified medical expenses |
| P1 | Long-term-care costs and insurance |
| P2 | Medicare Part B vs Part D IRMAA |

### 9.7 Withdrawals and Roth

| Priority | Article |
| --- | --- |
| P0 | Withdrawal order basics |
| P0 | Roth conversion basics |
| P0 | Filling a tax bracket with Roth conversions |
| P0 | How RetireGolden's optimizer values after-tax estate |
| P1 | RMDs: required minimum distributions |
| P1 | QCDs: qualified charitable distributions |
| P1 | Widow's penalty and survivor tax brackets |
| P1 | Rule of 55 and 72(t) basics |
| P1 | Inherited IRA 10-year rule |
| P2 | Paying conversion taxes from taxable vs IRA dollars |

### 9.8 Risk and Uncertainty

| Priority | Article |
| --- | --- |
| P0 | Sequence-of-returns risk |
| P0 | What Monte Carlo does and does not prove |
| P1 | Historical returns vs random return models |
| P1 | Inflation risk |
| P1 | Longevity risk |
| P1 | Why a 95% success rate is not a guarantee |
| P2 | Sensitivity testing: what changes the answer most |

### 9.9 Insurance and Estate

| Priority | Article |
| --- | --- |
| P1 | Insurance in your retirement plan |
| P1 | Long-term-care insurance as risk transfer |
| P1 | Permanent life insurance in a retirement plan |
| P1 | Survivor planning for couples |
| P1 | After-tax estate value |
| P2 | Step-up in basis |
| P2 | Beneficiaries and account titling basics |

### 9.10 Glossary seeds

Initial glossary terms:

- ACA.
- AGI.
- AIME.
- Annuity.
- Basis.
- Bend point.
- COLA.
- Effective tax rate.
- FRA.
- HSA.
- IRMAA.
- LTC.
- MAGI.
- Marginal tax rate.
- Medicare.
- Monte Carlo.
- NIIT.
- PIA.
- PTC.
- QCD.
- Qualified dividend.
- RMD.
- Roth conversion.
- Sequence-of-returns risk.
- Standard deduction.
- Taxable income.

### 9.11 Assumptions

| Priority | Article |
| --- | --- |
| P1 | General inflation |
| P1 | Healthcare cost inflation |
| P1 | Investment returns and volatility |
| P1 | The Social Security COLA |
| P1 | The Social Security trust-fund shortfall |
| P1 | How long to plan for (longevity) |
| P1 | The state tax override |
| P1 | Recent MAGI and the IRMAA lookback |
| P1 | The heir tax rate |

## 10. Referencing learning content from the app

### 10.1 Link levels

Use three levels of help:

1. **Tooltip:** one sentence, stays inline.
2. **Contextual learn link:** "Learn more about IRMAA" opens the article.
3. **Article:** durable explanation with examples, visuals, and sources.

Tooltips should not grow into mini-articles. If a tooltip needs more than two
sentences, move the concept to Learning Center and link to it.

### 10.2 LearnLink component

Add a small component that centralizes link behavior:

```tsx
<LearnLink slug="irmaa-two-year-lookback" label="Learn more about IRMAA" />
```

It should:

- Validate the slug exists in the registry.
- Preserve a return path when the user comes from `/plan/:planId/*`.
- Support an optional anchor within an article.
- Render consistently as a quiet inline link or compact button depending on
  context.

### 10.3 Planner integration map

| App area | Link topics |
| --- | --- |
| Household | planning horizon, survivor years, today's vs future dollars |
| Social Security input | PIA/AIME, claiming age, earnings test, spousal/survivor |
| Social Security analysis | break-even, benefits-only vs whole-plan, trust fund haircut |
| Accounts | account types, Roth vs traditional, taxable basis, HSA |
| Insurance | LTC cost risk, LTC insurance, permanent life |
| Income | pensions, annuities, Social Security as income |
| Spending | retirement phases, healthcare inflation, one-time goals |
| Strategy | withdrawal order, Roth conversions, QCDs |
| Assumptions | inflation, returns, real vs nominal, provenance |
| Results | tax detail, net worth, after-tax estate, depletion age |
| Monte Carlo | success rate, sequence risk, return models, longevity draws |
| Scenarios | stress tests, comparing choices, SS haircut |
| Optimize | optimizer objective, after-tax estate, conversion taxes, tax cliffs |
| Report | methodology links and glossary references |

### 10.4 Contextual recommendations

Contextual links use static mapping, not user-specific rule evaluation:

```ts
const routeLearningLinks = {
  '/plan/:planId/optimize': [
    'how-the-optimizer-thinks',
    'roth-conversion-basics',
    'after-tax-estate',
  ],
}
```

Later enhancement: plan-aware suggestions, such as showing the IRMAA article
when a conversion crosses an IRMAA tier.

### 10.5 Reports

Reports can include compact methodology links or article titles, but should not
depend on the Learning Center to make the report understandable. Printed/PDF
reports should include stable article titles and, if possible, relative app
paths.

### 10.6 Field help standard (PR3)

Every label uses one help ladder, in increasing depth, so help is consistent
across the app:

1. **Label** — always plain text.
2. **Hint** (`hint` prop) — one short line under the input, only for things that
   change what you type ("enter today's dollars"). Not for teaching concepts.
3. **Help + Learn** — a single ⓘ button (`HelpTip`) that reveals a one- to
   two-sentence explanation (`help` prop) and, when a durable article exists, a
   "Learn more" link (`learn` prop) at the foot of the same bubble. There is one
   affordance per label, not a separate tooltip and link.

The ⓘ bubble is an accessible disclosure, not a passive tooltip, because it can
hold an interactive link: hover or keyboard-focus reveals it, clicking pins it
(for touch and to reach the link), and Escape or an outside click closes it.

Wiring rules:

- Field help references a hook from `planner/learnLinks.ts` (`LEARN.*`), never a
  raw slug. The map only contains `ready` articles and is covered by a
  broken-slug test, so a typo or unwritten article fails a test instead of
  shipping a dead link.
- Screen-level "Learn about this screen" clusters use `<LearnAboutScreen>`, which
  derives its links from each article's `relatedPlannerRoutes`. A screen can host
  the cluster safely even before any article relates — it renders nothing until
  one does, then lights up automatically.
- All links go through `<LearnLink>`, which validates the slug, preserves a
  return path (so the article offers "← Back to Optimize"), and renders
  consistently per variant (`inline` / `tip` / `button`).

## 11. Adding and maintaining content

The framework — routes, the article registry, the content components, and the
`LearnLink` planner integration — is in place; new work is mostly writing, review,
and visual polish. Add content in small batches, not one giant release.

### 11.2 Content batch workflow

Recommended batch size: 5-8 articles.

For each batch:

1. Pick one category and one user journey.
2. Gather sources and mark current-year-sensitive topics.
3. Draft articles from the template.
4. Add at least one visual/structured element per article.
5. Add related links and glossary terms.
6. Run content QA checklist.
7. Run app tests and broken-link checks.
8. Review the batch as a coherent learning path, not just individual articles.

### 11.3 Suggested first article batches

Batch A - core orientation:

- How to read a retirement projection.
- Today's dollars vs future dollars.
- What RetireGolden models and what it does not.
- Reading the Results page.
- Understanding Monte Carlo success rate.

Batch B - V8 optimizer support:

- Roth conversion basics.
- Filling a tax bracket with Roth conversions.
- How RetireGolden's optimizer values after-tax estate.
- Marginal vs effective tax rate.
- Why Roth conversions can raise other costs.

Batch C - Social Security support:

- Social Security claiming age basics.
- PIA, AIME, and bend points.
- Break-even: useful lens, incomplete answer.
- Spousal and survivor benefits.
- Earnings test before full retirement age.

Batch D - healthcare/tax cliffs:

- Medicare, IRMAA, and the two-year lookback.
- ACA premium tax credits and MAGI.
- What AGI, MAGI, and taxable income mean.
- Healthcare before age 65.
- Healthcare after age 65.

Batch E - withdrawals:

- Withdrawal order basics.
- RMDs.
- QCDs.
- Widow's penalty and survivor tax brackets.
- Paying conversion taxes from taxable vs IRA dollars.

## 12. Content QA checklist

Before marking an article `ready`:

- Does the article answer one clear question?
- Is the title understandable without jargon?
- Are the first three takeaways useful on their own?
- Is there at least one chart, table, formula, scenario, or worked example?
- Are all acronyms defined?
- Are current-year values date-stamped or pulled from parameter data?
- Are sources present for rule claims?
- Are simplifications called out?
- Are links to app screens and related articles valid?
- Does the article avoid personal advice language?
- Does every visual have alt text or a text equivalent?
- Does it work on mobile without layout overflow?
- Does it have a `lastReviewed` date?

## 13. Testing and validation

Framework tests:

- Route smoke tests for `/learn`, `/learn/:slug`, `/learn/glossary`,
  `/learn/sources`.
- Registry uniqueness: no duplicate slugs.
- Related-link validation: every related slug exists.
- Route-link validation: planner route references are known patterns.
- Ready article validation: required fields populated.
- Current-year-sensitive validation: source URLs and last-reviewed date required.

Manual QA:

- Keyboard navigation through search, category cards, and article links.
- Screen-reader labels for search and article nav.
- Mobile viewport for long titles, tables, and formulas.
- Offline/PWA smoke test after content is cached.

Content validation:

- Source check against primary source URLs.
- Plain-language pass.
- "RetireGolden behavior" pass: confirm article statements match actual engine/UI.
- Disclaimer pass.

## 14. Status

Shipped: the Learning Center route and nav entry, search/category browsing, ~100
articles authored as structured TypeScript with enforced metadata/source/review
standards, the **Example Plans** category (one article per library demo — 24
today, spanning the original households, the FIRE accumulators, and the July
2026 depth-wave A/B pairs), and `LearnLink` contextual links from the planner screens. The
Strategy, Spending, and Insurance screens now have screen-level clusters plus
field-level links for budget, spending profiles, survivor spending, sustainable-spending solver,
objective modes, healthcare, permanent-life, and LTC decisions. Ongoing work
is content depth and keeping rule-heavy articles current — see
[maintenance-schedule.md](../maintenance-schedule.md).
