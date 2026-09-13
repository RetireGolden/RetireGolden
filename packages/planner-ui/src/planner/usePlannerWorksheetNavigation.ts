import { useEffect } from 'react'
import { useLocation } from 'react-router'

// Deliberately scoped: Learn owns its article anchors, and ordinary planner
// navigation retains App's existing main-landmark focus behavior.
const WORKSHEET_HASH = '#state-tax-worksheet-facts'

export function usePlannerWorksheetNavigation(): void {
  const { pathname, hash, key } = useLocation()
  useEffect(() => {
    if (!/^\/plan\/[^/]+\/assumptions\/?$/.test(pathname) || hash !== WORKSHEET_HASH) return
    const focusWorksheet = () => {
      const target = document.getElementById(WORKSHEET_HASH.slice(1))
      if (!target) return false
      if (!target.hasAttribute('tabindex')) target.tabIndex = -1
      target.focus({ preventScroll: true })
      target.scrollIntoView({ block: 'start', behavior: 'instant' })
      return true
    }
    // The destination may be behind both a lazy route and an asynchronous plan
    // load. Observe its mount rather than relying on a fixed timeout.
    const observer = new MutationObserver(() => {
      if (focusWorksheet()) observer.disconnect()
    })
    observer.observe(document.getElementById('main-content') ?? document.body, { childList: true, subtree: true })
    if (focusWorksheet()) observer.disconnect()
    return () => observer.disconnect()
  }, [pathname, hash, key])
}
