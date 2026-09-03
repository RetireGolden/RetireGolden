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

import { boundsForPath, checkRange, nativeMax, nativeMin, notKeptNote, type SchemaBounds } from './schemaBounds'
import { useFieldIssue } from './useFieldIssue'
import { warningFor } from './warnings'

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
  /**
   * Schema path of the value this field edits (`strategies.qcdAnnual`,
   * `incomes.0.endAge`). When the engine rejects the plan at that path, the
   * field shows the issue inline instead of leaving it to a card-level list.
   */
  path?: string
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
      // The sticky KPI bar owns the top of the viewport inside a plan; a bubble
      // that would open under it flips below its trigger instead (#469). The
      // bar is a sibling of the workspace outlet, so walk up to the nearest
      // ancestor that contains one rather than assuming where it sits.
      let scope: HTMLElement | null = button.parentElement
      while (scope && !scope.querySelector('.kpi-bar')) scope = scope.parentElement
      const barBottom = scope?.querySelector('.kpi-bar')?.getBoundingClientRect().bottom ?? 0
      const minTop = Math.max(margin, barBottom + margin)
      const above = btn.top - bub.height - margin
      bubble.style.left = `${left}px`
      bubble.style.top = `${above >= minTop ? above : btn.bottom + margin}px`
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
  // A caption and a value: no input chrome, so it never looks editable
  // (#462), and no <label> or <output>, since neither fits a value that is
  // not a control and <output> is an implicit live region that would announce
  // every recalculation (review of #532).
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

