/** Spending section: baseline, phases, goals, debts, property. */

import { useState } from 'react'

import type { GoalFlexibility, SpendingClassification } from '@retiregolden/engine/model/plan'
import { annualDeltaPhases, spendingShapePhases, type SpendingShapeId } from '@retiregolden/engine/spending/shapePresets'
import { invalidateAcaEvidence } from '../householdActions'
import { usePlan } from '../planContextCore'
import { CheckboxField, MoneyField, NumberField, PercentField, SelectField, TextField } from '../fields'
import { TypeChip } from '../TypeChip'
import { LearnAboutScreen } from '../../learn/LearnAboutScreen'
import { LearnLink } from '../../learn/LearnLink'
import { LEARN } from '../learnLinks'
import { SpendingPolicyCard } from './SpendingPolicyCard'
import { Issues } from './shared'
import { newId } from './sectionHelpers'

// Named spending shapes compile to ordinary `expenses.phases` rows (visible
// and editable afterwards) — never a parallel model. Calibrations and sources
// live with the compiler in engine/spending/shapePresets.ts.
type SpendingProfileId = SpendingShapeId

export function SpendingSection() {
  const { plan, update } = usePlan()
  const e = plan.expenses
  const applyProfile = (profile: SpendingProfileId) =>
    update((d) => {
      d.expenses.phases = spendingShapePhases(profile, plan.household.people[0]?.retirementAge ?? 65)
    })
  const [customDeltaPct, setCustomDeltaPct] = useState(-1.5)
  const applyCustomDelta = () =>
    update((d) => {
      d.expenses.phases = annualDeltaPhases(customDeltaPct, plan.household.people[0]?.retirementAge ?? 65)
    })
  return (
    <section>
      <div className="card">
        <h2>Spending</h2>
        <p className="card-hint">
          Today's dollars; the engine inflates everything. Healthcare is separate: enter full (unsubsidized) premiums pre-65
          and optionally apply the modeled ACA premium credit; Medicare + IRMAA from 65. <LearnLink {...LEARN.retirementHealthcareCosts} />
        </p>
        <div className="form-grid">
          <MoneyField
            label="Baseline annual spending"
            help="Everyday living costs in today's dollars: food, utilities, transportation, clothing, entertainment, routine travel, auto insurance, and out-of-pocket medical (copays, deductibles, dental, vision). The costs with no separate input. Leave OUT anything modeled elsewhere: mortgage/loan payments (debt accounts); property tax & homeowner's insurance (enter those on the home/property account, where they correctly continue after the mortgage is paid off); health-insurance premiums (Healthcare below); and long-term-care or life-insurance premiums (Insurance). The Results page breaks all of these out in a Spending-by-category chart."
            learn={LEARN.spendingBudget}
            hint="Living costs incl. auto insurance & out-of-pocket medical; exclude mortgage, property tax, premiums."
            path="expenses.baseAnnual"
            value={e.baseAnnual}
            // The floor is not pulled down with the baseline: the engine states
            // "required annual spending cannot exceed baseline" itself
            // (model/planCrossFieldChecks.ts, run from plan.ts's superRefine),
            // so a baseline below the floor surfaces as an issue on the
            // Required floor field rather than as a silent rewrite of a
            // number nobody touched (D5).
            onCommit={(v) => update((d) => void (d.expenses.baseAnnual = v ?? 0))}
          />
          <MoneyField
            label="Required floor (today's $)"
            help="The must-fund slice of baseline spending. The least you could live on in a bad market, before any discretionary lifestyle. Only matters when Spending guardrails (below) are on: the guardrail rations the gap between baseline and this floor but never cuts below it. Leave 0 (or equal to baseline) to treat all spending as required, which is today's behavior."
            learn={LEARN.spendingBudget}
            hint="Guardrails never cut below this. 0 = all spending is required."
            path="expenses.requiredAnnual"
            value={e.requiredAnnual ?? 0}
            // Kept as typed, a floor above the baseline included: the engine
            // refuses that pair at this path, so the field shows the refusal
            // instead of storing a number that was never entered (D5).
            onCommit={(v) =>
              update((d) => {
                if (!v || v <= 0) delete d.expenses.requiredAnnual
                else d.expenses.requiredAnnual = v
              })
            }
          />
          <MoneyField
            label="Ideal annual upside"
            help="Flexible annual spending above your target lifestyle: extra travel, upgrades, gifts, or other spending you would fund only when the plan is running ahead. Fixed target mode funds it every year; guardrails fund it only after target spending has been restored."
            learn={LEARN.spendingBudget}
            hint="Above baseline target; funded after required and target."
            value={e.idealAnnual ?? 0}
            onCommit={(v) =>
              update((d) => {
                if (!v || v <= 0) delete d.expenses.idealAnnual
                else d.expenses.idealAnnual = v
              })
            }
          />
          <MoneyField
            label="Excess annual upside"
            help="Opportunistic annual spending funded last in strong paths. Use this for lifestyle upside you are comfortable skipping before touching required or target spending."
            learn={LEARN.spendingBudget}
            hint="Funded after ideal; 0 = none."
            value={e.excessAnnual ?? 0}
            onCommit={(v) =>
              update((d) => {
                if (!v || v <= 0) delete d.expenses.excessAnnual
                else d.expenses.excessAnnual = v
              })
            }
          />
          {plan.household.people.length > 1 ? (
            <PercentField
              label="Survivor spending"
              help="Household spending in years when only one of you is alive, as a percent of the couple's spending. Studies of retired couples typically land between 60% and 80%, housing and utilities barely drop, while food, travel, and healthcare for the second person do. Scales baseline + phase spending only; one-time goals, healthcare premiums, debt payments, and property costs keep their own schedules."
              learn={LEARN.survivorSpending}
              hint="100% = no change in survivor years."
              step={5}
              path="expenses.survivorSpendingPct"
              value={e.survivorSpendingPct ?? 100}
              onCommit={(v) =>
                update((d) => {
                  if (v === null || v >= 100) delete d.expenses.survivorSpendingPct
                  else d.expenses.survivorSpendingPct = Math.max(0, v)
                })
              }
            />
          ) : null}
          <MoneyField
            label="Bequest target (today's $)"
            help="The after-tax estate you want the plan to still leave at the end, in today's dollars. Used as the estate floor by the sustainable-spending solver ('How much can I spend?') and by the estate-floor optimizer objective. It does not change the projection itself. Leave 0 for no target."
            learn={LEARN.sustainableSpending}
            hint="Estate floor for the spending solver and optimizer objectives; 0 = none."
            value={e.bequestTargetDollars ?? 0}
            onCommit={(v) =>
              update((d) => {
                if (!v || v <= 0) delete d.expenses.bequestTargetDollars
                else d.expenses.bequestTargetDollars = v
              })
            }
          />
        </div>

        <SpendingPolicyCard />

        <h3>Retirement phases</h3>
        <p className="card-hint">
          Spending multipliers by the primary person's age (go-go / slow-go / no-go).{' '}
          <LearnLink {...LEARN.spendingProfiles} />
        </p>
        {e.phases.map((p, i) => (
          <div className="item-row" key={i}>
            <div className="item-row-head">
              <span className="item-row-title"><TypeChip>Phase</TypeChip>from age {p.fromAge}</span>
              <button type="button" className="btn-ghost btn-ghost-danger" onClick={() => update((d) => void d.expenses.phases.splice(i, 1))}>Remove</button>
            </div>
            <div className="form-grid">
              <NumberField
                label="From age"
                help="The first age when this phase applies, using the primary person's age as the clock."
                learn={LEARN.spendingProfiles}
                path={`expenses.phases.${i}.fromAge`}
                value={p.fromAge}
                onCommit={(v) => update((d) => void (d.expenses.phases[i]!.fromAge = Math.round(v ?? 65)))}
              />
              <NumberField
                label="Multiplier"
                help="Multiplies baseline spending from this age forward. For example, 0.90 means recurring lifestyle spending is 10% lower before inflation."
                hint="1.00 = no change."
                learn={LEARN.spendingProfiles}
                // Presets write two-decimal multipliers (smirk 0.78, custom −1.5%/yr 0.64).
                // A 0.05 step marks those values HTML5-invalid even though they are editable plan rows.
                step={0.01}
                path={`expenses.phases.${i}.multiplier`}
                value={p.multiplier}
                onCommit={(v) => update((d) => void (d.expenses.phases[i]!.multiplier = v ?? 1))}
              />
            </div>
          </div>
        ))}
        <div className="add-row">
          <button type="button" className="btn btn-secondary btn-small" onClick={() => update((d) => void d.expenses.phases.push({ fromAge: 75, multiplier: 0.9 }))}>+ Phase</button>
        </div>
        <p className="field-hint" style={{ margin: '0.6rem 0 0.25rem' }}>
          {/* The section blurb above already carries the spending-profiles
              Learn link; one per destination in this section (#423). */}
          Profiles write ordinary phase rows you can edit afterwards{e.phases.length > 0 ? ' (replacing the phases above)' : ''}:
        </p>
        <div className="add-row">
          <button type="button" className="btn btn-secondary btn-small" onClick={() => applyProfile('flat')}>
            Constant-real (no phases)
          </button>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => applyProfile('smile')}>
            Retirement smile (−10% at 75, −20% at 85)
          </button>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => applyProfile('smirk')}>
            Retirement smirk (−1%/yr real)
          </button>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => applyProfile('frontLoaded')}>
            Front-loaded travel (+10% until 75)
          </button>
        </div>
        <p className="field-hint" style={{ margin: '0.6rem 0 0.25rem' }}>
          The smile is the shape of <em>average</em> retiree spending, a decline that late healthcare partly
          reverses (the preset approximates it as two downward steps); the smirk is the <em>median</em>: a steady
          real decline with no late rise, per Blanchett&apos;s spending research. Or set your own annual real drift
          in the field below; Apply custom shape compiles it to 5-year phase steps.
        </p>
        {/* In a form-grid, not a flex add-row, so the field takes the same
            column width as every other field on this form; the action sits in
            an add-row below it like the other shape buttons (#465). */}
        <div className="form-grid">
          <PercentField
            label="Custom real change per year"
            help="Your own steady real spending drift, applied from retirement and compiled into 5-year phase steps (the compounded multiplier at each step age, to age 100). Research on actual retirees clusters around −1% to −2%/yr; a positive value plans rising real spending."
            hint="Negative = declining real spending."
            learn={LEARN.spendingProfiles}
            step={0.5}
            // Intentionally pathless: this drift is not a plan field. It is
            // component state that "Apply custom shape" compiles into ordinary
            // `expenses.phases` rows, so there is no schema path to read a
            // range from and nothing to route an engine issue to.
            min={-5}
            max={5}
            value={customDeltaPct}
            onCommit={(v) => setCustomDeltaPct(v ?? -1.5)}
          />
        </div>
        <div className="add-row">
          <button type="button" className="btn btn-secondary btn-small" onClick={applyCustomDelta}>
            Apply custom shape
          </button>
        </div>

        <h3>One-time goals</h3>
        <p className="card-hint">
          Big, named purchases or gifts that should happen once instead of becoming part of everyday spending.{' '}
          <LearnLink {...LEARN.spendingBudget} />
        </p>
        <div className="add-row">
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() =>
              update((d) => {
                const targetYear = new Date().getFullYear() + 3
                d.expenses.oneTimeGoals.push({
                  id: newId(),
                  label: 'Car replacement',
                  year: targetYear,
                  amount: 35_000,
                  classification: 'target',
                  flexibility: 'movable',
                  earliestYear: targetYear - 2,
                  latestYear: targetYear,
                })
              })
            }
          >
            Car replacement
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() =>
              update((d) => {
                const targetYear = new Date().getFullYear() + 2
                d.expenses.oneTimeGoals.push({
                  id: newId(),
                  label: 'Home improvement',
                  year: targetYear,
                  amount: 50_000,
                  classification: 'ideal',
                  flexibility: 'movable',
                  earliestYear: targetYear,
                  latestYear: targetYear + 2,
                  allowPartialFunding: true,
                  minFundingPct: 50,
                })
              })
            }
          >
            Home improvement
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() =>
              update((d) => {
                const targetYear = new Date().getFullYear() + 1
                d.expenses.oneTimeGoals.push({
                  id: newId(),
                  label: 'Big trip',
                  year: targetYear,
                  amount: 12_000,
                  classification: 'excess',
                  flexibility: 'skippable',
                  earliestYear: targetYear,
                  latestYear: targetYear + 1,
                })
              })
            }
          >
            Big trip
          </button>
        </div>
        {e.oneTimeGoals.map((g, i) => (
          <div className="item-row" key={g.id}>
            <div className="item-row-head">
              <span className="item-row-title"><TypeChip>Goal</TypeChip>{g.label}</span>
              <button type="button" className="btn-ghost btn-ghost-danger" onClick={() => update((d) => void d.expenses.oneTimeGoals.splice(i, 1))}>Remove</button>
            </div>
            <div className="form-grid">
              <TextField
                label="Label"
                help="Name the goal so it is recognizable in Results, such as travel, car replacement, wedding gift, or home project."
                learn={LEARN.spendingBudget}
                path={`expenses.oneTimeGoals.${i}.label`}
                value={g.label}
                onCommit={(v) => update((d) => void (d.expenses.oneTimeGoals[i]!.label = v || 'Goal'))}
              />
              <NumberField
                label="Year"
                help="The calendar year the goal is funded. The amount is inflated from today's dollars to that year."
                learn={LEARN.spendingBudget}
                path={`expenses.oneTimeGoals.${i}.year`}
                value={g.year}
                // The funding window stays where it was put. The engine states
                // both halves of the ordering itself ("earliestYear cannot be
                // after the goal year", "latestYear cannot be before the goal
                // year"), so a year moved outside the window shows the refusal on
                // the window field rather than quietly moving it (D5).
                onCommit={(v) => update((d) => void (d.expenses.oneTimeGoals[i]!.year = Math.round(v ?? g.year)))}
              />
              <MoneyField
                label="Amount (today's $)"
                help="The one-time cost in today's dollars. Keep recurring lifestyle costs in baseline spending instead."
                learn={LEARN.spendingBudget}
                path={`expenses.oneTimeGoals.${i}.amount`}
                value={g.amount}
                onCommit={(v) => update((d) => void (d.expenses.oneTimeGoals[i]!.amount = v ?? 0))}
              />
              <SelectField<SpendingClassification>
                label="Layer"
                help="Required goals are part of the must-fund floor. Target goals are intended lifestyle. Ideal and excess goals are flexible upside funded after target spending."
                learn={LEARN.spendingBudget}
                value={g.classification ?? 'target'}
                options={[
                  { value: 'required', label: 'Required' },
                  { value: 'target', label: 'Target' },
                  { value: 'ideal', label: 'Ideal' },
                  { value: 'excess', label: 'Excess' },
                ]}
                onCommit={(classification) =>
                  update((d) => {
                    const goal = d.expenses.oneTimeGoals[i]!
                    if (classification === 'target') delete goal.classification
                    else goal.classification = classification
                  })
                }
              />
              <SelectField
                label="Flexibility"
                // The option labels ("Skippable (drop if unaffordable)") outrun
                // one goal-row column; two columns show the whole label (#465).
                wide
                help="Fixed happens in its year no matter what. Movable funds in its year normally, but is delayed up to the latest year while guardrails are cutting discretionary spending. Skippable is the same but dropped entirely if it is still unaffordable at the latest year. Only matters when Spending guardrails are on."
                learn={LEARN.spendingBudget}
                value={g.flexibility ?? 'fixed'}
                options={[
                  { value: 'fixed', label: 'Fixed (happens in its year)' },
                  { value: 'movable', label: 'Movable (delay under a cut)' },
                  { value: 'skippable', label: 'Skippable (drop if unaffordable)' },
                ]}
                onCommit={(flex: GoalFlexibility) =>
                  update((d) => {
                    const goal = d.expenses.oneTimeGoals[i]!
                    if (flex === 'fixed') {
                      delete goal.flexibility
                      delete goal.earliestYear
                      delete goal.latestYear
                      delete goal.priority
                      delete goal.minFundingPct
                      delete goal.allowPartialFunding
                    } else {
                      goal.flexibility = flex
                      goal.earliestYear ??= goal.year
                      goal.latestYear ??= goal.year
                    }
                  })
                }
              />
              {g.flexibility && g.flexibility !== 'fixed' ? (
                <>
                  <NumberField
                    label="Earliest year"
                    help="The earliest year a strong guardrail path may pull this goal forward. Leave equal to the target year to prevent acceleration."
                    learn={LEARN.spendingBudget}
                    path={`expenses.oneTimeGoals.${i}.earliestYear`}
                    value={g.earliestYear ?? g.year}
                    onCommit={(v) =>
                      update((d) => void (d.expenses.oneTimeGoals[i]!.earliestYear = Math.round(v ?? g.year)))
                    }
                  />
                  <NumberField
                    label="Latest year"
                    help="The latest year this goal may be delayed to. If it cannot be funded by then, the unfunded amount is reported as a layer shortfall."
                    learn={LEARN.spendingBudget}
                    path={`expenses.oneTimeGoals.${i}.latestYear`}
                    value={g.latestYear ?? g.year}
                    onCommit={(v) =>
                      update((d) => void (d.expenses.oneTimeGoals[i]!.latestYear = Math.round(v ?? g.year)))
                    }
                  />
                  <NumberField
                    label="Priority"
                    help="Lower numbers fund first within the same spending layer. Required goals still outrank target, ideal, and excess goals."
                    learn={LEARN.spendingBudget}
                    value={g.priority ?? i}
                    // Intentionally pathless: `expenses.oneTimeGoals.N.priority`
                    // is `z.number().int()` with no range (engine/model/plan.ts),
                    // so `boundsForPath` has nothing to hand back and a `path`
                    // here would leave the field unbounded. These two are a
                    // sort key, not a modeled quantity; they wait for the engine
                    // to state a range rather than borrow one invented here.
                    min={0}
                    max={999}
                    onCommit={(v) => update((d) => void (d.expenses.oneTimeGoals[i]!.priority = Math.round(v ?? i)))}
                  />
                  <CheckboxField
                    label="Allow partial funding"
                    help="When enabled, a flexible goal can resolve with less than the full amount if the hard flexible-goal budget clears the minimum funding percent."
                    learn={LEARN.spendingBudget}
                    value={g.allowPartialFunding ?? false}
                    onCommit={(v) =>
                      update((d) => {
                        const goal = d.expenses.oneTimeGoals[i]!
                        if (!v) {
                          delete goal.allowPartialFunding
                          delete goal.minFundingPct
                        } else {
                          goal.allowPartialFunding = true
                          goal.minFundingPct ??= 50
                        }
                      })
                    }
                  />
                  {g.allowPartialFunding ? (
                    <PercentField
                      label="Minimum funding"
                      help="The smallest percent of the goal that must be available before RetireGolden records it as partially funded instead of deferred or skipped."
                      learn={LEARN.spendingBudget}
                      step={5}
                      path={`expenses.oneTimeGoals.${i}.minFundingPct`}
                      value={g.minFundingPct ?? 50}
                      // No clamp: the engine's own 0-100 range (oneTimeGoalSchema,
                      // plan.ts) flags an entry outside it while typing and hands
                      // back the plan's value on blur (D5), so the percent only
                      // reaches here once it is already one the schema accepts.
                      // The old Math.min(95, ...) was a tighter ceiling this file
                      // invented on top of the schema's 0-100: 96-99 are schema-
                      // legal and now reach the plan. A 100 with partial funding
                      // on is refused separately, by planCrossFieldChecks.ts
                      // ("partial funding requires a minimum funding percent
                      // below 100"), which useFieldIssue surfaces on this field.
                      onCommit={(v) => update((d) => void (d.expenses.oneTimeGoals[i]!.minFundingPct = v ?? 50))}
                    />
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        ))}
        <div className="add-row">
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => update((d) => void d.expenses.oneTimeGoals.push({ id: newId(), label: 'New goal', year: new Date().getFullYear() + 2, amount: 10_000 }))}
          >
            + Goal
          </button>
        </div>

        <h3>Healthcare</h3>
        <div className="form-grid">
          <MoneyField
            label="Pre-65 premium / person / month"
            help="Enter the full unsubsidized monthly premium before any ACA credit. As a rough 2026 check, KFF's national benchmark Silver premium for a 40-year-old is $625/month, but older retirees and local quotes can differ a lot."
            learn={LEARN.healthcareBefore65}
            hint="Full (unsubsidized) marketplace premium."
            path="expenses.healthcare.pre65MonthlyPremiumPerPerson"
            value={e.healthcare.pre65MonthlyPremiumPerPerson}
            onCommit={(v) =>
              update((d) => {
                d.expenses.healthcare.pre65MonthlyPremiumPerPerson = v ?? 0
                invalidateAcaEvidence(d)
              })
            }
          />
          <MoneyField
            label="Medicare extras / person / month"
            help="Enter recurring post-65 coverage costs beyond standard Part B: Part D, Medigap, Medicare Advantage, dental, vision, or similar premiums. RetireGolden adds the 2026 Part B base premium ($202.90/month) and IRMAA separately."
            learn={LEARN.healthcareAfter65}
            hint="Part D, Medigap/Advantage; Part B + IRMAA added automatically."
            path="expenses.healthcare.medicareExtrasMonthlyPerPerson"
            value={e.healthcare.medicareExtrasMonthlyPerPerson}
            onCommit={(v) => update((d) => void (d.expenses.healthcare.medicareExtrasMonthlyPerPerson = v ?? 0))}
          />
          <CheckboxField
            label="Apply ACA premium credit"
            help="Requests current-year ACA reconciliation before Medicare. The standard planner cannot yet author the required annual tax-family, enrollment-premium, and SLCSP evidence; enabling this alone funds the gross premium and marks the year non-actionable."
            learn={LEARN.acaCredit}
            hint="Annual evidence is required before any credit is modeled."
            value={e.healthcare.applyAcaCredit}
            onCommit={(v) => update((d) => void (d.expenses.healthcare.applyAcaCredit = v))}
          />
          {plan.household.filingStatus === 'marriedFilingJointly' && plan.household.people.length === 2 ? (
            <CheckboxField
              label="Model SSA-44 IRMAA relief in survivor years"
              help="Form SSA-44 lets a surviving spouse ask Social Security to base Medicare's income surcharge (IRMAA) on the current year's lower income instead of the usual two-year lookback. This models the effect of a granted redetermination in the two years after the first death; filing the form itself is up to you."
              learn={LEARN.ssa44}
              hint="Death of spouse is a qualifying life-changing event."
              value={e.healthcare.ssa44?.survivorYears ?? false}
              onCommit={(v) =>
                update((d) => {
                  const prior = d.expenses.healthcare.ssa44
                  d.expenses.healthcare.ssa44 = { survivorYears: v, retirementYears: prior?.retirementYears ?? false }
                })
              }
            />
          ) : null}
          <CheckboxField
            label="Model SSA-44 IRMAA relief in retirement years"
            help="Stopping work is also an SSA-44 qualifying event. This applies the same redetermination in the two years after each person's retirement year, when the lookback still reflects working income."
            learn={LEARN.ssa44}
            hint="Work stoppage is a qualifying life-changing event."
            value={e.healthcare.ssa44?.retirementYears ?? false}
            onCommit={(v) =>
              update((d) => {
                const prior = d.expenses.healthcare.ssa44
                d.expenses.healthcare.ssa44 = { survivorYears: prior?.survivorYears ?? false, retirementYears: v }
              })
            }
          />
        </div>
        <Issues section="spending" />
      </div>
      <LearnAboutScreen route="/plan/:planId/spending" />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Strategy
// ---------------------------------------------------------------------------

