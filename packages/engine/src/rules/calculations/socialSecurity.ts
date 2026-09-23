/**
 * Social Security calculation records.
 *
 * One slice of the calculation registry. `../calculationRegistry.ts` composes
 * every slice into `CALCULATION_REGISTRY`; read it for what a record must carry.
 */
import type { CalculationRecord } from '../calculationRegistry.js'

export const socialSecurityRecords = {
  'current-spouse-excess-fallback': {
    title: 'Current-spouse excess: the annual phase\'s reduce-then-subtract fallback',
    purpose: 'Price the auxiliary spousal excess outside the guarded POMS-order helper.',
    kind: 'model',
    outputs: [],
    feeds: ['social-security-benefit-annual'],
    statement:
      'projection/internal/annualSocialSecurity.ts#annualSocialSecurity falls back, whenever the guarded POMS-order builder returns null, to the documented approximation: reduce half the worker PIA by the claimant\'s spousal factor first, then subtract the claimant\'s own benefit as already reduced by the retirement claim factor, flooring the auxiliary excess at zero. The combined monthly amount is that excess, after the worker-record family-maximum cap, plus the claimant\'s own benefit. Units: nominal USD per month, annualized by payable months, the COLA factor and the haircut factor. Rounding: none.',
    formula: {
      expression: 'auxiliary = max(0, 0.5 x workerPia x spousalFactor - ownPia x retirementFactor); combined = ownPia x retirementFactor + min(auxiliary, familyMaximumRoom)',
      variables: [
        { symbol: 'workerPia', meaning: 'Higher earner\'s primary insurance amount', unit: 'usd/month', domain: 'positive' },
        { symbol: 'ownPia', meaning: 'Claimant\'s own primary insurance amount', unit: 'usd/month', domain: 'nonnegative' },
        { symbol: 'spousalFactor', meaning: 'Spousal reduction factor at the claimant\'s claim age', unit: '1', domain: '0 < factor <= 1' },
        { symbol: 'retirementFactor', meaning: 'Claimant\'s own retirement claim factor', unit: '1', domain: 'positive' },
      ],
      timing: 'one projection year, per couple',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/social-security/current-spouse-excess-fallback.md',
    },
    limits: [
      'This is an approximation of POMS RS 00615.250, not that rule: it reduces before subtracting and so differs from the POMS order whenever the spousal and retirement reduction schedules differ, which is exactly the case asserted here',
      'The evidence reaches the fallback by putting the inputs outside the guard (no current-spouse context), the same way the annual phase does whenever the guarded builder declines',
      'The family-maximum cap sits between the excess and the published total; at the asserted PIAs it leaves the excess untouched',
    ],
    implementedBy: ['packages/engine/src/projection/internal/annualSocialSecurity.ts'],
    implementedByFunctions: ['packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity'],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'current-spouse-excess-poms-order': {
    title: 'Current-spouse excess in the POMS order',
    purpose: 'Subtract on unreduced PIAs first, then reduce only the excess.',
    kind: 'composition',
    outputs: [],
    feeds: ['social-security-benefit-annual'],
    statement:
      'socialSecurity/currentSpouseBenefit.ts#ordinarySimultaneousEarlyCurrentSpouseComponents uses the POMS RS 00615.250 order inside its narrow guard (current-spouse context, both alive in the priced period, positive spousal payable months no greater than twelve, exactly one Social Security stream on each side, neither person declared disabled, exact configured claim dates, the claimant claiming before FRA, the worker already claimed). It computes the unreduced excess as half the worker PIA less the claimant\'s own PIA on raw PIAs, then multiplies only that excess by the spousal factor; the own component is the already retirement-factor-reduced actual monthly benefit and is not recomputed. Units: nominal USD per month. Rounding: none.',
    formula: {
      expression: 'excess = max(0, 0.5 x workerPia - ownPia); auxiliary = excess x spousalFactor; own = ownActualMonthly',
      variables: [
        { symbol: 'workerPia', meaning: 'Worker\'s primary insurance amount', unit: 'usd/month', domain: 'positive' },
        { symbol: 'ownPia', meaning: 'Claimant\'s own primary insurance amount', unit: 'usd/month', domain: 'nonnegative' },
        { symbol: 'ownActualMonthly', meaning: 'Claimant\'s own benefit after the retirement claim factor', unit: 'usd/month', domain: 'nonnegative' },
        { symbol: 'spousalFactor', meaning: 'Spousal reduction factor, 25/36 of 1% per month for the first 36 months early', unit: '1', domain: '0 < factor <= 1' },
      ],
      timing: 'one priced period inside the guard',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/social-security/current-spouse-excess-poms-order.md',
    },
    limits: [
      'A null result means the caller must keep its existing legacy path; the guard facts are configured dates and stream shape, and the helper decides no SSA eligibility, application, insured status or the first month for which a benefit is legally payable',
      'Branch selection is tied to the original configured claim age, never to attained age, an ARF-credited age or the current benefit factor',
      'Spousal benefits earn no delayed retirement credits, so the factor is at most one',
    ],
    implementedBy: [
      'packages/engine/src/socialSecurity/currentSpouseBenefit.ts',
      'packages/engine/src/socialSecurity/claimFactor.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/currentSpouseBenefit.ts#ordinarySimultaneousEarlyCurrentSpouseComponents',
      'packages/engine/src/socialSecurity/claimFactor.ts#spousalBenefitFactor',
      'packages/engine/src/socialSecurity/claimFactor.ts#claimFactor',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'delayed-retirement-credit-factor': {
    title: 'Delayed retirement credit factor',
    purpose: 'Credit 2/3 of 1% per month after full retirement age, stopping at age 70.',
    kind: 'formula',
    outputs: [],
    feeds: ['social-security-benefit-annual'],
    statement:
      'socialSecurity/benefitFactor.ts#delayedRetirementFactor increases the retirement benefit by 2/3 of 1% of PIA per month after the normal retirement age, capped at the months available through age 70, so there is no credit past 70. Claiming at or before NRA returns a factor of 1. Units: a dimensionless factor on PIA. Rounding: none.',
    formula: {
      expression: 'factor = 1 + min(m, max(0, c)) x (2/3) / 100, and 1 when m <= 0',
      variables: [
        { symbol: 'm', meaning: 'Months claimed after the normal retirement age', unit: 'months', domain: 'integer' },
        { symbol: 'c', meaning: 'Maximum credited months from NRA through age 70', unit: 'months', domain: 'integer >= 0' },
      ],
      timing: 'once per claim',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/social-security/delayed-retirement-credit-factor.md',
    },
    limits: [
      'No direct census family: the factor multiplies PIA on the way to the published annual benefit',
      'Delayed credits apply to the worker\'s own retirement benefit only; spousal benefits earn none',
      'The cap is supplied by the caller as the months from that person\'s NRA to age 70, so the record claims the credit rate and the cap behaviour, not the NRA schedule',
    ],
    implementedBy: ['packages/engine/src/socialSecurity/benefitFactor.ts'],
    implementedByFunctions: ['packages/engine/src/socialSecurity/benefitFactor.ts#delayedRetirementFactor'],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'early-claim-factor': {
    title: 'Early claim reduction factor',
    purpose: 'Reduce PIA 5/9 of 1% for the first 36 early months and 5/12 of 1% beyond.',
    kind: 'formula',
    outputs: [],
    feeds: ['social-security-benefit-annual'],
    statement:
      'socialSecurity/benefitFactor.ts#earlyRetirementFactor computes the retirement-benefit factor for months before the normal retirement age by reducing PIA 5/9 of 1% per month for the first 36 months and 5/12 of 1% for each additional month. Claiming at or after NRA returns a factor of 1. Units: a dimensionless factor on PIA. Rounding: none.',
    formula: {
      expression: 'factor = 1 - (min(m, 36) x (5/9) + max(0, m - 36) x (5/12)) / 100, and 1 when m <= 0',
      variables: [
        { symbol: 'm', meaning: 'Months claimed before the normal retirement age', unit: 'months', domain: 'integer' },
      ],
      timing: 'once per claim',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/social-security/early-claim-factor.md',
    },
    limits: [
      'No direct census family: the factor multiplies PIA on the way to the published annual benefit',
      'The two-band schedule is the worker retirement schedule; the spousal reduction (25/36 of 1% for the first 36 months) and the widow(er) reduction are different rules',
    ],
    implementedBy: ['packages/engine/src/socialSecurity/benefitFactor.ts'],
    implementedByFunctions: ['packages/engine/src/socialSecurity/benefitFactor.ts#earlyRetirementFactor'],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'normal-retirement-age': {
    title: 'Normal retirement age endpoint',
    purpose: 'Assign births after 1955-1959 ramp the current-law 67-year full retirement age.',
    kind: 'data',
    outputs: [],
    feeds: ['social-security-benefit-annual'],
    statement:
      'socialSecurity/nra.ts#fraForBirthYear assigns effective birth years 1960 and later a normal retirement age of 67 years and 0 months under current law, the endpoint of the ramp whose last step is 66 years and 10 months at 1959, and #fraTotalMonths converts that to 804 total month slots as twelve times the completed years plus the extra months. Units: years, months and total month slots. Rounding: none; integers.',
    formula: {
      expression: 'fra(y >= 1960) = { years: 67, extraMonths: 0 }; totalMonths = years x 12 + extraMonths',
      variables: [
        { symbol: 'y', meaning: 'Effective birth year (a January 1 birth uses the prior calendar year)', unit: 'year', domain: 'integer' },
      ],
      timing: 'once per person',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/social-security/normal-retirement-age.md',
    },
    limits: [
      'Simplified to the birth year: the month-of-year refinements of the SSA schedule are not modeled, and a January 1 birth is handled by the separate effective-birth-year rule',
      'The survivor (widow(er)) full retirement age is a different, earlier schedule that tops out at 66 years 8 months and never reaches 67',
      'Current law may change; the record pins what the module states today',
    ],
    implementedBy: ['packages/engine/src/socialSecurity/nra.ts'],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/nra.ts#fraForBirthYear',
      'packages/engine/src/socialSecurity/nra.ts#fraTotalMonths',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'pia-from-aime-bend-points': {
    title: 'PIA from AIME across the bend points',
    purpose: 'Apply 90/32/15 percent across the eligibility-year bend points and floor to a dime.',
    kind: 'formula',
    outputs: [],
    feeds: ['social-security-benefit-annual'],
    statement:
      'socialSecurity/piaFromEarnings.ts#piaMonthlyFromAime computes monthly PIA from AIME by applying 90% through the first eligibility-year bend point, 32% between the two bend points and 15% above the second, then rounding the result DOWN to the next lower ten cents. The 2026 bend points come from socialSecurity/ssaWageData.ts#PIA_BEND_POINTS, not from the tax parameter pack. Units: nominal USD per month. Rounding: floor to a dime.',
    formula: {
      expression: 'pia = floorToDime(0.90 x min(A, b1) + 0.32 x max(0, min(A, b2) - b1) + 0.15 x max(0, A - b2))',
      variables: [
        { symbol: 'A', meaning: 'Average indexed monthly earnings', unit: 'usd/month', domain: 'nonnegative' },
        { symbol: 'b1', meaning: 'First bend point for the eligibility year', unit: 'usd/month', domain: 'positive' },
        { symbol: 'b2', meaning: 'Second bend point for the eligibility year', unit: 'usd/month', domain: 'positive and above b1' },
      ],
      timing: 'once per eligibility year',
      rounding: 'floor to the next lower ten cents',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/social-security/pia-from-aime-bend-points.md',
    },
    limits: [
      'The rounding is a floor, not a round-to-nearest; the worksheet\'s cross-both case happens not to distinguish them, so the evidence carries a separate discriminator that does',
      'Bend points live in the SSA wage data, not in year2026: reading them from the tax pack finds nothing',
      'An eligibility year past the last published table falls back to the latest published bend points',
    ],
    implementedBy: [
      'packages/engine/src/socialSecurity/piaFromEarnings.ts',
      'packages/engine/src/socialSecurity/ssaWageData.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/piaFromEarnings.ts#piaMonthlyFromAime',
      'packages/engine/src/socialSecurity/ssaWageData.ts#PIA_BEND_POINTS',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'social-security-cola-factor': {
    title: 'Social Security COLA factor',
    purpose: 'Compound the benefit escalator from the projection start, with no escalation in the first year.',
    kind: 'model',
    outputs: [],
    feeds: ['social-security-benefit-annual'],
    statement:
      'projection/internal/annualSocialSecurity.ts#annualSocialSecurity receives an ssColaFactor that compounds from the projection start, with factor 1 in the first year, using either the plan\'s general inflation rate or its fixed ssCola rate; projection/simulate.ts#simulatePlan builds it. For a fixed rate the factor at year offset n is (1 + rate)^n, so the published benefit of a stream already in force scales by exactly that factor against its start-year amount. Units: a dimensionless factor. Rounding: none.',
    formula: {
      expression: 'ssColaFactor(y) = (1 + ssCola.annualPct / 100)^(y - startYear) for the fixed mode, or the plan inflation factor from startYear to y for matchInflation',
      variables: [
        { symbol: 'y', meaning: 'Projection year', unit: 'year', domain: 'integer at or after startYear' },
        { symbol: 'startYear', meaning: 'First projection year', unit: 'year', domain: 'integer' },
        { symbol: 'ssCola.annualPct', meaning: 'Plan fixed COLA rate', unit: 'percent/year', domain: 'greater than -100' },
      ],
      timing: 'once per projection year',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/social-security/social-security-cola-factor.md',
    },
    limits: [
      'Asserted at the plan level the comments state rather than by reading a private local: the evidence runs a real projection of a single stream already in force, with twelve payable months and no haircut and no earnings test, so the year\'s published benefit over the start year\'s IS the factor the phase received',
      'The two modes are alternatives, never combined: a plan on matchInflation does not additionally apply the fixed rate',
      'The worksheet\'s 2.8% is year2026.socialSecurity.colaPct used as the plan\'s fixed rate; the pack figure is not itself the plan default',
    ],
    implementedBy: [
      'packages/engine/src/projection/internal/annualSocialSecurity.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'social-security-payable-months': {
    title: 'Social Security payable months',
    purpose: 'Count the modeled months a claim pays in the year it starts.',
    kind: 'formula',
    outputs: [],
    feeds: ['social-security-benefit-annual'],
    statement:
      'projection/internal/annualSocialSecurity.ts#annualSocialSecurityPayableMonths returns 0 before the claim year, 12 after it, and max(0, 12 - claimAge.months) when the attained age equals the claim-age years. The claim-age month itself is excluded and there is no calendar payment lag. Units: modeled months. Rounding: none; integers.',
    formula: {
      expression: 'months = 0 when ageAttained < claimAge.years; 12 when ageAttained > claimAge.years; max(0, 12 - claimAge.months) otherwise',
      variables: [
        { symbol: 'ageAttained', meaning: 'Age attained in the projection year', unit: 'years', domain: 'integer' },
        { symbol: 'claimAge.years', meaning: 'Completed years of the configured claim age', unit: 'years', domain: 'integer' },
        { symbol: 'claimAge.months', meaning: 'Extra months of the configured claim age', unit: 'months', domain: 'integer 0..11' },
      ],
      timing: 'once per person-year',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/social-security/social-security-payable-months.md',
    },
    limits: [
      'An annual-ledger approximation in age-year coordinates: the helper takes no birth month and cannot express an anniversary-year fraction',
      'No administrative payment lag is modeled, which the comment states explicitly',
    ],
    implementedBy: ['packages/engine/src/projection/internal/annualSocialSecurity.ts'],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurityPayableMonths',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'ss-bridge-sizing': {
    title: 'Social Security bridge: age-62 replacement sized as a TIPS ladder',
    purpose:
      'The real-dollar bridge that pays the forgone age-62 benefit from retirement until the chosen claim, quoted as a TIPS ladder bought this year.',
    kind: 'formula',
    outputs: ['social-security-bridge-sizing'],
    // The detector sums these per-claimant quotes; it does not re-derive them.
    feeds: ['insight-ss-bridge-gap-total'],
    statement:
      'Monthly age-62 benefit M = PIA × f_62; annual real amount A = 12M. startYear = max(age-62 year, retirementYear, currentYear+1). For a January claim (months = 0), endYear = claimYear − 1; for a mid-year claim, endYear = claimYear. years N = endYear − startYear + 1. ladderCost is the TIPS-ladder price of N annual real payments of A purchased in the current year. On a zero real curve with unit present value, cost = N A. Returns null when the claim is at or before 62 or the window is empty. Units: today\'s dollars and calendar years. Rounding: none.',
    formula: {
      expression: 'M = PIA × f_62; A = 12M; N = endYear − startYear + 1; cost = price of N real payments of A',
      variables: [
        { symbol: 'PIA', meaning: 'Primary insurance amount, monthly, today\'s dollars', unit: 'usd/month', domain: '> 0' },
        { symbol: 'f_62', meaning: 'Claim factor at age 62, already resolved for the date of birth', unit: '1', domain: '0 < f_62 <= 1' },
        { symbol: 'startYear', meaning: 'First calendar year the bridge pays', unit: 'year', domain: 'integer' },
        { symbol: 'endYear', meaning: 'Last calendar year the bridge pays', unit: 'year', domain: 'integer >= startYear' },
      ],
      timing: 'annual real payments from startYear through endYear inclusive; ladder purchased in currentYear',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/social-security/ss-bridge-sizing.md',
    },
    limits: [
      'The date formula (January claim ends the year before the claim year; start is the later of age 62, retirement, and next year) is the comments\' stated convention',
      'Synthetic TIPS coupons are floored at 0.125% (ladderMath MIN_TIPS_COUPON_PCT). On the zero real curve the worksheet states, that floor is absorbed into the back-solved face amounts and the ladder cost equals N x A exactly, which the evidence asserts at 1e-9 (a passing check, not an assumption); on a nonzero curve the cost is the discounted ladder and differs from N x A, and the worksheet does not claim otherwise',
    ],
    implementedBy: ['packages/engine/src/ladder/bridge.ts'],
    implementedByFunctions: ['packages/engine/src/ladder/bridge.ts#sizeBridge'],
    verifiedOn: '2026-09-17',
    provenance: { derivedBy: 'codex', implementedBy: 'grok', reviewedBy: 'cursor' },
  },
  'survivor-benefit-rib-lim': {
    title: 'Survivor benefit under RIB-LIM',
    purpose: 'Floor the survivor base at 82.5% of the deceased PIA, then apply the widow(er) reduction.',
    kind: 'composition',
    outputs: [],
    feeds: ['social-security-benefit-annual'],
    statement:
      'socialSecurity/survivorBenefit.ts#survivorBenefitMonthly computes the monthly survivor benefit as the greater of the deceased\'s actual benefit and 82.5% of the deceased\'s PIA (the RIB-LIM widow\'s-limit floor), multiplied by the widow(er) factor #survivorReductionFactor returns: a linear ramp from 71.5% at age 60 to 100% at the SURVIVOR full retirement age, clamped to 0.715 at or before 60 and to 1 at or after that FRA. A deceased with no PIA returns zero. Units: nominal USD per month, in today\'s dollars before COLA and haircut. Rounding: none.',
    formula: {
      expression: 'W = max(deceasedActual, 0.825 x deceasedPia); factor = 1 - 0.285 x (1 - (m - 720) / (F - 720)) for 720 < m < F, 0.715 at m <= 720, 1 at m >= F; benefit = W x factor',
      variables: [
        { symbol: 'deceasedPia', meaning: 'Deceased worker\'s primary insurance amount', unit: 'usd/month', domain: 'positive; zero or less returns 0' },
        { symbol: 'deceasedActual', meaning: 'Deceased worker\'s actual benefit after their own claim factor', unit: 'usd/month', domain: 'nonnegative' },
        { symbol: 'm', meaning: 'Survivor claim age in total months', unit: 'months', domain: 'integer' },
        { symbol: 'F', meaning: 'Survivor full retirement age in total months', unit: 'months', domain: 'integer above 720' },
      ],
      timing: 'once per survivor claim',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/social-security/survivor-benefit-rib-lim.md',
    },
    limits: [
      'The survivor FRA is a separate, earlier schedule than the worker FRA and tops out at 66 years 8 months; using the worker FRA changes every reduction between 60 and FRA',
      'Inputs are monthly, in today\'s dollars, before COLA and any benefit haircut; callers scale to their own annual frame',
      'RIB-LIM here is the widow\'s-limit floor at 82.5% of PIA; the full RIB-LIM family of provisions is broader and illustrative only',
    ],
    implementedBy: ['packages/engine/src/socialSecurity/survivorBenefit.ts'],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/survivorBenefit.ts#survivorReductionFactor',
      'packages/engine/src/socialSecurity/survivorBenefit.ts#survivorBenefitMonthly',
      'packages/engine/src/socialSecurity/survivorBenefit.ts#WIDOW_LIMIT_PIA_FRACTION',
      'packages/engine/src/socialSecurity/survivorBenefit.ts#SURVIVOR_EARLIEST_AGE',
      'packages/engine/src/socialSecurity/survivorBenefit.ts#SURVIVOR_MAX_REDUCTION',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'family-maximum-bend-points': {
    title: 'Retirement/survivor family maximum from PIA',
    purpose: 'The monthly ceiling every auxiliary benefit on a worker record shares, from that worker\'s PIA.',
    kind: 'formula',
    // No census family carries the family maximum itself: it is the ceiling
    // capAuxiliaryForFamilyMaximum applies to the current-spouse auxiliary,
    // which annualSocialSecurity folds into the published benefit.
    outputs: [],
    feeds: ['social-security-benefit-annual'],
    statement:
      'socialSecurity/familyMaximum.ts#familyMaximumMonthlyFromPia takes a monthly PIA P and an eligibility year, reads that year\'s three family-maximum bend points b1 < b2 < b3 from FAMILY_MAXIMUM_BEND_POINTS (2026: 1,643, 2,371 and 3,093 dollars per month; a year with no published triplet falls back to the latest one on file), and returns floorToDime(1.50 min(P, b1) + 2.72 min(max(P - b1, 0), b2 - b1) + 1.34 min(max(P - b2, 0), b3 - b2) + 1.75 max(P - b3, 0)). A PIA at or below zero returns 0. Units: nominal USD per month, before COLA and any trust-fund haircut. Rounding: the sum is floored to the next lower dime, Math.floor(x * 10 + 1e-9) / 10, so the published figure is quantized and the unrounded sum is an intermediate only.',
    formula: {
      expression: 'MFB = floorToDime(1.50 min(P, b1) + 2.72 min(max(P - b1, 0), b2 - b1) + 1.34 min(max(P - b2, 0), b3 - b2) + 1.75 max(P - b3, 0))',
      variables: [
        { symbol: 'P', meaning: 'Worker primary insurance amount', unit: 'usd/month', domain: 'P > 0; P <= 0 returns 0' },
        { symbol: 'b1, b2, b3', meaning: 'Family-maximum bend points for the eligibility year', unit: 'usd/month', domain: '0 < b1 < b2 < b3, from FAMILY_MAXIMUM_BEND_POINTS' },
        { symbol: 'MFB', meaning: 'Monthly retirement/survivor family maximum', unit: 'usd/month', domain: 'nonnegative multiple of 0.10' },
      ],
      timing: 'once per worker record, before COLA and haircut',
      rounding: 'floored to the next lower dime',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/social-security/family-maximum-bend-points.md',
    },
    limits: [
      'The four band rates 150/272/134/175 percent are the retirement and survivor family maximum, not the disability family maximum, which SSA computes differently',
      'The bend points are eligibility-year values (the year the worker attains 62 under familyMaximumEligibilityYearFromDobParts), not the benefit year; an eligibility year the table does not price falls back to the latest published triplet',
      'RetireGolden models no child dependents, so capAuxiliaryForFamilyMaximum gives the whole room above the worker\'s own benefit to the single current-spouse auxiliary; the worker\'s own benefit is never reduced by this ceiling',
      'The dime floor is part of the published contract: the fixture compares the floored figure exactly and treats the unrounded sum as an intermediate',
    ],
    implementedBy: [
      'packages/engine/src/socialSecurity/familyMaximum.ts',
      'packages/engine/src/socialSecurity/ssaWageData.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/familyMaximum.ts#familyMaximumMonthlyFromPia',
      'packages/engine/src/socialSecurity/ssaWageData.ts#FAMILY_MAXIMUM_BEND_POINTS',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
  'social-security-benefit-annual': {
    title: 'Annual household Social Security benefit',
    purpose: 'The Social Security cash the household is paid in one projection year, after the earnings test.',
    kind: 'composition',
    outputs: ['social-security-benefit-annual'],
    statement:
      'YearResult.incomes.socialSecurity is the sum over living people of that person\'s benefit. Each own retirement row is PIA x the claim-age factor x payable months (0 before the claim year, 12 − claim months in it, 12 after) x the COLA factor x the haircut factor. A divorced-spouse, current-spouse spousal — the claimant\'s own monthly PLUS max(0, 0.5 x the higher PIA x the spousal factor − own monthly), that excess capped by the family maximum — or survivor candidate REPLACES the running amount when it is larger, rather than adding to it. While the person is under FRA the earnings test then withholds max(0, (wages − the below-FRA annual limit) / 2), or the excess over the FRA-year limit divided by 3 in the FRA year itself, capped at the benefit. Units: nominal dollars per year. Rounding: none.',
    formula: {
      expression: 'benefit = Σ_people max(own, marital candidate) x months x cola x haircut, less max(0, (wages − limit)/2) capped at the benefit',
      variables: [
        { symbol: 'PIA', meaning: 'Primary insurance amount at FRA', unit: 'usd/month', domain: 'nonnegative' },
        { symbol: 'claim factor', meaning: 'Retirement factor for the claim age (early reduction or delayed credits)', unit: '1', domain: '0.70 to 1.32' },
        { symbol: 'payable months', meaning: '0, 12 − claim months, or 12', unit: 'months', domain: '0..12' },
        { symbol: 'cola, haircut', meaning: 'COLA factor from the start year and 1 − cutPct/100 from ssHaircut.fromYear', unit: '1', domain: 'positive' },
        { symbol: 'limit', meaning: 'Pack earnings-test limit, below-FRA or FRA-year, scaled for the year', unit: 'usd/year', domain: 'positive' },
      ],
      timing: 'annual; the earnings test applies after the marital comparison',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/social-security/social-security-benefit-annual.md',
    },
    limits: [
      'The own-claim-year case is constructible exactly as the worksheet now states it: a 1960 birth has FRA 67y0m, so a 64y3m claim is 33 months early and the factor is 1 − 33 x (5/9 of 1%) = 49/60, while the claim-age month of 3 pays 12 − 3 = 9 months in the claim year. The first derivation instead paired a 0.8 factor with those nine months — 0.8 is exactly 36 months before FRA, whose claim-age month is 0 and which therefore pays all 12 — and that was corrected on 2026-09-18; the incompatible pair is now the worksheet\'s first wrong reading, asserted as not matching',
      'Beyond the worksheet\'s inputs the evidence plans fix, for the claim-year and later-year cases: a 1960-born single filer claiming at 64y3m on one plan whose projection starts in 2024, the year that birth attains 64, so the claim year is the first projection year and its COLA factor is exactly 1; zero inflation and zero return; a fixed 6%/year ssCola so the second projection year\'s factor is exactly 1.06; ssHaircut cutPct 5 from the start year; and a cash account to fund the year',
      'The two-person case asserts the REPLACEMENT rule, so both people claim at their own FRA (claim and spousal factors 1) in the projection\'s first year, where the COLA factor is 1 and no haircut applies; the family maximum is left non-binding by the PIAs chosen',
      'The earnings-test case is a separate 1962-born plan claiming at 64y0m, where the 0.8 factor and 12 payable months ARE the compatible pair, and is asserted in 2026 so the pack\'s $24,480 below-FRA limit is unindexed; the wage row that drives it is ordinary income and is taxed, which does not enter this family',
      'The published field is the PAID benefit; the amount withheld is a separate field (ssEarningsTestWithheld), and withheld months are credited back into a later claim age rather than lost',
      'No discrepancy remains in the two-person case: annualSocialSecurity builds the current-spouse candidate as the claimant\'s own monthly benefit PLUS the capped spousal excess ($300 + $700 = $1,000) and replaces the running amount with that total, which is what a dually-entitled spouse is actually paid, so the household is $36,000 and the worksheet expects $36,000. The first derivation read the ledger comment\'s "replaces the running amount" as replacing the own benefit with the excess alone and expected $32,400; it was corrected on 2026-09-18, and $32,400 is now the worksheet\'s second wrong reading, asserted as not matching',
    ],
    implementedBy: ['packages/engine/src/projection/internal/annualSocialSecurity.ts'],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurityPayableMonths',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
} satisfies Record<string, CalculationRecord>
