import { planDollarsToLedgerCents } from '../../actions/planBalanceAdapter.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from '../../actions/structuralId.js'
import type { Plan } from '../../model/plan.js'
import type { ProjectionResult } from '../../projection/types.js'
import type { Detector } from '../types.js'

export const QCD_EFFICIENCY_EXPLORATORY_REASON =
  'This calculation-only QCD preview does not identify a donor, eligible owned IRA, execution date, charity designation, or complete eligibility evidence.'

export function qcdEfficiencyRationale(charitable: number): string {
  const charitableStr = '$' + Math.round(charitable).toLocaleString('en-US')
  return `You are donating ${charitableStr} per year outside a QCD. The model can price an exploratory QCD comparison, but it cannot call the transfer implementation-ready until a donor, eligible owned IRA, exact execution date, charity designation, and complete eligibility evidence are supplied.`
}

export interface QcdEfficiencyAnnualTarget {
  year: number
  requestedAmount: number
}

/**
 * Derive the exact-cent nominal QCD schedule that is financially equivalent
 * to the detector's recurring real-dollar strategy input over this projection.
 */
export function qcdEfficiencyAnnualTargets(
  plan: Readonly<Plan>,
  projection: Readonly<ProjectionResult>,
): readonly QcdEfficiencyAnnualTarget[] | null {
  try {
    const years = projection.years.map((entry) => entry.year)
    const firstYear = years[0]
    const lastYear = years.at(-1)
    const charitable = plan.strategies.itemizedDeductions?.charitable ?? 0
    if (
      firstYear === undefined ||
      lastYear === undefined ||
      projection.startYear !== firstYear ||
      projection.endYear !== lastYear ||
      !(charitable > 0) ||
      projection.years.some((entry, index) =>
        !Number.isFinite(entry.inflationScale) ||
        !(entry.inflationScale! > 0) ||
        (index === 0 && entry.inflationScale !== 1) ||
        !Number.isSafeInteger(entry.year) ||
        entry.year < 1 ||
        entry.year !== firstYear + index
      )
    ) return null

    const targets = projection.years.map((entry) => ({
      year: entry.year,
      requestedAmount: planDollarsToLedgerCents(
        charitable * entry.inflationScale!,
      ),
    }))
    return targets.every((target) =>
      Number.isSafeInteger(target.requestedAmount) && target.requestedAmount > 0,
    )
      ? targets
      : null
  } catch {
    return null
  }
}

/**
 * Bind a QCD detector result to the Plan revision and exact projection path
 * that produced its annual targets. Only target-relevant Plan facts are
 * included; identity collections are deliberately excluded so harmless
 * account/evidence array permutations do not change this binding.
 */
export function qcdEfficiencyProjectionBindingId(
  plan: Readonly<Plan>,
  projection: Readonly<ProjectionResult>,
): string | null {
  try {
    const annualTargets = qcdEfficiencyAnnualTargets(plan, projection)
    if (annualTargets === null) return null
    const horizonPeople = plan.household.people
      .map((person) => ({
        personId: person.id,
        dob: person.dob,
        planningAge: person.longevity.planningAge,
      }))
      .sort((left, right) => compareUtf16CodeUnits(left.personId, right.personId))
    return deriveActionStructuralId('qcd-efficiency-projection-binding', [{
      sourcePlan: {
        schemaVersion: plan.schemaVersion,
        planId: plan.id,
        updatedAtIso: plan.updatedAtIso,
        charitable: plan.strategies.itemizedDeductions?.charitable ?? 0,
        qcdAnnual: plan.strategies.qcdAnnual,
        inflationPct: plan.assumptions.inflationPct,
        horizonPeople,
      },
      projectionPath: {
        startYear: projection.startYear,
        endYear: projection.endYear,
        years: projection.years.map((entry) => ({
          year: entry.year,
          inflationScale: entry.inflationScale,
        })),
      },
      annualTargets,
    }])
  } catch {
    return null
  }
}

export const qcdEfficiency: Detector = {
  id: 'qcd-efficiency',
  category: 'withdrawals-charitable',
  version: 1,
  screen(ctx) {
    const charitable = ctx.plan.strategies.itemizedDeductions?.charitable ?? 0
    if (charitable <= 0) return null
    if (ctx.plan.strategies.qcdAnnual >= charitable) return null
    const qcdAnnualTargets = qcdEfficiencyAnnualTargets(ctx.plan, ctx.projection.result)
    const qcdProjectionBindingId = qcdEfficiencyProjectionBindingId(
      ctx.plan,
      ctx.projection.result,
    )
    if (qcdAnnualTargets === null || qcdProjectionBindingId === null) return null

    return {
      id: 'qcd-efficiency',
      category: 'withdrawals-charitable',
      title: 'Compare QCDs for your charitable giving',
      rationale: qcdEfficiencyRationale(charitable),
      impact: {
        qualitative: 'Previews donating pre-tax IRA assets directly to charity, which counts toward RMDs and lowers modeled taxable income.',
      },
      exact: false,
      confidence: 'medium',
      severity: 'info',
      evidence: [
        { label: 'Annual charitable giving', value: `$${Math.round(charitable).toLocaleString()}` },
        { label: 'Current annual QCD', value: `$${Math.round(ctx.plan.strategies.qcdAnnual).toLocaleString()}` },
      ],
      learnSlug: 'qcds-qualified-charitable-distributions',
      plannerRoute: 'strategy',
      action: {
        kind: 'preview-scenario',
        scenarioName: 'Donations routed as QCDs',
        patch: {
          strategies: {
            qcdAnnual: charitable,
            itemizedDeductions: {
              ...ctx.plan.strategies.itemizedDeductions,
              charitable: 0,
            },
          },
        },
        retirementActionReadiness: {
          state: 'exploratoryNonActionable',
          reason: QCD_EFFICIENCY_EXPLORATORY_REASON,
        },
        candidateMetadata: { qcdAnnualTargets, qcdProjectionBindingId },
      },
    }
  },
  evaluate(ctx) {
    const card = this.screen(ctx)
    if (!card) throw new Error('QCD efficiency not eligible')
    return { action: card.action, impact: card.impact }
  },
}
