/** Accessible modal dialog: backdrop + Escape close, focus moved on open. */

import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

export interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** Max width CSS value (default 36rem). */
  width?: string
  /** Element to focus when the dialog opens (defaults to the panel itself). */
  initialFocus?: RefObject<HTMLElement | null>
}

export function Modal({ title, onClose, children, width, initialFocus }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    ;(initialFocus?.current ?? panelRef.current)?.focus()

    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null || el === document.activeElement)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      // Keep Tab focus cycling within the dialog.
      const items = focusable()
      if (items.length === 0) {
        e.preventDefault()
        panelRef.current?.focus()
        return
      }
      const first = items[0]!
      const last = items[items.length - 1]!
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      // Return focus to whatever opened the dialog.
      previouslyFocused?.focus?.()
    }
  }, [onClose, initialFocus])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
        style={width ? { maxWidth: width } : undefined}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="btn-ghost modal-close" onClick={onClose} aria-label="Close dialog">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
