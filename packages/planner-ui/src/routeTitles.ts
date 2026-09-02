/**
 * Tab/history titles for the non-plan routes; plan routes are owned by
 * PlanWorkspace. Shared by the app shell (which sets document.title from
 * them) and the workspace not-found page (which names the site-level page
 * a plan-scoped URL was probably reaching for, #536), so the two never
 * drift apart. `/` is owned by PlannerApp, not by PlanPickerPage, so hosts
 * that mount `plannerHomeRoutes` under their own chrome do not have their
 * title overwritten.
 */
export const ROUTE_TITLES: ReadonlyArray<[prefix: string, title: string]> = [
  ['/examples', 'Examples'],
  ['/import', 'Import & migrate'],
  ['/compare', 'Compare plans'],
  // Learn routes each get their own name so tabs and history can tell the
  // landing, glossary, sources, and articles apart (#417). Longer prefixes
  // sit first: the match is first-wins. An article's title is resolved from
  // the registry asynchronously (see learnArticleSlugOf in App.tsx).
  ['/learn/glossary', 'Glossary'],
  ['/learn/sources', 'Sources & review methodology'],
  ['/learn', 'Learning Center'],
  ['/disclaimer', 'Disclaimer'],
  ['/how-tested', 'How RetireGolden is tested'],
]

/** The title for a non-plan pathname (first prefix match wins), or null. */
export function routeTitleOf(pathname: string): string | null {
  for (const [prefix, title] of ROUTE_TITLES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return title
  }
  return null
}
