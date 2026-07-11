/**
 * "How to use assumptions and provenance" - a Using RetireGolden P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const usingAssumptionsAndProvenanceArticle: LearningArticle = {
  slug: 'using-assumptions-and-provenance',
  title: 'How to use assumptions and provenance',
  description: 'Where each default comes from and how to override it responsibly.',
  category: 'using-retiregolden',
  tags: ['retiregolden', 'assumptions', 'provenance', 'defaults', 'parameter pack'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'stable',
  sourceUrls: ['https://www.irs.gov/', 'https://www.ssa.gov/', 'https://www.medicare.gov/', 'https://www.healthcare.gov/'],
  relatedArticles: [
    'how-assumptions-change-the-answer',
    'what-retiregolden-models',
    'inflation-risk',
    'irmaa-two-year-lookback',
    'aca-premium-tax-credits-and-magi',
  ],
  relatedPlannerRoutes: ['/plan/:planId/assumptions', '/plan/:planId/results', '/plan/:planId/monte-carlo'],
  currentYearSensitive: false,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'Assumptions are the bridge between your plan and the rules RetireGolden applies. Some assumptions are choices you set directly. Others come from dated parameter packs, such as tax brackets, contribution limits, RMD factors, Medicare, IRMAA, ACA, and Social Security figures.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Use plan assumptions for the household-specific future: inflation, returns, recent MAGI, state override, and Social Security COLA.',
        'Use provenance to see where the app\'s rule defaults came from.',
        'Override a default when you have better household-specific information, not just because the output is uncomfortable.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A parameter pack is a snapshot of published rules and dollar values. It helps the engine apply tax and benefit rules consistently without asking you to enter every bracket, limit, premium, and threshold yourself. Provenance is the record of where those inputs came from and when they were compiled.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/assumptions-provenance.webp' },
      caption:
        'Household assumptions and sourced parameter packs meet inside the projection engine.',
      alt: 'Two streams labeled by icons for household choices and official sources flow into a structured projection ledger.',
    },
    {
      type: 'table',
      caption: 'Where to look when a number feels surprising.',
      columns: ['Question', 'Where to check', 'What to do next'],
      rows: [
        ['Is this my input?', 'The planner entry screen that owns the field', 'Correct the fact if it is wrong'],
        ['Is this a plan-wide assumption?', 'Assumptions', 'Adjust it and rerun Results or Monte Carlo'],
        ['Is this a rule default?', 'Disclaimer and provenance table', 'Verify against the official source if it matters'],
        ['Is this beyond the latest published pack?', 'Report notes or modeling warnings', 'Treat projected future thresholds as planning approximations'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Jordan household',
      assumptions: [
        { label: 'Question', value: 'Medicare costs rise by about $1,900 after a Roth conversion year' },
        { label: 'First check', value: 'MAGI increased from $170,000 to $240,000 on the Results page' },
        { label: 'Second check', value: 'Provenance shows which Medicare and IRMAA values the estimate used' },
      ],
      summary:
        'The higher cost is not a random output. The Jordans can connect the $70,000 MAGI increase to the sourced Medicare rule and decide whether the conversion is still worth it.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'The **Assumptions** screen is where you set plan-wide levers. The **Disclaimer** page includes the provenance table for dated rule defaults. Results and reports may also show modeling notes when a value is a planning approximation or a future-year stand-in.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Changing returns or inflation to make a preferred strategy look better.',
        'Forgetting that future years may use indexed or stand-in values when official figures are not published yet.',
        'Treating a provenance source as tax advice instead of a place to verify the rule input.',
        'Leaving a state override at zero when the modeled state treatment does not fit your situation.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Assumptions** when you want to change the plan. Use the **Disclaimer** and provenance table when you want to understand the source of the default. Then rerun **Results** and **Monte Carlo** to see what changed.',
    },
  ],
}
