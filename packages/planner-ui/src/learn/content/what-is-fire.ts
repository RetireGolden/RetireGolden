import type { ArticleBlock } from '../learningRegistry'

export const blocks: ArticleBlock[] = [
  {
    type: 'prose',
    md: 'FIRE stands for **Financial Independence, Retire Early**. It is a lifestyle movement defined by high savings rates and intentional living. The ultimate goal is to build a retirement portfolio large enough that paid work becomes completely optional.',
  },
  { type: 'heading', text: 'Three key takeaways' },
  {
    type: 'list',
    items: [
      'Financial independence means your assets generate enough income to cover your expenses.',
      'Retire early is optional: many people in the movement continue working on their own terms.',
      'Different flavors of FIRE cater to different spending levels and career transitions.',
    ],
  },
  { type: 'heading', text: 'The four flavors of FIRE' },
  {
    type: 'table',
    caption: 'The main paths to Financial Independence.',
    columns: ['Flavor', 'Description', 'Lifestyle goal'],
    rows: [
      ['Lean FIRE', 'Lower-spending lifestyle with a smaller FI target.', 'Extremely low expenses and maximum savings.'],
      ['Fat FIRE', 'Higher-spending lifestyle with a larger FI target.', 'More room for comfort, travel, or location flexibility.'],
      ['Coast FIRE', 'Front-loading savings early, then letting investment compounding carry you to retirement.', 'Work only to cover living expenses, not retirement savings.'],
      ['Barista FIRE', 'Retiring from a primary high-stress career but keeping a low-stress part-time job.', 'Use part-time income and employer healthcare to bridge the gap.'],
    ],
  },
  { type: 'heading', text: 'Common mistakes' },
  {
    type: 'list',
    items: [
      'Treating FIRE as one rigid lifestyle instead of a set of planning tradeoffs.',
      'Ignoring healthcare, taxes, and sequence risk when estimating the portfolio needed.',
      'Assuming work must stop completely once financial independence is reached.',
    ],
  },
  { type: 'heading', text: 'Where this shows up in RetireGolden' },
  {
    type: 'prose',
    md: 'In RetireGolden, you can view your **FI Target Portfolio** and **Coast-FIRE Target** in the results dashboard. These derived metrics analyze your simulated accounts to pinpoint the year your net worth supports your retirement spending.',
  },
]
