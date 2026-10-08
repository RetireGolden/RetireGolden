// The split years behind two figures the part-year work of engine 0.4.3 moves (Codex's review
// of 2026-10-08, py2c, items u1-annuity and relocation): the U1 household's annuity effect from a
// 2026 start (packages/planner-ui/src/planner/preStartEvents.figures.test.ts), and the relocation
// candidates over the example library whose lifetime state and local tax moved. For each split
// year it prints the states and their months, the retirement rows each state's slice received,
// and each slice's state tax.
//
// It reads a checkout's TypeScript sources through that checkout's own Vite SSR loader
// (app/scripts/viteSsr.mjs) and makes the calls the tests make: planner-ui's projectPlan and
// buildExampleCouple, the engine's parsePlan, compareRelocationCandidates,
// relocationScenarioPatch, applyScenarioPatch and simulatePlan, the planner's tax stack
// (planTaxCalculator.ts), and createStateTaxCalculator's computeResult on each split year's
// accepted tax input. A checkout with tax/statePartYear.ts (0.4.3) reports the slices from
// StateTaxComputationResult.partYear and the rows from allocateSplitYear. One without it (0.4.2)
// prices each slice alone, the accepted input with that state's months as its only residency,
// which is how 0.4.2 summed a split year; 0.4.2 gave a slice no rows.
//
// Run from the repository root, the checkout's dependencies installed:
//   node DOCS/calculations/taxes/scripts/part-year-split-years.mjs             this checkout
//   node DOCS/calculations/taxes/scripts/part-year-split-years.mjs <checkout>  another one, such
//     as a worktree of 9b997500 (engine 0.4.2, the figures before the part-year work)
// part-year-split-years.output.txt beside this file holds both runs.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const checkout = resolve(process.argv[2] ?? '.')
const commit = execFileSync('git', ['-C', checkout, 'rev-parse', '--short=9', 'HEAD'], { encoding: 'utf8' }).trim()
const hasAllocator = existsSync(join(checkout, 'packages', 'engine', 'src', 'tax', 'statePartYear.ts'))
const { withSsrModules } = await import(pathToFileURL(join(checkout, 'app', 'scripts', 'viteSsr.mjs')).href)

const START_YEAR = 2026
// The five relocation candidates the bundle-headroom harness ran against every example plan
// (DOCS/operations/bundle-budget.md, "No computed figure moves"), from a 2026 start, without
// Monte Carlo.
const CANDIDATES = [
  { state: 'FL', moveYear: 2030 },
  { state: 'AZ', moveYear: 2028, moveMonth: 4 },
  { state: 'NY' },
  { state: 'PA', moveYear: 2031, moveMonth: 10 },
  { state: 'OR', moveYear: 2027 },
]
// The candidates whose lifetime state and local tax differs between the 0.4.2 run and the
// 0.4.3 run below: the table in the output shows every plan and candidate.
const DETAIL = [
  ['example-couple', [0, 1, 3]],
  ['glidepath-allocation', [3]],
  ['static-allocation-control', [3]],
]

