/**
 * "Privacy: what stays in your browser" - a Using RetireGolden P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const privacyWhatStaysInYourBrowserArticle: LearningArticle = {
  slug: 'privacy-what-stays-in-your-browser',
  title: 'Privacy: what stays in your browser',
  description: 'Why your plan data never leaves your device and what that implies.',
  category: 'using-retiregolden',
  tags: ['privacy', 'browser storage', 'backup', 'indexeddb', 'local storage'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'stable',
  sourceUrls: [],
  relatedArticles: [
    'planner-overview',
    'reports-csv-exports-and-sharing',
    'what-retiregolden-models',
    'using-assumptions-and-provenance',
    'troubleshooting-surprising-results',
  ],
  relatedPlannerRoutes: ['/', '/plan/:planId/report'],
  currentYearSensitive: false,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'RetireGolden does not have accounts or server-side plan storage. The plan data you enter stays in this browser on this device. That is good for privacy, but it also means you are responsible for backups.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'V2 plans are stored locally in IndexedDB, with some older/import helper data in localStorage.',
        'RetireGolden cannot recover a plan after you clear browser data or switch devices without a backup.',
        'A JSON backup is the way to keep or move editable plans outside the browser.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Local-first storage means the app can save your plan without creating an online account. It also means the browser is the vault. If that browser profile is deleted, reset, or unavailable, RetireGolden has no server copy to restore from.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/browser-privacy.webp' },
      caption:
        'Local browser storage protects plan privacy, but backups are how you keep a recoverable copy.',
      alt: 'A browser window holds a private retirement plan vault, with a backup file placed outside it for safekeeping.',
    },
    {
      type: 'table',
      caption: 'What this privacy model means in practice.',
      columns: ['Situation', 'What happens', 'Best habit'],
      rows: [
        ['Normal planning', 'The browser saves your plans locally', 'Keep working in the same browser profile'],
        ['Sharing a computer', 'Anyone with that browser profile may be able to open the plans', 'Use an OS account you control'],
        ['Clearing site data', 'Plans and older RetireGolden entries may be erased', 'Download a backup first'],
        ['Moving devices', 'The new device has no copy automatically', 'Import a JSON backup'],
        ['Asking for support', 'There is no server copy to inspect', 'Share only the report or details you choose'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Singh household',
      assumptions: [
        { label: 'Before travel', value: 'Download a JSON backup after updating 2 plans' },
        { label: 'New laptop', value: 'Import the backup into the new browser and confirm both plans open in 1 browser' },
        { label: 'Old browser cleanup', value: 'Clear local data from the old browser only after the 2 imported balances match' },
      ],
      summary:
        'Nothing was synced to an account. The Singhs moved **2** plans by carrying **1** backup file themselves, then checked both balances before clearing the old browser.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'The planner home explains that data stays on your device and offers **Download plan backup**, **Import previous backup**, and **Clear all data**. The workspace also reminds you that plans live only in this browser.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Assuming there is an online account behind the scenes.',
        'Using private browsing for long-term plan storage.',
        'Clearing browser data before exporting a backup.',
        'Emailing a full backup when a limited report would be safer.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use the planner home whenever you need to download a backup, import a prior backup, duplicate plans, or clear local RetireGolden data from the current browser.',
    },
  ],
}
