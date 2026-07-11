/**
 * "The three big questions: spending, time, and risk" - a Start Here P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const threeBigQuestionsSpendingTimeRiskArticle: LearningArticle = {
  slug: 'three-big-questions-spending-time-risk',
  title: 'The three big questions: spending, time, and risk',
  description: 'The handful of inputs that drive almost every retirement outcome.',
  category: 'start-here',
  tags: ['spending', 'retirement timing', 'risk', 'assumptions', 'planning basics'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'stable',
  sourceUrls: [],
  relatedArticles: [
    'how-to-read-a-retirement-projection',
    'todays-dollars-vs-future-dollars',
    'what-retiregolden-models',
    'how-assumptions-change-the-answer',
    'sequence-of-returns-risk',
  ],
  relatedPlannerRoutes: [
    '/plan/:planId/household',
    '/plan/:planId/spending',
    '/plan/:planId/assumptions',
    '/plan/:planId/results',
    '/plan/:planId/monte-carlo',
  ],
  currentYearSensitive: false,
  priority: 'P0',
  blocks: [
    {
      type: 'prose',
      md: 'Most retirement planning details eventually point back to three questions: how much you spend, how long the plan must run, and how much uncertainty the plan can absorb. If those three inputs are fuzzy, every later result is fuzzier too.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Spending usually drives the size of the problem more than any single tax detail.',
        'Time includes retirement age, claim age, planning age, and survivor years.',
        'Risk is not one number. It includes markets, inflation, longevity, healthcare, taxes, and flexibility.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A retirement plan is not mainly a prediction. It is a stress test of a lifestyle across time. Spending tells the plan what must be funded. Time tells the plan how many years the funding must last. Risk tells the plan how much bad luck could arrive before the answer breaks.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/three-big-questions.webp' },
      caption:
        'Spending, time, and risk form the core triangle underneath the rest of the retirement plan.',
      alt: 'Three large illustrated pillars for spending, time, and risk support a retirement path with account, tax, and healthcare icons above it.',
    },
    {
      type: 'table',
      caption: 'The three questions underneath most retirement choices.',
      columns: ['Question', 'What it controls', 'Where people get tripped up'],
      rows: [
        ['Spending', 'How much the plan must fund each year', 'Using a current budget that ignores taxes, healthcare, repairs, travel, or one-time goals'],
        ['Time', 'How many years income, withdrawals, inflation, and survivor rules run', 'Planning to life expectancy instead of a prudent planning age'],
        ['Risk', 'How much uncertainty the plan can absorb', 'Looking at a single result and missing weak paths'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Nolan household',
      assumptions: [
        { label: 'Spending', value: '$95,000 per year before healthcare surprises' },
        { label: 'Time', value: 'Retire at 63, plan through one spouse reaching 96' },
        { label: 'Risk', value: 'Moderate portfolio with 82% Monte Carlo success in the first pass' },
      ],
      summary:
        'Before debating Roth conversions or claim timing, the Nolans need to know whether **$95,000**, a 33-year horizon, and 82% success are a workable starting point.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden lets you edit these three questions directly. Spending lives in **Spending**. Time lives across **Household**, **Social Security**, and account strategy choices. Risk shows up in **Assumptions**, **Monte Carlo**, **Scenarios**, and **Optimize**.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Treating the first plan as the answer instead of a baseline.',
        'Fine-tuning tax strategy before the spending number is credible.',
        'Using one planning age for a couple and ignoring survivor years.',
        'Assuming a good median result means the plan is resilient.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Start with **Household**, **Spending**, and **Accounts**. Then read **Results** for the baseline, **Monte Carlo** for risk, and **Scenarios** for what changes the answer most.',
    },
  ],
}
