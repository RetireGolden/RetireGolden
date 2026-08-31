/**
 * The option modes a capture runs, and what each one is FOR.
 *
 * A year phase's product leaves `simulatePlan` through several channels, and a
 * mode that does not open a channel cannot see a defect confined to it. Running
 * only the default mode is the single easiest way to build a differential check
 * that passes for the wrong reason.
 *
 *   default          `yearSites` is null under default options, so this mode
 *                    executes NO `yearSites?.record*(...)` call anywhere. It is
 *                    the mode every product projection actually uses — and the
 *                    reason a ledger-payload defect is invisible in it.
 *   cashFlow         `captureAnnualCashFlow: true`: the only mode that reaches
 *                    the recorders, the sinks' `skipNonPositive` drops, and the
 *                    published `year.cashFlow` line ids and their ORDER.
 *   optimizerProbe   the `OptimizerYearProbe` the LP linearization consumes. A
 *                    defect confined to the probe moves no ProjectionResult
 *                    leaf and still reaches the optimizer, so a dump that
 *                    encodes only the ProjectionResult would pass it.
 *   counterfactual   the counterfactual annual-liability readings. Each
 *                    reading carries the year's liability as an EXACT RATIONAL
 *                    in minor units (bigint numerator over denominator) plus a
 *                    sha256 over the canonicalised tax inputs, so a last-bit
 *                    change in an income accumulator moves both.
 *
 * DELIBERATELY EXCLUDED, as measurement gaps rather than claims of insensitivity:
 *   - the optimizer's solve path: it records a wall-clock `solveMs` and loads a
 *     HiGHS wasm module, so it is not deterministic here;
 *   - Monte Carlo: it only re-runs `simulatePlan`, adding runtime without
 *     adding reach for a once-per-year phase. A corpus member wanting the
 *     market-path branch should carry a literal inflation/return series
 *     instead, which is deterministic.
 *
 * Each mode declares a `channelSize` so "this mode opened its channel" is
 * CHECKED per entry rather than assumed. A mode silently contributing nothing
 * is exactly as invisible as the defects it exists to catch.
 */

/** @typedef {{ result: unknown, optimizerProbes: unknown[] | null, counterfactualReadings: unknown[] | null }} RunOutput */

/**
 * @typedef {object} Mode
 * @property {string} id
 * @property {string} why
 * @property {(sinks: { probes: unknown[], readings: unknown[] }) => object} extraOptions
 * @property {(out: RunOutput) => number | null} channelSize
 *   null = this mode opens no extra channel, so there is nothing to check.
 */

/** @type {readonly Mode[]} */
export const MODES = [
  {
    id: 'default',
    why: 'yearSites null: the product path, and the only mode with no recorder calls at all',
    extraOptions: () => ({}),
    channelSize: () => null,
  },
  {
    id: 'cashFlow',
    why: 'the annual cash-flow ledger: recorder calls, skipNonPositive drops, line ids and order',
    extraOptions: () => ({ captureAnnualCashFlow: true }),
    channelSize: () => null,
  },
  {
    id: 'optimizerProbe',
    why: 'the OptimizerYearProbe the LP linearization reads; invisible in ProjectionResult',
    extraOptions: (sinks) => ({
      captureAnnualCashFlow: true,
      captureOptimizerInputs: (probe) => sinks.probes.push(probe),
    }),
    channelSize: (out) => (out.optimizerProbes === null ? 0 : out.optimizerProbes.length),
  },
  {
    id: 'counterfactual',
    why: 'exact-rational annual liability plus a sha256 tax-input snapshot id per year',
    extraOptions: (sinks) => ({
      captureAnnualCashFlow: true,
      annualCounterfactual: {
        omitActionIds: [],
        // Literal, so every identity hash downstream is reproducible.
        taxUnitId: 'equivalence-dump-tax-unit',
        nonGroupTaxInputs: [],
        capture: (reading) => sinks.readings.push(reading),
      },
    }),
    channelSize: (out) => (out.counterfactualReadings === null ? 0 : out.counterfactualReadings.length),
  },
]

export const MODE_IDS = MODES.map((mode) => mode.id)

/** @param {readonly string[]} ids @returns {readonly Mode[]} */
export function selectModes(ids) {
  return ids.map((id) => {
    const mode = MODES.find((candidate) => candidate.id === id)
    if (mode === undefined) throw new Error(`unknown mode "${id}" (known: ${MODE_IDS.join(', ')})`)
    return mode
  })
}

/**
 * Run one corpus member in one mode and return its COMPLETE observable output.
 * Absent channels are `null` rather than omitted, so the encoder emits an
 * explicit leaf for them and a channel that silently stopped being captured is
 * a textual diff rather than a missing key.
 *
 * @param {object} engine loaded engine surface
 * @param {object} member `{ plan, options, tax }` from a corpus file
 * @param {Mode} mode
 * @returns {RunOutput}
 */
export function runMember(engine, member, mode) {
  const parsed = engine.parsePlan(member.plan)
  if (!parsed.ok) {
    throw new Error(`corpus member "${member.id}" does not parse: ${parsed.issues.join('; ')}`)
  }
  const sinks = { probes: [], readings: [] }
  const result = engine.simulatePlan(parsed.plan, {
    ...member.options,
    taxCalculator: buildTaxCalculator(engine, member.tax, parsed.plan),
    ...mode.extraOptions(sinks),
  })
  return {
    result,
    optimizerProbes: mode.id === 'optimizerProbe' ? sinks.probes : null,
    counterfactualReadings: mode.id === 'counterfactual' ? sinks.readings : null,
  }
}

/**
 * Tax stacks are named by a small JSON descriptor rather than carried as a
 * function, so a corpus file is data that survives a round trip and both trees
 * build their own calculator from the same description.
 *
 * @param {object} engine
 * @param {{ kind: string }} tax
 * @param {object} plan the PARSED plan, for the plan-derived state overrides
 */
function buildTaxCalculator(engine, tax, plan) {
  const federal = engine.createFederalTaxCalculator()
  if (tax.kind === 'production') {
    return engine.combineTaxCalculators(federal, engine.createStateTaxCalculator())
  }
  if (tax.kind === 'planState') {
    // What `examples.golden.test.ts` runs: the state calculator configured from
    // the plan's own assumption fields.
    return engine.combineTaxCalculators(
      federal,
      engine.createStateTaxCalculator({
        overridePct: plan.assumptions.stateEffectiveTaxPct,
        localPct: plan.assumptions.localIncomeTaxPct,
      }),
    )
  }
  throw new Error(`unknown tax descriptor kind "${tax.kind}"`)
}
