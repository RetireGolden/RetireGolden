import { BRACKET_FILL_ROTH_WALKTHROUGH } from './bracketFillRoth.walkthrough'
import { EARLY_RETIREE_ACA_WALKTHROUGH } from './earlyRetireeAca.walkthrough'
import { RMD_IRMAA_WALKTHROUGH } from './rmdIrmaa.walkthrough'
import type { Walkthrough } from './walkthrough'

/**
 * Every published walkthrough, in page order. Each entry has a test file of
 * the same id in this directory (the engine's walkthrough census reads those
 * files' it() titles) and an evidence file DOCS/operations/walkthroughs/<id>.json
 * written by `pnpm walkthroughs:export` and held fresh by
 * walkthroughEvidence.test.ts.
 */
export const WALKTHROUGHS: readonly Walkthrough[] = [RMD_IRMAA_WALKTHROUGH, EARLY_RETIREE_ACA_WALKTHROUGH, BRACKET_FILL_ROTH_WALKTHROUGH]

export { runWalkthrough, type Walkthrough, type WalkthroughRow, type WalkthroughRowResult } from './walkthrough'
