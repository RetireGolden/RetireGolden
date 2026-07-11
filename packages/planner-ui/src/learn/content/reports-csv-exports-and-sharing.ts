/**
 * "Reports, CSV exports, and sharing results" - a Using RetireGolden P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const reportsCsvExportsAndSharingArticle: LearningArticle = {
  slug: 'reports-csv-exports-and-sharing',
  title: 'Reports, CSV exports, and sharing results',
  description: 'How to get plan results out of the app for review or records.',
  category: 'using-retiregolden',
  tags: ['retiregolden', 'report', 'csv', 'backup', 'sharing'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'stable',
  sourceUrls: [],
  relatedArticles: [
    'planner-overview',
    'reading-the-results-page',
    'privacy-what-stays-in-your-browser',
    'using-assumptions-and-provenance',
    'what-retiregolden-models',
  ],
  relatedPlannerRoutes: ['/', '/plan/:planId/results', '/plan/:planId/report'],
  currentYearSensitive: false,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'RetireGolden has four different ways to get information out of the app: a printable/PDF report, a self-contained HTML report, a CSV ledger, and a JSON plan backup. They are for different jobs, so it helps to choose the right one.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Use the printable report when a person needs a readable plan summary or browser-saved PDF.',
        'Use the HTML report when you want a portable audit file with assumptions, parameter provenance, warnings, and recommendation evidence.',
        'Use the CSV when you want the annual ledger in a spreadsheet.',
        'Use the JSON backup when you want to preserve or move the editable plan itself.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A report is for communication. A CSV is for analysis. A backup is for restoring the app state. Sending the wrong file can create confusion: a spreadsheet reader cannot reconstruct every planner field from the CSV, and a JSON backup may expose more personal data than a report reviewer needs.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/reports-csv-exports-sharing.webp' },
      caption:
        'Reports, CSV ledgers, and backups serve different sharing and recordkeeping needs.',
      alt: 'Three illustrated output paths leave a retirement plan: a readable report, a spreadsheet ledger, and a secure backup file.',
    },
    {
      type: 'table',
      caption: 'Which export to use.',
      columns: ['Output', 'Where it lives', 'Best for'],
      rows: [
        ['Printable report', 'Report route from Results', 'A clean summary for review, printing, or saving as PDF'],
        ['HTML report', 'Download HTML report on Results or Report; recommendation report on Optimize', 'A self-contained audit bundle with assumptions, sources, warnings, annual ledger data, and recommendation evidence when available'],
        ['CSV ledger', 'Download CSV on Results', 'Spreadsheet inspection of nominal year-by-year income, tax, withdrawals, and balances'],
        ['JSON backup', 'Planner home', 'Saving or moving editable plans to another browser or device'],
        ['Duplicate plan', 'Planner home or workspace controls', 'Trying a new version without changing the original'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Lee household',
      assumptions: [
        { label: 'Advisor review', value: 'Save a 12-page printable report as PDF' },
        { label: 'Audit file', value: 'Download the HTML report so assumptions, sources, and recommendation evidence travel with the results' },
        { label: 'Personal audit', value: 'Download the 35-year CSV and inspect taxes, MAGI, and withdrawals by year' },
        { label: 'Device move', value: 'Download one JSON backup, then import it in the other browser' },
      ],
      summary:
        'The files are not interchangeable. The PDF reads like a summary, the HTML report carries audit context, the 35-year CSV audits the ledger, and the JSON backup is the only one that preserves the editable inputs.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'The **Results** page has **Download CSV**, **Download HTML report**, and **View printable report**. The **Optimize** page can download a recommendation report once the optimizer has run, including the exact-ledger evidence behind the recommendation. The CSV uses the nominal year-by-year ledger, even if the screen is currently toggled to today\'s dollars. The planner home has **Download plan backup** and **Import previous backup** for moving the underlying plan data.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Sending a JSON backup when the other person only needs a report.',
        'Assuming the CSV follows the Results today-dollar toggle.',
        'Clearing browser data before downloading a backup.',
        'Sharing a file without realizing it may include sensitive household and account details.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Results** for the CSV, HTML report, and printable report. Use **Optimize** for a recommendation report after running the optimizer. Use the planner home for backups, imports, duplicates, and clearing all local data.',
    },
  ],
}
