/**
 * "Moving to RetireGolden" — Using RetireGolden article for the import &
 * migration wizard (onboarding-import-and-migration step 6).
 */

import type { ArticleBlock } from '../learningRegistry'

export const blocks: ArticleBlock[] = [
  {
    type: 'prose',
    md: 'Retyping a plan you already built somewhere else is the worst part of switching tools. The **Import & migrate** wizard (from the planner home) starts a draft RetireGolden plan from files you already have, and everything is parsed on your device, so no file is ever uploaded anywhere.',
  },
  { type: 'heading', text: 'Quick takeaways' },
  {
    type: 'list',
    items: [
      'Four guided paths: a broker positions CSV (Schwab, Fidelity, Vanguard), a ProjectionLab JSON export, any spreadsheet saved as CSV (including the Bogleheads Retiree Portfolio Model), and last year\'s Form 1040.',
      'Nothing imports silently: a review checklist shows what mapped, what was assumed for you, and what could not come over. Imports create a draft you approve before saving, and every value stays editable.',
      'Getting out is as supported as getting in: the plan backup is a documented, versioned JSON file.',
    ],
  },
  { type: 'heading', text: 'What each path brings over' },
  {
    type: 'table',
    caption: 'What each import source can and cannot provide.',
    columns: ['Source', 'What imports', 'What you still enter'],
    rows: [
      ['Broker CSV', 'Account balances, cost basis where the file has it, guessed account types', 'Household, income, spending, Social Security'],
      ['ProjectionLab JSON', 'Accounts, wages and other income, spending total, retirement-age milestone', 'Filing status, state, claim ages, strategies, assumptions'],
      ['Spreadsheet / RPM CSV', 'One account per row via column mapping (name, type, balance, basis, contribution)', 'Everything except accounts'],
      ['Form 1040 (guided)', 'Income streams, filing status, state, MAGI context, an estimated taxable balance', 'Spending, real account balances, retirement dates'],
    ],
  },
  { type: 'heading', text: 'The review checklist keeps mapping honest' },
  {
    type: 'prose',
    md: 'Formats differ, so no migration is ever 1:1. Instead of pretending otherwise, every import ends at a checklist with four groups: **Imported** (mapped directly), **Assumed: review** (a default the wizard had to invent, like treating a missing cost basis as "no unrealized gain"), **Not imported** (things the file could not express, with pointers to the right screen), and **Skipped** (unreadable rows). Work through the first two groups before trusting results.',
  },
  { type: 'heading', text: 'Updating balances later' },
  {
    type: 'prose',
    md: 'After the first import, you rarely want a whole new plan, just fresh numbers. The Accounts screen has **Update balances from a broker CSV**: download the same positions file at your annual checkup, assign each account in the file to a plan account, and apply. Balances (and cost basis, where present) refresh without retyping.',
  },
  { type: 'heading', text: 'And moving out' },
  {
    type: 'prose',
    md: 'Lock-in works both ways, so RetireGolden documents the exit too. **Download plan backup** on the planner home produces a plain JSON file containing every plan in full: a versioned, documented format, and backups made by older versions of the app keep importing through automatic migrations. If you move to another tool someday, your data is already in your hands in a machine-readable form.',
  },
  { type: 'heading', text: 'Common mistakes' },
  {
    type: 'list',
    items: [
      'Skipping the review checklist. The "Assumed" group is where wrong guesses (account types, cost basis) hide.',
      'Importing a broker CSV and expecting income or spending. Positions files only carry balances.',
      'Using the import wizard to restore a RetireGolden backup. That lives on the planner home ("Import previous backup").',
      'Forgetting that a draft is a starting point: results are only as good as the sections you finish afterward.',
    ],
  },
  { type: 'heading', text: 'Where to use this in the app' },
  {
    type: 'prose',
    md: 'Open **Import from a file** on the planner home (or go to the Import & migrate page directly). To refresh an existing plan\'s balances, use the panel at the bottom of that plan\'s **Accounts** screen.',
  },
]
