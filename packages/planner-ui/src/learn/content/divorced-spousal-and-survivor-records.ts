/**
 * "Divorced-spousal and survivor records" - a Social Security P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const divorcedSpousalSurvivorRecordsArticle: LearningArticle = {
  slug: 'divorced-spousal-and-survivor-records',
  title: 'Divorced-spousal and survivor records',
  description: "When benefits can be based on an ex-spouse's record.",
  category: 'social-security',
  tags: ['social security', 'divorced spouse', 'survivor benefit', 'former spouse', 'claiming'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.ssa.gov/benefits/retirement/planner/applying7.html',
    'https://www.ssa.gov/benefits/survivors/',
  ],
  relatedArticles: [
    'spousal-and-survivor-benefits',
    'social-security-claiming-age-basics',
    'planning-for-couples-and-survivor-years',
    'reading-the-social-security-analysis-page',
  ],
  relatedPlannerRoutes: ['/plan/:planId/social-security', '/plan/:planId/social-security-analysis'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'A former spouse can matter in Social Security planning even when that person is not part of your household today. In some cases, a divorced-spousal benefit or survivor benefit can be based on a former spouse\'s record.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'A long marriage to a living ex-spouse may support a divorced-spousal benefit if the claimant is currently unmarried.',
        'A deceased former spouse may support a survivor benefit, subject to survivor and remarriage rules.',
        'RetireGolden lets a single-person plan enter former-spouse records, then compares the eligible former-spouse benefit against the person\'s own benefit.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Social Security is based on work records, but not every benefit has to be based only on your own record. A current spouse, former spouse, or deceased spouse can sometimes create a higher benefit.\n\nThis is easiest to misunderstand after divorce or widowhood. A person may have their own retirement benefit and also a possible benefit tied to a former spouse. The planning question is usually not "Can I add both together?" It is "Which eligible benefit is larger, and when can it begin?"',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/divorced-spousal-survivor-records.webp' },
      caption:
        'Former-spouse records act like additional benefit paths; the modeled household uses the largest eligible path instead of stacking all paths together.',
      alt: 'A person has three possible Social Security paths from their own record, a living former spouse record, and a deceased former spouse record, with the largest eligible path flowing into one benefit bucket.',
    },
    {
      type: 'table',
      caption: 'How RetireGolden separates former-spouse records.',
      columns: ['Record type', 'Main eligibility idea', 'Modeled benefit idea'],
      rows: [
        ['Living ex-spouse', 'A marriage of at least ten years and a currently unmarried claimant', 'Up to half of the former spouse PIA, reduced for early claiming'],
        ['Deceased former spouse', 'Survivor eligibility and remarriage rules', 'A survivor-style benefit compared with the claimant\'s own benefit'],
        ['Current spouse', 'A current two-person household', 'Handled separately through the current-spouse top-up and survivor step-up'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Morgan plan',
      assumptions: [
        { label: 'Household', value: 'Single retiree with one former-spouse record' },
        { label: 'Own benefit estimate', value: '$1,100 a month at full retirement age' },
        { label: 'Former-spouse estimate', value: '$1,450 a month if eligibility is confirmed' },
      ],
      summary:
        'The former-spouse record matters only after eligibility is confirmed. If the $1,450 estimate applies, it adds about **$350** a month compared with Morgan\'s own modeled benefit.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'On the **Social Security** screen, a Social Security income stream can include former spouses. RetireGolden asks for the relationship type, former spouse date of birth, their estimated primary insurance amount, years married, and remarriage age when relevant. The projection then uses the larger eligible benefit rather than adding all benefits together.',
    },
    {
      type: 'callout',
      tone: 'note',
      md: 'Model note: RetireGolden uses planning-level simplifications. Divorced-spousal benefits require the claimant to be single in the modeled household. Survivor benefits on a former spouse use simplified reductions and should be checked against SSA before making a filing decision.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Assuming a divorce always erases Social Security spousal rights.',
        'Adding your own benefit and a spousal benefit together instead of comparing the larger eligible benefit.',
        'Forgetting remarriage rules for survivor benefits.',
        'Entering a former spouse record in RetireGolden without verifying the real SSA eligibility facts.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Open **Social Security**, expand the person\'s Social Security entry, and add former-spouse records only when they may apply. Then use **Social Security analysis** to compare claiming ages with the former-spouse record included.',
    },
  ],
}
