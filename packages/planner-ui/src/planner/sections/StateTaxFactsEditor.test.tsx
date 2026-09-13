/** @vitest-environment jsdom */

import { act, useCallback, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'

import { PlanCtx } from '../planContextCore'
import { createSamplePlan } from '../../testSupport/samplePlan'
import { STATE_TAX_WORKSHEET_ANCHOR } from '../stateTaxFactsActions'
import { AssumptionsSection } from './AssumptionsSection'
import { StateTaxFactsEditor } from './StateTaxFactsEditor'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount())
  container?.remove()
  root = null
  container = null
})

function StateTaxFactsHarness({
  initialPlan,
  onPlanChange,
}: {
  initialPlan: Plan
  onPlanChange: (plan: Plan) => void
}) {
  const [plan, setPlan] = useState(initialPlan)
  const update = useCallback(
    (mutator: (draft: Plan) => void) => {
      setPlan((current) => {
        const draft = structuredClone(current)
        mutator(draft)
        const parsed = parsePlan(draft)
        if (!parsed.ok) throw new Error(`State tax edit produced an invalid plan: ${parsed.issues.join('; ')}`)
        const next = parsed.plan
        onPlanChange(next)
        return next
      })
    },
    [onPlanChange],
  )
  return (
    <MemoryRouter initialEntries={['/plan/x/assumptions']}>
      <PlanCtx.Provider value={{ plan, update, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
        <StateTaxFactsEditor />
      </PlanCtx.Provider>
    </MemoryRouter>
  )
}

async function mount(initialPlan: Plan) {
  const parsed = parsePlan(initialPlan)
  if (!parsed.ok) throw new Error(`Invalid state tax fixture: ${parsed.issues.join('; ')}`)
  let plan = initialPlan
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(
      <StateTaxFactsHarness
        initialPlan={initialPlan}
        onPlanChange={(next) => {
          plan = next
        }}
      />,
    )
  })
  return {
    host: container,
    getPlan: () => plan,
  }
}

function labelFor(host: ParentNode, text: string): HTMLLabelElement {
  const label = [...host.querySelectorAll('label')].find((node) => node.textContent?.trim() === text)
  if (!label) throw new Error(`no label "${text}"`)
  return label
}

function controlForLabel(host: ParentNode, text: string): HTMLElement {
  const label = labelFor(host, text)
  const id = label.getAttribute('for')
  if (!id) throw new Error(`label "${text}" has no for=`)
  const control = host.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
  if (!control) throw new Error(`no control for "${text}"`)
  return control
}

