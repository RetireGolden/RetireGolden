/**
 * The single finished article shipped with the V9 framework (PR1).
 *
 * It is intentionally evergreen — no tax brackets, dollar limits, or other
 * current-year figures — so it can exercise the article renderer end to end
 * without carrying review-cadence or source obligations.
 */

import type { LearningArticle } from '../learningRegistry'

export const aboutRetireGoldenArticle: LearningArticle = {
  slug: 'about-retiregolden',
  title: 'About RetireGolden',
  description: 'What RetireGolden is, how it keeps your data private, and how to start your first plan.',
  category: 'using-retiregolden',
  tags: ['overview', 'getting started', 'privacy', 'about'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-19',
  reviewCadence: 'stable',
  sourceUrls: [],
  relatedArticles: ['planner-overview', 'what-retiregolden-models', 'privacy-what-stays-in-your-browser'],
  relatedPlannerRoutes: ['/'],
  currentYearSensitive: false,
  blocks: [
    {
      type: 'prose',
      md: 'RetireGolden helps you see how the choices you make today could shape your retirement — and it does it without sending a single number to anyone.',
    },
    {
      type: 'heading',
      text: 'Quick takeaways',
    },
    {
      type: 'list',
      items: [
        'RetireGolden is an **educational planner**, not personalized financial, tax, or legal advice.',
        'Everything you enter stays **in your browser** — there are no accounts and no server.',
        'You build a plan section by section, then explore results, risk, and trade-offs.',
      ],
    },
    {
      type: 'heading',
      text: 'What RetireGolden is',
    },
    {
      type: 'prose',
      md: "RetireGolden is a retirement-planning calculator that models how your savings, income, spending, and taxes might play out over the years ahead. You give it the pieces of your financial picture, and it projects a possible future so you can ask “what if?” questions.\n\nIt is built to **teach**, not to decide for you. The goal is a clearer mental model of how the parts of a plan fit together, so the choices you face feel less like guesswork.",
    },
    {
      type: 'heading',
      text: 'Everything stays in your browser',
    },
    {
      type: 'prose',
      md: 'RetireGolden has no accounts and no server-side storage. Every plan you create lives only on this device, in your browser.\n\nThat privacy comes with a trade-off: if you clear your browser data or switch devices, your plans are gone. Use the export option on the planner home to keep a backup you control.',
    },
    {
      type: 'callout',
      tone: 'note',
      md: 'Because nothing is uploaded, RetireGolden cannot recover a lost plan for you. A quick plan backup is your safety net.',
    },
    {
      type: 'heading',
      text: 'What it can and cannot do',
    },
    {
      type: 'prose',
      md: 'RetireGolden models common retirement realities: account types, Social Security, taxes at planning precision, withdrawals, Roth conversions, healthcare costs, and the role of luck through Monte Carlo simulation.\n\nIt does not file your taxes, give personal advice, or predict the future. Real markets, laws, and lives are messier than any model. Treat the numbers as a way to compare choices, not as promises.',
    },
    {
      type: 'table',
      caption: 'What RetireGolden is built for — and what it is not.',
      columns: ['Area', 'What it does', 'What it does not do'],
      rows: [
        ['Projections', 'Models savings, income, spending, and taxes over time', 'Predict actual market returns'],
        ['Taxes', 'Estimates federal and state tax at planning precision', 'Replace a tax return or a tax advisor'],
        ['Decisions', 'Helps you compare choices side by side', 'Tell you what you personally should do'],
      ],
    },
    {
      type: 'heading',
      text: 'How to start',
    },
    {
      type: 'list',
      ordered: true,
      items: [
        'Open the [planner home](/) and create a new plan.',
        'Work through the sections on the left, from **Household** to **Assumptions**.',
        'Visit **Results**, **Monte Carlo**, and **Optimize** to explore what your plan implies.',
        'Come back to the Learning Center whenever a term or screen needs explaining.',
      ],
    },
    {
      type: 'prose',
      md: 'You do not need every detail to get value. A rough plan with sensible defaults already tells you a lot — you can refine it over time.',
    },
  ],
}
