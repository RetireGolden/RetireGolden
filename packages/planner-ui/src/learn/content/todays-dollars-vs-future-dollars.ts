/**
 * "Today's dollars vs future dollars" — a Start Here P0 article.
 *
 * Evergreen and concept-first: it uses a single illustrative ~3% inflation
 * example (date-stamped as illustrative, not a rule), so it carries no source or
 * annual-review obligation. It doubles as the showcase that exercises every
 * rich content block: figure, formula, scenario, and table.
 */

import type { LearningArticle } from '../learningRegistry'

export const todaysDollarsArticle: LearningArticle = {
  slug: 'todays-dollars-vs-future-dollars',
  title: "Today's dollars vs future dollars",
  description: 'Why the same dollar amount means different things over time, and how to read it in your plan.',
  category: 'start-here',
  tags: ['inflation', 'real dollars', 'nominal', 'purchasing power', 'today’s dollars'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-19',
  reviewCadence: 'stable',
  sourceUrls: [],
  relatedArticles: ['about-retiregolden', 'how-assumptions-change-the-answer', 'inflation-risk'],
  relatedPlannerRoutes: ['/plan/:planId/assumptions', '/plan/:planId/results'],
  currentYearSensitive: false,
  blocks: [
    {
      type: 'prose',
      md: 'A dollar in 30 years will not buy what a dollar buys today. When a plan shows a big future number, the first question to ask is: **is that in today’s dollars, or future dollars?** The answer changes what the number really means.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        '**Future (nominal) dollars** are the actual dollar amounts in a future year — bigger, but each one buys less.',
        "**Today's dollars** (also called **real dollars**) strip out inflation so you can compare to prices you know now.",
        'Neither is “right.” What matters is knowing which one you are looking at.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Inflation is the slow rise in prices over time. As prices rise, each dollar buys a little less. Over a few years the effect is small. Over a multi-decade retirement, it is large.\n\nThe chart below shows what a fixed $50,000 would buy over time if prices rise about 3% a year. The dollar amount on the bill never changes — but its buying power keeps shrinking.',
    },
    {
      type: 'figure',
      chartId: 'purchasing-power',
      caption: 'Buying power of a fixed $50,000 over 30 years.',
      alt: 'A line falling from $50,000 today to roughly $20,600 of buying power after 30 years, because prices rise about 3% a year.',
      sourceNote: 'Illustrative, assuming about 3% inflation a year. Your plan uses your own inflation assumption.',
    },
    { type: 'heading', text: 'A quick formula' },
    {
      type: 'prose',
      md: 'To convert a future amount back into today’s dollars, divide it by inflation compounded over the years between now and then:',
    },
    {
      type: 'formula',
      expression: "today's dollars = future dollars ÷ (1 + inflation)^years",
      where: [
        { symbol: 'future dollars', meaning: 'the nominal amount in some future year' },
        { symbol: 'inflation', meaning: 'the average yearly price increase, e.g. 0.03 for 3%' },
        { symbol: 'years', meaning: 'the number of years from now until that future year' },
      ],
      note: 'This simple version assumes one steady inflation rate. Real inflation varies year to year, which is why the app lets you set the assumption and re-runs the math each year.',
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Rivera household',
      assumptions: [
        { label: 'Spending need', value: '$50,000 a year in today’s dollars' },
        { label: 'Years until retirement', value: '20 years' },
        { label: 'Assumed inflation', value: 'about 3% a year' },
      ],
      summary:
        'In 20 years, covering the **same** lifestyle takes about **$90,000** of future dollars — not because the Riveras live larger, but because each dollar buys less.',
    },
    {
      type: 'prose',
      md: 'So a plan that shows “$90,000 of spending” in year 20 may describe the exact same life as “$50,000 today.” Seeing both framings keeps you from over- or under-reacting to a big number.',
    },
    {
      type: 'table',
      caption: 'The same retirement, shown two ways.',
      columns: ['Framing', 'What the number is', 'Good for'],
      rows: [
        ["Today's dollars", 'Inflation removed, comparable to prices now', 'Judging whether a plan supports your lifestyle'],
        ['Future (nominal) dollars', 'Actual dollar amounts in each future year', 'Matching account statements and tax brackets'],
      ],
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'You set the inflation assumption on the **Assumptions** screen, and the **Results** screen can show key figures in today’s dollars so they stay comparable to prices you recognize. When you read any projection, check which framing it uses before drawing a conclusion.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Treating a large future balance as “rich” without converting it to today’s dollars.',
        'Comparing a today’s-dollars number against a future-dollars number — an apples-to-oranges mix.',
        'Assuming inflation is fixed; it is an assumption you can and should test.',
      ],
    },
  ],
}
