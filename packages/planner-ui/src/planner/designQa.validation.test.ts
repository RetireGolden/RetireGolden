/**
 * Source and stylesheet pins for the validation chrome (#452, #459, #476,
 * #494). Behaviour is covered in validationChrome.test.tsx; these hold the
 * pieces jsdom cannot see.
 */
import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8').replace(/\r\n/g, '\n')

describe('validation chrome pins', () => {
  it('invalid controls and their messages use the danger token; the save chip is a button that jumps', () => {
    const css = read('./planner.css')
    expect(css).toMatch(/\.field input\[aria-invalid='true'\],\n\.field select\[aria-invalid='true'\] \{\s*border-color: var\(--bad\)/)
    expect(css).toMatch(/\.field-error \{[^}]*color: var\(--bad\)/)
    expect(css).toMatch(/\.save-state--button \{[^}]*cursor: pointer/)
    const workspace = read('./PlanWorkspace.tsx')
    expect(workspace).toMatch(/document\.querySelector<HTMLElement>\('\[aria-invalid="true"\], \.issue-list'\)/)
    expect(workspace).toContain('className="save-state save-state--error save-state--button"')
  })

  it('every plan section scopes its issue list', () => {
    const sections = ['Accounts', 'Assumptions', 'Household', 'IncomeFloor', 'Income', 'Insurance', 'Spending', 'Strategy']
    for (const name of sections) {
      const src = read(`./sections/${name}Section.tsx`)
      expect(src, name).toMatch(/<Issues section="[a-z-]+" \/>/)
      expect(src, name).not.toContain('<Issues />')
    }
  })

  it('the fields the walk cited carry their schema path, so the engine issue lands beside them', () => {
    const pins: Array<[string, string[]]> = [
      ['./sections/StrategySection.tsx', [
        'path="strategies.qcdAnnual"',
        'path="strategies.taxableSafetyNetFloor"',
        'path="strategies.itemizedDeductions.stateAndLocalTaxes"',
        'path="strategies.rothConversion.targetValue"',
        'path="strategies.rothConversion.startYear"',
        'path="strategies.rothConversion.endYear"',
      ]],
      ['./sections/AssumptionsSection.tsx', [
        'path="assumptions.localIncomeTaxPct"',
        'path="assumptions.stateEffectiveTaxPct"',
        'path="assumptions.inflationPct"',
        'path="assumptions.healthcareExtraInflationPct"',
        'path="assumptions.defaultReturnPct"',
        'path="assumptions.heirTaxRatePct"',
      ]],
      ['./sections/HouseholdSection.tsx', [
        'path={`household.people.${i}.longevity.planningAge`}',
        'path={`household.people.${i}.retirementAge`}',
      ]],
      ['./sections/IncomeFloorSection.tsx', [
        'path={`incomeFloor.ladders.${index}.startYear`}',
        'path={`incomeFloor.ladders.${index}.endYear`}',
      ]],
      ['./sections/SpendingSection.tsx', [
        'path="expenses.baseAnnual"',
        'path={`expenses.phases.${i}.fromAge`}',
        'path={`expenses.phases.${i}.multiplier`}',
        'path={`expenses.oneTimeGoals.${i}.label`}',
        'path={`expenses.oneTimeGoals.${i}.year`}',
        'path={`expenses.oneTimeGoals.${i}.amount`}',
      ]],
      ['./sections/InsuranceSection.tsx', [
        'path={`insurance.${index}.premiumEndAge`}',
        'path={`insurance.${index}.cashValueGrowthPct`}',
        'useFieldIssue(`insurance.${index}.cashValueSchedule`)',
        'path={`careEvents.${index}.durationYears`}',
      ]],
      ['./sections/AccountEditorSharedFields.tsx', ['path={`accounts.${index}.balance`}']],
      ['./sections/PropertyDebtAccountEditors.tsx', [
        'path={`accounts.${index}.payoffYear`}',
        'path={`accounts.${index}.plannedSaleYear`}',
        'path={`accounts.${index}.interestPct`}',
      ]],
      ['./sections/LiquidAccountEditors.tsx', [
        'path={`accounts.${index}.dividendYieldPct`}',
        'path={`accounts.${index}.qualifiedRatio`}',
      ]],
      ['./sections/IncomeSection.tsx', [
        'path={`incomes.${index}.annualGross`}',
        'path={`incomes.${index}.endAge`}',
        'path={`incomes.${index}.startYear`}',
        'path={`incomes.${index}.endYear`}',
      ]],
      ['./SocialSecuritySection.tsx', [
        'path={`incomes.${streamIndex}.claimAge.years`}',
        'path={`incomes.${streamIndex}.claimAge.months`}',
      ]],
    ]
    for (const [file, paths] of pins) {
      const src = read(file)
      for (const p of paths) expect(src, `${file} ${p}`).toContain(p)
    }
  })

  it('scenario field lists never show raw pointer or dotted paths (#459)', () => {
    const scenarios = read('./ScenariosPage.tsx')
    expect(scenarios).not.toContain("preview.operationPaths.join(', ')")
    expect(scenarios).not.toContain("d.path.split('.').slice(-2)")
    expect(scenarios).toContain('{preview.operationPaths.map(fieldName)')
    expect(scenarios).toContain('{fieldName(d.path)}')
  })
})
