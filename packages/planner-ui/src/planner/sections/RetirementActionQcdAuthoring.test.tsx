/** @vitest-environment jsdom */

import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { parseRetirementActionRequest } from '@retiregolden/engine/actions/contract'
import { createActionReason } from '@retiregolden/engine/actions/reasons'
import { asUsdCents } from '@retiregolden/engine/actions/money'
import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { createFlatTaxCalculator } from '@retiregolden/engine/projection/flatTax'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'

import { PlanCtx } from '../planContextCore'
import {
  mintQcdCharityDesignationId,
  qcdNotEvaluatedFrame,
  QCD_CHARITY_ATTESTATIONS,
  QCD_REFUSAL_FRAME,
} from '../retirementActionQcdAuthoring'
import {
  QCD_NAMED_STANDS_DOWN_SCALAR,
  QCD_SECTION_HEADING,
} from '../retirementActionQcdSchedule'
import { createSamplePlan } from '../../testSupport/samplePlan'
import { RetirementActionsEditor } from './RetirementActionsEditor'
import { StrategySection } from './StrategySection'

const THIS_YEAR = new Date().getFullYear()

/**
 * The engine's end-to-end fixture, restated here so the two can be compared.
 * `simulate.qcdNamedExecution.test.ts` proves these exact facts produce an
 * executed gift; this file proves the form writes exactly these facts.
 */
const FIXTURE_TAX_YEAR = 2026
const FIXTURE_DOB = '1950-03-01'
const FIXTURE_THRESHOLD_YEAR = 2020
const FIXTURE_THRESHOLD_DATE = '2020-09-01'
const FIXTURE_GIFT_DOLLARS = 20_000
const FIXTURE_GIFT_DATE = `${FIXTURE_TAX_YEAR}-08-01`
const FIXTURE_IRA_DOLLARS = 500_000
const DONOR_ID = 'donor-1'
const IRA_ID = 'ira'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount())
  container?.remove()
  root = null
  container = null
})

interface GiftPlanOptions {
  readonly dob?: string
  readonly thresholdYear?: number
  readonly throughYear?: number
  readonly classifySource?: 'traditional' | 'sep' | 'none'
  readonly extraAccounts?: readonly Plan['accounts'][number][]
}

/**
 * The engine fixture's household, rebuilt on the planner's own example plan: a
 * single donor, one traditional IRA the gift can come out of, one cash account,
 * and a gapless post-70½ contribution history of stated zeros.
 */
function giftPlan(options: GiftPlanOptions = {}): Plan {
  const plan = createSamplePlan()
  const donor = plan.household.people[0]!
  plan.household.filingStatus = 'single'
  plan.household.hasQualifyingDependent = false
  plan.household.people = [{
    ...donor,
    id: DONOR_ID,
    name: 'Alex',
    dob: options.dob ?? FIXTURE_DOB,
    longevity: { planningAge: 95, source: 'manual' },
  }]
  plan.accounts = [
    {
      type: 'traditional',
      id: IRA_ID,
      name: 'Traditional IRA',
      ownerPersonId: DONOR_ID,
      annualReturnPct: 0,
      kind: 'ira',
      balance: FIXTURE_IRA_DOLLARS,
      annualContribution: 0,
    },
    {
      type: 'cash',
      id: 'cash',
      name: 'Cash reserve',
      ownerPersonId: DONOR_ID,
      annualReturnPct: 0,
      balance: 200_000,
      annualContribution: 0,
    },
    ...(options.extraAccounts ?? []),
  ]
  plan.incomes = []
  plan.insurance = []
  plan.careEvents = []
  plan.scenarios = []
  plan.expenses.baseAnnual = 0
  plan.expenses.phases = []
  plan.expenses.oneTimeGoals = []
  plan.expenses.healthcare.pre65MonthlyPremiumPerPerson = 0
  plan.expenses.healthcare.applyAcaCredit = false
  plan.expenses.healthcare.medicareExtrasMonthlyPerPerson = 0
  plan.strategies.rothConversion = { mode: 'none' }
  plan.strategies.qcdAnnual = 0
  plan.strategies.retirementActions = []
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.inflationPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  const subtype = options.classifySource ?? 'traditional'
  const thresholdYear = options.thresholdYear ?? FIXTURE_THRESHOLD_YEAR
  const throughYear = options.throughYear ?? FIXTURE_TAX_YEAR
  const contributions: NonNullable<
    Plan['retirementActionEligibilityFacts']
  >['deductibleIraContributions'] = []
  for (let taxYear = thresholdYear; taxYear <= throughYear; taxYear += 1) {
    contributions.push({
      donorPersonId: DONOR_ID,
      taxYear,
      amountCents: asUsdCents(0),
      evidenceId: `contribution-${taxYear}`,
      provenance: { source: 'manual' },
    })
  }
  plan.retirementActionEligibilityFacts = {
    iraClassifications: subtype === 'none'
      ? []
      : [{
          sourceAccountId: IRA_ID,
          subtype,
          evidenceId: 'classification-ira',
          provenance: { source: 'manual' },
        }],
    sepSimpleActivities: [],
    deductibleIraContributions: contributions,
  }
  return plan
}

