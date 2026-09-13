/** @vitest-environment jsdom */

import { act, useCallback, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { parsePlan, type Account, type Plan } from '@retiregolden/engine/model/plan'

import { PlanCtx } from '../planContextCore'
import { createSamplePlan } from '../../testSupport/samplePlan'
import { AccountFields } from './AccountFields'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount())
  container?.remove()
  root = null
  container = null
})

function pension(overrides: Partial<Extract<Account, { type: 'pension' }>> = {}): Extract<Account, { type: 'pension' }> {
  return {
    type: 'pension',
    id: 'pension-1',
    name: 'Pension',
    ownerPersonId: 'owner',
    annualReturnPct: null,
    source: 'unknownPrivate',
    startAge: 65,
    monthlyAmount: 2_000,
    colaPct: 0,
    survivorPct: 50,
    ...overrides,
  }
}

function PensionHarness({ initialPlan, onPlanChange }: { initialPlan: Plan; onPlanChange: (plan: Plan) => void }) {
  const [plan, setPlan] = useState(initialPlan)
  const update = useCallback(
    (fn: (draft: Plan) => void) => {
      setPlan((current) => {
        const draft = structuredClone(current)
        fn(draft)
        const parsed = parsePlan(draft)
        if (!parsed.ok) throw new Error(`Pension edit produced an invalid plan: ${parsed.issues.join('; ')}`)
        const next = parsed.plan
        onPlanChange(next)
        return next
      })
    },
    [onPlanChange],
  )
  return (
    <PlanCtx.Provider value={{ plan, update, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
      <AccountFields account={plan.accounts[0]!} index={0} />
    </PlanCtx.Provider>
  )
}

async function mountPension(account: Extract<Account, { type: 'pension' }>) {
  const initialPlan = createSamplePlan()
  // The sample household uses its own stable person IDs, not the helper's
  // placeholder owner. Exercise persistence with a real household member.
  initialPlan.accounts = [{ ...account, ownerPersonId: initialPlan.household.people[0]!.id }]
  const parsed = parsePlan(initialPlan)
  if (!parsed.ok) throw new Error(`Invalid pension fixture: ${parsed.issues.join('; ')}`)
  let plan = initialPlan
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () =>
    root!.render(
      <PensionHarness initialPlan={initialPlan} onPlanChange={(next) => { plan = next }} />,
    ),
  )
  return { host: container, getPlan: () => plan }
}

describe('Pension source confirmation editor', () => {
  it('keeps legacy public unconfirmed without offering it as a new characterized choice', async () => {
    const { host, getPlan } = await mountPension(pension({ source: 'public' }))
    const card = host.querySelector('[data-pension-source]')!
    expect(card.textContent).toContain('Not on record')
    expect(card.textContent).toContain('Legacy: public / military (unconfirmed)')
    expect(card.querySelector('option[value="public"]')).toBeNull()
    await act(async () => card.querySelector<HTMLButtonElement>('.btn-primary')!.click())
    expect(getPlan().accounts[0]).toMatchObject({ source: 'public' })
    expect(card.querySelector('[role="alert"]')).not.toBeNull()
  })

  it('spans the source card across the grid and locks eligibility until a source draft is recorded', async () => {
    const { host, getPlan } = await mountPension(pension({ source: 'ordinaryPrivatePension', stateEligibility: { recipientDisabled: false } }))
    const card = host.querySelector('[data-pension-source]')!
    expect(card.classList.contains('field-span-full')).toBe(true)
    const source = card.querySelector<HTMLSelectElement>('select')!
    const fields = host.querySelector<HTMLFieldSetElement>('fieldset[aria-label="Recorded pension source eligibility"]')!
    expect(fields.disabled).toBe(false)
    await act(async () => {
      source.value = 'militaryRetirement'
      source.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(fields.disabled).toBe(true)
    expect(fields.querySelector('select')!.matches(':disabled')).toBe(true)
    expect(host.textContent).toContain('Existing eligibility facts are preserved')
    expect(getPlan().accounts[0]).toMatchObject({ source: 'ordinaryPrivatePension', stateEligibility: { recipientDisabled: false } })
    await act(async () => card.querySelector<HTMLButtonElement>('.btn-primary')!.click())
    expect(fields.disabled).toBe(false)
    expect(getPlan().accounts[0]).toMatchObject({ source: 'militaryRetirement', stateEligibility: { recipientDisabled: false } })
  })

  it('persists and clears the bounded Massachusetts and Iowa eligibility facts', async () => {
    const { host, getPlan } = await mountPension(pension({ source: 'stateLocalPublic', stateEligibility: {} }))
    const control = (labelText: string) => {
      const label = [...host.querySelectorAll('label')].find((item) => item.textContent?.trim() === labelText)!
      return host.querySelector<HTMLInputElement | HTMLSelectElement>(`#${CSS.escape(label.htmlFor)}`)!
    }
    const choose = async (label: string, value: string) => {
      await act(async () => {
        const field = control(label)
        field.value = value
        field.dispatchEvent(new Event('change', { bubbles: true }))
      })
    }
    const basis = async (value: string) => {
      await act(async () => {
        const field = control('Previously taxed basis (Massachusetts)')
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(field, value)
        field.dispatchEvent(new Event('input', { bubbles: true }))
      })
    }
    await basis('0')
    await choose('Prior tax state', 'MA')
    await choose('Massachusetts public-pension reciprocity satisfied', 'false')
    await choose('Decedent would qualify (Iowa survivor)', 'true')
    await choose('Survivor has insurable interest (Iowa)', 'false')
    expect(getPlan().accounts[0]).toMatchObject({ stateEligibility: {
      knownPreviouslyTaxedBasis: 0, priorTaxState: 'MA', reciprocitySatisfied: false,
      decedentWouldQualify: true, survivorInsurableInterest: false,
    } })
    expect(parsePlan(getPlan()).ok).toBe(true)
    await basis('')
    await choose('Prior tax state', '')
    await choose('Massachusetts public-pension reciprocity satisfied', '')
    await choose('Decedent would qualify (Iowa survivor)', '')
    await choose('Survivor has insurable interest (Iowa)', '')
    const account = getPlan().accounts[0] as Extract<Account, { type: 'pension' }>
    for (const key of ['knownPreviouslyTaxedBasis', 'priorTaxState', 'reciprocitySatisfied', 'decedentWouldQualify', 'survivorInsurableInterest'] as const) {
      expect(account.stateEligibility?.[key]).toBeUndefined()
    }
    expect(parsePlan(getPlan()).ok).toBe(true)
  })

  it('records a characterized source from unknownPrivate', async () => {
    const { host, getPlan } = await mountPension(pension())
    const source = host.querySelector<HTMLSelectElement>('[data-pension-source] select')!
    await act(async () => {
      source.value = 'ordinaryPrivatePension'
      source.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-pension-source] .btn-primary')!.click()
    })
    expect(getPlan().accounts[0]).toMatchObject({ type: 'pension', source: 'ordinaryPrivatePension' })
  })

  it('does not record unknown sources', async () => {
    const { host, getPlan } = await mountPension(pension())
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-pension-source] .btn-primary')!.click()
    })
    expect(getPlan().accounts[0]).toMatchObject({ type: 'pension', source: 'unknownPrivate' })
    expect(host.querySelector('[data-pension-source] .callout--warn')).not.toBeNull()
  })

  it('preserves legacy private without forcing unknown', async () => {
    const { host, getPlan } = await mountPension(pension({ source: 'private' }))
    expect(host.textContent).toContain('Legacy: private')
    expect(getPlan().accounts[0]).toMatchObject({ source: 'private' })
  })

  it('keeps premature distribution disqualifier unknown until chosen', async () => {
    const { host, getPlan } = await mountPension(pension({ source: 'militaryRetirement', stateEligibility: {} }))
    const details = host.querySelector('details')!
    details.open = true
    const disqualifier = [...host.querySelectorAll('label')]
      .find((label) => label.textContent?.includes('Premature distribution disqualifier'))
      ?.control as HTMLSelectElement
    expect(disqualifier.value).toBe('')
    await act(async () => {
      disqualifier.value = 'false'
      disqualifier.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const account = getPlan().accounts[0] as Extract<Account, { type: 'pension' }>
    expect(account.stateEligibility?.earlyDistributionDisqualifier).toBe('false')
  })

  it('preserves explicit false and supports clearing optional eligibility facts', async () => {
    const { host, getPlan } = await mountPension(
      pension({
        source: 'militaryRetirement',
        stateEligibility: {
          planJurisdiction: 'WI',
          recipientDisabled: true,
          survivorSpouse: true,
          deathOrDisabilitySurvivorUnder55: true,
          earningsNotCoveredBySocialSecurity: true,
        },
      }),
    )
    const selectByLabel = (text: string) => {
      const label = [...host.querySelectorAll('label')].find((node) => node.textContent?.includes(text))!
      return host.querySelector<HTMLSelectElement>(`#${CSS.escape(label.htmlFor)}`)!
    }
    const commit = async (label: string, value: string) => {
      const control = selectByLabel(label)
      await act(async () => {
        control.value = value
        control.dispatchEvent(new Event('change', { bubbles: true }))
      })
    }
    await commit('Recipient disabled', 'false')
    await commit('Survivor benefit to spouse', 'false')
    await commit('Death or disability survivor under 55', 'false')
    await commit('Earnings not covered by Social Security', 'false')
    let account = getPlan().accounts[0] as Extract<Account, { type: 'pension' }>
    expect(account.stateEligibility).toMatchObject({
      recipientDisabled: false,
      survivorSpouse: false,
      deathOrDisabilitySurvivorUnder55: false,
      earningsNotCoveredBySocialSecurity: false,
    })
    await commit('Plan jurisdiction (state)', '')
    await commit('Recipient disabled', '')
    await commit('Survivor benefit to spouse', '')
    await commit('Death or disability survivor under 55', '')
    await commit('Earnings not covered by Social Security', '')
    account = getPlan().accounts[0] as Extract<Account, { type: 'pension' }>
    expect(account.stateEligibility?.planJurisdiction).toBeUndefined()
    expect(account.stateEligibility?.recipientDisabled).toBeUndefined()
    expect(account.stateEligibility?.survivorSpouse).toBeUndefined()
    expect(account.stateEligibility?.deathOrDisabilitySurvivorUnder55).toBeUndefined()
    expect(account.stateEligibility?.earningsNotCoveredBySocialSecurity).toBeUndefined()
    expect(parsePlan(getPlan()).ok).toBe(true)
  })

  it('clears a recorded source without certifying an unknown selection', async () => {
    const { host, getPlan } = await mountPension(pension({ source: 'ordinaryPrivatePension' }))
    const source = host.querySelector<HTMLSelectElement>('[data-pension-source] select')!
    await act(async () => {
      source.value = ''
      source.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const record = host.querySelector<HTMLButtonElement>('[data-pension-source] .btn-primary')!
    await act(async () => record.click())
    expect((getPlan().accounts[0] as Extract<Account, { type: 'pension' }>).source).toBeUndefined()
    expect(host.querySelector('[data-pension-source]')?.textContent).toContain('Not on record')
    expect(parsePlan(getPlan()).ok).toBe(true)
  })
})
