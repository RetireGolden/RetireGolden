/**
 * In-app replacements for window.confirm / window.prompt / window.alert,
 * built on the shared focus-managed Modal. `useDialogs()` returns
 * promise-based openers so call sites keep their imperative shape:
 *
 *   const { confirm, dialogs } = useDialogs()
 *   ...
 *   if (!(await confirm({ title: 'Delete plan', body: '...' }))) return
 *
 * Render `dialogs` once in the owning component. Escape, backdrop click,
 * and Cancel all resolve to the "did nothing" value (false / null).
 */

import { useCallback, useRef, useState, type ReactNode } from 'react'

import {
  AlertDialog,
  ChoiceDialog,
  ConfirmDialog,
  PromptDialog,
  type AlertOptions,
  type ChoiceOptions,
  type ConfirmOptions,
  type PromptOptions,
} from './dialogViews'

export type { AlertOptions, ChoiceOption, ChoiceOptions, ConfirmOptions, PromptOptions } from './dialogViews'

type ActiveDialog =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: 'prompt'; opts: PromptOptions; resolve: (value: string | null) => void }
  | { kind: 'alert'; opts: AlertOptions; resolve: () => void }
  | { kind: 'choice'; opts: ChoiceOptions<string>; resolve: (value: string | null) => void }

export function useDialogs() {
  const [active, setActive] = useState<ActiveDialog | null>(null)
  // Synchronous mirror of `active`: a second dialog requested while one is
  // open must not clobber it (that would strand the first Promise forever),
  // so re-entrant calls resolve immediately to their "did nothing" value.
  const activeRef = useRef<ActiveDialog | null>(null)

  const open = useCallback((dialog: ActiveDialog): boolean => {
    if (activeRef.current) return false
    activeRef.current = dialog
    setActive(dialog)
    return true
  }, [])

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        if (!open({ kind: 'confirm', opts, resolve })) resolve(false)
      }),
    [open],
  )
  const prompt = useCallback(
    (opts: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        if (!open({ kind: 'prompt', opts, resolve })) resolve(null)
      }),
    [open],
  )
  const alert = useCallback(
    (opts: AlertOptions) =>
      new Promise<void>((resolve) => {
        if (!open({ kind: 'alert', opts, resolve })) resolve()
      }),
    [open],
  )
  const choice = useCallback(
    <T extends string>(opts: ChoiceOptions<T>) =>
      new Promise<T | null>((resolve) => {
        const opened = open({
          kind: 'choice',
          opts: opts as ChoiceOptions<string>,
          resolve: resolve as (value: string | null) => void,
        })
        if (!opened) resolve(null)
      }),
    [open],
  )

  let dialogs: ReactNode = null
  if (active) {
    const close = () => {
      activeRef.current = null
      setActive(null)
    }
    if (active.kind === 'confirm') {
      dialogs = (
        <ConfirmDialog
          opts={active.opts}
          onResult={(ok) => {
            close()
            active.resolve(ok)
          }}
        />
      )
    } else if (active.kind === 'prompt') {
      dialogs = (
        <PromptDialog
          opts={active.opts}
          onResult={(value) => {
            close()
            active.resolve(value)
          }}
        />
      )
    } else if (active.kind === 'alert') {
      dialogs = (
        <AlertDialog
          opts={active.opts}
          onResult={() => {
            close()
            active.resolve()
          }}
        />
      )
    } else {
      dialogs = (
        <ChoiceDialog
          opts={active.opts}
          onResult={(value) => {
            close()
            active.resolve(value)
          }}
        />
      )
    }
  }

  return { confirm, prompt, alert, choice, dialogs }
}
