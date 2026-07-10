import type { Detector, InsightCard } from '../types'
import { computeFederalTax } from '../../tax/federalTax'

/**
 * The widow's-penalty lever (extended by survivor-widowhood-and-irmaa-relief,
 * step 3): screens trad-heavy MFJ couples without conversions — the original
 * gate is unchanged — and now quantifies the survivor bracket jump on the
 * plan's own first single-FILED survivor year (same MAGI priced single vs
 * joint, a cheap pack calculation, exact:false; QSS interlude years keep the
 * joint tables and are narrated, not priced), flags survivor-year IRMAA tiers
 * with an SSA-44 pointer when the plan isn't modeling the relief, and previews
 * the conversion-acceleration scenario the caller prices on the exact ledger.
 */
export const widowsPenalty: Detector = {
  id: 'widows-penalty-roth',
  category: 'social-security',
  screen(ctx) {
    if (ctx.plan.household.filingStatus !== 'marriedFilingJointly') {
      return null
    }

    if (ctx.plan.strategies.rothConversion.mode !== 'none') {
      return null
    }

    // Check if there are traditional assets
    const firstYear = ctx.projection.result.years[0]
    if (!firstYear) {
      return null
    }
    const tradBalance = ctx.plan.accounts
      .filter((a) => a.type === 'traditional')
      .reduce((sum, a) => sum + (firstYear.balances[a.id] ?? 0), 0)

    if (tradBalance < 50000) {
      return null
    }

    // Find the first year where only one spouse remains alive
    const singleYearObj = ctx.projection.result.years.find((y) => {
      const living = y.people.filter((p) => p.alive)
      return living.length === 1
    })

    if (!singleYearObj) {
      return null
    }

    const firstSingleYear = singleYearObj.year
    const lastJointYear = firstSingleYear - 1

    if (lastJointYear < ctx.projection.startYear) {
      return null
    }

    // Survivor bracket jump, quantified on the plan's own numbers: the first
    // survivor year that truly files SINGLE (a qualifying surviving spouse
    // keeps the joint tables for up to two years, so QSS years have no bracket
    // jump to price), with that year's MAGI compared single vs joint. Rough by
    // design (taxable SS itself shifts with filing status), so the card stays
    // exact:false; the preview scenario is what the exact ledger prices.
    const singleFiledYearObj = ctx.projection.result.years.find(
      (y) => y.year >= firstSingleYear && y.filingStatus === 'single',
    )
    let bracketJumpToday = 0
    if (singleFiledYearObj) {
      const jumpYear = singleFiledYearObj.year
      const survivorMagi = singleFiledYearObj.magi
      const jointAges65Plus = ctx.plan.household.people.filter(
        (p) => jumpYear - Number(p.dob.slice(0, 4)) >= 65,
      ).length
      const bracketJump = Math.max(
        0,
        computeFederalTax({
          year: jumpYear,
          filingStatus: 'single',
          ordinaryIncome: survivorMagi,
          capitalGains: 0,
          ssBenefits: 0,
          peopleAged65Plus: singleFiledYearObj.people.filter((p) => p.alive && p.ageAttained >= 65).length,
        }).totalTax -
          computeFederalTax({
            year: jumpYear,
            filingStatus: 'marriedFilingJointly',
            ordinaryIncome: survivorMagi,
            capitalGains: 0,
            ssBenefits: 0,
            peopleAged65Plus: jointAges65Plus,
          }).totalTax,
      )
      bracketJumpToday = Math.round(ctx.projection.deflate(jumpYear, bracketJump))
    }

    // SSA-44 awareness: the two years after the death are redeterminable when
    // their premiums land in an IRMAA tier the plan isn't already relieving
    // (QSS years already price IRMAA on the single table, so a flagged tier is
    // real regardless of the income-tax filing status).
    const ssa44Window = ctx.projection.result.years.filter(
      (y) => y.year >= firstSingleYear && y.year <= firstSingleYear + 1 && y.irmaaTier > 0,
    )
    const modelsSsa44 = ctx.plan.expenses.healthcare.ssa44?.survivorYears === true
    const ssa44Note =
      ssa44Window.length > 0 && !modelsSsa44
        ? ` The survivor's Medicare premiums also land in an IRMAA surcharge tier in ${ssa44Window
            .map((y) => y.year)
            .join(' and ')}: Form SSA-44 can re-price those years on the survivor's own income (model it under Spending → Healthcare).`
        : ''

    // The death is projected in the last joint year (the death year still
    // files MFJ); the survivor's own filing starts the year after — as
    // qualifying surviving spouse first when the plan opts into it.
    const isQss = singleYearObj.filingStatus === 'qualifyingSurvivingSpouse'
    const filingStory = isQss
      ? singleFiledYearObj
        ? `the survivor files as qualifying surviving spouse (joint tables) through ${singleFiledYearObj.year - 1}, then as Single from ${singleFiledYearObj.year}`
        : `the survivor files as qualifying surviving spouse (joint tables) for up to two years, then as Single`
      : `the survivor files as Single from ${firstSingleYear}`
    const rationale =
      `When one spouse passes away (projected in ${lastJointYear}), ${filingStory}. ` +
      (bracketJumpToday > 100
        ? `On the survivor's projected income in ${singleFiledYearObj!.year}, single brackets and the smaller deduction cost about $${bracketJumpToday.toLocaleString('en-US')} more (today's $) than the same income filed jointly. `
        : `Single filing cuts tax bracket ceilings in half, raising their tax rate. `) +
      `Converting traditional assets to Roth before ${firstSingleYear} utilizes joint brackets.` +
      ssa44Note

    const card: InsightCard = {
      id: 'widows-penalty-roth',
      category: 'social-security',
      title: "Avoid the 'widow's penalty' tax cliff",
      rationale,
      impact: {
        // The bracket jump is a size-of-problem number, not this action's
        // delta, so it lives in the rationale; the preview scenario supplies
        // the exact deltas when evaluated.
        qualitative: 'Proactively convert assets while filing Married Jointly to protect the survivor from higher tax brackets.',
      },
      exact: false,
      confidence: 'high',
      learnSlug: 'widows-penalty-and-survivor-brackets',
      plannerRoute: 'strategy',
      action: {
        kind: 'preview-scenario',
        scenarioName: 'Pre-emptive conversions (MFJ)',
        patch: {
          strategies: {
            rothConversion: {
              mode: 'fillToTarget',
              target: 'topOfBracket',
              targetValue: 12,
              startYear: ctx.projection.startYear,
              endYear: lastJointYear,
            },
          },
        },
      },
    }
    return card
  },
  evaluate(ctx) {
    const card = this.screen(ctx)
    if (!card) {
      throw new Error('Widows penalty not eligible')
    }
    return {
      action: card.action,
      impact: card.impact,
    }
  },
}