/** A gift the way an imported Plan already carries one. */
function namedGift(year: number) {
  const parsed = parseRetirementActionRequest({
    actionId: `imported-gift-${year}`,
    kind: 'qcd',
    year,
    executionDate: `${year}-08-01`,
    executionSequence: 1,
    requestedAmount: FIXTURE_GIFT_DOLLARS * 100,
    provenance: { source: 'manual' },
    donorPersonId: DONOR_ID,
    allocation: {
      allocationId: `imported-gift-allocation-${year}`,
      sourceAccountId: IRA_ID,
      requestedAmount: FIXTURE_GIFT_DOLLARS * 100,
    },
    charity: {
      designationId: `imported-charity-${year}`,
      name: 'Public charity',
      designationKind: 'eligiblePublicCharity',
      directFromCustodianAttested: true,
      eligibleOrganizationAttested: true,
      notDonorAdvisedFundOrSupportingOrganizationAttested: true,
      notSplitInterestEntityAttested: true,
      entireDistributionOtherwiseDeductibleAttested: true,
    },
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

/**
 * The evidence ID the simulator mints for a gift's prior-offset evidence. A
 * Plan that already carries this exact string on one of its own eligibility
 * records makes the whole year's QCD prerequisite batch refuse
 * `evidenceIdReused`, and the year then publishes no record for any gift.
 */
function mintedPriorOffsetEvidenceId(gift: { actionId: string; year: number }): string {
  return `projection-prior-qcd-offset:${JSON.stringify([
    gift.actionId,
    DONOR_ID,
    gift.year,
    `${gift.year}-08-01`,
  ])}`
}

/**
 * The invariant the refusal frame has to keep: it introduces a list, so it may
 * never render without one. Asserted structurally over whatever the row drew.
 */
function assertRefusalFramesCarryReasons(host: HTMLElement) {
  for (const callout of Array.from(host.querySelectorAll('.callout'))) {
    if (!(callout.textContent ?? '').includes(QCD_REFUSAL_FRAME)) continue
    expect(callout.querySelectorAll('li').length).toBeGreaterThan(0)
  }
}

async function mount(
  initialPlan: Plan,
  content: ReactNode = <RetirementActionsEditor />,
) {
  let current = initialPlan
  function Harness() {
    const [plan, setPlan] = useState(initialPlan)
    current = plan
    return (
      <PlanCtx.Provider value={{
        plan,
        update: (mutator) => setPlan((previous) => {
          const next = structuredClone(previous)
          mutator(next)
          return next
        }),
        discardPendingSave: () => undefined,
        saveState: 'saved',
        issues: [],
      }}>
        {content}
      </PlanCtx.Provider>
    )
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root!.render(<Harness />))
  return { container, current: () => current }
}

async function waitForText(host: HTMLElement, text: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (host.textContent?.includes(text)) return
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)))
  }
  throw new Error(`Timed out waiting for ${text}`)
}