function FieldShell({
  label,
  hint,
  help,
  learn,
  source,
  id,
  error,
  note,
  warning,
  wide,
  children,
}: BaseProps & {
  id: string
  error?: string | null
  note?: string | null
  warning?: string | null
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={['field', wide ? 'field--wide' : null, error ? 'field--invalid' : null].filter(Boolean).join(' ')}>
      {/* .field--invalid tints the caption; the control itself carries aria-invalid. */}
      <span className="field-label-row">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        {help || hint || learn || source ? <HelpTip text={help} hint={hint} learn={learn} source={source} id={`${id}-help`} /> : null}
      </span>
      {children}
      {/* The message the input's aria-describedby points at; rendered only
          while there is one, so nothing announces on a valid field. */}
      {error ? (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
      {/* What the field did with an entry it did not keep ("Not kept: 150 is
          above the highest allowed, 120"). It is described, not an error: the
          value the plan holds is valid, so the control does not stay
          aria-invalid and the save chip's jump does not land on it (#476, #494). */}
      {!error && note ? (
        // A status: the note appears after focus has already moved on (a
        // blur wrote it), so it has to announce itself to be heard.
        <p className="field-note" id={`${id}-note`} role="status">
          {note}
        </p>
      ) : null}
      {/* A value the engine accepts that is almost certainly not what was
          meant (#495 decisions D1, D2, D3, D7 and the past-year half of D4).
          The plan holds it: nothing is refused, the control never goes
          aria-invalid, and this is a status rather than an error. It reads in
          the warn token like a `callout--warn`, one step down from
          `.field-error`'s danger token. */}
      {!error && !note && warning ? (
        <p className="field-warning" id={`${id}-warning`} role="status">
          {warning}
        </p>
      ) : null}
    </div>
  )
}

/** aria-describedby from the ids that exist. */
function describedBy(...ids: Array<string | undefined | false | null>): string | undefined {
  const list = ids.filter((x): x is string => typeof x === 'string' && x !== '')
  return list.length > 0 ? list.join(' ') : undefined
}

/** Control-level state a caller may set on an input field. */
interface ControlProps {
  /** Disable the control (the label and help stay readable). */
  disabled?: boolean
  /** Id of an element that describes the control, e.g. a note on why it is disabled. */
  describedBy?: string
}

interface NumericProps extends BaseProps, ControlProps {
  value: number | null
  onCommit: (value: number | null) => void
  /** When false (default for most), clearing the field commits 0 instead of null. */
  allowNull?: boolean
}

interface MoneyFieldProps extends NumericProps {
  onInvalid?: () => void
  /** Omit for the existing whole-dollar display; use 2 for exact-cent inputs. */
  fractionDigits?: 0 | 2
  /**
   * What a blank means, shown inside the empty box (e.g. "No floor") so an
   * optional field never reads as a value that failed to render (#518).
   */
  placeholder?: string
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
  path,
  value,
  onCommit,
  allowNull,
  onInvalid,
  fractionDigits,
  placeholder,
  disabled,
  describedBy: describedById,
}: MoneyFieldProps) {
  const id = useId()
  // The engine's range for this path, so a money field refuses what the schema
  // forbids instead of storing it and reporting it afterwards (r3-2). Nothing
  // here invents a limit: an unwired money field (the import wizard, a lever)
  // has no bounds and commits as before.
  const bounds = boundsForPath(path)
  const [rangeError, setRangeError] = useState<string | null>(null)
  const [notKept, setNotKept] = useState<string | null>(null)
  const issue = useFieldIssue(path)
  const error = rangeError ?? issue?.advice ?? null
  // Read from the value the plan holds, not the text being typed, so the note
  // is about what was stored rather than a keystroke on the way there.
  const warning = warningFor(path, value)
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
    setNotKept(null)
    const parsed = parseAmount(next)
    if (parsed !== null) {
      const { message } = checkRange(parsed, bounds)
      // Flag it and commit nothing: the same rule the number fields follow, so
      // an amount the engine would reject never reaches the plan.
      setRangeError(message)
      if (message === null) onCommit(parsed)
      return
    }
    setRangeError(null)
    if (next.trim() === '') onCommit(allowNull ? null : 0)
    else onInvalid?.()
  }
  useLayoutEffect(() => {
    if (!selectOnFocus.current) return
    selectOnFocus.current = false
    inputRef.current?.select()
  }, [focused, text])
  return (
    <FieldShell label={label} hint={hint} help={help} learn={learn} source={source} id={id} error={error} note={notKept} warning={warning}>
      <div className={placeholder !== undefined ? 'input-affix input-affix--optional' : 'input-affix'}>
        {/* A blank optional field is a non-amount state, so the unit chip steps
            back for as long as the placeholder is showing, focused or not; it
            returns with the first typed character (#518). */}
        <span aria-hidden className={placeholder !== undefined && text.replace(/^\$/, '') === '' ? 'input-affix-unit--blank' : undefined}>
          $
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(
            describedById,
            error ? `${id}-error` : notKept ? `${id}-note` : warning && `${id}-warning`,
          )}
          data-path={path}
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
            // An amount outside the engine's range is not kept: the plan's own
            // value comes back and a note says what the field allows.
            const parsed = parseAmount(text)
            const { side } = parsed === null ? { side: null } : checkRange(parsed, bounds)
            if (side !== null && parsed !== null) setNotKept(notKeptNote(String(parsed), side, bounds))
            setRangeError(null)
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
  path,
  value,
  onCommit,
  allowNull,
  suffix,
  step,
  min,
  max,
  disabled,
  describedBy: describedById,
}: NumericProps & { suffix?: string; step?: number; min?: number; max?: number }) {
  const id = useId()
  const { text, setText, setFocused } = useLocalText(value === null ? '' : String(value))
  // The range is the engine's, read from its schema by path (r3-3): a local
  // min/max could be tighter than what the engine allows and refuse a value it
  // would have accepted. The props remain for controls with no schema path
  // (the import wizard, the lever editors).
  const schema = boundsForPath(path)
  const bounds: SchemaBounds | null = schema ?? (min === undefined && max === undefined ? null : { min, max })
  // While typing, a value outside that range (or text that is not a number at
  // all) is flagged beside the field and commits nothing, so an intermediate
  // keystroke never stores a bound the person did not choose and the engine is
  // never handed an age or rate it cannot model (#476, #494). Leaving the
  // field does not clamp: the entry is not kept, the plan's value comes back,
  // and a note says what the field allows — a blur is often a Tab or the save
  // chip mid-edit, and "9" on the way to "95" must not become 60.
  const [rangeError, setRangeError] = useState<string | null>(null)
  const [adjustedNote, setAdjustedNote] = useState<string | null>(null)
  const issue = useFieldIssue(path)
  const error = rangeError ?? issue?.advice ?? null
  // Read from the value the plan holds, not the text being typed, so the note
  // is about what was stored rather than a keystroke on the way there.
  const warning = warningFor(path, value)
  const outOfRange = (n: number): 'low' | 'high' | null => checkRange(n, bounds).side
  // Clearing a required field commits 0 when 0 is a value the engine allows
  // here, which is the documented "off" state for the rate overrides and every
  // other zero-floored field. Where 0 is out of range (a claim age, a planning
  // age) there is nothing safe to commit, so the field says so and keeps what
  // the plan holds.
  const emptyCommitsZero = !allowNull && outOfRange(0) === null
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
      min={nativeMin(bounds)}
      max={nativeMax(bounds)}
      disabled={disabled}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(
        suffixId,
        describedById,
        error ? `${id}-error` : adjustedNote ? `${id}-note` : warning && `${id}-warning`,
      )}
      data-path={path}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        setFocused(false)
        const trimmed = text.trim()
        const n = Number(trimmed)
        const badInput = e.target.validity?.badInput === true
        if (trimmed === '' && badInput) {
          // Text the field could not parse: the plan kept its value, so show it.
          setText(value === null ? '' : String(value))
          setRangeError(null)
          return
        }
        if (trimmed === '' ? !allowNull && !emptyCommitsZero : !Number.isFinite(n)) {
          // Nothing was committed for non-numeric text ("1e", "-"), or for an
          // emptied field with no safe zero: show the value the plan kept.
          setText(value === null ? '' : String(value))
          setRangeError(null)
          return
        }
        const side = trimmed !== '' && Number.isFinite(n) ? outOfRange(n) : null
        if (side === null) {
          setRangeError(null)
          return
        }
        // Out of range on leaving: the entry is not kept and the plan's value
        // comes back, with a note naming the bound it missed.
        setText(value === null ? '' : String(value))
        setRangeError(null)
        setAdjustedNote(notKeptNote(trimmed, side, bounds))
      }}
      onChange={(e) => {
        setText(e.target.value)
        setAdjustedNote(null)
        const trimmed = e.target.value.trim()
        const n = Number(trimmed)
        // A number input reports text it cannot parse ("1e", "-", "1.2.3") as
        // an empty value with badInput set, so the two empty cases are told
        // apart by the browser's own flag rather than guessed at.
        const badInput = e.target.validity?.badInput === true
        if (trimmed === '' && badInput) {
          // Say so while the text is on screen, rather than letting it sit
          // there with no feedback until blur silently reverts it.
          setRangeError('Enter a number')
        } else if (trimmed === '') {
          setRangeError(null)
          if (allowNull) onCommit(null)
          else if (emptyCommitsZero) onCommit(0)
          else setRangeError('Enter a value')
        } else if (!Number.isFinite(n)) {
          setRangeError('Enter a number')
        } else {
          const { message } = checkRange(n, bounds)
          setRangeError(message)
          if (message === null) onCommit(n)
        }
      }}
    />
  )
  return (
    <FieldShell label={label} hint={hint} help={help} learn={learn} source={source} id={id} error={error} note={adjustedNote} warning={warning}>
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
  path,
  value,
  onCommit,
}: BaseProps & { value: string; onCommit: (v: string) => void }) {
  const id = useId()
  const error = useFieldIssue(path)?.advice ?? null
  return (
    <FieldShell label={label} hint={hint} help={help} learn={learn} source={source} id={id} error={error}>
      <input
        id={id}
        type="text"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(error && `${id}-error`)}
        data-path={path}
        onChange={(e) => onCommit(e.target.value)}
      />
    </FieldShell>
  )
}

