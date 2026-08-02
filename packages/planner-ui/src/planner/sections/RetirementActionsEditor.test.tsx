/** @vitest-environment jsdom */

import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { parseRetirementActionRequest } from '@retiregolden/engine/actions/contract'
import { asPositiveUsdCents } from '@retiregolden/engine/actions/money'
import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'

import { PlanCtx } from '../planContextCore'
import { createSamplePlan } from '../../testSupport/samplePlan'
import { RetirementActionsEditor } from './RetirementActionsEditor'
import { StrategySection } from './StrategySection'

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

function migratedAction(
  kind: 'legacyAggregateWithdrawal' | 'legacyAggregateRothConversion' | 'legacyAggregateQcd',
  id = `migrated-${kind}`,
) {
  const parsed = parseRetirementActionRequest({
    actionId: id,
    kind,
    year: 2034,
    requestedAmount: asPositiveUsdCents(25_000_00),
    provenance: { source: 'migration', sourceId: 'plan-v1' },
    ...(kind === 'legacyAggregateWithdrawal' ? { legacyCategory: 'traditional' } : {}),
    ...(kind === 'legacyAggregateQcd' ? { legacyField: 'qcdAnnual' } : {}),
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

function scheduledWithdrawal(plan: Plan, executionDate: string, executionSequence: number) {
  const owner = plan.household.people[0]!
  const parsed = parseRetirementActionRequest({
    actionId: 'preserved-withdrawal',
    kind: 'ordinaryWithdrawal',
    year: 2034,
    executionDate,
    executionSequence,
    requestedAmount: asPositiveUsdCents(100_00),
    provenance: { source: 'manual' },
    personId: owner.id,
    allocations: [{
      allocationId: 'preserved-withdrawal-allocation',
      sourceAccountId: 'source-ira',
      requestedAmount: asPositiveUsdCents(100_00),
    }],
    purpose: { kind: 'spending' },
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

function editorPlan(): Plan {
  const plan = createSamplePlan()
  const owner = plan.household.people[0]!
  plan.accounts = [
    {
      type: 'traditional',
      id: 'source-ira',
      name: 'Traditional IRA',
      ownerPersonId: owner.id,
      annualReturnPct: null,
      kind: 'ira',
      balance: 100_000,
      annualContribution: 0,
    },
    {
      type: 'roth',
      id: 'destination-roth',
      name: 'Roth IRA',
      ownerPersonId: owner.id,
      annualReturnPct: null,
      kind: 'ira',
      balance: 10_000,
      annualContribution: 0,
    },
  ]
  plan.strategies.retirementActions = []
  return plan
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

async function completeConversionIdentityReview(host: HTMLElement, personId: string) {
  await change(controlByLabel(host, 'Person'), personId)
  await change(controlByLabel(host, 'Source account'), 'source-ira')
  await act(async () => controlByLabel<HTMLInputElement>(
    host,
    'Assign the full $25,000.00 to this source',
  ).click())
  await change(controlByLabel(host, 'Execution date'), '2034-09-01')
  await change(controlByLabel(host, 'Execution sequence'), '4')
  await change(controlByLabel(host, 'Roth destination account'), 'destination-roth')
  await change(controlByLabel(host, 'Conversion tax funding'), 'externalCash')
}

describe('RetirementActionsEditor', () => {
  it('is mounted on the public Strategy screen', async () => {
    const plan = editorPlan()
    plan.strategies.retirementActions = [migratedAction('legacyAggregateWithdrawal')]
    const mounted = await mount(
      plan,
      <MemoryRouter initialEntries={['/plan/example/strategy']}>
        <StrategySection />
      </MemoryRouter>,
    )

    await waitForText(mounted.container, 'Needs source review')
    expect(mounted.container.textContent).toContain('Retirement actions')
  })

  it('renders migrated aggregate actions with blank must-answer identity controls', async () => {
    const plan = editorPlan()
    plan.strategies.retirementActions = [migratedAction('legacyAggregateWithdrawal')]
    const mounted = await mount(plan)

    expect(mounted.container.textContent).toContain('Needs source review')
    expect(mounted.container.textContent).toContain('nothing below is preselected')
    for (const label of ['Person', 'Source account', 'Execution date', 'Execution sequence', 'Withdrawal purpose']) {
      expect(controlByLabel(mounted.container, label).value).toBe('')
    }
  })

  it('disambiguates household members with duplicate names using stable IDs', async () => {
    const plan = editorPlan()
    const first = plan.household.people[0]!
    const second = plan.household.people[1]!
    second.name = first.name
    plan.strategies.retirementActions = [migratedAction('legacyAggregateWithdrawal')]
    const mounted = await mount(plan)

    const labels = Array.from(
      controlByLabel<HTMLSelectElement>(mounted.container, 'Person').options,
    ).slice(1).map((option) => option.textContent)

    expect(labels).toEqual([
      `${first.name} (ID ${first.id})`,
      `${second.name} (ID ${second.id})`,
    ])
  })

  it('uses the engine adapter to replace a migrated withdrawal after explicit review', async () => {
    const plan = editorPlan()
    const target = migratedAction('legacyAggregateWithdrawal')
    plan.strategies.retirementActions = [target]
    const mounted = await mount(plan)
    const owner = plan.household.people[0]!

    await change(controlByLabel(mounted.container, 'Person'), owner.id)
    await change(controlByLabel(mounted.container, 'Source account'), 'source-ira')
    const confirm = controlByLabel<HTMLInputElement>(
      mounted.container,
      'Assign the full $25,000.00 to this source',
    )
    await act(async () => confirm.click())
    await change(controlByLabel(mounted.container, 'Execution date'), '2034-06-15')
    await change(controlByLabel(mounted.container, 'Execution sequence'), '3')
    await change(controlByLabel(mounted.container, 'Withdrawal purpose'), 'spending')
    const save = Array.from(mounted.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Save reviewed action',
    )
    await act(async () => save!.click())

    const replacement = mounted.current().strategies.retirementActions[0]!
    expect(replacement).toMatchObject({
      kind: 'ordinaryWithdrawal',
      year: target.year,
      requestedAmount: target.requestedAmount,
      personId: owner.id,
      executionDate: '2034-06-15',
      executionSequence: 3,
      provenance: { source: 'manual' },
      allocations: [{ sourceAccountId: 'source-ira', requestedAmount: target.requestedAmount }],
      purpose: { kind: 'spending' },
    })
    expect(replacement.actionId).not.toBe(target.actionId)
    expect(parsePlan(mounted.current()).ok).toBe(true)
    expect(mounted.container.textContent).not.toContain('Needs source review')
  })

  it('preserves another review row draft when an earlier action is replaced', async () => {
    const plan = editorPlan()
    const first = migratedAction('legacyAggregateWithdrawal', 'migrated-first')
    const second = migratedAction('legacyAggregateWithdrawal', 'migrated-second')
    plan.strategies.retirementActions = [first, second]
    const mounted = await mount(plan)
    const owner = plan.household.people[0]!
    const secondRow = mounted.container.querySelector<HTMLElement>(
      `[data-retirement-action-id="${second.actionId}"]`,
    )!

    await change(controlByLabel(secondRow, 'Person'), owner.id)
    await change(controlByLabel(secondRow, 'Source account'), 'source-ira')
    await change(controlByLabel(secondRow, 'Execution date'), '2034-11-20')
    await change(controlByLabel(secondRow, 'Execution sequence'), '9')

    const firstRow = mounted.container.querySelector<HTMLElement>(
      `[data-retirement-action-id="${first.actionId}"]`,
    )!
    await change(controlByLabel(firstRow, 'Person'), owner.id)
    await change(controlByLabel(firstRow, 'Source account'), 'source-ira')
    await act(async () => controlByLabel<HTMLInputElement>(
      firstRow,
      'Assign the full $25,000.00 to this source',
    ).click())
    await change(controlByLabel(firstRow, 'Execution date'), '2034-06-15')
    await change(controlByLabel(firstRow, 'Execution sequence'), '3')
    await change(controlByLabel(firstRow, 'Withdrawal purpose'), 'spending')
    const save = Array.from(firstRow.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Save reviewed action',
    )
    await act(async () => save!.click())

    const preservedSecondRow = mounted.container.querySelector<HTMLElement>(
      `[data-retirement-action-id="${second.actionId}"]`,
    )!
    expect(controlByLabel(preservedSecondRow, 'Person').value).toBe(owner.id)
    expect(controlByLabel(preservedSecondRow, 'Source account').value).toBe('source-ira')
    expect(controlByLabel(preservedSecondRow, 'Execution date').value).toBe('2034-11-20')
    expect(controlByLabel(preservedSecondRow, 'Execution sequence').value).toBe('9')
    expect(mounted.current().strategies.retirementActions).toEqual([
      expect.objectContaining({ kind: 'ordinaryWithdrawal' }),
      second,
    ])
  })

  it('blocks Save when a preserved action already uses the chosen execution slot', async () => {
    const plan = editorPlan()
    const target = migratedAction('legacyAggregateWithdrawal')
    const preserved = scheduledWithdrawal(plan, '2034-06-15', 3)
    plan.strategies.retirementActions = [target, preserved]
    const mounted = await mount(plan)
    const owner = plan.household.people[0]!

    await change(controlByLabel(mounted.container, 'Person'), owner.id)
    await change(controlByLabel(mounted.container, 'Source account'), 'source-ira')
    await act(async () => controlByLabel<HTMLInputElement>(
      mounted.container,
      'Assign the full $25,000.00 to this source',
    ).click())
    await change(controlByLabel(mounted.container, 'Execution date'), '2034-06-15')
    await change(controlByLabel(mounted.container, 'Execution sequence'), '3')
    await change(controlByLabel(mounted.container, 'Withdrawal purpose'), 'spending')
    const save = Array.from(mounted.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Save reviewed action',
    )
    await act(async () => save!.click())

    expect(mounted.current().strategies.retirementActions).toEqual([target, preserved])
    expect(mounted.container.textContent).toContain(
      'Another retirement action already uses this execution date and sequence.',
    )
  })

  it('requires an explicit Roth destination and tax-funding decision', async () => {
    const plan = editorPlan()
    plan.strategies.retirementActions = [migratedAction('legacyAggregateRothConversion')]
    const mounted = await mount(plan)
    const owner = plan.household.people[0]!

    await change(controlByLabel(mounted.container, 'Person'), owner.id)
    expect(controlByLabel<HTMLSelectElement>(mounted.container, 'Source account').value).toBe('')
    expect(controlByLabel<HTMLSelectElement>(mounted.container, 'Roth destination account').value).toBe('')
    expect(controlByLabel<HTMLSelectElement>(mounted.container, 'Conversion tax funding').value).toBe('')
    expect(Array.from(
      controlByLabel<HTMLSelectElement>(mounted.container, 'Source account').options,
    ).map((option) => option.value)).toContain('source-ira')
    expect(Array.from(
      controlByLabel<HTMLSelectElement>(mounted.container, 'Roth destination account').options,
    ).map((option) => option.value)).toContain('destination-roth')
  })

  it('keeps principal withholding visible but blocks replacement as unsupported', async () => {
    const plan = editorPlan()
    const target = migratedAction('legacyAggregateRothConversion')
    plan.strategies.retirementActions = [target]
    const mounted = await mount(plan)
    const owner = plan.household.people[0]!

    await completeConversionIdentityReview(mounted.container, owner.id)
    await change(
      controlByLabel(mounted.container, 'Conversion tax funding'),
      'conversionPrincipalWithholding',
    )
    expect(mounted.container.textContent).toContain(
      'Conversion-principal withholding is not supported.',
    )
    expect(Array.from(mounted.container.querySelectorAll('label')).some(
      (label) => label.textContent?.trim() === 'Tax-funding amount',
    )).toBe(false)

    const save = Array.from(mounted.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Save reviewed action',
    )
    await act(async () => save!.click())

    expect(mounted.current().strategies.retirementActions).toEqual([target])
    expect(mounted.container.textContent).toContain(
      'Choose external cash or no tax funding expected.',
    )
  })

  it('excludes employer-plan conversion sources and explains the unsupported boundary', async () => {
    const plan = editorPlan()
    const target = migratedAction('legacyAggregateRothConversion')
    const source = plan.accounts.find((account) => account.id === 'source-ira')!
    if (source.type !== 'traditional') throw new Error('expected traditional source')
    source.kind = 'employer'
    source.name = 'Employer 401(k)'
    plan.strategies.retirementActions = [target]
    const mounted = await mount(plan)
    const owner = plan.household.people[0]!

    await change(controlByLabel(mounted.container, 'Person'), owner.id)
    const sourceOptions = Array.from(
      controlByLabel<HTMLSelectElement>(mounted.container, 'Source account').options,
    ).slice(1)
    expect(sourceOptions).toEqual([])
    expect(mounted.container.textContent).toContain(
      'No supported conversion source is available for this person.',
    )
    expect(mounted.container.textContent).toContain(
      'employer-plan conversions remain unsupported until plan-availability evidence is modeled.',
    )

    const save = Array.from(mounted.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Save reviewed action',
    )
    await act(async () => save!.click())
    expect(mounted.current().strategies.retirementActions).toEqual([target])
  })

  it('disambiguates same-name account choices with type, kind, and stable ID', async () => {
    const plan = editorPlan()
    const owner = plan.household.people[0]!
    plan.accounts.push(
      {
        type: 'traditional',
        id: 'source-ira-2',
        name: 'Traditional IRA',
        ownerPersonId: owner.id,
        annualReturnPct: null,
        kind: 'ira',
        balance: 200_000,
        annualContribution: 0,
      },
      {
        type: 'roth',
        id: 'destination-roth-2',
        name: 'Roth IRA',
        ownerPersonId: owner.id,
        annualReturnPct: null,
        kind: 'ira',
        balance: 20_000,
        annualContribution: 0,
      },
    )
    plan.strategies.retirementActions = [migratedAction('legacyAggregateRothConversion')]
    const mounted = await mount(plan)

    await change(controlByLabel(mounted.container, 'Person'), owner.id)
    const sourceLabels = Array.from(
      controlByLabel<HTMLSelectElement>(mounted.container, 'Source account').options,
    ).slice(1).map((option) => option.textContent)
    const destinationLabels = Array.from(
      controlByLabel<HTMLSelectElement>(mounted.container, 'Roth destination account').options,
    ).slice(1).map((option) => option.textContent)

    expect(sourceLabels).toEqual([
      'Traditional IRA (traditional/ira; ID source-ira)',
      'Traditional IRA (traditional/ira; ID source-ira-2)',
    ])
    expect(destinationLabels).toEqual([
      'Roth IRA (roth/ira; ID destination-roth)',
      'Roth IRA (roth/ira; ID destination-roth-2)',
    ])
  })

  it('replaces a migrated conversion only after every identity and funding choice is made', async () => {
    const plan = editorPlan()
    const target = migratedAction('legacyAggregateRothConversion')
    plan.strategies.retirementActions = [target]
    const mounted = await mount(plan)
    const owner = plan.household.people[0]!

    await change(controlByLabel(mounted.container, 'Person'), owner.id)
    await change(controlByLabel(mounted.container, 'Source account'), 'source-ira')
    await act(async () => controlByLabel<HTMLInputElement>(
      mounted.container,
      'Assign the full $25,000.00 to this source',
    ).click())
    await change(controlByLabel(mounted.container, 'Execution date'), '2034-09-01')
    await change(controlByLabel(mounted.container, 'Execution sequence'), '4')
    await change(
      controlByLabel(mounted.container, 'Roth destination account'),
      'destination-roth',
    )
    await change(
      controlByLabel(mounted.container, 'Conversion tax funding'),
      'noneExpected',
    )
    const save = Array.from(mounted.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Save reviewed action',
    )
    await act(async () => save!.click())

    expect(mounted.current().strategies.retirementActions).toEqual([
      expect.objectContaining({
        kind: 'rothConversion',
        personId: owner.id,
        destinationRothAccountId: 'destination-roth',
        executionDate: '2034-09-01',
        executionSequence: 4,
        requestedAmount: target.requestedAmount,
        taxFunding: { kind: 'noneExpected' },
        allocations: [expect.objectContaining({ sourceAccountId: 'source-ira' })],
      }),
    ])
    expect(parsePlan(mounted.current()).ok).toBe(true)
  })

  it('refuses a stale tax-funding amount after valid text becomes malformed', async () => {
    const plan = editorPlan()
    const target = migratedAction('legacyAggregateRothConversion')
    plan.strategies.retirementActions = [target]
    const mounted = await mount(plan)
    const owner = plan.household.people[0]!

    await completeConversionIdentityReview(mounted.container, owner.id)
    const amount = controlByLabel<HTMLInputElement>(mounted.container, 'Tax-funding amount')
    await change(amount, '100')
    await act(async () => controlByLabel<HTMLInputElement>(
      mounted.container,
      'I confirm this external cash is available',
    ).click())

    await change(amount, '100x')
    const save = Array.from(mounted.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Save reviewed action',
    )
    await act(async () => save!.click())

    expect(mounted.current().strategies.retirementActions).toEqual([target])
    expect(mounted.container.textContent).toContain(
      'Enter a positive exact-cent tax-funding amount.',
    )
  })

  it('revokes external-cash attestation whenever its amount changes', async () => {
    const plan = editorPlan()
    const target = migratedAction('legacyAggregateRothConversion')
    plan.strategies.retirementActions = [target]
    const mounted = await mount(plan)
    const owner = plan.household.people[0]!

    await completeConversionIdentityReview(mounted.container, owner.id)
    const amount = controlByLabel<HTMLInputElement>(mounted.container, 'Tax-funding amount')
    await change(amount, '100')
    const attestation = controlByLabel<HTMLInputElement>(
      mounted.container,
      'I confirm this external cash is available',
    )
    await act(async () => attestation.click())
    expect(attestation.checked).toBe(true)

    await change(amount, '200')

    expect(attestation.checked).toBe(false)
    const save = Array.from(mounted.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Save reviewed action',
    )
    await act(async () => save!.click())
    expect(mounted.current().strategies.retirementActions).toEqual([target])
    expect(mounted.container.textContent).toContain(
      'Confirm that the external cash is available for conversion taxes.',
    )
  })

  it('keeps migrated QCDs visibly manual-review-required and unsupported', async () => {
    const plan = editorPlan()
    plan.strategies.retirementActions = [migratedAction('legacyAggregateQcd')]
    const mounted = await mount(plan)

    expect(mounted.container.textContent).toContain('Needs source review')
    expect(mounted.container.textContent).toContain(
      'Manual review required — QCD source editing is not supported yet.',
    )
    expect(mounted.container.textContent).toContain(
      'until the canonical identity allocator exposes a QCD arm',
    )
    expect(mounted.container.querySelector('button')).toBeNull()
    expect(mounted.current().strategies.retirementActions[0]?.kind).toBe('legacyAggregateQcd')
  })
})
