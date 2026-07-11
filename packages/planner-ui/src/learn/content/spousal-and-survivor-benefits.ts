/**
 * "Spousal and survivor benefits" - a Social Security P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const spousalSurvivorBenefitsArticle: LearningArticle = {
  slug: 'spousal-and-survivor-benefits',
  title: 'Spousal and survivor benefits',
  description: 'How a couple\'s benefits interact while both live and after one dies.',
  category: 'social-security',
  tags: ['social security', 'spousal benefit', 'survivor benefit', 'couples', 'widow', 'widower'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-29',
  reviewCadence: 'rule-change',
  sourceUrls: [
    'https://www.ssa.gov/benefits/retirement/planner/applying7.html',
    'https://www.ssa.gov/benefits/survivors/',
    'https://www.ssa.gov/oact/ProgData/nra.html',
    'https://secure.ssa.gov/poms.nsf/lnx/0300615100',
  ],
  relatedArticles: [
    'social-security-claiming-age-basics',
    'break-even-useful-lens',
    'planning-for-couples-and-survivor-years',
    'widows-penalty-and-survivor-brackets',
  ],
  relatedPlannerRoutes: ['/plan/:planId/social-security', '/plan/:planId/social-security-analysis'],
  currentYearSensitive: false,
  priority: 'P0',
  blocks: [
    {
      type: 'prose',
      md: 'For a couple, Social Security is not just two separate checks. Spousal and survivor rules can change the household income while both spouses are alive and after one spouse dies.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'A lower earner may receive a spousal top-up while both spouses are alive.',
        'After the first death, the survivor generally keeps the larger benefit, not both checks.',
        'Delaying the higher earner can protect the person who lives longest, even if it looks less attractive for one person alone.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'While both spouses are alive, each person may have their own retirement benefit. If one benefit is much smaller, a spousal rule can lift the lower earner toward a share of the higher earner\'s base benefit.\n\nAfter one spouse dies, the household usually does not keep both checks. The survivor benefit can replace the smaller check with the larger one. That is why a high earner\'s claiming age can be a survivor-protection decision, not just an individual decision.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/spousal-survivor-benefits.webp' },
      caption:
        'A couple may have two benefit streams while both are alive; after one death, the survivor keeps one protected larger stream.',
      alt: 'Two benefit ribbons flow through a couple-years gate, then one larger protected ribbon continues through a survivor checkpoint.',
    },
    { type: 'heading', text: 'Two phases to think about' },
    {
      type: 'table',
      caption: 'How couple benefits can change across a retirement.',
      columns: ['Phase', 'What to watch', 'Why it matters'],
      rows: [
        ['Both spouses alive', 'Own benefits plus possible spousal top-up', 'The lower earner may receive more than their own record alone would pay'],
        ['First spouse dies', 'The smaller check may disappear', 'Household income can fall while many expenses remain'],
        ['Survivor years', 'Survivor keeps the larger benefit stream', 'A larger delayed high-earner check can become long-life protection'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Morgan household',
      assumptions: [
        { label: 'Higher earner', value: '$2,800 monthly benefit at full retirement age' },
        { label: 'Lower earner', value: '$900 own benefit, with a possible top-up toward $1,400 while both are alive' },
        { label: 'Survivor concern', value: 'After one death, the survivor keeps one larger benefit, not both checks' },
      ],
      summary:
        'The spousal top-up can raise couple-year income by about **$500** a month. Later, the survivor floor depends heavily on the higher earner\'s benefit, so claim timing affects more than the first check.',
    },
    { type: 'heading', text: 'Survivor precision: early-claim reduction and the widow\u2019s limit' },
    {
      type: 'prose',
      md: 'A survivor benefit is not always 100% of what the deceased would have received. Two SSA rules shape the amount, and RetireGolden models both:',
    },
    {
      type: 'list',
      items: [
        '**Early-claim widow(er) reduction.** A survivor can claim as early as age 60, but claiming before the survivor\u2019s own full retirement age reduces the benefit by up to 28.5% at 60 (a floor of 71.5%). The survivor FRA is a separate, earlier schedule than the worker FRA \u2014 it tops out at 66 years and 8 months for those born 1960+, not 67.',
        '**RIB-LIM (the widow\u2019s limit).** If the deceased claimed reduced benefits early, the survivor is capped at the larger of the deceased\u2019s actual reduced benefit or 82.5% of the deceased\u2019s PIA. This usually lifts the survivor above the deceased\u2019s reduced amount but below 100% of the PIA.',
        '**The base is the deceased\u2019s actual benefit.** If the deceased delayed past FRA, those delayed retirement credits pass through to the survivor.',
      ],
    },
    {
      type: 'callout',
      tone: 'note',
      md: 'Example: a deceased worker with a $2,400 PIA who claimed at 62 was receiving 70% ($1,680). At the survivor FRA, the widow\u2019s limit floors the survivor at 82.5% of PIA \u2014 $1,980 \u2014 even though the deceased only got $1,680. If instead the deceased had delayed to 70, the survivor would receive the full delayed amount (about 124% of PIA).',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden models a current-spouse top-up while both spouses are alive and both have claimed. It also models a survivor step-up so the surviving spouse keeps the larger benefit, computed with full precision \u2014 the deceased\u2019s claim-age-adjusted base, the RIB-LIM widow\u2019s-limit cap, and the early-claim widow(er) reduction. The Social Security entry screen can store former-spouse records (including the deceased ex\u2019s claim age) for divorced-spousal or survivor cases.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Optimizing each spouse as if they were single.',
        'Forgetting that one check can disappear after the first death.',
        'Assuming a spousal benefit earns delayed retirement credits the same way a worker benefit does.',
        'Leaving out former-spouse records that may matter for a single divorced or widowed person.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Social Security** to enter both spouses and any former-spouse records that may apply. Use **Social Security analysis** to compare claim-age combinations and read the couple strategy notes.',
    },
  ],
}