function controlByLabel<T extends HTMLInputElement | HTMLSelectElement>(
  host: HTMLElement,
  label: string,
): T {
  const labelNode = Array.from(host.querySelectorAll('label')).find(
    (entry) => entry.textContent?.trim() === label,
  )
  const control = labelNode?.htmlFor
    ? host.ownerDocument.getElementById(labelNode.htmlFor)
    : null
  if (!(control instanceof HTMLInputElement) && !(control instanceof HTMLSelectElement)) {
    throw new Error(`Missing control for ${label}`)
  }
  return control as T
}

async function change(control: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const prototype = control instanceof HTMLInputElement
      ? window.HTMLInputElement.prototype
      : window.HTMLSelectElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')!.set!
    setter.call(control, value)
    control.dispatchEvent(new Event(
      control instanceof HTMLInputElement ? 'input' : 'change',
      { bubbles: true },
    ))
  })
}

function buttonByText(host: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll('button')).find(
    (entry) => entry.textContent?.trim() === text,
  )
  if (button === undefined) throw new Error(`Missing button ${text}`)
  return button
}

function row(host: HTMLElement, selector: string): HTMLElement {
  const found = host.querySelector<HTMLElement>(selector)
  if (found === null) throw new Error(`Missing row ${selector}`)
  return found
}

async function openDraft(host: HTMLElement): Promise<HTMLElement> {
  await act(async () => buttonByText(host, '+ Charitable gift').click())
  return row(host, '[data-qcd-gift-draft="new"]')
}

interface GiftAnswers {
  readonly year?: string
  readonly date?: string
  readonly amount?: string
  readonly sequence?: string
  readonly charityName?: string
  readonly designationKind?: string
  readonly sourceAccountId?: string
  /** Attestation keys deliberately left unchecked. */
  readonly withhold?: readonly string[]
}

/** Answer every control the form asks for, minus anything deliberately withheld. */
async function answerGift(draft: HTMLElement, answers: GiftAnswers = {}) {
  await change(controlByLabel(draft, 'Tax year'), answers.year ?? String(FIXTURE_TAX_YEAR))
  await change(controlByLabel(draft, 'Donor'), DONOR_ID)
  const sourceId = answers.sourceAccountId ?? IRA_ID
  if (sourceId !== '') await change(controlByLabel(draft, 'Source IRA'), sourceId)
  await change(
    controlByLabel(draft, 'Gift amount'),
    answers.amount ?? String(FIXTURE_GIFT_DOLLARS),
  )
  await change(controlByLabel(draft, 'Gift date'), answers.date ?? FIXTURE_GIFT_DATE)
  await change(controlByLabel(draft, 'Execution sequence'), answers.sequence ?? '1')
  await change(controlByLabel(draft, 'Charity name'), answers.charityName ?? 'Public charity')
  await change(
    controlByLabel(draft, 'Charity type'),
    answers.designationKind ?? 'eligiblePublicCharity',
  )
  const withheld = new Set(answers.withhold ?? [])
  for (const attestation of QCD_CHARITY_ATTESTATIONS) {
    if (withheld.has(attestation.key)) continue
    await act(async () =>
      controlByLabel<HTMLInputElement>(draft, attestation.label).click())
  }
}

function authoredGift(plan: Plan) {
  const gift = plan.strategies.retirementActions.find((action) => action.kind === 'qcd')
  if (gift === undefined || gift.kind !== 'qcd') throw new Error('no authored gift')
  return gift
}

