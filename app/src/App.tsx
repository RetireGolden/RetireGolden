import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { PlanPickerPage } from './planner/PlanPickerPage'
import { DisclaimerPage } from './planner/DisclaimerPage'
import { RouteErrorBoundary } from './RouteErrorBoundary.tsx'
import { RouteFallback } from './routes/RouteFallback'
import { readLocal, STORAGE_KEYS, writeLocal } from './data/localStore'
import './planner/planner.css'

const PlanRoutes = lazy(() => import('./routes/PlanRoutes'))
const LearnRoutes = lazy(() => import('./routes/LearnRoutes'))
// Lazy like /plan and /learn: Examples pulls in all example builders + the Zod
// schema, Compare pulls in the whole engine via projectPlan — eager imports
// here would drag both into the landing entry chunk.
const ExamplesPage = lazy(() => import('./planner/examples/ExamplesPage').then((m) => ({ default: m.ExamplesPage })))
const ComparePlansPage = lazy(() => import('./planner/ComparePlansPage').then((m) => ({ default: m.ComparePlansPage })))
// Lazy so the glob-derived test-suite manifests it embeds stay out of the landing chunk.
const HowTestedPage = lazy(() => import('./planner/HowTestedPage').then((m) => ({ default: m.HowTestedPage })))
// Lazy: the import wizard pulls in the per-source mappers and the Zod schema.
const ImportPage = lazy(() => import('./import/ImportPage').then((m) => ({ default: m.ImportPage })))

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

export function App() {
  const location = useLocation()
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
        <RouteErrorBoundary>
          <Routes>
            <Route path="/" element={<PlanPickerPage />} />
            <Route
              path="/examples"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <ExamplesPage />
                </Suspense>
              }
            />
            <Route
              path="/compare"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <ComparePlansPage />
                </Suspense>
              }
            />
            <Route
              path="/plan/*"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <PlanRoutes />
                </Suspense>
              }
            />
            <Route
              path="/learn/*"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <LearnRoutes />
                </Suspense>
              }
            />
            <Route
              path="/import"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <ImportPage />
                </Suspense>
              }
            />
            <Route path="/disclaimer" element={<DisclaimerPage />} />
            <Route
              path="/how-tested"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <HowTestedPage />
                </Suspense>
              }
            />
            {/* Retired v1 routes now redirect into the planner. */}
            <Route path="/legacy" element={<Navigate to="/" replace />} />
            <Route path="/longevity" element={<Navigate to="/" replace />} />
            <Route path="/social-security" element={<Navigate to="/" replace />} />
          </Routes>
        </RouteErrorBoundary>
      </main>
      <footer className="app-footer">
        <span className="muted small">
          Educational only — not tax, legal, financial, or medical advice. All data stays on this device.{' '}
          <NavLink to="/disclaimer">Full disclaimer</NavLink>
        </span>
      </footer>
    </div>
  )
}
