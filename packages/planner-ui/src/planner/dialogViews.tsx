/**
 * The dialog bodies used by useDialogs (./dialogs.tsx): confirm (with an
 * optional typed-confirmation gate for unrecoverable actions), prompt, alert,
 * and a multi-option choice — all rendered on the shared focus-managed Modal.
 */

import { useId, useRef, useState, type ReactNode } from 'react'

import { Modal } from './Modal'

export interface ConfirmOptions {
  title: string
  body: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Style the confirm button as destructive. */
  danger?: boolean
  /**
   * Require typing this word (case-insensitive) before the confirm button
   * enables — for unrecoverable actions like clearing all local data.
   */
  typedConfirmation?: string
  /** Optional side action shown with the buttons (e.g. "Download backup"). Does not close the dialog. */
  extraAction?: { label: string; onClick: () => void }
}

export interface PromptOptions {
  title: string
  label: string
  defaultValue?: string
  confirmLabel?: string
  cancelLabel?: string
}

export interface AlertOptions {
  title: string
  body: ReactNode
  closeLabel?: string
}

export interface ChoiceOption<T extends string> {
  value: T
  label: string
  /** Explanatory line under the button label. */
  description?: string
}

export interface ChoiceOptions<T extends string> {
  title: string
  body: ReactNode
  choices: ReadonlyArray<ChoiceOption<T>>
}

export function ConfirmDialog({ opts, onResult }: { opts: ConfirmOptions; onResult: (ok: boolean) => void }) {
  const [typed, setTyped] = useState('')
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const gate = opts.typedConfirmation
  const ready = !gate || typed.trim().toLowerCase() === gate.toLowerCase()
  return (
    <Modal title={opts.title} onClose={() => onResult(false)} initialFocus={gate ? inputRef : undefined}>
      <div className="dialog-body">{opts.body}</div>
      {gate ? (
        <div className="field dialog-typed-field">
          <label className="field-label" htmlFor={inputId}>
            Type <strong>{gate}</strong> to confirm
          </label>
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={typed}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
      ) : null}
      <div className="dialog-actions">
        {opts.extraAction ? (
          <button type="button" className="btn btn-secondary dialog-extra-action" onClick={opts.extraAction.onClick}>
            {opts.extraAction.label}
          </button>
        ) : null}
        <button type="button" className="btn btn-secondary" onClick={() => onResult(false)}>
          {opts.cancelLabel ?? 'Cancel'}
        </button>
        <button
          type="button"
          className={opts.danger ? 'btn btn-secondary btn-danger' : 'btn btn-primary'}
          disabled={!ready}
          onClick={() => onResult(true)}
        >
          {opts.confirmLabel ?? 'OK'}
        </button>
      </div>
    </Modal>
  )
}

export function PromptDialog({ opts, onResult }: { opts: PromptOptions; onResult: (value: string | null) => void }) {
  const [value, setValue] = useState(opts.defaultValue ?? '')
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <Modal title={opts.title} onClose={() => onResult(null)} initialFocus={inputRef}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onResult(value)
        }}
      >
        <div className="field">
          <label className="field-label" htmlFor={inputId}>
            {opts.label}
          </label>
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={value}
            autoComplete="off"
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={() => onResult(null)}>
            {opts.cancelLabel ?? 'Cancel'}
          </button>
          <button type="submit" className="btn btn-primary">
            {opts.confirmLabel ?? 'OK'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function AlertDialog({ opts, onResult }: { opts: AlertOptions; onResult: () => void }) {
  return (
    <Modal title={opts.title} onClose={onResult}>
      <div className="dialog-body">{opts.body}</div>
      <div className="dialog-actions">
        <button type="button" className="btn btn-primary" onClick={onResult}>
          {opts.closeLabel ?? 'Close'}
        </button>
      </div>
    </Modal>
  )
}

export function ChoiceDialog({
  opts,
  onResult,
}: {
  opts: ChoiceOptions<string>
  onResult: (value: string | null) => void
}) {
  return (
    <Modal title={opts.title} onClose={() => onResult(null)}>
      <div className="dialog-body">{opts.body}</div>
      <div className="dialog-choices">
        {opts.choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            className="dialog-choice"
            aria-label={choice.description ? `${choice.label} — ${choice.description}` : choice.label}
            onClick={() => onResult(choice.value)}
          >
            <span className="dialog-choice-label">{choice.label}</span>
            {choice.description ? <span className="dialog-choice-desc">{choice.description}</span> : null}
          </button>
        ))}
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={() => onResult(null)}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}
