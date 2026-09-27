import { describe, expect, it } from 'vitest'

import type { Plan } from '@retiregolden/engine/model/plan'
import { ACA_COVERAGE_YEARS, LATEST_ACA_COVERAGE_YEAR } from '@retiregolden/engine/params'
import { applyScenarioPatch } from '@retiregolden/engine/scenarios/scenarios'

import { EXAMPLE_PLAN_BODIES } from '../../learn/content/examplePlanBodies'
import { projectPlan } from '../../projection'
import { EXAMPLE_FIXED_YEAR } from './buildContext'
import { getExampleById, type ExamplePlan } from './registry'

/**
 * The figures the example library prints, held to the engine.
 *
 * The copy of four examples (the registry's teaches and lookFor, and the Learn
 * articles' bodies) states engine results: depletion years, penalties,
 * lifetime tax, the years a credit is priced, the years Medicare's income
 * surcharge applies. Each phrase below is built from a projection of the plan
 * as the library builds it (and, for the bridge pair, of its built-in
 * scenario), and the copy must contain it word for word. A change to the
 * engine that moves a figure, or an edit to the copy that changes one, fails
 * here instead of leaving the copy false. The years a premium tax credit is
 * priced come from the published coverage-year blocks, so the day a new
 * year's block lands the "so far" sentences fail until they are reworded.
 */

const usd = (amount: number) => `$${Math.round(amount).toLocaleString('en-US')}`
/** A list as the copy writes one: "2026 and 2027", "2026, 2027 and 2028". */
const listed = (items: readonly (number | string)[]) =>
  items.length === 1 ? String(items[0]) : `${items.slice(0, -1).join(', ')} and ${String(items.at(-1))}`
const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six']

function textOf(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(textOf).join('\n')
  if (value !== null && typeof value === 'object') return Object.values(value).map(textOf).join('\n')
  return ''
}

function example(id: string): ExamplePlan {
  const found = getExampleById(id)
  if (!found) throw new Error(`no example ${id}`)
  return found
}

/** The example as the library stamps it before the planner opens it (the copy describes that plan). */
function stamped(id: string): Plan {
  return { ...example(id).build(), origin: 'example', exampleSourceId: id }
}

function body(id: string): string {
  const blocks = EXAMPLE_PLAN_BODIES[`example-${id}`]
  if (!blocks) throw new Error(`no learn body for ${id}`)
  return textOf(blocks)
}

function run(plan: Plan) {
  return projectPlan(plan, { startYear: EXAMPLE_FIXED_YEAR })
}

function yearOf(view: ReturnType<typeof run>, year: number) {
  const row = view.result.years.find((entry) => entry.year === year)
  if (!row) throw new Error(`no ${year} row`)
  return row
}

const lifetimeTax = (view: ReturnType<typeof run>) => view.summary.lifetimeTaxesAndPenalties
const yearsWhere = (view: ReturnType<typeof run>, test: (year: ReturnType<typeof run>['result']['years'][number]) => boolean) =>
  view.result.years.filter(test).map((year) => year.year)

function contiguous(years: readonly number[]): { first: number; last: number } {
  expect(years.length).toBeGreaterThan(0)
  const first = years[0]!
  const last = years.at(-1)!
  expect(years).toEqual(Array.from({ length: last - first + 1 }, (_, i) => first + i))
  return { first, last }
}

