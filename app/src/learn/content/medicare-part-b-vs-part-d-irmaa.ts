/**
 * "Medicare Part B vs Part D IRMAA" - a Healthcare P2 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const medicarePartBVsPartDIrmaaArticle: LearningArticle = {
  slug: 'medicare-part-b-vs-part-d-irmaa',
  title: 'Medicare Part B vs Part D IRMAA',
  description: 'How the income surcharge applies to both premiums.',
  category: 'healthcare',
  tags: ['medicare', 'irmaa', 'part b', 'part d', 'magi', 'premium surcharge'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: ['https://www.medicare.gov/basics/costs/medicare-costs', 'https://www.ssa.gov/medicare/lower-irmaa'],
  relatedArticles: [
    'irmaa-two-year-lookback',
    'healthcare-after-65',
    'agi-magi-and-taxable-income',
    'why-roth-conversions-raise-other-costs',
  ],
  relatedPlannerRoutes: ['/plan/:planId/spending', '/plan/:planId/assumptions', '/plan/:planId/results', '/plan/:planId/optimize'],
  currentYearSensitive: true,
  priority: 'P2',
  blocks: [
    {
      type: 'prose',
      md: 'IRMAA can affect more than one Medicare line item. Higher modified adjusted gross income can raise Part B premiums and can also add a Part D income-related surcharge.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Part B is medical insurance; Part D is prescription drug coverage.',
        'IRMAA is income-related and generally uses MAGI from two tax years earlier.',
        'RetireGolden models Part B and Part D IRMAA separately from verified parameter-pack values.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Many people learn IRMAA as "the Medicare surcharge." That shorthand can hide the mechanics. The standard Part B premium can rise at higher income levels. Part D can also have an income-related surcharge, even though the drug plan premium itself depends on the plan chosen.\n\nFor planning, this matters because an income event can create multiple Medicare cost ripples two years later. A Roth conversion, capital gain, or large required distribution might raise federal tax now and Medicare premiums later.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/medicare-part-b-vs-d-irmaa.webp' },
      caption:
        'A higher MAGI year can feed separate Part B and Part D surcharge paths after the two-year lookback.',
      alt: 'An income threshold gate sends two delayed ribbons into separate Medicare Part B and Part D premium buckets.',
    },
    {
      type: 'table',
      caption: 'Part B and Part D IRMAA in planning terms.',
      columns: ['Item', 'What it is', 'Planning note'],
      rows: [
        ['Part B premium', 'Medical insurance premium', 'RetireGolden adds the standard premium and IRMAA tier effect automatically at 65+'],
        ['Part D surcharge', 'Income-related surcharge tied to drug coverage', 'Modeled separately from any plan-specific drug premium extras'],
        ['Medicare extras', 'User-entered recurring coverage costs', 'Use for Medigap, Medicare Advantage, Part D plan premiums, or other recurring coverage estimates'],
        ['Two-year lookback', 'Prior MAGI drives later premium tiers', 'A current income decision can affect a future premium year'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Simmons household',
      assumptions: [
        { label: 'Income event', value: 'Large Roth conversion at age 66' },
        { label: 'Lookback', value: 'MAGI can affect Medicare premiums two years later' },
        { label: 'Cost paths', value: 'Estimated surcharge adds $120/month for Part B and $35/month for Part D' },
      ],
      summary:
        'A combined **$155** monthly surcharge is about **$1,860** for the year. The conversion may still win, but the Medicare cost should be counted with the tax bill.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden calls the Medicare premium model for each living person age 65 or older. It uses MAGI from two years earlier, the household filing status, and the parameter pack. The model returns Part B annual premium, Part D surcharge, and the IRMAA tier. User-entered Medicare extras are added separately.',
    },
    {
      type: 'callout',
      tone: 'note',
      md: 'Model note: RetireGolden adds published Part D IRMAA surcharges separately from any plan-specific drug premium you enter in Medicare extras.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Entering a Part B estimate in Medicare extras even though Part B is already modeled automatically.',
        'Forgetting the Part D surcharge when testing income near an IRMAA tier.',
        'Thinking this year\'s lower income immediately erases a prior-year lookback.',
        'Treating every IRMAA tier as fatal instead of comparing the whole lifetime plan.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Spending** for Medicare extras, **Assumptions** for recent MAGI, and **Results** to inspect MAGI and healthcare costs. Use **Optimize** carefully around IRMAA tier edges when conversion timing is part of the plan.',
    },
  ],
}
