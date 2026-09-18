/**
 * Insights calculation records.
 *
 * One slice of the calculation registry: the detector screens and evaluate
 * steps that publish the catalog's insight cards. `../calculationRegistry.ts`
 * composes every slice into `CALCULATION_REGISTRY`; read it for what a record
 * must carry.
 */
import type { CalculationRecord } from '../calculationRegistry.js'

export const insightsRecords = {
  'insight-annuitization-headroom-illustrative-spia': {
    title: 'Illustrative SPIA premium and monthly payout from unused longevity headroom',
    purpose:
      'A bounded quarter-account SPIA illustration for a planning-age-95-or-later plan that holds no annuity or pension covering the floor.',
    kind: 'model',
    outputs: ['insight-annuitization-headroom-illustrative-spia'],
    statement:
      'For a plan whose maximum planning age is at least 95, with a qualifying largest cash-or-taxable account of at least $100,000 and no annuity or pension covering the floor: premium = min(0.25 × liquidBalance, $250,000); monthly payout = premium × spiaPayoutRate(startAge) / 12, where startAge = min(95, max(currentAge, 65)). Units: nominal dollars. Rounding: none — the production function returns a binary float, formatted to whole dollars only at the card.',
    formula: {
      expression: 'premium = min(0.25 L, 250000); monthly = premium × r(startAge) / 12',
      variables: [
        { symbol: 'L', meaning: 'Largest qualifying liquid (cash or taxable) account balance', unit: 'usd', domain: 'L >= 100000' },
        { symbol: 'r(startAge)', meaning: 'Annual SPIA payout rate as a fraction of premium, already resolved by spiaPayoutRate', unit: '1', domain: 'r > 0' },
        { symbol: 'startAge', meaning: 'min(95, max(currentAge, 65))', unit: 'years', domain: '65 <= startAge <= 95' },
      ],
      timing: 'illustration at the projection start year; payout begins at startAge',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/insights/insight-annuitization-headroom-illustrative-spia.md',
    },
    limits: [
      'An illustration, not a carrier quote, recommendation, or claim that the payout is optimal or guaranteed',
      'The worksheet supplies the already-resolved spiaPayoutRate(startAge) = 6.6%/year; the evidence passes that rate through rather than re-quoting the table',
      'startAge is clamped to [65, 95], so a rate below the age-65 table point is not reachable without substituting the resolved rate',
    ],
    implementedBy: ['packages/engine/src/insights/detectors/annuitizationHeadroom.ts'],
    implementedByFunctions: ['packages/engine/src/insights/detectors/annuitizationHeadroom.ts#annuitizationHeadroom.screen'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'grok', reviewedBy: 'cursor' },
  },
  'insight-asset-location-swappable-exposure': {
    title: 'Swappable class exposure of the preferred asset-location candidate',
    purpose:
      'The dollar amount of class exposure the preferred bounded asset-location swap would relocate while holding the household mix constant.',
    kind: 'model',
    outputs: ['insight-asset-location-swappable-exposure'],
    statement:
      'Among bounded asset-location candidates generated for a plan that uses static allocation on multiple accounts, the unique best beneficial candidate is the one whose exact-ledger ending-after-tax-estate delta is the largest strictly positive value. The published figure is that candidate\'s swappable-exposure metadata, not the estate delta. Units: nominal dollars. Rounding: the generator stores Math.round(dollars); the worksheet copies that metadata.',
    formula: {
      expression: 'selected = argmax_{c : delta_c > 0} delta_c; exposure = swappedDollars(selected)',
      variables: [
        { symbol: 'delta_c', meaning: 'Ending after-tax estate delta of candidate c versus the baseline ledger', unit: 'usd', domain: 'finite' },
        { symbol: 'swappedDollars', meaning: 'Class exposure the candidate relocates between wrappers', unit: 'usd', domain: '>= 0' },
      ],
      timing: 'screen-time metadata of a bounded swap; the estate delta is priced on the exact ledger',
      rounding: 'generator rounds swapped dollars to whole dollars',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/insights/insight-asset-location-swappable-exposure.md',
    },
    limits: [
      'A screening choice, not a claim that asset location always helps',
      'The worksheet pins screen() and requires a unique largest positive delta, so the extract\'s unstated tie behavior is out of scope',
      'Production screen() publishes the preferred generator candidate (bonds-to-traditional, else the first) without pricing deltas; evaluate() is what selects the unique best beneficial candidate. The evidence fixture names A as that preferred id so the published exposure still matches the worksheet\'s selected candidate',
    ],
    implementedBy: ['packages/engine/src/insights/detectors/assetLocation.ts'],
    implementedByFunctions: ['packages/engine/src/insights/detectors/assetLocation.ts#assetLocation.screen'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'grok', reviewedBy: 'cursor' },
  },
  'insight-hecm-buffer-illustrative-credit-line': {
    title: 'Illustrative HECM credit line for a house-rich, portfolio-thin plan',
    purpose:
      'The initial HECM line of credit a house-rich, portfolio-thin household could open, together with the investable sum it is compared against.',
    kind: 'model',
    outputs: ['insight-hecm-buffer-illustrative-credit-line'],
    statement:
      'For a primary residence worth at least $100,000, youngest borrower age at least 62, no modeled HECM, and home-to-investable ratio at least 0.75: investable = cash + taxable + equityComp + traditional + Roth + HSA balances; credit line = (principalLimitFactorPct / 100) × homeValue. Units: nominal dollars. Rounding: none.',
    formula: {
      expression: 'investable = C+Tx+Eq+Trad+Roth+HSA; line = (PLF/100) × H; fires when H/investable >= 0.75',
      variables: [
        { symbol: 'H', meaning: 'Primary residence value', unit: 'usd', domain: 'H >= 100000' },
        { symbol: 'PLF', meaning: 'Principal-limit factor in percent, already resolved for the youngest borrower age', unit: 'percent', domain: 'PLF > 0' },
        { symbol: 'investable', meaning: 'Sum of cash, taxable, equity-comp, traditional, Roth and HSA balances', unit: 'usd', domain: '> 0' },
      ],
      timing: 'illustration at the projection start year',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/insights/insight-hecm-buffer-illustrative-credit-line.md',
    },
    limits: [
      'An illustration from the published age factor, not a lender quote or a claim the line is valuable on the deterministic path',
      'The worksheet supplies the already-resolved principal-limit factor of 45% at age 65; the evidence passes that factor through rather than re-reading the pack table (the 2026 pack\'s age-65 factor is 37.2%)',
    ],
    implementedBy: ['packages/engine/src/insights/detectors/hecmBufferCandidate.ts'],
    implementedByFunctions: ['packages/engine/src/insights/detectors/hecmBufferCandidate.ts#hecmBufferCandidate.screen'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'grok', reviewedBy: 'cursor' },
  },
  'insight-irmaa-tier-edge-premium-cliff': {
    title: 'IRMAA tier-edge household Medicare premium cliff',
    purpose:
      'The extra annual Medicare premium a MAGI just over an IRMAA threshold triggers two years later, versus MAGI one dollar under it.',
    kind: 'model',
    outputs: ['insight-irmaa-tier-edge-premium-cliff'],
    // The detector stuffs the cliff into endingAfterTaxEstateDelta as a rough
    // avoidance signal; that field's published meaning is an estate change,
    // so the cliff enters it as an input rather than being its value.
    feeds: ['insight-impact-ending-after-tax-estate-delta'],
    statement:
      'For a selected IRMAA edge with n Medicare enrollees in the charge year (lookback MAGI year + 2): cliff = n × ((Part B + Part D surcharge)_just-above − (Part B + Part D surcharge)_one-dollar-below), using the healthcare-premium scale for the charge year. Units: nominal dollars per year. Rounding: none; the card floors a negative difference at 0.',
    formula: {
      expression: 'cliff = n (P_above − P_below); P = partBAnnual + partDSurchargeAnnual',
      variables: [
        { symbol: 'n', meaning: 'Medicare enrollees (alive, age 65+) in the charge year', unit: 'people', domain: 'integer n >= 1' },
        { symbol: 'P_above', meaning: 'Per-person annual Part B + Part D premium just above the MAGI threshold, already resolved', unit: 'usd/year', domain: 'finite' },
        { symbol: 'P_below', meaning: 'Per-person annual Part B + Part D premium one dollar below the threshold, already resolved', unit: 'usd/year', domain: 'finite' },
      ],
      timing: 'charge year = MAGI year + 2 (the statutory lookback)',
      rounding: 'none; a negative (P_above − P_below) is floored at 0 before multiplying by n',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/insights/insight-irmaa-tier-edge-premium-cliff.md',
    },
    limits: [
      'A rough avoidance signal, not a claim that reducing current-year income changes a premium already charged',
      'The worksheet supplies the already-resolved per-person premiums; the evidence passes those through rather than recomputing medicareAnnualPremiumPerPerson',
      'The detector only fires when MAGI is at most $5,000 over the next threshold; that proximity window is a screen, not part of the cliff identity',
    ],
    implementedBy: ['packages/engine/src/insights/detectors/irmaaTierEdge.ts'],
    implementedByFunctions: ['packages/engine/src/insights/detectors/irmaaTierEdge.ts#irmaaTierEdge.screen'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'grok', reviewedBy: 'cursor' },
  },
  'insight-spending-guardrails-illustrative-floor': {
    title: 'Illustrative (or explicit) required spending floor for a guardrail preview',
    purpose:
      'The required annual floor the spending-guardrails card previews: the plan\'s own requiredAnnual when set, otherwise 80% of base spending.',
    kind: 'model',
    outputs: ['insight-spending-guardrails-illustrative-floor'],
    statement:
      'For a depleting plan (or one with first-year investable of at least $100,000) that does not already run a guardrail policy: requiredAnnual = the plan\'s explicit requiredAnnual when that field is a finite number, otherwise 80% of baseAnnual (the probability-band generator\'s default floor, then min\'d with baseAnnual). Units: nominal dollars per year. Rounding: the generator rounds the 80% fallback with Math.round.',
    formula: {
      expression: 'floor = min(requiredAnnual ?? round(0.80 × baseAnnual), baseAnnual)',
      variables: [
        { symbol: 'baseAnnual', meaning: 'Plan baseline annual spending', unit: 'usd/year', domain: '> 0' },
        { symbol: 'requiredAnnual', meaning: 'Plan-supplied essential floor, when present', unit: 'usd/year', domain: 'finite, or absent' },
      ],
      timing: 'illustration at the first projection year',
      rounding: 'Math.round on the 80% fallback; an explicit floor is used as supplied',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/insights/insight-spending-guardrails-illustrative-floor.md',
    },
    limits: [
      'A guardrail preview, not a claim that 80% is an objectively required household budget',
      'The generator also min\'s the floor with baseAnnual, so an explicit floor above base spending is capped; the worksheet\'s explicit case is below base and does not hit that cap',
    ],
    implementedBy: ['packages/engine/src/insights/detectors/spendingGuardrails.ts'],
    implementedByFunctions: ['packages/engine/src/insights/detectors/spendingGuardrails.ts#spendingGuardrails.screen'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'grok', reviewedBy: 'cursor' },
  },
  'insight-spending-headroom-rough-annual': {
    title: 'Rough real annual spending headroom from excess terminal estate',
    purpose:
      'A first-pass lifestyle amount: excess after-tax estate in today\'s dollars, spread across the remaining projection years.',
    kind: 'model',
    outputs: ['insight-spending-headroom-rough-annual'],
    statement:
      'For a nondepleting, non-ABW plan: endingEstateToday = deflate(endYear, endingAfterTaxEstate); excess = endingEstateToday − bequestTarget; roughHeadroom = excess / yearsRemaining. The card screens only when excess >= $250,000 and roughHeadroom >= $2,000. N = max(1, endYear − startYear) is the number of year boundaries between the projection start and end years (9 for 2026 through 2035), not the inclusive row count. Units: today\'s dollars per year. Rounding: none.',
    formula: {
      expression: 'headroom = (deflate(endYear, endingAfterTaxEstate) − bequestTarget) / N',
      variables: [
        { symbol: 'endingAfterTaxEstate', meaning: 'Nominal ending after-tax estate at the horizon', unit: 'usd', domain: 'finite' },
        { symbol: 'bequestTarget', meaning: 'Bequest target in today\'s dollars (0 when unset)', unit: 'usd', domain: '>= 0' },
        { symbol: 'N', meaning: 'Year boundaries between the start and end years, max(1, endYear − startYear)', unit: 'years', domain: 'integer N >= 1' },
      ],
      timing: 'straight-line over the remaining modeled years, before the exact-ledger solver',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/insights/insight-spending-headroom-rough-annual.md',
    },
    limits: [
      'A cheap first-pass, not a claim that withdrawing this amount every year is sustainable',
      'The first derivation guessed an inclusive row count (10 for 2026 through 2035) because the comment stated no convention; the comment now states N = max(1, endYear − startYear) and the worksheet was re-derived on it (44,444.44, shown as $44,444)',
    ],
    implementedBy: ['packages/engine/src/insights/detectors/spendingHeadroom.ts'],
    implementedByFunctions: ['packages/engine/src/insights/detectors/spendingHeadroom.ts#spendingHeadroom.screen'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'grok', reviewedBy: 'cursor' },
  },
  'insight-ss-bridge-gap-total': {
    title: 'Household Social Security bridge: summed ladder cost and annual real income',
    purpose:
      'The household total of independently sized Social Security bridge ladders for delaying claimants whose gap is not already covered.',
    kind: 'composition',
    outputs: ['insight-ss-bridge-gap-total'],
    statement:
      'Each delaying claimant is independently sized by sizeBridge. Eligible claimants are those whose gap is not already covered by a plan ladder and who, as a household, meet the shared 50% funding threshold (liquid >= 0.5 × totalCost). totalCost = sum of eligible ladderCost_i; annualTotal = sum of eligible annualRealAmount_i. Units: dollars (ladder cost in today\'s dollars; annual amount real). Rounding: none.',
    formula: {
      expression: 'totalCost = sum_eligible ladderCost_i; annualTotal = sum_eligible annualRealAmount_i',
      variables: [
        { symbol: 'ladderCost_i', meaning: 'Quoted TIPS-ladder cost for claimant i, already resolved by sizeBridge', unit: 'usd', domain: '>= 0' },
        { symbol: 'annualRealAmount_i', meaning: 'Level real annual bridge payout for claimant i, already resolved by sizeBridge', unit: 'usd/year', domain: '>= 0' },
      ],
      timing: 'sum over currently delaying claimants at the projection start year',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/insights/insight-ss-bridge-gap-total.md',
    },
    limits: [
      'A scenario preview, not a claim the ladder is affordable merely because half its cost is present',
      'The worksheet supplies already-sized per-claimant ladder costs and annual amounts; the evidence passes those through rather than re-running sizeBridge on the embedded curve',
      'The 50% funding gate is household-wide against the summed cost, not per claimant',
    ],
    implementedBy: ['packages/engine/src/insights/detectors/ssBridgeGap.ts'],
    implementedByFunctions: ['packages/engine/src/insights/detectors/ssBridgeGap.ts#ssBridgeGap.screen'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'grok', reviewedBy: 'cursor' },
  },
  'insight-widows-penalty-bracket-jump': {
    title: 'Rough real survivor bracket jump, single versus joint on the same MAGI',
    purpose:
      'The extra federal tax of filing the first single-filed survivor year as Single rather than married-filing-jointly, deflated to today.',
    kind: 'model',
    outputs: ['insight-widows-penalty-bracket-jump'],
    statement:
      'On the plan\'s first survivor year that files Single, hold that year\'s MAGI fixed: J = Tax_single(M) − Tax_joint(M); J_today = J × d, where d is the deflator from that year to today. Units: today\'s dollars. Rounding: production rounds J_today with Math.round before publishing.',
    formula: {
      expression: 'J_today = (Tax_single(M) − Tax_joint(M)) × d',
      variables: [
        { symbol: 'M', meaning: 'Survivor-year MAGI, held constant across the two filings', unit: 'usd', domain: 'finite' },
        { symbol: 'Tax_single, Tax_joint', meaning: 'Federal tax on M under Single and MFJ, already resolved', unit: 'usd', domain: 'finite' },
        { symbol: 'd', meaning: 'Deflation factor from the survivor year to today', unit: '1', domain: 'd > 0' },
      ],
      timing: 'first single-filed survivor year; QSS interlude years keep joint tables and are not priced',
      rounding: 'Math.round on the deflated jump',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/insights/insight-widows-penalty-bracket-jump.md',
    },
    limits: [
      'Identifies a conversion-planning question, not a forecast of the survivor\'s actual return',
      'The worksheet supplies the already-resolved Single and MFJ tax figures; the evidence passes those through rather than recomputing federal tax',
      'Production floors a negative jump at 0 before deflating; the worksheet\'s Single > MFJ case does not hit that floor',
      'The card omits the evidence row when the rounded today-dollar jump is at most $100',
    ],
    implementedBy: ['packages/engine/src/insights/detectors/widowsPenalty.ts'],
    implementedByFunctions: ['packages/engine/src/insights/detectors/widowsPenalty.ts#widowsPenalty.screen'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'grok', reviewedBy: 'cursor' },
  },
  'insight-state-relocation-lifetime-state-tax-savings': {
    title: 'Lifetime state-and-local tax saved by the best zero-tax relocation candidate',
    purpose:
      'Today\'s-dollar lifetime state-and-local tax saved by moving to the best of FL, TX and WA versus staying put.',
    kind: 'composition',
    outputs: ['insight-state-relocation-lifetime-state-tax-savings'],
    // Candidate selection and the per-year state-tax series come from the
    // relocation sweep; this record's published number is the floored
    // deflated savings, not the per-candidate lifetime tax itself.
    feeds: ['relocation-lifetime-state-local-tax'],
    statement:
      'Among non-baseline sweep rows with error=null, the best candidate is the one with the lowest nominal lifetimeTaxesAndPenalties; replacement requires strict `<`, so an earlier shortlist row wins a tie. For that row and the id=\'baseline\' row, savings = max(0, −sum_y deflate(y, candidateStateTax_y − baselineStateTax_y)) over the union of years, with a missing year treated as zero. Units: start-year dollars. Rounding: none on the sum; the display string rounds to whole dollars.',
    formula: {
      expression: 'savings = max(0, −sum_y deflate(y, S_cand,y − S_base,y)); union of years, missing = 0',
      variables: [
        { symbol: 'S_base,y, S_cand,y', meaning: 'Nominal state-plus-local tax in year y for baseline and the selected candidate', unit: 'usd', domain: 'finite; absent years contribute 0' },
        { symbol: 'deflate(y, ·)', meaning: 'Maps year-y nominal dollars to start-year dollars', unit: '1', domain: '> 0' },
      ],
      timing: 'lifetime over the union of the two annual series; a start-year move defaults to July (split-year origin tax)',
      rounding: 'none on the sum; whole-dollar display only',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/insights/insight-state-relocation-lifetime-state-tax-savings.md',
    },
    limits: [
      'Candidate selection uses all taxes and penalties; the savings identity uses state-plus-local tax only',
      'A failed sweep publishes no dollar figure (evaluate degrades to the screen-level card)',
      'Only the final sum is floored at zero, not each year\'s contribution',
      'The evidence constructs the sweep rows the worksheet states rather than running four ledgers',
    ],
    implementedBy: ['packages/engine/src/insights/detectors/stateRelocation.ts'],
    implementedByFunctions: ['packages/engine/src/insights/detectors/stateRelocation.ts#stateRelocation.evaluate'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'grok', reviewedBy: 'cursor' },
  },
} satisfies Record<string, CalculationRecord>
