/**
 * Shared form fields. Numeric fields hold local text state while focused and
 * commit parsed values on change, so partial input ("1,2") never fights the
 * plan state; money fields accept "$450k"-style shorthand. A money field
 * opens empty (or selected) so typing replaces the formatted value instead
 * of appending into it; a doubled Chromium insertReplacementText (450→450450)
 * is treated as a full-field replace, while a partial selection keeps the
 * input's target value.
 * Date fields cap the year segment at 4 digits.
 */

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import { LearnLink, type LearnHook } from '../learn/LearnLink'
import { capIsoDateYear, editingMoneyText, nextMoneyFieldText } from './fieldInput'
import { fmtMoney, parseAmount } from './format'

/** External citation shown inside a ⓘ help bubble (cite-the-authority pattern). */
export interface SourceLink {
  /** Link text, e.g. the publisher ("IRS", "CMS"). */
  label: string
  url: string
}

interface BaseProps {
  label: string
  /** Short inline note shown below the field — only for things that change what you type. */
  hint?: string
  /** Longer explanation behind an ⓘ help button (hover/focus/click). Prefer this over hint for background detail. */
  help?: string
  /** Optional "Learn more" link to a Learning Center article, shown inside the ⓘ help bubble. */
  learn?: LearnHook
  /** Optional citation to the authority behind the parameter (Rev. Proc. / statute / agency figure). */
  source?: SourceLink
}

/**
 * The one help affordance on a label: a single ⓘ button that, on hover/focus,
 * reveals a bubble holding the field's explanation, any short input note, and —
 * when the concept has a durable article — a "Learn more" link. All field help
 * lives in this bubble, so labels never carry separate sub-text under the input.
 *
 * It is an accessible disclosure, not a passive tooltip, because the bubble can
 * hold an interactive link: hover or keyboard-focus reveals it, clicking pins it
 * open (for touch and to reach the link), and Escape or an outside click closes
 * a pinned bubble. The bubble is positioned with fixed coordinates clamped to
 * the viewport, so it never clips at a screen edge or inside a scrolling panel.
 */
export function HelpTip({ text, hint, learn, source, id }: { text?: string; hint?: string; learn?: LearnHook; source?: SourceLink; id?: string }) {
  const auto = useId()
  const bubbleId = id ?? `${auto}-help`
  const textId = `${bubbleId}-text`
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [pinned, setPinned] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const bubbleRef = useRef<HTMLSpanElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const open = hovered || focused || pinned

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = undefined
  }
  // Brief delay so the pointer can cross the gap from the ⓘ into the bubble.
  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => setHovered(false), 120)
  }

  // Position the open bubble by the ⓘ, clamped to the viewport (flipping below
  // when there's no room above), and keep it tracking on scroll/resize. Written
  // imperatively (not via state) so it lands before paint with no extra render.
  useLayoutEffect(() => {
    if (!open) return
    const bubble = bubbleRef.current
    const button = btnRef.current
    if (!bubble || !button) return
    const place = () => {
      const btn = button.getBoundingClientRect()
      const bub = bubble.getBoundingClientRect()
      const margin = 8
      const left = Math.max(
        margin,
        Math.min(btn.left + btn.width / 2 - bub.width / 2, window.innerWidth - bub.width - margin),
      )
      const above = btn.top - bub.height - margin
      bubble.style.left = `${left}px`
      bubble.style.top = `${above >= margin ? above : btn.bottom + margin}px`
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, text, hint])

  // Close a pinned bubble on Escape or a click outside.
  useEffect(() => {
    if (!pinned) return
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!wrapRef.current?.contains(t) && !bubbleRef.current?.contains(t)) setPinned(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPinned(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [pinned])

  return (
    <span
      className={pinned ? 'help-tip help-tip--pinned' : 'help-tip'}
      ref={wrapRef}
      onMouseEnter={() => {
        cancelClose()
        setHovered(true)
      }}
      onMouseLeave={scheduleClose}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
      }}
    >
      <button
        ref={btnRef}
        type="button"
        aria-label="More information"
        aria-describedby={text || hint ? textId : undefined}
        aria-expanded={pinned}
        aria-controls={bubbleId}
        // Prevent the surrounding <label> (e.g. CheckboxField) from toggling its control.
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setPinned((p) => !p)
        }}
      >
        i
      </button>
      <span
        ref={bubbleRef}
        className={open ? 'help-tip-bubble help-tip-bubble--open' : 'help-tip-bubble'}
        id={bubbleId}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
      >
        {text || hint ? (
          <span id={textId} className="help-tip-text">
            {text}
            {text && hint ? <span className="help-tip-hint">{hint}</span> : hint}
          </span>
        ) : null}
        {source ? (
          <a className="help-tip-source" href={source.url} target="_blank" rel="noopener noreferrer">
            Source: {source.label} ↗
          </a>
        ) : null}
        {learn ? <LearnLink {...learn} variant="tip" /> : null}
      </span>
    </span>
  )
}