describe('example copy figures', () => {
  it('early retiree and the ACA cliff: the credit years, the premium, the bracket and the cliff', () => {
    const id = 'early-retiree-aca'
    const plan = stamped(id)
    const view = run(plan)

    // The years the credit is priced are the published coverage years inside
    // Casey's Marketplace years, and every published year is one of them.
    const marketplaceYears = yearsWhere(view, (year) => year.aca !== undefined)
    const publishedYears = ACA_COVERAGE_YEARS.map((block) => block.coverageYear)
    const pricedYears = yearsWhere(view, (year) => year.aca?.readiness === 'actionable' && (year.aca.modeledAllowablePtc ?? 0) > 0)
    expect(pricedYears).toEqual(publishedYears.filter((year) => marketplaceYears.includes(year)))
    expect(pricedYears).toEqual(publishedYears)
    const firstUnpriced = LATEST_ACA_COVERAGE_YEAR + 1
    expect(marketplaceYears).toContain(firstUnpriced)
    const unpriced = yearOf(view, firstUnpriced)
    expect(unpriced.aca!.supportCodes).toContain('tax-year-parameters-unsupported')
    expect(unpriced.expenses.healthcare).toBeCloseTo(unpriced.aca!.grossEnrollmentPremium, 6)

    const years = listed(pricedYears)
    const count = NUMBER_WORDS[pricedYears.length]!
    expect(example(id).lookFor).toContain(`A premium credit in ${years}, the ${count} coverage years whose figures are published so far (from ${firstUnpriced} the full premium is budgeted)`)
    expect(body(id)).toContain(`The credit is priced for ${years}, the ${count} coverage years whose figures are published so far. From ${firstUnpriced} the plan budgets the full premium`)
    expect(body(id)).toContain(`Check the ${years} premium credits`)
    // Both lookFor lines say "both" credits.
    expect(example(id).lookFor).toContain('watch the cliff erase both credits')
    expect(body(id)).toContain('watch both go to zero')
    expect(pricedYears).toHaveLength(2)

    // The household the copy describes.
    const person = plan.household.people[0]!
    expect(body(id)).toContain(`retired at ${person.retirementAge}`)
    const strategy = plan.strategies.rothConversion
    expect(strategy.mode === 'fillToTarget' && strategy.target === 'topOfBracket' ? strategy.targetValue : null).toBe(10)
    expect(body(id)).toContain('fill the 10% tax bracket')
    const premium = plan.expenses.healthcare.pre65MonthlyPremiumPerPerson
    expect(body(id)).toContain(`the same ${usd(premium)} a month Casey pays`)
    for (const year of pricedYears) {
      const aca = yearOf(view, year).aca!
      expect(aca.applicableSlcspPremium, String(year)).toBe(aca.grossEnrollmentPremium)
    }

    // Raising the conversions to the 12% bracket erases every priced credit.
    const twelve = structuredClone(plan)
    if (twelve.strategies.rothConversion.mode !== 'fillToTarget') throw new Error('expected fill-to-target')
    twelve.strategies.rothConversion.targetValue = 12
    const twelveView = run(twelve)
    for (const year of pricedYears) {
      const aca = yearOf(twelveView, year).aca!
      expect(aca.modeledAllowablePtc, String(year)).toBe(0)
      expect(aca.cliffState, String(year)).toBe('above-cliff')
    }
    expect(example(id).lookFor).toContain('raise the conversion bracket to 12%')
    expect(body(id)).toContain('raise the conversion bracket to 12% on Strategy')

    // A different premium no longer matches the example's coverage details.
    const edited = structuredClone(plan)
    edited.expenses.healthcare.pre65MonthlyPremiumPerPerson = premium + 100
    const editedView = run(edited)
    for (const year of pricedYears) {
      expect(yearOf(editedView, year).aca!.supportCodes, String(year)).toContain('example-contract-input-mismatch')
    }
    expect(body(id)).toContain('change the premium and the credit is no longer priced')
  })

  it('401(k) plus brokerage bridge and its all-401(k) control: penalties, depletion, lifetime tax and the conversion scenario', () => {
    const bridgePlan = stamped('brokerage-bridge-401k')
    const bridge = run(bridgePlan)
    const control = run(stamped('all-401k-no-bridge'))
    const scenario = bridgePlan.scenarios?.[0]
    if (!scenario) throw new Error('the bridge example has no scenario')
    const applied = applyScenarioPatch(bridgePlan, scenario.patch)
    if (!applied.ok) throw new Error(applied.issues.join('; '))
    const converted = run(applied.plan)

    const bridgeTeaches = example('brokerage-bridge-401k').teaches
    const bridgeLookFor = example('brokerage-bridge-401k').lookFor
    const controlTeaches = example('all-401k-no-bridge').teaches
    const controlLookFor = example('all-401k-no-bridge').lookFor
    const bridgeBody = body('brokerage-bridge-401k')
    const controlBody = body('all-401k-no-bridge')

    // Penalties: only the control pays them, and only in the bridge years it
    // funds from the 401(k)s.
    const penaltyYears = contiguous(yearsWhere(control, (year) => year.penalties > 0))
    const penalties = control.result.years.reduce((sum, year) => sum + year.penalties, 0)
    expect(bridge.result.years.every((year) => year.penalties === 0)).toBe(true)
    const penaltyPhrase = `${usd(penalties)} of early-withdrawal penalties from ${penaltyYears.first} to ${penaltyYears.last}`
    expect(controlTeaches).toContain(penaltyPhrase)
    expect(controlBody).toContain(penaltyPhrase)
    expect(controlLookFor).toContain(`Early-withdrawal penalties in Results from ${penaltyYears.first} to ${penaltyYears.last}`)
    expect(bridgeBody).toContain(`of which ${usd(penalties)} is the control's penalties`)
    for (let year = penaltyYears.first; year <= penaltyYears.last; year += 1) {
      expect(yearOf(bridge, year).magi, String(year)).toBeLessThan(0.6 * yearOf(control, year).magi)
    }
    expect(bridgeBody).toContain(`MAGI stays far below the control's from ${penaltyYears.first} to ${penaltyYears.last}`)

    // Depletion: one year apart, both before the plan ends.
    const bridgeDepletion = bridge.summary.depletionYear!
    const controlDepletion = control.summary.depletionYear!
    const planEnd = bridge.result.years.at(-1)!.year
    expect(bridgeDepletion - controlDepletion).toBe(1)
    expect(bridgeDepletion).toBeLessThan(planEnd)
    expect(controlTeaches).toContain(`run out a year sooner, in ${controlDepletion} against ${bridgeDepletion}`)
    expect(controlLookFor).toContain('a depletion year one year earlier than the bridge version')
    expect(controlBody).toContain(`this plan runs out of money in ${controlDepletion}, the bridge version in ${bridgeDepletion}`)
    expect(controlBody).toContain(`compare the depletion year, ${controlDepletion}, with the bridge version's ${bridgeDepletion}`)
    expect(bridgeTeaches).toContain(`it lasts one year longer than the control (${bridgeDepletion} against ${controlDepletion})`)
    expect(bridgeBody).toContain(`lasts one year longer, to ${bridgeDepletion} against ${controlDepletion}; neither reaches the end of the plan in ${planEnd}`)

    // Lifetime tax and penalties: more tax while saving, less over the lifetime.
    const retirementYear = Number(bridgePlan.household.people[0]!.dob.slice(0, 4)) + bridgePlan.household.people[0]!.retirementAge!
    const taxBefore = (view: ReturnType<typeof run>) =>
      view.result.years.filter((year) => year.year < retirementYear).reduce((sum, year) => sum + year.tax + year.penalties, 0)
    expect(taxBefore(bridge)).toBeGreaterThan(taxBefore(control))
    expect(lifetimeTax(bridge)).toBeLessThan(lifetimeTax(control))
    const lifetimePhrase = `${usd(lifetimeTax(bridge))} against ${usd(lifetimeTax(control))}`
    expect(bridgeTeaches).toContain(`over its lifetime (${lifetimePhrase})`)
    expect(bridgeBody).toContain(`(${lifetimePhrase}, of which`)

    // No premium tax credit in either plan: the bridge years come after the
    // last published coverage year, and in the priced years the wages put the
    // couple above the cliff.
    expect(retirementYear).toBeGreaterThan(LATEST_ACA_COVERAGE_YEAR)
    for (const view of [bridge, control]) {
      expect(view.result.years.every((year) => (year.aca?.modeledAllowablePtc ?? 0) === 0)).toBe(true)
      for (const year of yearsWhere(view, (row) => row.aca?.readiness === 'actionable')) {
        expect(yearOf(view, year).aca!.cliffState, String(year)).toBe('above-cliff')
      }
    }
    for (const year of yearsWhere(bridge, (row) => row.aca !== undefined)) {
      expect(yearOf(bridge, year).expenses.healthcare, String(year)).toBe(yearOf(control, year).expenses.healthcare)
    }
    expect(controlBody).toContain('These bridge years come after the last published coverage year, so both plans budget the full marketplace premium')
    expect(bridgeBody).toContain('these bridge years come after the last published coverage year, so both plans budget the full marketplace premium')
    const firstBridgeYear = yearOf(bridge, retirementYear)
    expect(firstBridgeYear.withdrawals.cash).toBeGreaterThan(0)
    expect(firstBridgeYear.withdrawals.taxable + firstBridgeYear.withdrawals.traditional).toBe(0)
    expect(bridgeBody).toContain('Cash covers the first bridge years')

    // The conversion scenario: the 12% bracket in the bridge years, Sam's
    // share only, lower lifetime tax and a later depletion year.
    const conversionYears = contiguous(yearsWhere(converted, (year) => year.rothConversion > 0))
    expect(conversionYears.first).toBe(retirementYear)
    const patchStrategy = applied.plan.strategies.rothConversion
    expect(patchStrategy.mode === 'fillToTarget' ? patchStrategy.targetValue : null).toBe(12)
    expect(converted.result.warnings.some((warning) => warning.startsWith('Jordan has no Roth account'))).toBe(true)
    const brokerageLastYear = yearsWhere(converted, (year) => year.withdrawals.taxable > 0).at(-1)!
    const scenarioDepletion = converted.summary.depletionYear!
    expect(lifetimeTax(converted)).toBeLessThan(lifetimeTax(bridge))
    expect(bridgeLookFor).toContain('conversions sized to the top of the 12% bracket during the bridge (only Sam holds a Roth IRA, so only his share converts)')
    expect(bridgeLookFor).toContain(`lower lifetime tax and move depletion from ${bridgeDepletion} to ${scenarioDepletion}`)
    expect(bridgeBody).toContain(`each bridge year, ${conversionYears.first} to ${conversionYears.last}, it sizes a conversion to the top of the 12% bracket`)
    expect(bridgeBody).toContain(`lifetime tax falls from ${usd(lifetimeTax(bridge))} to ${usd(lifetimeTax(converted))} and the money lasts to ${scenarioDepletion} instead of ${bridgeDepletion}`)
    expect(bridgeBody).toContain(`the brokerage still lasts into ${brokerageLastYear}`)
  })

  it('bracket-fill Roth conversions: the draws above the filled bracket, the empty IRAs and the Medicare surcharge years', () => {
    const id = 'bracket-fill-roth'
    const plan = stamped(id)
    const view = run(plan)
    const copy = body(id)

    // Each spouse holds a Roth IRA of their own.
    for (const person of plan.household.people) {
      expect(plan.accounts.some((account) => account.type === 'roth' && account.ownerPersonId === person.id), person.name).toBe(true)
    }
    expect(copy).toContain('Each of them has a Roth IRA')

    // The cash runs out, then the spending draws land above the filled 22% bracket, inside 24%.
    const cashId = plan.accounts.find((account) => account.type === 'cash')!.id
    const cashGone = yearsWhere(view, (year) => (year.balances[cashId] ?? 0) === 0)[0]!
    const brackets = (scale: number) => ({ top22: 211_400 * scale, top24: 403_550 * scale })
    const over = yearsWhere(view, (year) => (year.advisoryFederalTax?.detail.taxableIncome ?? 0) > brackets(year.inflationScale ?? 1).top22)
    contiguous(over)
    expect(over[0]).toBe(cashGone)
    const amounts = over.map((year) => {
      const row = yearOf(view, year)
      const taxable = row.advisoryFederalTax!.detail.taxableIncome
      const { top22, top24 } = brackets(row.inflationScale ?? 1)
      expect(taxable, String(year)).toBeLessThan(top24)
      return usd(taxable - top22)
    })
    expect(copy).toContain(`once the cash reserve runs out in ${cashGone}`)
    expect(copy).toContain(`taxable income ends ${listed(amounts)} above the top of the 22% bracket in ${listed(over)}, taxed at 24%, and Results warns about it`)
    expect(view.result.warnings).toContain('Spending withdrawals from traditional accounts pushed income above the Roth-conversion target in some years.')

    // Both IRAs are empty by the end of one year; the RMDs and the gifts stop after it.
    const iraIds = plan.accounts.filter((account) => account.type === 'traditional').map((account) => account.id)
    const emptyYear = yearsWhere(view, (year) => iraIds.every((accountId) => (year.balances[accountId] ?? 0) === 0))[0]!
    expect(yearOf(view, emptyYear).rmd).toBeGreaterThan(0)
    expect(yearOf(view, emptyYear).qcd).toBeGreaterThan(0)
    expect(view.result.years.filter((year) => year.year > emptyYear).every((year) => year.rmd === 0 && year.qcd === 0)).toBe(true)
    expect(copy).toContain(`empties both IRAs by ${emptyYear}, so the RMDs and the charitable gifts from the IRAs stop there`)

    // Medicare's income surcharge applies in one run of years.
    const surchargeYears = contiguous(yearsWhere(view, (year) => year.irmaaTier > 0))
    expect(copy).toContain(`raise Medicare premiums two years later, from ${surchargeYears.first} to ${surchargeYears.last}`)
  })
})
