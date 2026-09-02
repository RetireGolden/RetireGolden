/**
 * A horizontally scrolling table wrap that keyboard and screen-reader users
 * can reach (#468, #480, #483): the `.year-table-wrap` chrome plus
 * `tabIndex=0` so arrow keys scroll it, and a `region` role with a name so
 * assistive tech announces what the scroller holds. The visible scroll cue
 * (edge shadows that appear only when there is more to see) is CSS on the
 * class, so every existing `.year-table-wrap` gets it; the focusability and
 * name are what this component adds. Use it for any wide table.
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

export function ScrollRegion({
  label,
  grow = false,
  className,
  style,
  children,
}: {
  /** Accessible name for the region, e.g. "Year-by-year table". */
  label: string
  /** Let the wrap grow with its rows instead of capping height and slicing a row (#468). */
  grow?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const classes = ['year-table-wrap', grow ? 'year-table-wrap--grow' : null, className].filter(Boolean).join(' ')
  const ref = useRef<HTMLDivElement>(null)
  // A tab stop only while there is something to scroll: a table that fits
  // its wrap would otherwise cost keyboard users an inert stop. Starts true
  // (server render and environments without ResizeObserver keep the stop)
  // and follows the measured overflow from then on.
  const [scrollable, setScrollable] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () =>
      setScrollable(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    for (const child of el.children) observer.observe(child)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={classes}
      style={style}
      role="region"
      aria-label={label}
      tabIndex={scrollable ? 0 : undefined}
    >
      {children}
    </div>
  )
}
