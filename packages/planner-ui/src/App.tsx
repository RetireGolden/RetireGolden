import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useRoutes } from 'react-router-dom'
import { RouteErrorBoundary } from './RouteErrorBoundary.tsx'
import { plannerContentRoutes, plannerHomeRoutes, plannerWorkspaceRoutes } from './routes/groups'
import { readLocal, STORAGE_KEYS, writeLocal } from './data/localStore'
import { usePlanStore, type PlanStore } from './data/planStoreContext'
import { PlanStoreProvider } from './data/PlanStoreProvider'
import { ReportBrandingContext } from './report/brandingContext'
import type { ReportBranding } from './report/reportHtml'
import './planner/planner.css'

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'nav-link nav-link--active' : 'nav-link'

/** Tab/history titles for non-plan routes; plan routes are owned by PlanWorkspace. */
const ROUTE_TITLES: ReadonlyArray<[prefix: string, title: string]> = [
  ['/examples', 'Examples'],
  ['/import', 'Import & migrate'],
  ['/compare', 'Compare plans'],
  ['/learn', 'Learn'],
  ['/disclaimer', 'Disclaimer'],
  ['/how-tested', 'How RetireGolden is tested'],
]

function routeTitleOf(pathname: string): string | null {
  if (pathname === '/') return 'Your plans'
  for (const [prefix, title] of ROUTE_TITLES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return title
  }
  return null
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
}

export function App({ reportBranding, planStore, readOnly }: PlannerAppProps = {}) {
  // An ambient <PlanStoreProvider> above the app must win over the built-in
  // default; with neither prop nor provider this resolves to the browser
  // store (the context's default value).
  const ambientStore = usePlanStore()
  const location = useLocation()
  // The full route table — <Routes> is exactly useRoutes over its children,
  // so composing the exported groups this way renders identically.
  const routeTree = useRoutes([...plannerHomeRoutes, ...plannerWorkspaceRoutes, ...plannerContentRoutes])
  const isLanding = location.pathname === '/' || location.pathname === '/examples'
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => getResolvedTheme(getInitialThemeMode()))
  const [logoLoadFailed, setLogoLoadFailed] = useState(false)
  const isFirstRoute = useRef(true)

  // Page identity: retitle the tab per route (plan routes retitle themselves in
  // PlanWorkspace with the plan name) and move focus to the main landmark on
  // SPA navigation so screen readers hear the new page instead of silence.
  useEffect(() => {
    if (!location.pathname.startsWith('/plan/')) {
      const title = routeTitleOf(location.pathname)
      document.title = title ? `${title} · RetireGolden` : 'RetireGolden'
    }
    if (isFirstRoute.current) {
      // Initial load: the browser's own focus/scroll behavior is correct.
      isFirstRoute.current = false
      return
    }
    document.getElementById('main-content')?.focus()
  }, [location.pathname])

  useEffect(() => {
    const root = document.documentElement
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

    const applyTheme = () => {
      const nextResolvedTheme = getResolvedTheme(themeMode)

      root.dataset.theme = themeMode
      setResolvedTheme(nextResolvedTheme)
      writeLocal(THEME_STORAGE_KEY, themeMode)
      themeColor?.setAttribute('content', nextResolvedTheme === 'dark' ? '#0e1116' : '#f4f6f8')
    }

    applyTheme()

    if (themeMode !== 'system' || typeof window.matchMedia !== 'function') return undefined

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [themeMode])

  const logoSrc = logoLoadFailed
    ? '/favicon.svg'
    : resolvedTheme === 'dark'
      ? '/brand/retiregolden-logo-lockup.png'
      : '/brand/retiregolden-logo-lockup-light.png'

  return (
    <PlanStoreProvider store={planStore ?? ambientStore} readOnly={readOnly}>
    <ReportBrandingContext.Provider value={reportBranding ?? null}>
    <div className={`app-shell planner-shell${isLanding ? ' app-shell--landing' : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <NavLink to="/" className="brand brand-logo-link" end aria-label="RetireGolden home">
          <picture>
            {/* Phones get the compact square mark; it's theme-independent and
                skips loading the lockup PNG on mobile. */}
            <source media="(max-width: 640px)" srcSet="/favicon.svg" />
            <img
              className="brand-logo"
              src={logoSrc}
              alt="RetireGolden"
              onError={() => setLogoLoadFailed(true)}
            />
          </picture>
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
            <NavLink to="/disclaimer" className={navClass}>
              Disclaimer
            </NavLink>
          </nav>
          <div className="theme-switcher" role="group" aria-label="Color theme">
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
      </header>
      <main className="app-main" id="main-content" tabIndex={-1}>
        <RouteErrorBoundary>{routeTree}</RouteErrorBoundary>
      </main>
      <footer className="app-footer">
        <span className="muted small">
          Educational only — not tax, legal, financial, or medical advice. All data stays on this device.{' '}
          <NavLink to="/disclaimer">Full disclaimer</NavLink>
        </span>
      </footer>
    </div>
    </ReportBrandingContext.Provider>
    </PlanStoreProvider>
  )
}
