/**
 * What the load changed in the stored plan, for the workspace notice.
 *
 * A context of its own rather than a field on `PlanContextValue`: this is a
 * one-shot fact about the document as it was FOUND, it is dead the moment the
 * household dismisses it, and nothing that edits or saves a plan reads it. The
 * plan context is the editing contract, and the same separation the read-only
 * and privacy flags already use applies here.
 *
 * The default is an empty list, so any subtree mounted without the provider (a
 * host embedding a page directly, a component test) shows no notice, which is
 * the truthful answer when nothing said a repair happened.
 */

import { createContext, useContext } from 'react'

import type { PlanLoadRepair } from '@retiregolden/engine/model/migrations'

export interface PlanRepairNoticeValue {
  /** Repairs the load reported, in the engine's stored-account order. */
  repairs: readonly PlanLoadRepair[]
  /** Close the notice for the rest of this visit to the plan. */
  dismiss: () => void
}

const EMPTY: PlanRepairNoticeValue = { repairs: [], dismiss: () => undefined }

export const PlanRepairCtx = createContext<PlanRepairNoticeValue>(EMPTY)

export function usePlanRepairs(): PlanRepairNoticeValue {
  return useContext(PlanRepairCtx)
}
