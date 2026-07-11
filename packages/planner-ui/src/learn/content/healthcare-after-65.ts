/**
 * "Healthcare after age 65" - a Healthcare P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const healthcareAfter65Article: LearningArticle = {
  slug: 'healthcare-after-65',
  title: 'Healthcare after age 65',
  description: 'How Medicare parts and premiums fit into spending.',
  category: 'healthcare',
  tags: ['medicare', 'part b', 'part d', 'medigap', 'medicare advantage', 'irmaa', 'healthcare spending'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-19',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.medicare.gov/basics/get-started-with-medicare/get-more-coverage/your-coverage-options',
    'https://www.medicare.gov/basics/get-started-with-medicare/sign-up',
    'https://www.medicare.gov/basics/costs/medicare-costs',
  ],
  relatedArticles: [
    'irmaa-two-year-lookback',
    'healthcare-before-65',
    'agi-magi-and-taxable-income',
    'long-term-care-costs-and-insurance',
  ],
  relatedPlannerRoutes: ['/plan/:planId/spending', '/plan/:planId/results', '/plan/:planId/assumptions'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'At 65, healthcare planning usually shifts from a pre-Medicare bridge to Medicare. That does not mean healthcare becomes free. Premiums, drug coverage, supplemental coverage, out-of-pocket costs, and IRMAA can still be a major retirement expense.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Medicare has multiple parts and coverage choices, not one single premium.',
        'IRMAA can raise premiums when MAGI from two years earlier is above a tier.',
        'RetireGolden models premium pressure, but it does not replace Medicare plan shopping.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Many retirees pay a Part B premium. They may also pay for Part D drug coverage, Medicare Advantage, Medigap, dental, vision, hearing, or other supplemental coverage. Some costs are premiums; others are deductibles, copays, and uncovered services.\n\nA retirement projection does not need to pick the perfect Medicare plan to be useful. It does need a reasonable healthcare spending line, and it needs to understand when income can raise premiums through IRMAA.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/healthcare-after-65.webp' },
      caption:
        'After 65, Medicare costs are a stack: base premiums, optional coverage, out-of-pocket assumptions, and possible IRMAA surcharges.',
      alt: 'Coverage tiles for hospital, medical, drug, and supplemental care flow into a Medicare premium bucket, while an income-threshold marker sends a surcharge ribbon into the same bucket.',
    },
    { type: 'heading', text: 'What belongs in the planning estimate' },
    {
      type: 'table',
      caption: 'Post-65 healthcare costs are not all modeled the same way.',
      columns: ['Cost type', 'How to think about it', 'RetireGolden treatment'],
      rows: [
        ['Part B premium', 'Common monthly Medicare premium', 'Added automatically from the parameter pack at 65+'],
        ['IRMAA', 'Income-related surcharge for higher MAGI', 'Modeled with the two-year lookback'],
        ['Part D surcharge', 'Drug-plan-related IRMAA surcharge', 'Modeled from the parameter pack where available'],
        ['Supplemental or Advantage premium', 'Plan-specific monthly cost', 'Enter as Medicare extras'],
        ['Out-of-pocket medical costs', 'Deductibles, copays, uncovered care', 'Include in broader spending or a separate goal/assumption'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Adams household',
      assumptions: [
        { label: 'Age', value: 'Both spouses are 67 and on Medicare' },
        { label: 'Regular premium line', value: '$520 a month each for Part B, drug coverage, and supplemental coverage' },
        { label: 'Lookback income event', value: 'A $90,000 Roth conversion two years earlier adds an estimated $180 a month each' },
      ],
      summary:
        'Their medical needs did not change, but the plan-year healthcare cost rises by about **$4,320** for the couple. That delayed premium jump belongs in the conversion trade-off.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden automatically adds Part B and IRMAA for people age 65 and older. The **Medicare extras** input is where you can add monthly amounts for Part D, Medigap, Medicare Advantage, or other recurring coverage costs that are not automatically modeled.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Assuming Medicare removes the need for a healthcare budget.',
        'Entering only supplemental premiums and forgetting that Part B is added automatically.',
        'Ignoring IRMAA when planning conversions around ages 63 and later.',
        'Using RetireGolden as a substitute for Medicare enrollment, provider-network, or drug-formulary research.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Spending** for Medicare extras, **Assumptions** for healthcare inflation and recent MAGI, and **Results** to see annual healthcare costs after Medicare begins.',
    },
  ],
}