async function setNumberField(host: ParentNode, label: string, value: string) {
  const input = controlForLabel(host, label) as HTMLInputElement
  await act(async () => {
    // React tracks controlled inputs through the native setter. Assigning
    // input.value directly bypasses that tracker, so the editor never sees a
    // commit (the two annual-count regressions this lane caught).
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function setSelectField(host: ParentNode, label: string, value: string) {
  const select = controlForLabel(host, label) as HTMLSelectElement
  await act(async () => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

describe('StateTaxFactsEditor', () => {
  it('adds one shared row per year and persists through parsePlan', async () => {
    const { host, getPlan } = await mount(createSamplePlan())
    await act(async () => {
      host.querySelector<HTMLButtonElement>('button.btn-secondary')!.click()
    })
    const plan = getPlan()
    expect(plan.stateTaxFacts.householdYearFacts).toHaveLength(1)
    const year = plan.stateTaxFacts.householdYearFacts[0]!.year
    await setNumberField(host, 'Personal exemption count', '2')
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.exemptionTaxpayerCount).toBe(2)
    const reparsed = parsePlan(getPlan())
    expect(reparsed.ok).toBe(true)
    if (!reparsed.ok) return
    expect(reparsed.plan.stateTaxFacts.householdYearFacts).toEqual([
      { year, exemptionTaxpayerCount: 2 },
    ])
  })

  it('does not duplicate a year row when adding the same year twice', async () => {
    const { host, getPlan } = await mount(createSamplePlan())
    const add = () =>
      act(async () => {
        host.querySelector<HTMLButtonElement>('button.btn-secondary')!.click()
      })
    await add()
    await add()
    expect(getPlan().stateTaxFacts.householdYearFacts).toHaveLength(1)
    expect(parsePlan(getPlan()).ok).toBe(true)
  })

  it('keeps CT and IA fields on one row when filtering by state', async () => {
    const seed = createSamplePlan()
    seed.stateTaxFacts.householdYearFacts = [{ year: 2026, connecticutAgi: 50_000, iowaTestNetIncome: 12_000 }]
    const { host, getPlan } = await mount(seed)
    const filter = controlForLabel(host, 'Show fields for') as HTMLSelectElement
    await act(async () => {
      filter.value = 'CT'
      filter.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(host.querySelector('label[for]')?.textContent).toBeTruthy()
    expect(labelFor(host, 'Connecticut AGI')).toBeTruthy()
    expect(() => labelFor(host, 'Iowa alternate tax net income')).toThrow()
    await act(async () => {
      filter.value = 'IA'
      filter.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(labelFor(host, 'Iowa alternate tax net income')).toBeTruthy()
    expect(getPlan().stateTaxFacts.householdYearFacts[0]).toMatchObject({
      year: 2026,
      connecticutAgi: 50_000,
      iowaTestNetIncome: 12_000,
    })
    expect(parsePlan(getPlan()).ok).toBe(true)
  })

  it('removes a year row without touching other years', async () => {
    const seed = createSamplePlan()
    seed.stateTaxFacts.householdYearFacts = [
      { year: 2025, connecticutAgi: 1 },
      { year: 2026, connecticutAgi: 2 },
    ]
    const { host, getPlan } = await mount(seed)
    const remove2025 = host.querySelector<HTMLButtonElement>('[data-state-tax-year="2025"] button.btn-ghost-danger')
    await act(async () => {
      remove2025!.click()
    })
    expect(getPlan().stateTaxFacts.householdYearFacts).toEqual([{ year: 2026, connecticutAgi: 2 }])
    expect(parsePlan(getPlan()).ok).toBe(true)
  })

  it('distinguishes blank unknown from explicit zero on counts', async () => {
    const seed = createSamplePlan()
    seed.stateTaxFacts.householdYearFacts = [{ year: 2026 }]
    const { host, getPlan } = await mount(seed)
    await setNumberField(host, 'Dependent exemption count', '0')
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.exemptionDependentCount).toBe(0)
    await setNumberField(host, 'Dependent exemption count', '')
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.exemptionDependentCount).toBeUndefined()
    expect(parsePlan(getPlan()).ok).toBe(true)
  })

  it('does not invent recipient zeros and preserves unrelated facts when one amount is cleared', async () => {
    const seed = createSamplePlan()
    const ownerPersonId = seed.household.people[0]!.id
    seed.stateTaxFacts.householdYearFacts = [{
      year: 2026,
      recipientSocialSecurity: [{
        ownerPersonId,
        grossSocialSecurity: 10_000,
        federallyIncludedSocialSecurity: 5_000,
        grossRailroadTier1: 2_000,
        federallyIncludedRailroadTier1: 1_000,
      }],
    }]
    const { host, getPlan } = await mount(seed)
    const recipient = host.querySelector<HTMLElement>(`[data-recipient-ss="${ownerPersonId}"]`)!
    await setNumberField(recipient, 'Gross Social Security', '')
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.recipientSocialSecurity).toEqual([{
      ownerPersonId,
      grossSocialSecurity: 10_000,
      federallyIncludedSocialSecurity: 5_000,
      grossRailroadTier1: 2_000,
      federallyIncludedRailroadTier1: 1_000,
    }])
    expect(parsePlan(getPlan()).ok).toBe(true)
  })

  it('keeps a new recipient row unknown until every required amount is supplied', async () => {
    const seed = createSamplePlan()
    const ownerPersonId = seed.household.people[0]!.id
    seed.stateTaxFacts.householdYearFacts = [{ year: 2026 }]
    const { host, getPlan } = await mount(seed)
    const recipient = host.querySelector<HTMLElement>(`[data-recipient-ss="${ownerPersonId}"]`)!
    await setNumberField(recipient, 'Gross Social Security', '10')
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.recipientSocialSecurity).toBeUndefined()
    expect(parsePlan(getPlan()).ok).toBe(true)
  })

  it('keeps federal exemption unknown until a count is explicitly entered, and preserves explicit zero', async () => {
    const seed = createSamplePlan()
    seed.stateTaxFacts.householdYearFacts = [{ year: 2026 }]
    const { host, getPlan } = await mount(seed)
    await setSelectField(host, 'Show fields for', 'WV')
    await setSelectField(host, 'Federal personal exemption count', 'count')
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.federalExemptionCount).toBeUndefined()
    await setNumberField(host, 'Federal exemption count (value)', '3')
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.federalExemptionCount).toEqual({ known: true, value: 3 })
    await setSelectField(host, 'Federal personal exemption count', 'zero')
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.federalExemptionCount).toEqual({ known: true, value: 0 })
    await setSelectField(host, 'Federal personal exemption count', 'unknown')
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.federalExemptionCount).toBeUndefined()
    expect(parsePlan(getPlan()).ok).toBe(true)
  })

  it('records and clears a reason only for an explicitly known zero federal exemption count', async () => {
    const seed = createSamplePlan()
    seed.stateTaxFacts.householdYearFacts = [{ year: 2026, federalExemptionCount: { known: false } }]
    const { host, getPlan } = await mount(seed)
    await setSelectField(host, 'Show fields for', 'IL')
    expect(() => labelFor(host, 'Federal personal exemption count')).toThrow()
    expect(labelFor(host, 'Personal exemption count')).toBeTruthy()
    expect(labelFor(host, 'Dependent exemption count')).toBeTruthy()
    await setSelectField(host, 'Show fields for', 'WV')
    expect(() => labelFor(host, 'Zero federal exemption reason')).toThrow()

    await setSelectField(host, 'Federal personal exemption count', 'zero')
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.federalExemptionCount).toEqual({ known: true, value: 0 })
    expect((controlForLabel(host, 'Zero federal exemption reason') as HTMLSelectElement).value).toBe('')
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.zeroFederalExemptionReason).toBeUndefined()
    await setSelectField(host, 'Zero federal exemption reason', 'irc151d2')
    const recorded = parsePlan(getPlan())
    expect(recorded.ok).toBe(true)
    if (!recorded.ok) throw new Error(recorded.issues.join('; '))
    expect(recorded.plan.stateTaxFacts.householdYearFacts[0]).toMatchObject({
      federalExemptionCount: { known: true, value: 0 },
      zeroFederalExemptionReason: 'irc151d2',
    })

    await setSelectField(host, 'Zero federal exemption reason', '')
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.zeroFederalExemptionReason).toBeUndefined()
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.federalExemptionCount).toEqual({ known: true, value: 0 })
    await setSelectField(host, 'Federal personal exemption count', 'count')
    await setNumberField(host, 'Federal exemption count (value)', '2')
    expect(() => labelFor(host, 'Zero federal exemption reason')).toThrow()
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.federalExemptionCount).toEqual({ known: true, value: 2 })
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.zeroFederalExemptionReason).toBeUndefined()
    expect(parsePlan(getPlan()).ok).toBe(true)
  })

  it('lets optional state selectors return to undefined through a real DOM Unknown choice', async () => {
    const seed = createSamplePlan()
    const personId = seed.household.people[0]!.id
    seed.stateTaxFacts.householdYearFacts = [{
      year: 2026,
      stateFilingStatus: 'single',
      claimedAsDependent: true,
      iowaClaimedAsDependent: false,
      oregonCreditClaimantPersonId: personId,
      vermontRetirementElection: 'civilService',
    }]
    const { host, getPlan } = await mount(seed)

    await setSelectField(host, 'State filing status (override)', '')
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.stateFilingStatus).toBeUndefined()

    await setSelectField(host, 'Show fields for', 'WI')
    await setSelectField(host, 'Claimed as dependent (Wisconsin)', '')
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.claimedAsDependent).toBeUndefined()

    await setSelectField(host, 'Show fields for', 'IA')
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.iowaClaimedAsDependent).toBe(false)
    await setSelectField(host, 'Iowa claimed as dependent', '')
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.iowaClaimedAsDependent).toBeUndefined()

    await setSelectField(host, 'Show fields for', 'OR')
    expect(() => labelFor(host, 'Oregon credit claimant')).toThrow()
    expect(labelFor(host, 'Oregon household income')).toBeTruthy()
    // The unsupported control is absent; existing imported data is preserved.
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.oregonCreditClaimantPersonId).toBe(personId)

    await setSelectField(host, 'Show fields for', 'VT')
    await setSelectField(host, 'Vermont retirement election', '')
    expect(getPlan().stateTaxFacts.householdYearFacts[0]!.vermontRetirementElection).toBeUndefined()
    expect(parsePlan(getPlan()).ok).toBe(true)
  })
})

describe('AssumptionsSection state tax integration', () => {
  it('exposes the worksheet anchor and accessible labels', async () => {
    const plan = createSamplePlan()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () =>
      root!.render(
        <MemoryRouter initialEntries={['/plan/x/assumptions']}>
          <PlanCtx.Provider
            value={{ plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}
          >
            <AssumptionsSection />
          </PlanCtx.Provider>
        </MemoryRouter>,
      ),
    )
    expect(container.querySelector(`#${STATE_TAX_WORKSHEET_ANCHOR}`)).not.toBeNull()
    expect(labelFor(container, 'Show fields for')).toBeTruthy()
    expect(labelFor(container, 'Add tax year')).toBeTruthy()
  })
})