export function ReadonlyField({ label, help, learn, value }: BaseProps & { value: ReactNode }) {
  const id = useId()
  return (
    <div className="field">
      <span className="field-label-row">
        <span className="field-label" id={id}>
          {label}
        </span>
        {help || learn ? <HelpTip text={help} learn={learn} id={`${id}-help`} /> : null}
      </span>
      <p className="field-readonly" aria-labelledby={id}>
        {value}
      </p>
    </div>
  )
}

function FieldShell({ label, hint, help, learn, source, id, children }: BaseProps & { id: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label-row">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        {help || hint || learn || source ? <HelpTip text={help} hint={hint} learn={learn} source={source} id={`${id}-help`} /> : null}
      </span>
      {children}
    </div>
  )
}

interface NumericProps extends BaseProps {
  value: number | null
  onCommit: (value: number | null) => void
  /** When false (default for most), clearing the field commits 0 instead of null. */
  allowNull?: boolean
}

interface MoneyFieldProps extends NumericProps {
  onInvalid?: () => void
  /** Omit for the existing whole-dollar display; use 2 for exact-cent inputs. */
  fractionDigits?: 0 | 2
}

function useLocalText(formatted: string) {
  const [text, setText] = useState(formatted)
  const [focused, setFocused] = useState(false)
  // Derived-state-during-render: adopt the external value unless the user is typing.
  const [prevFormatted, setPrevFormatted] = useState(formatted)
  if (formatted !== prevFormatted) {
    setPrevFormatted(formatted)
    if (!focused) setText(formatted)
  }
  return { text, setText, focused, setFocused }
}

export function MoneyField({
  label,
  hint,
  help,
  learn,
  source,
  value,
  onCommit,
  allowNull,
  onInvalid,
  fractionDigits,
}: MoneyFieldProps) {
  const id = useId()
  const formatted = value === null
    ? ''
    : fractionDigits === undefined
      ? fmtMoney(value)
      : value.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: fractionDigits,
        })
  const { text, setText, focused, setFocused } = useLocalText(formatted)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectOnFocus = useRef(false)
  const commitText = (next: string) => {
    setText(next)
    const parsed = parseAmount(next)
    if (parsed !== null) onCommit(parsed)
    else if (next.trim() === '') onCommit(allowNull ? null : 0)
    else onInvalid?.()
  }
  useLayoutEffect(() => {
    if (!selectOnFocus.current) return
    selectOnFocus.current = false
    inputRef.current?.select()
  }, [focused, text])
  return (
    <FieldShell label={label} hint={hint} help={help} learn={learn} source={source} id={id}>
      <div className="input-affix">
        <span aria-hidden>$</span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault()
          }}
          value={text.replace(/^\$/, '')}
          onFocus={() => {
            setFocused(true)
            setText(editingMoneyText(value))
            selectOnFocus.current = true
          }}
          onBlur={() => {
            setFocused(false)
            setText(formatted)
          }}
          onChange={(e) => {
            const native = e.nativeEvent as InputEvent
            commitText(
              nextMoneyFieldText({
                targetValue: e.target.value,
                inputType: native.inputType,
                data: native.data,
              }),
            )
          }}
        />
      </div>
    </FieldShell>
  )
}