function projectAt(plan: Plan, year: number) {
  const parsed = parsePlan(structuredClone(plan))
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return simulatePlan(parsed.plan, {
    startYear: year,
    horizonEndYear: year,
    taxCalculator: createFlatTaxCalculator(0),
  }).years.find((entry) => entry.year === year)
}

describe('named-QCD authoring', () => {
  it('offers the gift affordance on the public Strategy screen', async () => {
    const mounted = await mount(
      giftPlan(),
      <MemoryRouter initialEntries={['/plan/example/strategy']}>
        <StrategySection />
      </MemoryRouter>,
    )

    await waitForText(mounted.container, QCD_SECTION_HEADING)
    expect(mounted.container.textContent).toContain('No charitable gifts are scheduled.')
    expect(buttonByText(mounted.container, '+ Charitable gift')).toBeInstanceOf(
      HTMLButtonElement,
    )
  })

  it('writes the canonical request the engine’s executed fixture uses', async () => {
    const mounted = await mount(giftPlan())
    const draft = await openDraft(mounted.container)

    await answerGift(draft)
    await act(async () => buttonByText(draft, 'Schedule this gift').click())

    const gift = authoredGift(mounted.current())
    const { actionId, allocation, charity, ...scheduled } = gift
    // Field for field against the fixture's `namedQcd()` literal, minus the
    // three IDs nothing but a minting rule can supply.
    expect(scheduled).toEqual({
      kind: 'qcd',
      year: FIXTURE_TAX_YEAR,
      executionDate: FIXTURE_GIFT_DATE,
      executionSequence: 1,
      requestedAmount: FIXTURE_GIFT_DOLLARS * 100,
      provenance: { source: 'manual' },
      donorPersonId: DONOR_ID,
    })
    expect({
      sourceAccountId: allocation.sourceAccountId,
      requestedAmount: allocation.requestedAmount,
    }).toEqual({
      sourceAccountId: IRA_ID,
      requestedAmount: FIXTURE_GIFT_DOLLARS * 100,
    })
    const { designationId, ...charityFacts } = charity
    expect(charityFacts).toEqual({
      name: 'Public charity',
      designationKind: 'eligiblePublicCharity',
      directFromCustodianAttested: true,
      eligibleOrganizationAttested: true,
      notDonorAdvisedFundOrSupportingOrganizationAttested: true,
      notSplitInterestEntityAttested: true,
      entireDistributionOtherwiseDeductibleAttested: true,
    })
    expect(designationId).toBe(mintQcdCharityDesignationId({
      donorPersonId: DONOR_ID,
      year: FIXTURE_TAX_YEAR,
      executionDate: FIXTURE_GIFT_DATE,
      executionSequence: 1,
    }))
    expect(new Set([actionId, allocation.allocationId, designationId]).size).toBe(3)
    expect(parseRetirementActionRequest(structuredClone(gift)).ok).toBe(true)
    expect(parsePlan(structuredClone(mounted.current())).ok).toBe(true)
  })

  it('produces a plan that projects to an executed gift', async () => {
    const mounted = await mount(giftPlan())
    const draft = await openDraft(mounted.container)
    await answerGift(draft)
    await act(async () => buttonByText(draft, 'Schedule this gift').click())

    const authored = projectAt(mounted.current(), FIXTURE_TAX_YEAR)
    const ungifted = projectAt(giftPlan(), FIXTURE_TAX_YEAR)
    const record = authored?.retirementActionPublication?.records[0]

    // The end-to-end consequence, on the same terms the engine fixture states
    // it: the source IRA falls by the gift, the year publishes it, and income
    // is where the ungifted year left it.
    expect(record?.outcome).toBe('executed')
    expect(record?.executedAmount).toBe(FIXTURE_GIFT_DOLLARS * 100)
    expect(record?.executedDate).toBe(FIXTURE_GIFT_DATE)
    expect(record?.reasons).toEqual([])
    expect(authored?.qcd).toBeCloseTo(FIXTURE_GIFT_DOLLARS, 6)
    expect(ungifted?.qcd).toBe(0)
    expect((ungifted?.balances.ira ?? 0) - (authored?.balances.ira ?? 0))
      .toBeCloseTo(FIXTURE_GIFT_DOLLARS, 6)
    expect(authored?.magi).toBeCloseTo(ungifted?.magi ?? -1, 6)
    expect(authored?.rmd).toBeGreaterThan(0)
    expect(authored?.qcdActionPrerequisites?.[0]?.eligibility.donor.age70HalfThresholdDate)
      .toBe(FIXTURE_THRESHOLD_DATE)
  })

  it('reports an executing gift and the donor’s age-70½ date in the row', async () => {
    // The row's own projection starts at the current year, so this assertion
    // is only meaningful in a year the gift can be projected from.
    if (THIS_YEAR > FIXTURE_TAX_YEAR) return
    const mounted = await mount(giftPlan())
    const draft = await openDraft(mounted.container)
    await answerGift(draft)
    await act(async () => buttonByText(draft, 'Schedule this gift').click())

    await waitForText(mounted.container, 'This gift is modeled as executing on')
    expect(mounted.container.textContent).toContain(FIXTURE_GIFT_DATE)
    expect(mounted.container.textContent).toContain(
      `reaching age 70½ on ${FIXTURE_THRESHOLD_DATE}`,
    )
  })

  it('renders the engine’s refusal messages word for word', async () => {
    const mounted = await mount(giftPlan({ throughYear: THIS_YEAR + 1 }))
    const draft = await openDraft(mounted.container)

    // A donor-advised fund is offered, taken, and refused: the surface never
    // hides a designation the exclusion does not cover.
    await answerGift(draft, {
      year: String(THIS_YEAR),
      date: `${THIS_YEAR}-08-01`,
      designationKind: 'donorAdvisedFund',
      charityName: 'Community fund',
    })
    await act(async () => buttonByText(draft, 'Schedule this gift').click())

    await waitForText(mounted.container, QCD_REFUSAL_FRAME)
    expect(mounted.container.textContent).toContain(
      createActionReason('qcd-direct-charity-unconfirmed').message,
    )
    expect(mounted.container.textContent).toContain('qcd-direct-charity-unconfirmed')
    // The frame promises a list; this is the assertion that it has one.
    assertRefusalFramesCarryReasons(mounted.container)
    // Saved, not rejected: a refusal is an answer about the projection, not a
    // reason to throw the household's gift away.
    expect(authoredGift(mounted.current()).charity.designationKind).toBe('donorAdvisedFund')
  })

  it('says the projection did not evaluate a gift it published no record for', async () => {
    // The whole-year QCD batch refuses `evidenceIdReused`, so the year
    // publishes no source and no requests and the gift gets no record at all.
    // That is not a refusal, and the old code called it one: it rendered
    // "The projection gives these reasons:" over an empty list.
    const gift = namedGift(THIS_YEAR)
    const plan = giftPlan({ throughYear: THIS_YEAR })
    const facts = plan.retirementActionEligibilityFacts!
    const collidingYear = facts.deductibleIraContributions.find(
      (record) => record.taxYear === THIS_YEAR,
    )!
    collidingYear.evidenceId = mintedPriorOffsetEvidenceId(gift)
    plan.strategies.retirementActions = [gift]
    expect(parsePlan(structuredClone(plan)).ok).toBe(true)
    const mounted = await mount(plan)

    await waitForText(mounted.container, qcdNotEvaluatedFrame(THIS_YEAR))
    const giftRow = row(mounted.container, `[data-qcd-gift-id="${gift.actionId}"]`)
    expect(giftRow.textContent).toContain(qcdNotEvaluatedFrame(THIS_YEAR))
    expect(giftRow.textContent).not.toContain(QCD_REFUSAL_FRAME)
    expect(giftRow.querySelectorAll('.callout li')).toHaveLength(0)
    assertRefusalFramesCarryReasons(mounted.container)
  })

  it('keeps a pre-projection gift distinct from a gift with no record', async () => {
    const gift = namedGift(THIS_YEAR - 1)
    const plan = giftPlan()
    plan.strategies.retirementActions = [gift]
    const mounted = await mount(plan)

    const giftRow = row(mounted.container, `[data-qcd-gift-id="${gift.actionId}"]`)
    expect(giftRow.textContent).toContain(
      `This gift is scheduled for ${THIS_YEAR - 1}, before this projection starts in ${THIS_YEAR}`,
    )
    expect(giftRow.textContent).not.toContain(QCD_REFUSAL_FRAME)
    expect(giftRow.textContent).not.toContain(qcdNotEvaluatedFrame(THIS_YEAR - 1))
    assertRefusalFramesCarryReasons(mounted.container)
  })

  it('blocks the gift on each unchecked statement, one at a time', async () => {
    for (const withheld of QCD_CHARITY_ATTESTATIONS) {
      const mounted = await mount(giftPlan())
      const draft = await openDraft(mounted.container)
      await answerGift(draft, { withhold: [withheld.key] })
      await act(async () => buttonByText(draft, 'Schedule this gift').click())

      expect(mounted.container.textContent).toContain(
        `Confirm this statement before saving: ${withheld.label}`,
      )
      expect(mounted.current().strategies.retirementActions).toEqual([])
      if (root !== null) await act(async () => root!.unmount())
      container?.remove()
      root = null
      container = null
    }
  })

  it('mints distinct IDs for two gifts and refuses a repeat of one slot', async () => {
    const mounted = await mount(giftPlan())
    const first = await openDraft(mounted.container)
    await answerGift(first)
    await act(async () => buttonByText(first, 'Schedule this gift').click())

    // The same slot twice: one gift already holds this date and sequence, and
    // a collision here would mint the same charity ID as well.
    const repeat = await openDraft(mounted.container)
    await answerGift(repeat)
    await act(async () => buttonByText(repeat, 'Schedule this gift').click())
    expect(repeat.textContent).toContain(
      'Another retirement action already uses this execution date and sequence. Choose an unused sequence.',
    )
    expect(mounted.current().strategies.retirementActions).toHaveLength(1)

    await change(controlByLabel(repeat, 'Execution sequence'), '2')
    await change(controlByLabel(repeat, 'Charity name'), 'Second charity')
    await act(async () => buttonByText(repeat, 'Schedule this gift').click())

    const gifts = mounted.current().strategies.retirementActions
      .filter((action) => action.kind === 'qcd')
    expect(gifts).toHaveLength(2)
    const ids = gifts.flatMap((gift) =>
      gift.kind === 'qcd'
        ? [gift.actionId, gift.allocation.allocationId, gift.charity.designationId]
        : [])
    expect(new Set(ids).size).toBe(6)
    expect(parsePlan(structuredClone(mounted.current())).ok).toBe(true)
  })

  it('links to the IRA facts section when the source classification is missing', async () => {
    const mounted = await mount(giftPlan({ classifySource: 'none' }))
    const draft = await openDraft(mounted.container)
    await change(controlByLabel(draft, 'Donor'), DONOR_ID)

    expect(draft.textContent).toContain(
      'This IRA needs its type on record before it can fund a charitable gift.',
    )
    expect(draft.textContent).toContain(
      `No IRA in this plan can fund a gift by this donor in ${FIXTURE_TAX_YEAR}.`,
    )
    const link = draft.querySelector<HTMLAnchorElement>('a[href="#retirement-action-ira-facts"]')
    expect(link?.textContent).toBe('IRA facts on record')
    expect(mounted.container.querySelector('#retirement-action-ira-facts')).not.toBeNull()
  })

  it('separates a Roth source from an employer plan and a cross-owner account', async () => {
    const plan = giftPlan({
      extraAccounts: [
        {
          type: 'roth',
          id: 'roth-ira',
          name: 'Roth IRA',
          ownerPersonId: DONOR_ID,
          annualReturnPct: 0,
          kind: 'ira',
          balance: 50_000,
          annualContribution: 0,
          contributionBasis: 10_000,
        },
        {
          type: 'traditional',
          id: 'employer-401k',
          name: 'Employer 401(k)',
          ownerPersonId: DONOR_ID,
          annualReturnPct: 0,
          kind: 'employer',
          balance: 100_000,
          annualContribution: 0,
        },
        {
          type: 'traditional',
          id: 'joint-ira',
          name: 'Unassigned IRA',
          ownerPersonId: null,
          annualReturnPct: 0,
          kind: 'ira',
          balance: 25_000,
          annualContribution: 0,
        },
      ],
    })
    const mounted = await mount(plan)
    const draft = await openDraft(mounted.container)
    await change(controlByLabel(draft, 'Donor'), DONOR_ID)

    const options = Array.from(
      controlByLabel<HTMLSelectElement>(draft, 'Source IRA').options,
    ).map((option) => option.value)
    expect(options).toEqual(['', IRA_ID])
    expect(draft.textContent).toContain('Some accounts cannot fund this gift.')
    expect(draft.textContent).toContain(
      'RetireGolden does not model a charitable gift from a Roth IRA.',
    )
    expect(draft.textContent).toContain(
      'RetireGolden models a charitable gift only from an IRA, not from an employer plan.',
    )
    expect(draft.textContent).toContain(
      'This jointly owned account does not record the individual owner a charitable gift needs.',
    )
  })

  it('refuses visibly when the minted charity ID is already claimed', async () => {
    const claimed = mintQcdCharityDesignationId({
      donorPersonId: DONOR_ID,
      year: FIXTURE_TAX_YEAR,
      executionDate: FIXTURE_GIFT_DATE,
      executionSequence: 1,
    })
    const plan = giftPlan({
      extraAccounts: [{
        type: 'cash',
        id: claimed,
        name: 'Odd account',
        ownerPersonId: DONOR_ID,
        annualReturnPct: 0,
        balance: 1_000,
        annualContribution: 0,
      }],
    })
    const mounted = await mount(plan)
    const draft = await openDraft(mounted.container)
    await answerGift(draft)
    await act(async () => buttonByText(draft, 'Schedule this gift').click())

    expect(draft.textContent).toContain('This gift was not created.')
    expect(draft.textContent).toContain(
      'another item in this plan already uses the ID RetireGolden files its charity under',
    )
    expect(mounted.current().strategies.retirementActions).toEqual([])
  })

  it('refuses visibly when the allocator’s derived action ID is already reserved', async () => {
    const first = await mount(giftPlan())
    const firstDraft = await openDraft(first.container)
    await answerGift(firstDraft)
    await act(async () => buttonByText(firstDraft, 'Schedule this gift').click())
    const derivedActionId = authoredGift(first.current()).actionId
    if (root !== null) await act(async () => root!.unmount())
    container?.remove()
    root = null
    container = null

    const mounted = await mount(giftPlan({
      extraAccounts: [{
        type: 'cash',
        id: derivedActionId,
        name: 'Odd account',
        ownerPersonId: DONOR_ID,
        annualReturnPct: 0,
        balance: 1_000,
        annualContribution: 0,
      }],
    }))
    const draft = await openDraft(mounted.container)
    await answerGift(draft)
    await act(async () => buttonByText(draft, 'Schedule this gift').click())

    // The allocator's own sentence, not a paraphrase of it.
    expect(draft.textContent).toContain('This gift was not created.')
    expect(draft.textContent).toContain(
      `The deterministic actionId ${derivedActionId} is already reserved by this Plan; the allocator will not suffix or replace it.`,
    )
    expect(mounted.current().strategies.retirementActions).toEqual([])
  })

  it('shows the stand-down in the gift section and beside the recurring amount', async () => {
    const plan = giftPlan({ throughYear: THIS_YEAR + 1 })
    plan.strategies.qcdAnnual = 5_000
    const mounted = await mount(
      plan,
      <MemoryRouter initialEntries={['/plan/example/strategy']}>
        <StrategySection />
      </MemoryRouter>,
    )
    await waitForText(mounted.container, QCD_SECTION_HEADING)
    const draft = await openDraft(mounted.container)
    await answerGift(draft, { year: String(THIS_YEAR), date: `${THIS_YEAR}-08-01` })
    await act(async () => buttonByText(draft, 'Schedule this gift').click())

    await waitForText(
      mounted.container,
      `This recurring amount gives nothing in ${THIS_YEAR}, where a charitable gift is scheduled.`,
    )
    const occurrences = mounted.container.textContent
      ?.split(QCD_NAMED_STANDS_DOWN_SCALAR).length ?? 0
    // Once under the recurring control, once in the gift section.
    expect(occurrences - 1).toBe(2)
    expect(mounted.container.textContent).toContain(
      'To schedule one specific gift, use',
    )
  })

  it('asks for every contribution year the gift’s tax year reaches', async () => {
    const giftYear = THIS_YEAR + 3
    const plan = giftPlan({
      dob: `${THIS_YEAR - 76}-03-01`,
      thresholdYear: THIS_YEAR - 6,
      throughYear: THIS_YEAR,
    })
    const mounted = await mount(plan)
    // Before the gift, the range stops at the current year.
    expect(
      mounted.container.querySelector(`[data-eligibility-contribution="${DONOR_ID}:${giftYear}"]`),
    ).toBeNull()

    const draft = await openDraft(mounted.container)
    await answerGift(draft, { year: String(giftYear), date: `${giftYear}-08-01` })
    await act(async () => buttonByText(draft, 'Schedule this gift').click())

    for (let year = THIS_YEAR + 1; year <= giftYear; year += 1) {
      expect(
        mounted.container.querySelector(`[data-eligibility-contribution="${DONOR_ID}:${year}"]`),
      ).not.toBeNull()
    }
  })

  it('surfaces the gift’s year in the SEP employer-contribution rows', async () => {
    const giftYear = THIS_YEAR + 2
    const sepPlan = () => giftPlan({
      classifySource: 'sep',
      dob: `${THIS_YEAR - 76}-03-01`,
      thresholdYear: THIS_YEAR - 6,
      throughYear: giftYear,
    })
    const withoutGift = await mount(sepPlan())
    // Without a gift, only the current year is asked about, and the household
    // would have to press "+ Year" twice to reach the year it cares about.
    expect(
      withoutGift.container.querySelector(`[data-eligibility-activity="${IRA_ID}:${THIS_YEAR}"]`),
    ).not.toBeNull()
    expect(
      withoutGift.container.querySelector(`[data-eligibility-activity="${IRA_ID}:${giftYear}"]`),
    ).toBeNull()
    if (root !== null) await act(async () => root!.unmount())
    container?.remove()
    root = null
    container = null

    // A SEP source is not offered in the form until its year is answered, so
    // the gift arrives the way an imported Plan carries one.
    const gifted = sepPlan()
    gifted.strategies.retirementActions = [namedGift(giftYear)]
    const mounted = await mount(gifted)

    expect(
      mounted.container.querySelector(`[data-eligibility-activity="${IRA_ID}:${giftYear}"]`),
    ).not.toBeNull()
    const draft = await openDraft(mounted.container)
    await change(controlByLabel(draft, 'Tax year'), String(giftYear))
    await change(controlByLabel(draft, 'Donor'), DONOR_ID)
    expect(draft.textContent).toContain(
      `This SEP IRA needs an employer-contribution answer for ${giftYear} on record before it can fund a charitable gift.`,
    )
  })
})
