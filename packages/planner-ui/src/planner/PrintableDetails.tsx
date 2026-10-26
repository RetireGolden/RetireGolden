import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react'

/** Native disclosure on screen; complete content on paper, with state restored. */
export function PrintableDetails(props: ComponentPropsWithoutRef<'details'>) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const details = ref.current
    if (!details) return
    let wasOpen: boolean | null = null
    const expand = () => {
      if (wasOpen === null) wasOpen = details.open
      details.open = true
    }
    const restore = () => {
      if (wasOpen !== null) details.open = wasOpen
      wasOpen = null
    }
    window.addEventListener('beforeprint', expand)
    window.addEventListener('afterprint', restore)
    return () => {
      restore()
      window.removeEventListener('beforeprint', expand)
      window.removeEventListener('afterprint', restore)
    }
  }, [])
  return <details {...props} ref={ref} />
}