export function NumberField({
  label,
  hint,
  help,
  learn,
  source,
  value,
  onCommit,
  allowNull,
  suffix,
  step,
  min,
  max,
}: NumericProps & { suffix?: string; step?: number; min?: number; max?: number }) {
  const id = useId()
  const { text, setText, setFocused } = useLocalText(value === null ? '' : String(value))
  // The suffix names the unit ("%"); it is the input's description, not
  // decoration, so a screen reader announces "22, percent" and not just "22".
  const suffixId = suffix ? `${id}-unit` : undefined
  const input = (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      value={text}
      step={step}
      min={min}
      max={max}
      aria-describedby={suffixId}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value.trim() === '') onCommit(allowNull ? null : 0)
        else if (Number.isFinite(n)) onCommit(n)
      }}
    />
  )
  return (
    <FieldShell label={label} hint={hint} help={help} learn={learn} source={source} id={id}>
      {suffix ? (
        <div className="input-affix">
          {input}
          <span id={suffixId}>{suffix}</span>
        </div>
      ) : (
        input
      )}
    </FieldShell>
  )
}

export function PercentField(props: NumericProps & { step?: number; min?: number; max?: number }) {
  return <NumberField {...props} suffix="%" step={props.step ?? 0.1} />
}

export function TextField({
  label,
  hint,
  help,
  learn,
  source,
  value,
  onCommit,
}: BaseProps & { value: string; onCommit: (v: string) => void }) {
  const id = useId()
  return (
    <FieldShell label={label} hint={hint} help={help} learn={learn} source={source} id={id}>
      <input id={id} type="text" value={value} onChange={(e) => onCommit(e.target.value)} />
    </FieldShell>
  )
}

export function DateField({
  label,
  hint,
  help,
  learn,
  source,
  value,
  onCommit,
}: BaseProps & { value: string; onCommit: (v: string) => void }) {
  const id = useId()
  return (
    <FieldShell label={label} hint={hint} help={help} learn={learn} source={source} id={id}>
      <input
        id={id}
        type="date"
        min="1900-01-01"
        max="9999-12-31"
        value={capIsoDateYear(value)}
        onChange={(e) => onCommit(capIsoDateYear(e.target.value))}
      />
    </FieldShell>
  )
}

export function SelectField<T extends string>({
  label,
  hint,
  help,
  learn,
  source,
  value,
  options,
  onCommit,
  describedBy,
  placeholder,
}: BaseProps & {
  /** `''` renders the placeholder (when given) as an explicit not-yet-answered state. */
  value: T | ''
  options: ReadonlyArray<{ value: T; label: string }>
  onCommit: (v: T) => void
  /** id of visible text outside the field (e.g. a card hint) that describes the current selection. */
  describedBy?: string
  /**
   * A must-answer select with no safe default: shown as a disabled first
   * option while value is `''`, so the field starts visibly unanswered
   * instead of silently prefilling — a missed selection then fails loudly at
   * validation rather than committing whatever the default happened to be.
   */
  placeholder?: string
}) {
  const id = useId()
  return (
    <FieldShell label={label} hint={hint} help={help} learn={learn} source={source} id={id}>
      <select
        id={id}
        value={value}
        required={placeholder !== undefined}
        aria-describedby={describedBy}
        title={options.find((o) => o.value === value)?.label ?? placeholder}
        onChange={(e) => {
          const v = e.target.value
          // With a placeholder, '' is the disabled not-yet-answered option —
          // never a committable choice. Without one, '' can be a real option
          // value (e.g. "Default (by account type)") and must commit as usual.
          if (placeholder !== undefined && v === '') return
          onCommit(v as T)
        }}
      >
        {placeholder !== undefined ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

export function CheckboxField({
  label,
  hint,
  help,
  learn,
  source,
  value,
  onCommit,
}: BaseProps & { value: boolean; onCommit: (v: boolean) => void }) {
  const id = useId()
  return (
    <div className="field field--checkbox">
      <span className="field-label-row">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        {help || hint || learn || source ? <HelpTip text={help} hint={hint} learn={learn} source={source} id={`${id}-help`} /> : null}
      </span>
      <input id={id} type="checkbox" checked={value} onChange={(e) => onCommit(e.target.checked)} />
    </div>
  )
}
