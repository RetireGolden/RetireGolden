/**
 * Longevity calculation records.
 *
 * One slice of the calculation registry: the SSA-table death-probability
 * identity, the stochastic death-age draw and joint expectancy built on it,
 * and the survival-percentile helpers (single, joint, and the hazard power a
 * questionnaire multiplier maps to). `../calculationRegistry.ts` composes
 * every slice into `CALCULATION_REGISTRY`; read it for what a record must
 * carry.
 */
import type { CalculationRecord } from '../calculationRegistry.js'

export const longevityRecords = {
  'mortality-ex-to-qx-identity': {
    title: 'One-year death probability from SSA remaining life expectancy',
    purpose:
      'The annual death probability q(x) every survival curve and stochastic-longevity draw reads from the embedded SSA period table.',
    kind: 'formula',
    // A mortality rate is an intermediate: the survival product and the
    // percentile ages consume q(x), and the death-age draw the Monte Carlo
    // aggregates walks it year by year. No surface publishes it.
    outputs: [],
    feeds: ['longevity-survival-percentile-age', 'monte-carlo-success-rate', 'monte-carlo-ending-investable-histogram'],
    statement:
      'For the embedded SSA 2022 period table of remaining life expectancy e(x) at integer ages 0..119 (male, female, or their elementwise average for sex "average") and an age a, let x = floor(a). q(x) = 1 - (e(x) - 0.5)/(e(x+1) + 0.5), clamped into [0, 1]. x < 0 returns 0; x >= 119, the last row, returns 1, forcing death at the table endpoint. Units: probability of death within one year. Rounding: none.',
    formula: {
      expression: 'q(x) = 1 - (e(x) - 0.5)/(e(x+1) + 0.5) for 0 <= x < 119; q(x) = 1 for x >= 119; q(x) = 0 for x < 0',
      variables: [
        { symbol: 'x', meaning: 'Integer age (the floor of the requested age)', unit: 'years', domain: 'integer' },
        { symbol: 'e(x)', meaning: 'SSA period remaining life expectancy at exact age x', unit: 'years', domain: 'e(x) >= 0.5 within the table' },
        { symbol: 'q(x)', meaning: 'Probability of dying between ages x and x+1', unit: '1', domain: '0 <= q(x) <= 1' },
      ],
      timing: 'one-year transition between consecutive integer ages',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/longevity/mortality-ex-to-qx-identity.md',
    },
    limits: [
      'Half-year convention: deaths are assumed uniformly distributed within each age interval, so e(x) = E[complete years] + 0.5; this is a modeling convention, not an SSA-published q(x)',
      'The period table is applied unchanged to the cohort; the identity describes the table, not an individual\'s risk',
      'The result is clamped into [0, 1] and a negative age returns 0; neither case is flagged',
      'Sex "average" derives q(x) from the elementwise mean of the male and female e(x) rows, not from the mean of the two q(x) values',
      'DUPLICATION: packages/planner-ui/src/socialSecurity/expectedPv.ts#oneYearSurvival re-derives p(x) = (e(x) - 0.5)/(e(x+1) + 0.5) from the same rows (with an optional multiplier scaling e(x) and Math.round instead of floor on the age); packages/planner-ui/src/socialSecurity/expectedPv.mortalityParity.test.ts proves the two agree at multiplier 1 for the worksheet rows x = 65, 66, 67 within 1e-12, in the planner-ui suite so the engine suite never loads a UI module. Moving the UI copy into the engine is packet B2-P1 of the bidirectional validation plan',
    ],
    implementedBy: ['packages/engine/src/montecarlo/mortality.ts'],
    implementedByFunctions: ['packages/engine/src/montecarlo/mortality.ts#annualMortality'],
    verifiedOn: '2026-09-14',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'mortality-sampled-death-age': {
    title: 'Sampled death age: inverse-Bernoulli walk over annual death probabilities',
    purpose: 'The last full age alive a stochastic-longevity path draws for each person.',
    kind: 'model',
    // No family carries a death-age field; the draw decides on which paths a
    // person is alive in a year, which is what the Monte Carlo success rate
    // and the ending-balance histogram aggregate (the worksheet's Family).
    // The draw enters those aggregates as a per-path input; it is not their value.
    outputs: [],
    feeds: ['monte-carlo-success-rate', 'monte-carlo-ending-investable-histogram'],
    statement:
      'Starting at x = floor(max(currentAge, 0)): for each integer age x < 119, draw one uniform U in [0, 1) from the path RNG; if U < q(x) return x (alive through x, dead before x + 1), otherwise advance to x + 1. Reaching x = 119 returns 119 without a draw. One draw per year survived, in age order, so the result is deterministic for a fixed RNG stream. Units: integer age. Rounding: the starting age is floored.',
    formula: {
      expression: 'death age = min{ x >= x0 : U_x < q(x) }, or 119 when no such x < 119 exists',
      variables: [
        { symbol: 'x0', meaning: 'Starting integer age, floor(max(currentAge, 0))', unit: 'years', domain: 'integer >= 0' },
        { symbol: 'U_x', meaning: 'Uniform draw consumed at age x', unit: '1', domain: '[0, 1)' },
        { symbol: 'q(x)', meaning: 'One-year death probability at x (mortality-ex-to-qx-identity)', unit: '1', domain: '[0, 1]' },
      ],
      timing: 'annual; one draw per integer age from the current age until death',
      rounding: 'starting age floored; the result is an integer',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/longevity/mortality-sampled-death-age.md',
    },
    limits: [
      'Period-table hazards are applied throughout the remaining lifetime; the draw does not predict an individual\'s death',
      'No proportional-hazards adjustment: sampled deaths use the unadjusted q(x), so the longevity questionnaire\'s multiplier does not reach the stochastic draw',
      'Exactly one RNG draw is consumed per year survived, so the death age shifts every later draw on the same path stream',
      'The table endpoint (age 119) forces death; nobody is sampled past it',
    ],
    implementedBy: ['packages/engine/src/montecarlo/mortality.ts'],
    implementedByFunctions: ['packages/engine/src/montecarlo/mortality.ts#sampleDeathAge'],
    verifiedOn: '2026-09-14',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'mortality-joint-last-survivor-expectancy': {
    title: 'Joint last-survivor life expectancy of two independent lives',
    purpose: 'The expected years until both members of a couple are dead, used to size joint-and-survivor annuity forms.',
    kind: 'formula',
    // "none yet" in the worksheet: the census exposes no joint-expectancy
    // family. The only engine consumer is projection/annuityForms.ts
    // #annuityExclusionMultiple, which uses it as the expected-return
    // multiple of a joint-and-survivor payout form (the registry's
    // Treas. Reg. 1.72-5(b)(2) rule pins this function), so the annuity
    // income family whose taxable split that multiple shapes is the nearest.
    // The gross payment the family publishes does not depend on this record,
    // so the nearest family is fed, not output.
    outputs: [],
    feeds: ['income-annuity-annual'],
    statement:
      'For lives A and B at integer ages a and b with their own sex tables, e = 0.5 + sum over t = 1..120 of [1 - (1 - S_A(t))(1 - S_B(t))], where S_A(t) = product over k = 0..t-1 of (1 - q(a + k)) is A\'s probability of surviving t more years and S_B likewise. Lifetimes are independent. Because q = 1 at age 119, a life past the table contributes S = 0 and later terms add only the other life\'s survival. Units: years. Rounding: none.',
    formula: {
      expression: 'e = 0.5 + sum_{t=1..120} [1 - (1 - S_A(t))(1 - S_B(t))]; S(t) = prod_{k<t} (1 - q(age + k))',
      variables: [
        { symbol: 'a, b', meaning: 'Current integer ages of the two lives', unit: 'years', domain: 'integer >= 0' },
        { symbol: 'S_A(t), S_B(t)', meaning: 'Probability each life survives t more years', unit: '1', domain: '[0, 1], nonincreasing in t' },
        { symbol: 'e', meaning: 'Expected years until the second death', unit: 'years', domain: 'e >= 0.5' },
      ],
      timing: 'annual survival steps; the 0.5 is the within-year death convention',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/longevity/mortality-joint-last-survivor-expectancy.md',
    },
    limits: [
      'Independent lifetimes; shared household hazards are not modeled and can be understated',
      'Curtate expectation plus one half; no hazard adjustment is applied to either life',
      'Ages are used as passed (annualMortality floors them); a negative age is treated as 0 by the caller, not here',
      'The census exposes no joint-expectancy output; income-annuity-annual is named as the nearest family because the joint-and-survivor exclusion multiple shapes that income\'s taxable portion',
    ],
    implementedBy: ['packages/engine/src/montecarlo/mortality.ts'],
    implementedByFunctions: ['packages/engine/src/montecarlo/mortality.ts#jointLastSurvivorExpectancy'],
    verifiedOn: '2026-09-14',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'survival-probability-product': {
    title: 'Conditional survival to a target age: product of hazard-adjusted one-year survivals',
    purpose: 'The probability someone alive today is still alive at a later integer age, on the SSA table with an optional health hazard.',
    kind: 'formula',
    // A survival product is an intermediate: the percentile-age searches walk
    // it for the threshold crossing, and nothing else consumes it. The Monte
    // Carlo reaches mortality through sampleDeathAge and the q(x) identity, not
    // through this product. No surface publishes the product itself.
    outputs: [],
    feeds: ['longevity-survival-percentile-age'],
    statement:
      'For current age c, target age g, sex and hazard power h (default 1): with from = floor(max(c, 0)) and to = floor(g), S = product over x = from..to-1 of (1 - q(x))^h, where the factor is 0 when q(x) >= 1. Returns 1 when to <= from, and 0 as soon as the running product reaches 0. Units: probability. Rounding: none.',
    formula: {
      expression: 'S(c -> g) = prod_{x=from}^{to-1} (1 - q(x))^h; S = 1 when to <= from',
      variables: [
        { symbol: 'from, to', meaning: 'Floored current and target ages', unit: 'years', domain: 'integer, from >= 0' },
        { symbol: 'q(x)', meaning: 'One-year death probability at x (mortality-ex-to-qx-identity)', unit: '1', domain: '[0, 1]' },
        { symbol: 'h', meaning: 'Proportional-hazards power (q\' = 1 - (1 - q)^h; h > 1 is worse health)', unit: '1', domain: 'h > 0' },
        { symbol: 'S', meaning: 'Probability of being alive at the target age', unit: '1', domain: '[0, 1]' },
      ],
      timing: 'annual; one factor per integer age from the current age up to, not including, the target',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/longevity/survival-probability-product.md',
    },
    limits: [
      'Ages are floored; a fractional current or target age is not interpolated',
      'A target at or below the current age returns exactly 1 without consulting the table',
      'The hazard power is not validated; a non-positive h is used as passed',
      'annualSurvival is module-private; the evidence reaches it through survivalProbabilityTo',
    ],
    implementedBy: ['packages/engine/src/montecarlo/survival.ts'],
    implementedByFunctions: [
      'packages/engine/src/montecarlo/survival.ts#survivalProbabilityTo',
      'packages/engine/src/montecarlo/survival.ts#annualSurvival',
    ],
    verifiedOn: '2026-09-14',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'survival-percentile-age': {
    title: 'Survival-percentile planning age: oldest age reached with probability at least pct/100',
    purpose: 'The single-life planning age the assumptions card previews: the age a person has a pct% chance of reaching.',
    kind: 'formula',
    outputs: ['longevity-survival-percentile-age'],
    statement:
      'For current age c, sex, percentage p and hazard power h (default 1): threshold = min(max(p, 0.1), 100)/100. Starting at from = floor(max(c, 0)) with S = 1 and best = from, for x = from..119 multiply S by (1 - q(x))^h; while S >= threshold record best = x + 1, and stop at the first x whose S falls below the threshold. Returns best: the oldest integer age whose conditional survival from c is at least the threshold, always >= from. Units: integer age. Rounding: none.',
    formula: {
      expression: 'age* = max{ g >= from : S(from -> g) >= p/100 }, with S(from -> from) = 1',
      variables: [
        { symbol: 'from', meaning: 'Floored current age', unit: 'years', domain: 'integer >= 0' },
        { symbol: 'p', meaning: 'Percent chance of reaching the age, clamped to [0.1, 100]', unit: 'percent', domain: '0.1 <= p <= 100' },
        { symbol: 'S(from -> g)', meaning: 'Conditional survival to g (survival-probability-product)', unit: '1', domain: '[0, 1], nonincreasing in g' },
        { symbol: 'age*', meaning: 'Survival-percentile planning age', unit: 'years', domain: 'from <= age* <= 119' },
      ],
      timing: 'annual survival steps over integer ages',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/longevity/survival-percentile-age.md',
    },
    limits: [
      'The percentage is clamped to [0.1, 100] before use, a bound the signature comment does not state; a value passed as a probability (0.97) is read as 0.97%',
      'Survival is nonincreasing, so the qualifying ages form an initial interval and the loop may stop at the first failure',
      'The signature comment bounds the result by MAX_AGE + 1 (120); since q(119) = 1 the survival to 120 is 0 and 119 is the largest value actually returned',
      'The planner-ui SurvivalPercentileModal clamps the result to 60..120 before it becomes the plan\'s planning age; that clamp is presentation and is not part of this record',
    ],
    implementedBy: ['packages/engine/src/montecarlo/survival.ts'],
    implementedByFunctions: ['packages/engine/src/montecarlo/survival.ts#survivalPercentileAge'],
    verifiedOn: '2026-09-14',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'joint-survival-percentile-age': {
    title: 'Joint (either-survives) percentile age on the primary\'s age clock',
    purpose: 'The couple\'s planning age: the oldest primary age at which at least one of two independent lives is alive with probability at least pct/100.',
    kind: 'formula',
    outputs: ['longevity-survival-percentile-age'],
    statement:
      'With from = floor(max(primary.age, 0)), partnerFrom = floor(max(partner.age, 0)) and threshold = min(max(p, 0.1), 100)/100: for t = 0, 1, ... while from + t <= 120, let P(t) = 1 - (1 - S_primary(t))(1 - S_partner(t)), where each S(t) is the product of (1 - q)^h over the t ages from that person\'s own starting age under that person\'s hazard (default 1). Record best = from + t while P(t) >= threshold; stop at the first t below the threshold, or once both survivals are 0. Returns best; P(0) = 1, so the result is always >= from and never below the primary\'s single-life answer. Units: integer primary age. Rounding: none.',
    formula: {
      expression: 'age* = max{ from + t : 1 - (1 - S_primary(t))(1 - S_partner(t)) >= p/100 }',
      variables: [
        { symbol: 'from, partnerFrom', meaning: 'Floored current ages of primary and partner', unit: 'years', domain: 'integer >= 0' },
        { symbol: 't', meaning: 'Years elapsed on the primary\'s clock', unit: 'years', domain: 'integer >= 0, from + t <= 120' },
        { symbol: 'S_primary(t), S_partner(t)', meaning: 'Each life\'s survival over t more years (survival-probability-product)', unit: '1', domain: '[0, 1]' },
        { symbol: 'p', meaning: 'Percent chance that at least one is alive, clamped to [0.1, 100]', unit: 'percent', domain: '0.1 <= p <= 100' },
      ],
      timing: 'annual; both curves advance one year per step on the primary\'s clock',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/longevity/joint-survival-percentile-age.md',
    },
    limits: [
      'Independent lifetimes; the either-alive probability is the complement of both being dead, 1 - (1 - S_a)(1 - S_b)',
      'The partner\'s clock is offset by the age difference and advances with the primary\'s; the answer is a primary age, not a partner age',
      'The percentage is clamped to [0.1, 100] before use, a bound the signature comment does not state',
      'Each person\'s hazard power applies to that person\'s own curve; a missing hazard is 1',
    ],
    implementedBy: ['packages/engine/src/montecarlo/survival.ts'],
    implementedByFunctions: ['packages/engine/src/montecarlo/survival.ts#jointSurvivalPercentileAge'],
    verifiedOn: '2026-09-14',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'survival-hazard-from-expectancy-multiplier': {
    title: 'Hazard power for a remaining-years multiplier, solved by bisection',
    purpose: 'Turns the longevity questionnaire\'s remaining-years multiplier into the proportional-hazards power the percentile ages use.',
    kind: 'model',
    // The worksheet names longevity-survival-percentile-age "upstream": the
    // solved power is the hazard the percentile pickers apply, an input to
    // the age they publish rather than the age itself.
    outputs: [],
    feeds: ['longevity-survival-percentile-age'],
    statement:
      'Given age, sex and multiplier m: target = max(0.1, m) x e_baseline(age, sex), the SSA remaining expectancy (linearly interpolated for a fractional age, averaged across sexes for "average"). E(h) = 0.5 + sum over x = from..119 of S(x), where S is the running product of (1 - q(x))^h from from = floor(max(age, 0)) and the sum stops once S <= 1e-12. E is strictly decreasing in h. If E(0.2) <= target return 0.2; if E(8) >= target return 8; otherwise bisect [0.2, 8] for 40 halvings, raising lo to the midpoint when E(mid) > target and lowering hi otherwise, and return the final midpoint. For m = 1, E(1) rebuilt from the derived q(x) matches e_baseline within the worksheet\'s 1e-6 absolute tolerance rather than exactly, because the embedded SSA e(x) rows are rounded to two decimals; the root is therefore h = 1 within that tolerance (exactly 1 only for an internally consistent table), and the bisection\'s final interval width is 7.8/2^40. Units: dimensionless hazard power. Rounding: none.',
    formula: {
      expression: 'h* = argsolve_h E(h) = max(0.1, m) e_baseline, h in [0.2, 8]; E(h) = 0.5 + sum_x prod_{k<=x} (1 - q(k))^h',
      variables: [
        { symbol: 'm', meaning: 'Remaining-years multiplier from the longevity questionnaire (m < 1 is shorter)', unit: '1', domain: 'floored at 0.1' },
        { symbol: 'e_baseline', meaning: 'SSA remaining life expectancy at the age and sex', unit: 'years', domain: '> 0' },
        { symbol: 'E(h)', meaning: 'Remaining expectancy under hazard power h', unit: 'years', domain: 'strictly decreasing in h' },
        { symbol: 'h*', meaning: 'Solved hazard power', unit: '1', domain: '0.2 <= h* <= 8' },
      ],
      timing: 'annual survival steps; the 0.5 is the within-year death convention',
      rounding: 'none; the bisection stops after 40 halvings',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/longevity/survival-hazard-from-expectancy-multiplier.md',
    },
    limits: [
      'Proportional hazards is the modeling choice: the multiplier is matched on remaining expectancy only, not on the shape of the survival curve',
      'The result is clamped to [0.2, 8] and the multiplier floored at 0.1, so extreme questionnaire answers cannot degenerate the curve; the clamps are unstated in the signature comment',
      'The questionnaire\'s factors are not validated here; the record maps a given multiplier, whatever its source',
      'The expectancy sum stops once the running survival falls to 1e-12, and the bisection runs a fixed 40 halvings rather than to a stated tolerance',
      'expectancyUnderHazard is module-private; the evidence recomputes the adjusted expectancy through survivalProbabilityTo at the solved power',
      'The worksheet example is the identity point m = 1, so the evidence pins the fixed point and the expectancy identity, not the bisection away from it; survival.test.ts covers direction and monotonicity for m = 0.8 and 1.12, and a non-identity worksheet case is owed by a later derive round',
    ],
    implementedBy: ['packages/engine/src/montecarlo/survival.ts'],
    implementedByFunctions: [
      'packages/engine/src/montecarlo/survival.ts#hazardForExpectancyMultiplier',
      'packages/engine/src/montecarlo/survival.ts#expectancyUnderHazard',
    ],
    verifiedOn: '2026-09-14',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'longevity-depletion-year': {
    title: 'Depletion year: the first projection year whose shortfall clears the funding tolerance',
    purpose: 'The year the headline results call the plan depleted, or null when every year was funded.',
    kind: 'model',
    outputs: ['longevity-depletion-year'],
    statement:
      'ProjectionResult.depletionYear is the first projection year, in year order, whose YearResult.shortfall — the funding shortfall left after every withdrawal and any HECM backstop draw — is strictly greater than projection/moneyTolerance.ts#ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS ($0.005, the ledger\'s own residual budget). A residual at or below that budget is not depletion; once a year is recorded the value is never replaced by a later one; and the field is null when no year exceeds the tolerance. Units: calendar year, or null. Rounding: none; the comparison is strict.',
    formula: {
      expression: 'depletionYear = min{ y : shortfall_y > ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS }, else null',
      variables: [
        { symbol: 'shortfall_y', meaning: 'Year y\'s funding shortfall after every withdrawal and any HECM backstop draw', unit: 'usd', domain: 'shortfall_y >= 0' },
        { symbol: 'ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS', meaning: 'The funding fixed point\'s accepted residual', unit: 'usd', domain: '0.005' },
        { symbol: 'depletionYear', meaning: 'First qualifying calendar year', unit: 'year', domain: 'a projection year, or null' },
      ],
      timing: 'annual; tested in each year\'s funding-and-close phase, in year order',
      rounding: 'none; strictly greater than the half-cent tolerance',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/longevity/longevity-depletion-year.md',
    },
    limits: [
      'Beyond the worksheet\'s inputs the evidence plan fixes: one cash account (so no market shock and no taxable yield reach it), a 51-year-old single filer under 65 (no Medicare premium, no early-withdrawal exposure), zero income, zero inflation and zero return, base spending as the only expense, and an explicit horizonEndYear of 2028 so the three rows are exactly 2026-2028',
      'The tolerance is a residual budget, not a balance test: a year that closes at exactly zero with every dollar of spending funded is not depletion, which is why the $30,000 opening balance against the same $10,000 gap still publishes null',
      'The field records the FIRST qualifying year only; later shortfalls do not move it, and a plan that recovers after a shortfall year still reports that year',
      'The comparison is strict (>), so a shortfall of exactly $0.005 is accepted as a rounding residual rather than depletion; the evidence does not pin that boundary, which would need a plan whose funding residual lands on the tolerance exactly',
    ],
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts#annualFundingApplicationAndClosePhase',
    ],
    verifiedOn: '2026-09-18',
    provenance: { derivedBy: 'codex', implementedBy: 'claude', reviewedBy: 'cursor' },
  },
} satisfies Record<string, CalculationRecord>