const money = (n) => (Object.is(n, -0) ? 0 : n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const label = (c) => `${c.state}${c.moveYear === undefined ? '' : ` ${c.moveYear}${c.moveMonth === undefined ? '' : `-${String(c.moveMonth).padStart(2, '0')}`}`}`
const lines = []
const say = (text = '') => lines.push(text)

await withSsrModules({
  plan: '@retiregolden/engine/model/plan',
  relocation: '@retiregolden/engine/projection/relocation',
  simulate: '@retiregolden/engine/projection/simulate',
  scenarios: '@retiregolden/engine/scenarios/scenarios',
  stateTax: '@retiregolden/engine/tax/stateTax',
  couple: '@retiregolden/planner-ui/planner/examples/buildExampleCouple',
  registry: '@retiregolden/planner-ui/planner/examples/registry',
  projection: '@retiregolden/planner-ui/projection',
  taxStack: '@retiregolden/planner-ui/planTaxCalculator',
  ...(hasAllocator ? { partYear: '@retiregolden/engine/tax/statePartYear' } : {}),
}, async (m) => {
  const stateCalculator = (plan) => m.stateTax.createStateTaxCalculator({
    overridePct: plan.assumptions.stateEffectiveTaxPct,
    localPct: plan.assumptions.localIncomeTaxPct,
  })

  // Every split year of one projection: states, months, rows and each slice's state tax.
  function splitYears(plan, years) {
    const calculator = stateCalculator(plan)
    for (const row of years) {
      const input = row.acceptedTaxInput
      const residency = (input?.stateResidency ?? []).filter((segment) => segment.months > 0)
      if (input === undefined || residency.length < 2) continue
      const year = calculator.computeResult(input)
      say(`  ${input.year}: ${residency.map((s) => `${s.state} ${s.months} months`).join(', ')}; year-end state ${input.state}; state tax ${money(year.totalTax)} (${year.status})`)
      const rows = input.stateRetirementDistributions
      if (hasAllocator) {
        const spans = m.partYear.residencySpans(input.stateResidency)
        const qcd = input.stateQcdEventFacts?.map((event) => ({ ...event, directTransfer: event.directTransfer === true }))
        year.partYear.slices.forEach((slice, index) => {
          const ratio = slice.incomeRatio === undefined ? '' : `, ratio ${slice.incomeRatio.toFixed(6)}`
          say(`    ${slice.state}: ${slice.months} months, ${slice.method}${ratio}, state tax ${money(slice.totalTax)}`)
          const allocated = m.partYear.allocateSplitYear(input, spans[index], rows, qcd, input.stateHouseholdFacts, 0)
          for (const fact of allocated.rows ?? []) {
            const conversion = fact.rothConversionAmount === undefined ? '' : `, Roth conversion ${money(fact.rothConversionAmount)}`
            const date = fact.distributionDate === undefined ? ', undated' : `, dated ${fact.distributionDate}`
            say(`      row ${fact.accountId} (${fact.sourceKind}, owner ${fact.ownerPersonId}, age ${Number(fact.recipientAgeYears.toFixed(2))}): included ${money(fact.federallyIncludedAmount)}${conversion}${date}`)
          }
          if ((allocated.rows ?? []).length === 0) say('      no retirement rows')
        })
        say(`    spread by months: ${money(year.partYear.undatedIncomeSpreadByMonths)}`)
      } else {
        for (const segment of residency) {
          const alone = calculator.computeResult({ ...input, stateResidency: [segment] })
          say(`    ${segment.state}: ${segment.months} months, the months share of the year, state tax ${money(alone.totalTax)}; no rows`)
        }
        for (const fact of rows ?? []) {
          const conversion = fact.rothConversionAmount === undefined ? '' : `, Roth conversion ${money(fact.rothConversionAmount)}`
          say(`    the year's row ${fact.accountId} (${fact.sourceKind}, owner ${fact.ownerPersonId}, age ${Number(fact.recipientAgeYears.toFixed(2))}): included ${money(fact.federallyIncludedAmount)}${conversion}`)
        }
      }
    }
  }

  say(`part-year-split-years.mjs at ${commit} (${hasAllocator ? 'with' : 'without'} tax/statePartYear.ts)`)
  say()

  // U1: preStartEvents.figures.test.ts#household, the review L7 household.
  const BROKERAGE = 'example-couple--brokerage'
  function household(annuity) {
    const plan = structuredClone(m.couple.buildExampleCouple())
    plan.id = 'saved-couple'
    plan.name = 'Our plan'
    plan.origin = 'user'
    delete plan.exampleSourceId
    plan.createdAtIso = '2026-10-15T15:00:00.000Z'
    plan.updatedAtIso = '2026-10-15T15:00:00.000Z'
    const alex = plan.household.people[0].id
    plan.expenses.oneTimeGoals.push({ id: 'car', label: 'New car', year: 2026, amount: 30_000 })
    plan.incomes.push({ type: 'oneTime', id: 'inh', label: 'Inheritance', year: 2026, inflationAdjusted: false, amount: 50_000, taxTreatment: 'none' })
    plan.strategies.rothConversion = { mode: 'fillToTarget', target: 'topOfBracket', targetValue: 22, startYear: 2026, endYear: 2030 }
    if (annuity) {
      plan.accounts.push({
        type: 'annuity', id: 'spia', name: 'Income annuity', ownerPersonId: alex, annualReturnPct: null,
        startAge: 67, monthlyAmount: 550, colaPct: 0, taxablePct: 0,
        purchase: { year: 2026, premium: 100_000, fundingAccountId: BROKERAGE, taxQualification: 'nonQualified' },
      })
    }
    plan.household.stateMoves = [{ fromYear: 2026, fromMonth: 11, state: 'FL' }]
    const parsed = m.plan.parsePlan(plan)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    return parsed.plan
  }
  say('U1 (Kentucky to Florida in November 2026), from a 2026 start')
  const ending = {}
  for (const [name, annuity] of [['with the annuity', true], ['without the annuity', false]]) {
    const plan = household(annuity)
    const { result } = m.projection.projectPlan(plan, START_YEAR)
    ending[name] = result.endingNetWorth
    say(` ${name}: ending net worth ${money(result.endingNetWorth)}`)
    splitYears(plan, result.years)
  }
  say(` the annuity's effect: ${money(ending['with the annuity'] - ending['without the annuity'])}`)
  say()

  // Relocation: every example plan against the five candidates.
  say(`Relocation, lifetime state and local tax, from a ${START_YEAR} start: baseline | ${CANDIDATES.map(label).join(' | ')}`)
  const examples = new Map(m.registry.EXAMPLE_PLANS.map((example) => [example.id, example]))
  for (const id of [...examples.keys()].sort()) {
    const comparison = m.relocation.compareRelocationCandidates(examples.get(id).build(), CANDIDATES, { startYear: START_YEAR, monteCarlo: null })
    say(` ${id}: ${comparison.rows.map((row) => money(row.lifetimeStateLocalTax)).join(' | ')}`)
  }
  say()
  for (const [id, indexes] of DETAIL) {
    const base = examples.get(id).build()
    for (const index of indexes) {
      const candidate = CANDIDATES[index]
      const applied = m.scenarios.applyScenarioPatch(base, m.relocation.relocationScenarioPatch(base, candidate, START_YEAR))
      if (!applied.ok) throw new Error(applied.issues.join('; '))
      const comparison = m.relocation.compareRelocationCandidates(base, [candidate], { startYear: START_YEAR, monteCarlo: null })
      say(`${id}, candidate ${index} (${label(candidate)}): lifetime state and local tax ${money(comparison.rows[1].lifetimeStateLocalTax)}`)
      const result = m.simulate.simulatePlan(applied.plan, { startYear: START_YEAR, taxCalculator: m.taxStack.taxCalculatorFor(applied.plan) })
      splitYears(applied.plan, result.years)
    }
  }
})

process.stdout.write(`${lines.join('\n')}\n`)
