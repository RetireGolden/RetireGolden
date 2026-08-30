/**
 * Published per-account and per-stream activity facts from the ledger's own
 * execution: inherited IRAs, Roth pools, the Form 8606 traditional aggregate,
 * qualified annuity payments, and Social Security streams.
 *
 * One slice of the projection type surface. `../../types.ts` re-exports every
 * slice, so `projection/types.js` stays the single public specifier for all of
 * them; the package export map blocks `projection/internal/*`, so this module
 * is not separately importable. Declarations and the commentary attached to
 * them were moved here verbatim, so a block that says "above" or "below" may
 * now point across a module boundary.
 */
/**
 * Per-account, per-year inherited-IRA execution evidence (WS4 exact ledger).
 * Regime law is produced solely by `classifyInheritedRegime` /
 * `inheritedRequirementForYear` in strategies/inheritedIra.ts — this surface
 * records what the ledger forced and what the planner took beyond that.
 */
export interface InheritedAccountYearEvidence {
  accountId: string
  /** The beneficiary person holding the account. */
  ownerPersonId: string
  /** InheritedRegimeKey | refusal key (e.g. legacy-planning-approximation). */
  regime: string
  matrixRow: string
  classification?: 'settled' | 'unsettled'
  /**
   * Present when the classifier refused (non-X1 → legacy fallback) OR when the
   * successor-clock / out-of-scope condition suppresses the schedule (matrix X2
   * beneficiary-death rows).
   */
  refusalReason?: string
  requirementKind: 'year-of-death-rmd' | 'annual-rmd' | 'none' | 'final-sweep' | 'legacy'
  /** Evidence amount on the real prior-Dec-31 balance (0 on the legacy path when forced is 0). */
  requiredAmount: number
  /** What the ledger actually forced (≤ live balance; entire balance on final-sweep). */
  executedRequiredAmount: number
  /** Planner draws beyond the requirement this year (need-based withdrawals). */
  voluntaryAmount: number
  divisor?: number
  divisorArm?: string
  noticeWaived?: boolean
  limitation?: string
  finalDeadlineYear?: number
  disclosures: string[]
  citations: string[]
}

/**
 * One owner's aggregated Roth-IRA pool activity for a projection year.
 *
 * Published fact from the ledger's own execution — the one-source-of-truth
 * channel for insight detectors. Consumers must not re-derive withdrawals or
 * credited contributions from plan schedules, household aggregates, or
 * `YearWithdrawals.roth` (which mixes inherited and employer Roth).
 */
export interface OwnedRothIraPoolActivity {
  /** Resolved owner id (`null` owner already resolves to the household primary). */
  ownerPersonId: string
  /**
   * Present when a pre-qualified-age withdrawal's assumed-zero counterfactual
   * would change tax/penalty: either the portion of assumed-seeded contribution
   * spill that lands on taxable/penalized remainders when walked FIFO through
   * post-draw conversion layers (seasoned and wholly nontaxable unseasoned
   * principal absorb without consequence; an unseasoned taxable remainder is
   * finished first so free layers behind a partial blocker still absorb; a
   * fully exhausted live blocker no longer blocks), or — after the assumed
   * seed is spent — a later free-conversion take exceeds cover already
   * re-homed by earlier suppressed spills. Free-cover capacity is tracked
   * cumulatively per pool (per-attempt scoped) in the assumed-zero
   * counterfactual. `withdrawal` is the excess that would change tax/penalty
   * if the omitted `contributionBasis` were supplied. Observation-only — set
   * from live pool balances at `splitRothWithdrawal` commit; never re-derived
   * by detectors.
   */
  assumedBasisConsequential?: { readonly withdrawal: number }
}

/**
 * One employer-designated Roth account's separate basis-pool activity for a
 * projection year.
 *
 * Published fact from the ledger's own execution — the one-source-of-truth
 * channel for insight detectors. Consumers must not re-derive it; employer
 * Roth pools stay per-account and never join an owner's Roth-IRA aggregate.
 */
export interface EmployerRothAccountActivity {
  accountId: string
  /** Resolved owner id (`null` owner already resolves to the household primary). */
  ownerPersonId: string
  /**
   * Present when a pre-qualified-age withdrawal's spill into assumed-seeded
   * contribution basis exceeded remaining free-cover capacity at the
   * consumption site. Same observation-only semantics as
   * `OwnedRothIraPoolActivity.assumedBasisConsequential`.
   */
  assumedBasisConsequential?: { readonly withdrawal: number }
}

/**
 * One owner's Form 8606 owned-traditional-IRA aggregate activity for a
 * projection year (owned non-inherited IRAs only — never employer plans or
 * inherited IRAs that remain on the beneficiary path).
 *
 * Treat-as-own-elected accounts that still carry an `inherited` block are
 * admitted per year via `isAggregatedIraThisYear` once the election is
 * effective (and not the owner-death year), and can appear in this per-owner
 * aggregate for those years. Static `isAggregatedIra` (seed / opening basis)
 * still excludes them until that year-scoped gate applies.
 *
 * Published fact from the ledger's own execution — the one-source-of-truth
 * channel for insight detectors. Consumers must not re-derive attribution from
 * aggregate `withdrawals.traditional` / `rothConversion` household totals.
 */