export function DateField({
  label,
  hint,
  help,
  learn,
  source,
  path,
  value,
  onCommit,
  disabled,
  describedBy: describedById,
}: BaseProps & ControlProps & { value: string; onCommit: (v: string) => void }) {
  const id = useId()
  const error = useFieldIssue(path)?.advice ?? null
  return (
    <FieldShell label={label} hint={hint} help={help} learn={learn} source={source} id={id} error={error}>
      <input
        id={id}
        type="date"
        min="1900-01-01"
        max="9999-12-31"
        disabled={disabled}
        value={capIsoDateYear(value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(describedById, error && `${id}-error`)}
        data-path={path}
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
  path,
  value,
  options,
  onCommit,
  describedBy: describedById,
  placeholder,
  wide,
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
  /**
   * Span two form-grid columns. A select cannot wrap its options, so one
   * whose labels outrun a single column (Goal Flexibility, #465) takes two
   * beside its peers instead of clipping the selected label to an ellipsis.
   */
  wide?: boolean
}) {
  const id = useId()
  const error = useFieldIssue(path)?.advice ?? null
  return (
    <FieldShell label={label} hint={hint} help={help} learn={learn} source={source} id={id} error={error} wide={wide}>
      <select
        id={id}
        value={value}
        required={placeholder !== undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(describedById, error && `${id}-error`)}
        data-path={path}
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
