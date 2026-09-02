import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useRoutes } from 'react-router'
import { RouteErrorBoundary } from './RouteErrorBoundary.tsx'
import { plannerContentRoutes, plannerHomeRoutes, plannerNotFoundRoute, plannerWorkspaceRoutes } from './routes/groups'
import { readLocal, STORAGE_KEYS, writeLocal } from './data/localStore'
import { listPlansVia, usePlanStore, type PlanStore } from './data/planStoreContext'
import { PlanStoreProvider } from './data/PlanStoreProvider'
import { ReportBrandingContext } from './report/brandingContext'
import type { ReportBranding } from './report/reportHtml'
import { ImportAvailabilityProvider } from './import/ImportAvailabilityProvider'
import './planner/planner.css'

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'nav-link nav-link--active' : 'nav-link'

/** Tab/history titles for non-plan routes; plan routes are owned by PlanWorkspace.
 *  `/` is owned here (PlannerApp), not by PlanPickerPage, so hosts that mount
 *  `plannerHomeRoutes` under their own chrome do not have their title overwritten. */
const ROUTE_TITLES: ReadonlyArray<[prefix: string, title: string]> = [
  ['/examples', 'Examples'],
  ['/import', 'Import & migrate'],
  ['/compare', 'Compare plans'],
  // Learn routes each get their own name so tabs and history can tell the
  // landing, glossary, sources, and articles apart (#417). Longer prefixes
  // sit first: the match is first-wins. An article's title is resolved from
  // the registry asynchronously (see learnArticleSlugOf).
  ['/learn/glossary', 'Glossary'],
  ['/learn/sources', 'Sources & review methodology'],
  ['/learn', 'Learning Center'],
  ['/disclaimer', 'Disclaimer'],
  ['/how-tested', 'How RetireGolden is tested'],
]

function routeTitleOf(pathname: string): string | null {
  for (const [prefix, title] of ROUTE_TITLES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return title
  }
  return null
}

/** `/learn/<slug>` for an article route; null for the landing, glossary, and sources. */
function learnArticleSlugOf(pathname: string): string | null {
  const slug = pathname.match(/^\/learn\/([^/]+)\/?$/)?.[1]
  return slug && slug !== 'glossary' && slug !== 'sources' ? slug : null
}

type ThemeMode = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = STORAGE_KEYS.theme
const THEME_MODES: ThemeMode[] = ['light', 'dark', 'system']

function getInitialThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const stored = readLocal(THEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

function getResolvedTheme(mode: ThemeMode) {
  if (mode !== 'system') return mode
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export interface PlannerAppProps {
  /**
   * Identity applied to downloaded HTML reports (name, logo, accent color,
   * footer note) — a generic host hook; omit it and reports keep the
   * RetireGolden defaults. In-app chrome is themed via CSS tokens instead
   * (override the custom properties from index.css).
   */
  reportBranding?: ReportBranding
  /**
   * Plan storage for the planner (see `PlanStore` in the package exports).
   * Precedence: this prop, else a `<PlanStoreProvider>` wrapping
   * `<PlannerApp/>`, else the browser IndexedDB store — exactly as on
   * retiregolden.app. Pass a stable instance — the planner reloads when the
   * store's identity changes.
   */
  planStore?: PlanStore
  /**
   * When `true`, renders the plan-editing surfaces read-only: editing controls
   * disable, autosave never runs, and the discrete write actions (duplicate,
   * "Save to my plans", import, new plan, delete) are hidden — while
   * results/report/compare and the export/download paths keep working. A
   * generic, edition-neutral capability (planner-ui knows nothing about *why*);
   * the host renders its own banner explaining the reason. Omitting it inherits
   * an ambient `<PlanStoreProvider>`'s value (else `false`), so behavior is
   * exactly as before unless a host opts in.
   */
  readOnly?: boolean
  /**
   * Host-controlled emergency boundary for file-backed import surfaces. When
   * false, the new-plan wizard, broker CSV refresh, mySSA XML import, and
   * FedInvest CSV fallback are replaced by an unavailable notice, while
   * manual entry, saved-plan reads, exports, and backup restore remain
   * available. Defaults to true for existing hosts.
   */
  importEnabled?: boolean
  /**
   * Whether the host has finished resolving `importEnabled`. While false,
   * file inputs stay unmounted but the UI reports a neutral availability
   * check instead of an incident. Defaults to true for existing hosts.
   */
  importResolved?: boolean
}

export function App({
  reportBranding,
  planStore,
  readOnly,
  importEnabled = true,
  importResolved = true,
}: PlannerAppProps = {}) {
  // An ambient <PlanStoreProvider> above the app must win over the built-in
  // default; with neither prop nor provider this resolves to the browser
  // store (the context's default value).
  const ambientStore = usePlanStore()
  const store = planStore ?? ambientStore
  const location = useLocation()
  // The full route table — <Routes> is exactly useRoutes over its children,
  // so composing the exported groups this way renders identically.
  const routeTree = useRoutes([
    ...plannerHomeRoutes,
    ...plannerWorkspaceRoutes,
    ...plannerContentRoutes,
    plannerNotFoundRoute,
  ])
  const isLanding = location.pathname === '/' || location.pathname === '/examples'
  // Reading routes: the shell narrows to the page's own measure so the header's
  // brand sits on the same left edge as the page's H1 (#443). The Learn home,
  // Disclaimer, and How-tested are 48rem columns; Learn articles, the glossary,
  // and the sources page use the tighter 42rem reading measure (learn.css).
  const isReadingNarrow = location.pathname.startsWith('/learn/')
  const isReading =
    !isReadingNarrow &&
    (location.pathname === '/learn' || location.pathname === '/disclaimer' || location.pathname === '/how-tested')
  // How-tested is reached from Disclaimer and has no nav item of its own, so
  // Disclaimer stays the active place while it is open (#419). NavLink only
  // sets aria-current for its own route match, hence a plain Link below.
  const disclaimerActive = ['/disclaimer', '/how-tested'].some(
    (p) => location.pathname === p || location.pathname.startsWith(`${p}/`),
  )
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode)
  const isFirstRoute = useRef(true)

  // Page identity: retitle the tab per route (plan routes retitle themselves in
  // PlanWorkspace with the plan name) and move focus to the main landmark on
  // SPA navigation so screen readers hear the new page instead of silence.
  // `/` is set immediately — do not leave the previous route title up while
  // the home skeleton waits on IndexedDB — then refined once the list returns.
  useEffect(() => {
    let cancelled = false
    if (!location.pathname.startsWith('/plan/')) {
      if (location.pathname === '/') {
        document.title = 'RetireGolden'
        void listPlansVia(store).then((summaries) => {
          if (!cancelled && summaries.length > 0) {
            document.title = 'Your plans · RetireGolden'
          }
        })
      } else {
        const title = routeTitleOf(location.pathname)
        document.title = title ? `${title} · RetireGolden` : 'RetireGolden'
        const slug = learnArticleSlugOf(location.pathname)
        if (slug) {
          // Article names live in the Learning Center registry, which stays
          // out of the landing chunk; the generic Learning Center title holds
          // until it loads. An unknown slug keeps that title (the route
          // renders "Article not found").
          void import('./learn/learningRegistry').then((m) => {
            const article = m.getArticle(slug)
            if (!cancelled && article) document.title = `${article.title} · RetireGolden`
          })
        }
      }
    }
    if (isFirstRoute.current) {
      // Initial load: the browser's own focus/scroll behavior is correct.
      isFirstRoute.current = false
      return () => {
        cancelled = true
      }
    }
    document.getElementById('main-content')?.focus()
    return () => {
      cancelled = true
    }
  }, [location.pathname, store])

  useEffect(() => {
    const root = document.documentElement
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

    const applyTheme = () => {
      const nextResolvedTheme = getResolvedTheme(themeMode)

      root.dataset.theme = themeMode
      writeLocal(THEME_STORAGE_KEY, themeMode)
      themeColor?.setAttribute('content', nextResolvedTheme === 'dark' ? '#0e1116' : '#f4f6f8')
    }

    applyTheme()

    if (themeMode !== 'system' || typeof window.matchMedia !== 'function') return undefined

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [themeMode])

  return (
    <ImportAvailabilityProvider enabled={importEnabled} resolved={importResolved}>
      <PlanStoreProvider store={store} readOnly={readOnly}>
        <ReportBrandingContext.Provider value={reportBranding ?? null}>
          <div
            className={`app-shell planner-shell${isLanding ? ' app-shell--landing' : ''}${isReading ? ' app-shell--reading' : ''}${isReadingNarrow ? ' app-shell--reading-narrow' : ''}`}
          >
            <a className="skip-link" href="#main-content">
              Skip to content
            </a>
            <header className="app-header">
              {/* Mark + real wordmark text. The lockup PNGs bake the tagline in at
                  ~5–6px, which is illegible; do not restore those as the header
                  identity. The existing tagline copy lives in the first-run hero. */}
              <NavLink to="/" className="brand brand-logo-link" end aria-label="RetireGolden home">
                <img className="brand-mark" src="/favicon.svg" alt="" />
                <span className="brand-wordmark">RetireGolden</span>
              </NavLink>
              {/* No hamburger at any width (owner preference): on narrow screens the
                  nav shares the logo row and the theme switcher wraps below, keeping
                  visual order = DOM order = tab order. */}
              <div className="header-menu" id="header-menu">
                <nav className="nav" aria-label="Primary">
                  <NavLink to="/" className={navClass} end>
                    Planner
                  </NavLink>
                  <NavLink to="/examples" className={navClass}>
                    Examples
                  </NavLink>
                  <NavLink to="/learn" className={navClass}>
                    Learn
                  </NavLink>
                  <Link
                    to="/disclaimer"
                    className={navClass({ isActive: disclaimerActive })}
                    aria-current={disclaimerActive ? 'page' : undefined}
                  >
                    Disclaimer
                  </Link>
                </nav>
                <div className="theme-switcher-cluster">
                  <span className="theme-switcher-label" id="theme-switcher-label">
                    Theme
                  </span>
                  <div className="theme-switcher" role="group" aria-labelledby="theme-switcher-label">
                    {THEME_MODES.map((mode) => (
                      <button
                        key={mode}
                        className="theme-switcher-button"
                        type="button"
                        aria-pressed={themeMode === mode}
                        onClick={() => setThemeMode(mode)}
                      >
                        {mode[0].toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </header>
            <main className="app-main" id="main-content" tabIndex={-1}>
              <RouteErrorBoundary>{routeTree}</RouteErrorBoundary>
            </main>
            <footer className="app-footer">
              <span className="muted small">
                Educational only. Not tax, legal, financial, or medical advice. All data stays on this device.{' '}
                <NavLink to="/disclaimer">Full disclaimer</NavLink>
              </span>
            </footer>
          </div>
        </ReportBrandingContext.Provider>
      </PlanStoreProvider>
    </ImportAvailabilityProvider>
  )
}