export interface OwnedTraditionalIraAggregateActivity {
  ownerPersonId: string
  /**
   * Present when Form 8606 pricing produced taxable income from this owner's
   * aggregate while at least one owned IRA had omitted `nondeductibleBasis`
   * (assumed zero). Each channel amount is the taxable ordinary income that
   * channel actually produced under the assumption — not the year's full
   * distribution/conversion/annuity gross. A qualified-QCD-plus-taxable-
   * conversion year therefore has distributions 0 and conversions > 0.
   * Observation-only — set from the executed character at each binding site;
   * never re-derived by detectors.
   */
  assumedBasisConsequential?: {
    readonly distributions: number
    readonly conversions: number
    readonly annuityPayments: number
  }
}

/**
 * One qualified annuity contract's payment actually paid this year.
 *
 * Published fact from the ledger's own execution — the one-source-of-truth
 * channel for insight detectors. Consumers must not re-derive payout-form
 * gates or funding linkage from plan inputs. Absent (or no entry) when the
 * payout-form gate pays nothing this year.
 */
export interface QualifiedAnnuityPaymentActivity {
  annuityAccountId: string
  /** Payment amount actually paid this year. */
  payment: number
  /**
   * Form 8606 pool owner of the traditional IRA that funded the contract
   * (funding-account owner, not necessarily the annuity account's owner).
   */
  fundingOwnerPersonId: string
}

/**
 * Benefit source the Social Security pass actually paid for a stream this year.
 * Published fact — detectors must not re-derive eligibility or precedence.
 */
export type SocialSecurityBenefitSource =
  | 'own-retirement'
  | 'ssdi'
  | 'spousal'
  | 'survivor'
  | 'none'

/**
 * Per-stream Social Security activity for a projection year.
 *
 * Published fact from the ledger's own execution — the one-source-of-truth
 * channel for insight detectors. Consumers must not re-derive PIA, claim
 * gates, spousal/survivor anchors, or SSDI path selection from plan inputs.
 *
 * One entry per `socialSecurity` income stream each year (including streams
 * not yet in force, and **unresolved** streams with `piaMonthly: null` and no
 * usable earnings history). Unresolved streams that pay nothing publish an
 * empty not-payable row (`source: 'none'`, `claimInForce: false`, zero amounts)
 * so consumers can correlate every configured stream id; milestone detectors
 * treat those rows as unmodeled. When the former-spouse marital menu still
 * pays a positive spousal/survivor benefit through an unresolved stream, the
 * row publishes the actual paid amounts and source (empty only when nothing
 * pays). When a person has multiple streams with unequal claim ages,
 * each stream's payments and claim-in-force state are attributed exactly —
 * not collapsed into a single per-person row.
 *
 * `isSpousalSurvivorGateStream` marks the sim's last-resolved stream for the
 * person (the stream that keys spousal/survivor auxiliary benefits).
 *
 * **`claimInForce` contract:** true when either (1) this stream's own filing /
 * payability status from its pay site is in force **before** auxiliary-gate
 * overrides (former-spouse marital menu, current-spouse top-up, survivor
 * step-up) and **before** the earnings-test / SGA withholding step, **or**
 * (2) an auxiliary benefit is actually paying through this stream — including
 * when the stream has no usable own PIA/earnings (unresolved) but the
 * former-spouse marital menu, current-spouse top-up, or survivor step-up still
 * publishes positive amounts on it (`simulatePlan` sets `claimInForce: true` at
 * those pay sites). Auxiliary overrides may zero a *sibling* stream's amounts
 * and set its `source` to `'none'` while leaving that sibling's
 * `claimInForce: true` from its own pay site — the filing fact remains true for
 * that stream; do **not** clear `claimInForce` on sibling rows. A row may
 * therefore legitimately be `{ claimInForce: true, source: 'none',
 * annualAmount: 0, preWithholdingAnnual: 0 }` when an auxiliary benefit on
 * another stream for the same person overrides it. Earnings-test / SGA
 * withholding can likewise leave `claimInForce: true` with a zero paid amount
 * while `preWithholdingAnnual` stays positive.
 */
export interface SocialSecurityStreamActivity {
  personId: string
  streamId: string
  source: SocialSecurityBenefitSource
  /**
   * Annual amount actually paid this year after COLA, haircut, and
   * earnings-test / SGA withholding. May be $0 when a claim is in force but
   * fully withheld, or when an auxiliary override zeroed this stream's
   * published amount (see interface contract above).
   */
  annualAmount: number
  /**
   * True when this stream's own pay site had payable months > 0 this year,
   * **or** an auxiliary benefit is actually paying through this stream
   * (including unresolved own-PIA streams that still publish aux amounts).
   * Independent of sibling-stream amount overrides and of earnings-test / SGA
   * withholding. See the interface-level `claimInForce` contract.
   */
  claimInForce: boolean
  /**
   * Annual amount after COLA and haircut, before earnings-test / SGA
   * withholding. May be zeroed by an auxiliary override on a sibling stream
   * even when `claimInForce` remains true.
   */
  preWithholdingAnnual: number
  /**
   * True when this stream is the last stream written into the sim's
   * `ssStreamByPerson` map for its person — the spousal/survivor gate winner.
   */
  isSpousalSurvivorGateStream: boolean
}
