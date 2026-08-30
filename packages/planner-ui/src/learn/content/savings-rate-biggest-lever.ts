import type { ArticleBlock } from '../learningRegistry'

export const blocks: ArticleBlock[] = [
  {
    type: 'prose',
    md: 'Your **savings rate** is the single most dominant variable in early retirement planning. It determines two things simultaneously: how much money you are adding to your portfolio, and how much money you need to live on.',
  },
  { type: 'heading', text: 'Three key takeaways' },
  {
    type: 'list',
    items: [
      'Savings rate is calculated as: (Employee Contributions + Employer Match + Surplus Invested) ÷ Gross Income.',
      'Increasing your savings rate has a dual effect: it speeds up growth and shrinks your retirement budget.',
      'At a 50% savings rate, you buy one year of freedom for every year you work.',
    ],
  },
  { type: 'heading', text: 'Savings rate vs. years to FI' },
  {
    type: 'table',
    caption: 'Years to achieve financial independence assuming a 5% real return and 4% safe withdrawal rate.',
    columns: ['Savings rate', 'Years to FI', 'Working years per year of retirement funded'],
    rows: [
      ['10%', '51 years', '9 years of work funds 1 year of retirement'],
      ['20%', '37 years', '4 years of work funds 1 year of retirement'],
      ['30%', '28 years', '2.3 years of work funds 1 year of retirement'],
      ['50%', '17 years', '1 year of work funds 1 year of retirement'],
      ['70%', '8.5 years', '0.4 years of work funds 1 year of retirement'],
    ],
  },
  { type: 'heading', text: 'Common mistakes' },
  {
    type: 'list',
    items: [
      'Mixing take-home-pay savings rates with gross-income savings rates without labeling which one you mean.',
      'Counting the same dollar twice, such as counting a brokerage contribution and the surplus that funded it.',
      'Forgetting that a higher savings rate also usually means a smaller spending target.',
    ],
  },
  { type: 'heading', text: 'Where this shows up in RetireGolden' },
  {
    type: 'prose',
    md: 'RetireGolden calculates your annual savings rate on the Results page. You can see the **Average Savings Rate** KPI, representing the average percentage of gross wages saved before your target retirement age.',
  },
]
