/**
 * Plain-language companion to the public engineering docs on calculation
 * validation (DOCS/testing.md and DOCS/external-oracles.md in the repo).
 *
 * Evergreen by design: it describes the checking method, not current-year
 * rules or dollar figures, so it carries no annual review obligation. If the
 * validation approach itself changes, update this article and the public
 * DOCS together.
 */

import type { LearningArticle } from '../learningRegistry'

export const howRetireGoldenChecksItsMathArticle: LearningArticle = {
  slug: 'how-retiregolden-checks-its-math',
  title: 'How RetireGolden checks its math',
  description:
    'The testing discipline behind the numbers: answers worked out from official sources, comparisons against independent tools, and code anyone can inspect.',
  category: 'using-retiregolden',
  tags: ['trust', 'testing', 'methodology', 'open source', 'accuracy'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-07-15',
  reviewCadence: 'stable',
  sourceUrls: [
    'https://github.com/RetireGolden/RetireGolden/blob/main/DOCS/testing.md',
    'https://github.com/RetireGolden/RetireGolden/blob/main/DOCS/external-oracles.md',
    'https://github.com/RetireGolden/RetireGolden/blob/main/DOCS/operations/owl-parity.md',
  ],
  relatedArticles: [
    'what-retiregolden-models',
    'about-retiregolden',
    'how-to-read-a-retirement-projection',
    'understanding-monte-carlo-success-rate',
  ],
  relatedPlannerRoutes: ['/', '/plan/:planId/results'],
  currentYearSensitive: false,
  blocks: [
    {
      type: 'prose',
      md: 'A retirement projection is only useful if the arithmetic behind it is right. This article explains how RetireGolden’s calculations are tested — and how you can check that work yourself, because all of it is public.',
    },
    {
      type: 'heading',
      text: 'Quick takeaways',
    },
    {
      type: 'list',
      items: [
        'Important calculations are tested against answers worked out **outside the app** — IRS worksheets, Social Security formulas, and independent open-source tools.',
        'The app is not allowed to grade its own homework: a correctness test never uses RetireGolden’s own output as the expected answer.',
        'The code, the tests, and the testing rules are **open source**, so anyone — including you — can inspect them.',
      ],
    },
    {
      type: 'heading',
      text: 'The app never grades its own homework',
    },
    {
      type: 'prose',
      md: 'The easiest way for a calculator to “pass” its tests is to compare itself against itself. Run the code, save the output, and check that tomorrow’s output matches. That catches accidental changes, but it can never tell you whether the answer was right in the first place.\n\nSo RetireGolden’s testing rules draw a hard line. A test that claims a calculation is **correct** must get its expected answer from somewhere independent: a worksheet filled out by hand from an official publication, a formula published by the Social Security Administration (SSA), or a separate tool that models the same rule. The independent working is written into the test itself, like showing your work in the margin, so a reviewer can re-check the arithmetic without trusting the app.',
    },
    {
      type: 'prose',
      md: 'For example, the required minimum distribution (RMD) tests don’t ask the app what an RMD should be. They take the divisor tables and worked examples straight from IRS Publication 590-B, compute the expected dollar amounts from those, and then require the app to match.',
    },
    {
      type: 'heading',
      text: 'Four layers of checking',
    },
    {
      type: 'table',
      caption: 'The layers of testing that protect the calculations, and what each one catches.',
      columns: ['Layer', 'What it does', 'Example'],
      rows: [
        [
          'Official worksheets',
          'Small cases worked out by hand from IRS, SSA, and Medicare publications, then frozen into tests',
          'Federal tax brackets, Social Security benefit formulas, RMD divisors, Medicare premium tiers',
        ],
        [
          'Independent tools',
          'The same household is run through unrelated open-source planners and the comparable answers must agree',
          'Claiming-age results checked against Open Social Security; Roth-conversion plans checked against the Owl planner',
        ],
        [
          'Always-true rules',
          'Properties that must hold for any plan, no matter the inputs',
          'Money never appears from nowhere; account balances never go negative; the same plan run twice gives identical results',
        ],
        [
          'Change alarms',
          'Realistic sample plans whose reviewed results are locked in, so unexplained drift fails the test suite',
          'A code change that shifts a sample couple’s projection must be explained and re-reviewed before it ships',
        ],
      ],
    },
    {
      type: 'prose',
      md: 'The comparisons against independent tools follow written rules, too: the tax year and tool version are pinned, differences in what each tool models are documented next to the numbers, and each comparison states how close the answers must be. When two tools disagree, the difference is investigated and classified — a bug to fix, or a documented modeling difference — rather than quietly ignored.',
    },
    {
      type: 'heading',
      text: 'What this does and does not prove',
    },
    {
      type: 'prose',
      md: 'This testing shows that RetireGolden applies its modeled rules the way the official sources describe them. That is a statement about arithmetic, not about the future.\n\nA projection still depends on assumptions — returns, inflation, how long you live — that no amount of testing can pin down. And the model deliberately simplifies some rules to stay at planning precision; [What RetireGolden models and what it does not](/learn/what-retiregolden-models) lists those boundaries.',
    },
    {
      type: 'callout',
      tone: 'note',
      md: 'Well-tested math makes the model trustworthy at what it does. It does not turn a projection into a prediction, and it does not make the app a substitute for professional advice.',
    },
    {
      type: 'heading',
      text: 'See for yourself',
    },
    {
      type: 'prose',
      md: 'RetireGolden is open source, and the testing discipline is published alongside the code — the sources listed below include the testing rules and the full index of which official source backs which test.\n\nYou don’t need to read code to benefit from this. Inside the app, rule-heavy numbers carry their own citations: the [sources and review methodology](/learn/sources) page explains how rules are sourced and kept current, and the Assumptions screen shows where each parameter came from and when it was last reviewed.',
    },
  ],
}
