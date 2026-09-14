/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Output families imported from the output-family census at commit 17c1d3d387430e65992822a159919b1eac5dcfa8.
 * Regenerate: node packages/engine/scripts/import-output-census.mjs <census-dir>
 */

export type OutputFamilyKind = 'engine' | 'ui-native' | 'ui-transformation' | 'adapter'

export interface OutputFamilySurface {
  readonly surface: string
  readonly selector: string
}

export interface OutputFamilyEngineSource {
  readonly path: string
  readonly symbol: string
}

export interface OutputFamilyRelocation {
  readonly status: 'pending' | 'done'
  readonly target: string | null
}

export interface OutputFamily {
  readonly title: string
  readonly group: string
  readonly meaning: string
  readonly unit: string
  readonly basis: string
  readonly dimensions: readonly string[]
  readonly kind: OutputFamilyKind
  readonly engineSource: OutputFamilyEngineSource | null
  readonly surfaces: readonly OutputFamilySurface[]
  readonly relocation: OutputFamilyRelocation | null
}

const families = {
  "aca-applicable-slcsp-premium-annual": {
    "title": "ACA benchmark (SLCSP) premium",
    "group": "medicare-and-aca",
    "meaning": "Applicable second-lowest-cost silver plan premium for the year; null when not modeled.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/aca.ts",
      "symbol": "YearAcaResult.applicableSlcspPremium"
    },
    "surfaces": [
      {
        "surface": "report",
        "selector": "aca-ledger block and ReportPage ACA table \"Benchmark premium\""
      }
    ],
    "relocation": null
  },
  "aca-economic-net-premium-annual": {
    "title": "ACA net premium",
    "group": "medicare-and-aca",
    "meaning": "Gross enrollment premium net of the modeled allowable credit.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/aca.ts",
      "symbol": "YearAcaResult.economicNetPremium"
    },
    "surfaces": [
      {
        "surface": "report",
        "selector": "aca-ledger block and ReportPage ACA table \"Net premium\""
      }
    ],
    "relocation": null
  },
  "aca-gross-enrollment-premium-annual": {
    "title": "ACA gross enrollment premium",
    "group": "medicare-and-aca",
    "meaning": "Gross Marketplace premium for the year before any premium tax credit.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/aca.ts",
      "symbol": "YearAcaResult.grossEnrollmentPremium"
    },
    "surfaces": [
      {
        "surface": "report",
        "selector": "aca-ledger block and ReportPage ACA table \"Gross premium\""
      }
    ],
    "relocation": null
  },
  "aca-modeled-allowable-ptc-annual": {
    "title": "ACA modeled premium tax credit",
    "group": "medicare-and-aca",
    "meaning": "Modeled allowable premium tax credit for the year; null when not modeled.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/aca.ts",
      "symbol": "YearAcaResult.modeledAllowablePtc"
    },
    "surfaces": [
      {
        "surface": "report",
        "selector": "aca-ledger block and ReportPage ACA table \"Modeled credit\""
      },
      {
        "surface": "insights",
        "selector": "aca-threshold-proximity card evidence \"Modeled premium tax credit at stake\" (evidence is not rendered at pin)"
      }
    ],
    "relocation": null
  },
  "accounts-balance-per-account-annual": {
    "title": "End-of-year balance per account",
    "group": "accounts-and-growth",
    "meaning": "End-of-year balance of each plan account after flows and growth, keyed by account id.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year",
      "account"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.balances"
    },
    "surfaces": [
      {
        "surface": "chart",
        "selector": "Investable balances by account type (summed per category by display-balance-by-category-annual)"
      },
      {
        "surface": "report",
        "selector": "chart-data block per-category series (same category sum)"
      },
      {
        "surface": "results-table",
        "selector": "Inherited schedule and carryforward callouts read individual balances indirectly; no per-account column is printed"
      }
    ],
    "relocation": null
  },
  "accounts-ending-balance-by-category": {
    "title": "Ending balance by category",
    "group": "accounts-and-growth",
    "meaning": "End-of-plan balance summed by account category (cash, taxable, traditional, roth, hsa) over the selected logical balance accounts.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "category"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/compare.ts",
      "symbol": "ProjectionSummary.endingByCategory"
    },
    "surfaces": [
      {
        "surface": "results-headline",
        "selector": "KpiBar \"ending Roth $X\" (endingByCategory.roth)"
      },
      {
        "surface": "scenarios-page",
        "selector": "Estate table Cash / Taxable / Traditional / Roth / HSA rows"
      },
      {
        "surface": "mcp",
        "selector": "run_projection.summary.endingByCategory"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.a.endingByCategory"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.b.endingByCategory"
      }
    ],
    "relocation": null
  },
  "accounts-investable-total-annual": {
    "title": "Investable total",
    "group": "accounts-and-growth",
    "meaning": "Cash + taxable + traditional + Roth + HSA (+ unassigned) balances at year end.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.investableTotal"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "investable"
      },
      {
        "surface": "results-table",
        "selector": "Investable column"
      },
      {
        "surface": "report",
        "selector": "year-ledger block investable and ReportPage year table"
      },
      {
        "surface": "chart",
        "selector": "Path to FI chart investable line"
      },
      {
        "surface": "scenarios-page",
        "selector": "Annual ledger comparison \"Investable assets\""
      },
      {
        "surface": "survivor-page",
        "selector": "Survivor spending \"low point\" (minimum over survivor years)"
      },
      {
        "surface": "results-table",
        "selector": "Bucket lens investableTotal row and bucket sum"
      },
      {
        "surface": "insights",
        "selector": "spending-guardrails and hecm-buffer cards read year-one investableTotal"
      }
    ],
    "relocation": null
  },
  "accounts-net-worth-annual": {
    "title": "Net worth",
    "group": "accounts-and-growth",
    "meaning": "Modeled total net worth at the end of a projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.netWorth"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "netWorth"
      },
      {
        "surface": "report",
        "selector": "headlineResults"
      },
      {
        "surface": "results-table",
        "selector": "Net worth column"
      },
      {
        "surface": "report",
        "selector": "year-ledger block netWorth and ReportPage year table"
      },
      {
        "surface": "scenarios-page",
        "selector": "Annual \"Net worth\""
      }
    ],
    "relocation": null
  },
  "annuitization-payout-rate-pct": {
    "title": "SPIA payout rate",
    "group": "monte-carlo",
    "meaning": "Annual annuity payout as a percent of premium at the payment start age, from the embedded default quote table or the user quote.",
    "unit": "percent",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/decisions/annuitization.ts",
      "symbol": "AnnuitizationSweep.payoutRatePct"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Annuitization paragraph \"payout rate X% at age Y\""
      },
      {
        "surface": "insights",
        "selector": "annuitizationHeadroom card illustrative monthly income (spiaPayoutRate)"
      }
    ],
    "relocation": null
  },
  "annuitization-sweep-annual-income": {
    "title": "Annuitization sweep annual income",
    "group": "monte-carlo",
    "meaning": "Annual life-annuity income the premium buys at the quoted payout rate.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "grid point"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/decisions/annuitization.ts",
      "symbol": "AnnuitizationSweepPoint.annualIncome"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Annuitization frontier table \"Income/yr\" column"
      }
    ],
    "relocation": null
  },
  "annuitization-sweep-effective-allocation-pct": {
    "title": "Annuitization sweep effective allocation",
    "group": "monte-carlo",
    "meaning": "Premium divided by total investable assets, in percent; lower than the requested grid percent when the funding account caps the purchase.",
    "unit": "percent",
    "basis": "n/a",
    "dimensions": [
      "grid point"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/decisions/annuitization.ts",
      "symbol": "AnnuitizationSweepPoint.effectiveAllocationPct"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Annuitization frontier chart x-axis and table \"Annuitized\" column"
      }
    ],
    "relocation": null
  },
  "annuitization-sweep-premium": {
    "title": "Annuitization sweep premium",
    "group": "monte-carlo",
    "meaning": "SPIA premium traded away at each grid point: the requested share of investable assets, capped by the largest liquid funding account.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "grid point"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/decisions/annuitization.ts",
      "symbol": "AnnuitizationSweepPoint.premium"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Annuitization frontier table \"Premium\" column"
      }
    ],
    "relocation": null
  },
  "bucket-lens-allocation": {
    "title": "buckets",
    "group": "cash-flow-and-summary",
    "meaning": "Investable assets assigned to near-, middle-, and long-horizon spending buckets.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "results-table",
        "selector": "bucket lens allocation"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "cash-flow-line-amount": {
    "title": "Cash-flow line amount",
    "group": "cash-flow-and-summary",
    "meaning": "Dollar amount carried by a source-to-use line in the selected year cash-flow drilldown.",
    "unit": "usd",
    "basis": "display",
    "dimensions": [
      "year",
      "source",
      "use"
    ],
    "kind": "ui-transformation",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "cash-flow-drilldown",
        "selector": "Sankey link and node amount labels"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "cash-flow-line-plan-dollars": {
    "title": "Cash-flow line amounts (nominal plan dollars)",
    "group": "cash-flow-and-summary",
    "meaning": "The nominal plan-dollar amount of one identity-bearing cash-flow line in a projection year: a source line's amount, a use line's requested, funded and unfunded amounts, and a transfer line's paired debit and credit.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year",
      "source",
      "use"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/cashFlow.ts",
      "symbol": "YearCashFlowCashSourceLine.amountPlanDollars / YearCashFlowPostSolveDepositLine.amountPlanDollars / YearCashFlowUseLine.requestedPlanDollars, fundedPlanDollars, unfundedPlanDollars / YearCashFlowTransferLine.debitPlanDollars, creditPlanDollars"
    },
    "surfaces": [
      {
        "surface": "cash-flow-drilldown",
        "selector": "YearCashFlowDialog DetailTable columns Amount, Requested, Funded, Unfunded, Debit and Credit (through display-dollar-basis-conversion)"
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "Sankey links and per-node totals (the UI mapping is cash-flow-line-amount)"
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "detailCsv.ts columns nominalAmount, requested, funded, unfunded, debit, credit (unrounded nominal plan dollars)"
      }
    ],
    "relocation": null
  },
  "cash-flow-reconciliation-totals": {
    "title": "Cash-flow reconciliation totals",
    "group": "cash-flow-and-summary",
    "meaning": "Per year, the total of funded sources, the total of funded uses, the unfunded (shortfall) uses, and the paired transfer debit and credit totals that the identity-bearing cash-flow ledger reconciles.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/cashFlow.ts",
      "symbol": "YearCashFlowCashIdentityTotals.sourceTotalPlanDollars / YearCashFlowUseIdentityTotals.fundedUsesPlanDollars, unfundedUsesPlanDollars / YearCashFlowTransferIdentityTotals.debitsPlanDollars, creditsPlanDollars"
    },
    "surfaces": [
      {
        "surface": "cash-flow-drilldown",
        "selector": "YearCashFlowDialog summary tiles \"Sources\", \"Funded uses\", \"Shortfall\" and Sankey props"
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "YearCashFlowSankey aria-label: 'Cash flow for YEAR. Source total $X. Funded uses $Y. Shortfall $Z.' and, on the transfers view, 'Transfers for YEAR. Debits $X. Credits $Y.'"
      }
    ],
    "relocation": null
  },
  "cash-flow-tax-character-amount": {
    "title": "Cash-flow line tax character amount",
    "group": "taxes",
    "meaning": "The dollar amount of one tax characterization attached to a cash-flow line or standing alone (ordinary income, capital gain or loss, QCD exclusion, phantom OID and the other closed kinds); metadata that is never summed into the money identities.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year",
      "source",
      "use"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/cashFlow.ts",
      "symbol": "YearCashFlowTaxCharacter.amountPlanDollars (on source, transfer and standalone taxCharacterMetadata lines)"
    },
    "surfaces": [
      {
        "surface": "cash-flow-drilldown",
        "selector": "YearCashFlowDialog DetailTable 'Tax character' column (kind and amount per line) and the taxCharacter view rows"
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "detailCsv.ts taxCharacter column (kind:amount pairs)"
      }
    ],
    "relocation": null
  },
  "claim-age-co-optimization-combinations-evaluated": {
    "title": "combinationsEvaluated",
    "group": "optimizer-and-comparisons",
    "meaning": "Number of household Social Security claim-age combinations evaluated by optimization.",
    "unit": "count",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/optimizePlan.ts",
      "symbol": "ClaimAgeCoOptimization.combinationsEvaluated"
    },
    "surfaces": [
      {
        "surface": "optimize-page",
        "selector": "claim combinations evaluated"
      },
      {
        "surface": "report",
        "selector": "modeled-findings claim-age \"SS claim combinations optimized\""
      }
    ],
    "relocation": null
  },
  "claim-age-co-optimization-current-claim-exact-estate": {
    "title": "currentClaimExactEstate",
    "group": "optimizer-and-comparisons",
    "meaning": "After-tax estate produced by exact validation of the current claim ages.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/optimizePlan.ts",
      "symbol": "ClaimAgeCoOptimization.currentClaimExactEstate"
    },
    "surfaces": [
      {
        "surface": "optimize-page",
        "selector": "current claim exact estate"
      },
      {
        "surface": "report",
        "selector": "modeled-findings claim-age evidence"
      }
    ],
    "relocation": null
  },
  "claim-age-co-optimization-estate-gain": {
    "title": "Claim-age co-optimization estate gain",
    "group": "social-security",
    "meaning": "After-tax estate gained by the winning joint claim-age combination over the best result at the current claim ages.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "optimize-page",
        "selector": "\"$X more projected after-tax estate than the best result at your current claim ages\""
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "claim-age-co-optimization-joint-exact-estate": {
    "title": "jointExactEstate",
    "group": "optimizer-and-comparisons",
    "meaning": "After-tax estate produced by exact validation of the jointly optimized claim ages.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/optimizePlan.ts",
      "symbol": "ClaimAgeCoOptimization.jointExactEstate"
    },
    "surfaces": [
      {
        "surface": "optimize-page",
        "selector": "co-optimized claim estate"
      },
      {
        "surface": "report",
        "selector": "modeled-findings claim-age evidence"
      }
    ],
    "relocation": null
  },
  "compare-plan-deltas": {
    "title": "Plan B minus Plan A: money lasts, ages and deterministic success",
    "group": "optimizer-and-comparisons",
    "meaning": "Differences between two plans in last funded year, depletion age and deterministic success (100 or 0 by depletion), with bounded labels when only one plan depletes.",
    "unit": "years",
    "basis": "n/a",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "compare-page",
        "selector": "Money lasts, Depletion age and Deterministic success rows (delta column)"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "compare-plan-money-deltas": {
    "title": "Plan B minus Plan A money deltas",
    "group": "optimizer-and-comparisons",
    "meaning": "Differences between two plans in ending net worth, ending investable, ending after-tax estate and lifetime tax plus penalties.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "compare-page",
        "selector": "Delta column of the four money rows"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "display-balance-by-category-annual": {
    "title": "Balances by account type",
    "group": "accounts-and-growth",
    "meaning": "Per year, the sum of per-account balances within each account category (cash, taxable, equityComp, traditional, roth, hsa).",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year",
      "category"
    ],
    "kind": "ui-transformation",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "chart",
        "selector": "Investable balances by account type stacked areas"
      },
      {
        "surface": "report",
        "selector": "chart-data block cash/taxable/equityComp/traditional/roth/hsa and chartDataCsv"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "display-dollar-basis-conversion": {
    "title": "Today's-dollar display conversion",
    "group": "cash-flow-and-summary",
    "meaning": "Conversion of a nominal year amount to today's dollars, or back to nominal dollars for a chart.",
    "unit": "usd",
    "basis": "either",
    "dimensions": [
      "year"
    ],
    "kind": "ui-transformation",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "results-table",
        "selector": "today dollars toggle"
      },
      {
        "surface": "results-headline",
        "selector": "KpiBar and ResultsPage \"in today's dollars\" ending net worth"
      },
      {
        "surface": "solver-page",
        "selector": "Evidence ending after-tax estate today's dollars (deflator) and SWR rows"
      },
      {
        "surface": "relocation-page",
        "selector": "deflateEnd on ending after-tax estate"
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "displayAmount applied to every line, node and reconciliation total"
      },
      {
        "surface": "insights",
        "selector": "DetectorProjection.deflate handed to detectors for today's-dollar figures"
      },
      {
        "surface": "chart",
        "selector": "Every Results chart series through the DollarAdjuster"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "display-fan-band-widths": {
    "title": "Fan chart band widths",
    "group": "monte-carlo",
    "meaning": "Heights of the stacked p10-p90 and p25-p75 bands drawn on the Range of outcomes chart.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "ui-transformation",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Range of outcomes stacked Area dataKeys d.p90 - d.p10 and d.p75 - d.p25"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "display-fi-target-annual": {
    "title": "Displayed FI target",
    "group": "cash-flow-and-summary",
    "meaning": "Financial-independence portfolio target plotted in the same year and dollar basis as account balances.",
    "unit": "usd",
    "basis": "display",
    "dimensions": [
      "year"
    ],
    "kind": "ui-transformation",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "chart",
        "selector": "fiTarget"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "display-guardrail-balance-thresholds": {
    "title": "Risk-based guardrail dollar thresholds",
    "group": "spending-and-withdrawals",
    "meaning": "The cut and raise balance thresholds of a risk-based guardrail policy in dollars.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "ui-transformation",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "results-table",
        "selector": "Risk-based guardrails callout \"cut below $X / raise above $Y\""
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "display-histogram-bin-label": {
    "title": "Histogram bin center label",
    "group": "monte-carlo",
    "meaning": "The dollar label printed under each ending-balance histogram bar.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "bin"
    ],
    "kind": "ui-transformation",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Ending balances histogram x-axis labels (histRows)"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "display-loss-carryforward-used-annual": {
    "title": "Loss carryforward used",
    "group": "taxes",
    "meaning": "Capital-loss carryforward applied this year against gains and against ordinary income, combined.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "ui-transformation",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "csv",
        "selector": "lossCarryforwardUsed"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "display-net-care-cost-annual": {
    "title": "Displayed net care cost",
    "group": "medicare-and-aca",
    "meaning": "Long-term-care cost remaining after the modeled insurance benefit, floored at zero.",
    "unit": "usd",
    "basis": "display",
    "dimensions": [
      "year"
    ],
    "kind": "ui-transformation",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "chart",
        "selector": "care"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "display-tax-free-gains-room-annual": {
    "title": "Tax-free gains room",
    "group": "taxes",
    "meaning": "Additional long-term gains realizable at $0 federal tax: remaining loss carryforward plus 0%-bracket headroom.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "ui-transformation",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "results-table",
        "selector": "Tax-free gains room column"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "display-tax-plus-penalties-annual": {
    "title": "Tax plus penalties",
    "group": "taxes",
    "meaning": "Settled tax plus early-withdrawal and RMD-shortfall penalties for the year, as the ledger surfaces print a single \"Tax\" figure.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "ui-transformation",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "results-table",
        "selector": "Tax column (y.tax + y.penalties)"
      },
      {
        "surface": "report",
        "selector": "year-ledger block taxAndPenalties and ReportPage year table"
      },
      {
        "surface": "chart",
        "selector": "Spending by category \"Tax + penalties\" series"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "display-total-spending-annual": {
    "title": "Displayed total spending",
    "group": "spending-and-withdrawals",
    "meaning": "Expenses, taxes, and penalties plotted together as total spending for a projection year.",
    "unit": "usd",
    "basis": "display",
    "dimensions": [
      "year"
    ],
    "kind": "ui-transformation",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "chart",
        "selector": "spending"
      },
      {
        "surface": "report",
        "selector": "chart-data block spendingPlusTax (expenses.total + tax + penalties)"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "display-upside-shortfall-annual": {
    "title": "Upside miss",
    "group": "spending-and-withdrawals",
    "meaning": "Ideal plus excess spending not funded.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "ui-transformation",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "results-table",
        "selector": "Layer miss \"Upside\""
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "display-upside-spending-annual": {
    "title": "Upside spending",
    "group": "spending-and-withdrawals",
    "meaning": "Ideal plus excess spending intended above the target layer.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "ui-transformation",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "results-table",
        "selector": "Upside column (layered spending)"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "display-years-before-plan-end": {
    "title": "Years depleted before plan end",
    "group": "longevity",
    "meaning": "How many years before the plan horizon the portfolio depletes.",
    "unit": "years",
    "basis": "n/a",
    "dimensions": [],
    "kind": "ui-transformation",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "results-headline",
        "selector": "Depletion narrative \"depletes N years before the plan ends\""
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "estate-heir-income-tax": {
    "title": "Heir income tax on the estate",
    "group": "taxes",
    "meaning": "Total income tax heirs are assumed to owe on inherited pre-tax balances: per non-spouse traditional account, the taxable pre-tax base (gross net of allocated nondeductible basis) times the class heir rate, plus non-spouse HSA gross times its rate, net of charity carve-outs.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/compare.ts",
      "symbol": "ProjectionSummary.endingEstateHeirTax"
    },
    "surfaces": [
      {
        "surface": "scenarios-page",
        "selector": "Estate table \"Estimated heir income tax\""
      },
      {
        "surface": "mcp",
        "selector": "run_projection.summary.endingEstateHeirTax"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.a.endingEstateHeirTax"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.b.endingEstateHeirTax"
      }
    ],
    "relocation": null
  },
  "estate-to-charity": {
    "title": "Estate passing to charity",
    "group": "accounts-and-growth",
    "meaning": "Sum over accounts with a charity destination of gross balance times the charity share.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/compare.ts",
      "symbol": "ProjectionSummary.endingEstateToCharity"
    },
    "surfaces": [
      {
        "surface": "scenarios-page",
        "selector": "Estate table \"Charitable destination\""
      },
      {
        "surface": "mcp",
        "selector": "run_projection.summary.endingEstateToCharity"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.a.endingEstateToCharity"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.b.endingEstateToCharity"
      }
    ],
    "relocation": null
  },
  "exact-ledger-tournament-margin-over-milp-dollars": {
    "title": "marginOverMilpDollars",
    "group": "optimizer-and-comparisons",
    "meaning": "After-tax-estate margin by which the exact-ledger winner beats the solver schedule.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/optimizePlan.ts",
      "symbol": "ExactLedgerTournament.marginOverMilpDollars"
    },
    "surfaces": [
      {
        "surface": "optimize-page",
        "selector": "winner margin over solver schedule"
      },
      {
        "surface": "monte-carlo-page",
        "selector": "WhySuccessPanel (explainPanels) \"beat the solver's own schedule by $X\""
      }
    ],
    "relocation": null
  },
  "exact-ledger-validation-ending-net-worth-delta": {
    "title": "endingNetWorthDelta",
    "group": "optimizer-and-comparisons",
    "meaning": "Change in ending net worth between the candidate recommendation and baseline plan.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/optimizePlan.ts",
      "symbol": "ExactLedgerValidation.endingNetWorthDelta"
    },
    "surfaces": [
      {
        "surface": "report",
        "selector": "validation ending net-worth delta"
      }
    ],
    "relocation": null
  },
  "exact-ledger-validation-executed-conversion-ratio": {
    "title": "executedConversionRatio",
    "group": "optimizer-and-comparisons",
    "meaning": "Share of requested Roth-conversion dollars actually executed by the projection ledger.",
    "unit": "percent",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/optimizePlan.ts",
      "symbol": "ExactLedgerValidation.executedConversionRatio"
    },
    "surfaces": [
      {
        "surface": "optimize-page",
        "selector": "executed conversion percentage"
      },
      {
        "surface": "report",
        "selector": "modeled-findings validation executed percent"
      }
    ],
    "relocation": null
  },
  "exact-ledger-validation-first-materially-unexecuted-year": {
    "title": "firstMateriallyUnexecutedYear",
    "group": "optimizer-and-comparisons",
    "meaning": "First year in which a requested Roth conversion is materially not executed.",
    "unit": "year",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/optimizePlan.ts",
      "symbol": "ExactLedgerValidation.firstMateriallyUnexecutedYear"
    },
    "surfaces": [
      {
        "surface": "optimize-page",
        "selector": "first materially unexecuted year"
      },
      {
        "surface": "report",
        "selector": "modeled-findings validation \"First material execution shortfall\""
      }
    ],
    "relocation": null
  },
  "exact-ledger-validation-requested-conversion-total": {
    "title": "requestedConversionTotal",
    "group": "optimizer-and-comparisons",
    "meaning": "Total Roth-conversion dollars requested by the candidate schedule.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/optimizePlan.ts",
      "symbol": "ExactLedgerValidation.requestedConversionTotal"
    },
    "surfaces": [
      {
        "surface": "report",
        "selector": "requested conversion total"
      },
      {
        "surface": "report",
        "selector": "modeled-findings validation \"Requested conversions\""
      }
    ],
    "relocation": null
  },
  "exact-ledger-validation-traditional-depletion-year": {
    "title": "traditionalDepletionYear",
    "group": "optimizer-and-comparisons",
    "meaning": "First year traditional-account assets are depleted under the validated schedule.",
    "unit": "year",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/optimizePlan.ts",
      "symbol": "ExactLedgerValidation.traditionalDepletionYear"
    },
    "surfaces": [
      {
        "surface": "report",
        "selector": "traditional depletion year"
      }
    ],
    "relocation": null
  },
  "flexible-goal-funded-amount-annual": {
    "title": "flexibleGoalFundedAmount",
    "group": "cash-flow-and-summary",
    "meaning": "Dollars delivered to flexible goals during the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.flexibleGoals.fundedAmount"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "flexibleGoalFundedAmount"
      }
    ],
    "relocation": null
  },
  "flexible-goal-unfunded-amount-annual": {
    "title": "flexibleGoalUnfundedAmount",
    "group": "cash-flow-and-summary",
    "meaning": "Dollars requested by flexible goals but not delivered during the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.flexibleGoals.unfundedAmount"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "flexibleGoalUnfundedAmount"
      }
    ],
    "relocation": null
  },
  "flexible-goals-deferred-count-annual": {
    "title": "flexibleGoalsDeferred",
    "group": "cash-flow-and-summary",
    "meaning": "Number of flexible goals postponed to a later year in this projection year.",
    "unit": "count",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.flexibleGoals.deferred"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "flexibleGoalsDeferred"
      },
      {
        "surface": "results-table",
        "selector": "Guardrails column goal-outcome aria-label"
      }
    ],
    "relocation": null
  },
  "flexible-goals-funded-count-annual": {
    "title": "flexibleGoalsFunded",
    "group": "cash-flow-and-summary",
    "meaning": "Number of flexible goals fully funded in this projection year.",
    "unit": "count",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.flexibleGoals.funded"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "flexibleGoalsFunded"
      },
      {
        "surface": "results-table",
        "selector": "Guardrails column goal-outcome aria-label"
      }
    ],
    "relocation": null
  },
  "flexible-goals-partially-funded-count-annual": {
    "title": "flexibleGoalsPartiallyFunded",
    "group": "cash-flow-and-summary",
    "meaning": "Number of flexible goals partly funded in this projection year.",
    "unit": "count",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.flexibleGoals.partiallyFunded"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "flexibleGoalsPartiallyFunded"
      },
      {
        "surface": "results-table",
        "selector": "Guardrails column goal-outcome aria-label"
      }
    ],
    "relocation": null
  },
  "flexible-goals-skipped-count-annual": {
    "title": "flexibleGoalsSkipped",
    "group": "cash-flow-and-summary",
    "meaning": "Number of flexible goals skipped in this projection year.",
    "unit": "count",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.flexibleGoals.skipped"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "flexibleGoalsSkipped"
      },
      {
        "surface": "results-table",
        "selector": "Guardrails column goal-outcome aria-label"
      }
    ],
    "relocation": null
  },
  "funded-ratio-result-essential-spending-pv": {
    "title": "essentialSpendingPv",
    "group": "ladders-and-valuation",
    "meaning": "Present value of essential retirement spending over the funded-ratio horizon.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/ladder/fundedRatio.ts",
      "symbol": "FundedRatioResult.essentialSpendingPv"
    },
    "surfaces": [
      {
        "surface": "income-floor",
        "selector": "essential spending valued today"
      },
      {
        "surface": "insights",
        "selector": "income-floor-funded card title and rationale (computeFundedRatio values)"
      }
    ],
    "relocation": null
  },
  "funded-ratio-result-funded-ratio-pct": {
    "title": "fundedRatioPct",
    "group": "ladders-and-valuation",
    "meaning": "Percentage of essential retirement spending present value covered by guaranteed income.",
    "unit": "percent",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/ladder/fundedRatio.ts",
      "symbol": "FundedRatioResult.fundedRatioPct"
    },
    "surfaces": [
      {
        "surface": "income-floor",
        "selector": "essential floor funded percentage"
      },
      {
        "surface": "insights",
        "selector": "income-floor-funded card title and rationale (computeFundedRatio values)"
      }
    ],
    "relocation": null
  },
  "funded-ratio-result-guaranteed-income-pv": {
    "title": "guaranteedIncomePv",
    "group": "ladders-and-valuation",
    "meaning": "Present value of guaranteed retirement income over the funded-ratio horizon.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/ladder/fundedRatio.ts",
      "symbol": "FundedRatioResult.guaranteedIncomePv"
    },
    "surfaces": [
      {
        "surface": "income-floor",
        "selector": "guaranteed income valued today"
      },
      {
        "surface": "insights",
        "selector": "income-floor-funded card title and rationale (computeFundedRatio values)"
      }
    ],
    "relocation": null
  },
  "funded-ratio-result-unfunded-pv": {
    "title": "unfundedPv",
    "group": "ladders-and-valuation",
    "meaning": "Essential-spending present value left for the portfolio after guaranteed income.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/ladder/fundedRatio.ts",
      "symbol": "FundedRatioResult.unfundedPv"
    },
    "surfaces": [
      {
        "surface": "income-floor",
        "selector": "gap riding on the portfolio"
      },
      {
        "surface": "insights",
        "selector": "income-floor-funded card title and rationale (computeFundedRatio values)"
      }
    ],
    "relocation": null
  },
  "hecm-draw-annual": {
    "title": "HECM draw",
    "group": "accounts-and-growth",
    "meaning": "Tax-free HECM line-of-credit proceeds drawn this year (coordinated draws after down years plus last-resort backstop draws).",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.hecmDraw"
    },
    "surfaces": [
      {
        "surface": "cash-flow-drilldown",
        "selector": "hecmCoordinatedDraw and hecmBackstopDraw source lines (YearCashFlow line identities)"
      }
    ],
    "relocation": null
  },
  "historical-stress-window-total-shortfall": {
    "title": "Historical window total shortfall",
    "group": "monte-carlo",
    "meaning": "Sum of unfunded spending over a deterministic replay of one rolling or reversed historical market window.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "window"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/historicalSuites.ts",
      "symbol": "HistoricalStressWindow.totalShortfall"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Historical stress windows table \"Shortfall\" column"
      }
    ],
    "relocation": null
  },
  "income-annuity-annual": {
    "title": "Annuity income",
    "group": "cash-flow-and-summary",
    "meaning": "Annuity payments received in a projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year",
      "account"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.incomes.annuity"
    },
    "surfaces": [
      {
        "surface": "chart",
        "selector": "annuity"
      },
      {
        "surface": "csv",
        "selector": "annuity"
      },
      {
        "surface": "scenarios-page",
        "selector": "Lifetime income \"Annuity\""
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "annuityPayment source line"
      }
    ],
    "relocation": null
  },
  "income-floor-ladder-yield-pct": {
    "title": "Income-floor ladder yield",
    "group": "ladders-and-valuation",
    "meaning": "Annual real income generated by the modeled ladder as a percentage of its total purchase cost.",
    "unit": "percent",
    "basis": "n/a",
    "dimensions": [],
    "kind": "ui-transformation",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "income-floor",
        "selector": "annual real income as percent of total cost"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "income-one-time-annual": {
    "title": "One-time income",
    "group": "cash-flow-and-summary",
    "meaning": "One-time income recognized in a projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.incomes.oneTime"
    },
    "surfaces": [
      {
        "surface": "chart",
        "selector": "oneTime"
      },
      {
        "surface": "csv",
        "selector": "oneTimeIncome"
      },
      {
        "surface": "scenarios-page",
        "selector": "Lifetime income \"One-time income\""
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "oneTimeIncome source line"
      }
    ],
    "relocation": null
  },
  "income-ordinary-dividends-annual": {
    "title": "ordinaryDividends",
    "group": "cash-flow-and-summary",
    "meaning": "Ordinary dividend income recognized during the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.incomes.ordinaryDividends"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "ordinaryDividends"
      }
    ],
    "relocation": null
  },
  "income-pension-annual": {
    "title": "Pension income",
    "group": "cash-flow-and-summary",
    "meaning": "Pension income paid in a projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year",
      "person"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.incomes.pension"
    },
    "surfaces": [
      {
        "surface": "chart",
        "selector": "pension"
      },
      {
        "surface": "csv",
        "selector": "pension"
      },
      {
        "surface": "scenarios-page",
        "selector": "Lifetime income \"Pension\""
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "pension source line"
      }
    ],
    "relocation": null
  },
  "income-qualified-dividends-annual": {
    "title": "qualifiedDividends",
    "group": "cash-flow-and-summary",
    "meaning": "Qualified dividend income recognized during the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.incomes.qualifiedDividends"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "qualifiedDividends"
      }
    ],
    "relocation": null
  },
  "income-recurring-annual": {
    "title": "Recurring income",
    "group": "cash-flow-and-summary",
    "meaning": "Recurring non-wage income in a projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.incomes.recurring"
    },
    "surfaces": [
      {
        "surface": "chart",
        "selector": "recurring"
      },
      {
        "surface": "csv",
        "selector": "recurring"
      },
      {
        "surface": "scenarios-page",
        "selector": "Lifetime income \"Recurring income\""
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "recurringIncome source line"
      }
    ],
    "relocation": null
  },
  "income-taxable-interest-annual": {
    "title": "taxableInterest",
    "group": "cash-flow-and-summary",
    "meaning": "Taxable interest credited to the household during the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.incomes.taxableInterest"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "taxableInterest"
      }
    ],
    "relocation": null
  },
  "income-taxable-yield-annual": {
    "title": "Taxable investment yield",
    "group": "accounts-and-growth",
    "meaning": "Taxable account income recognized in a projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year",
      "account"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.incomes.taxableYield"
    },
    "surfaces": [
      {
        "surface": "chart",
        "selector": "taxableYield"
      },
      {
        "surface": "csv",
        "selector": "taxableYield"
      },
      {
        "surface": "scenarios-page",
        "selector": "Lifetime income \"Taxable yield\""
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "taxableAccountYield source line"
      }
    ],
    "relocation": null
  },
  "income-tips-ladder-annual": {
    "title": "tipsLadder",
    "group": "ladders-and-valuation",
    "meaning": "Income paid by the modeled TIPS ladder during the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.incomes.tipsLadder"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "tipsLadder"
      },
      {
        "surface": "scenarios-page",
        "selector": "Lifetime income \"TIPS ladder\""
      },
      {
        "surface": "chart",
        "selector": "Income by source \"TIPS ladder\" series"
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "tipsLadderCash source line"
      }
    ],
    "relocation": null
  },
  "income-total-annual": {
    "title": "Total income",
    "group": "cash-flow-and-summary",
    "meaning": "All modeled income received in a projection year before expenses and taxes.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.incomes.total"
    },
    "surfaces": [
      {
        "surface": "chart",
        "selector": "income"
      },
      {
        "surface": "csv",
        "selector": "totalIncome"
      },
      {
        "surface": "report",
        "selector": "yearLedger"
      },
      {
        "surface": "results-table",
        "selector": "income total"
      },
      {
        "surface": "results-table",
        "selector": "Income column"
      },
      {
        "surface": "report",
        "selector": "year-ledger block income and ReportPage year table"
      },
      {
        "surface": "scenarios-page",
        "selector": "Annual \"Gross income\" and lifetime \"Total gross income\""
      },
      {
        "surface": "results-headline",
        "selector": "Depletion narrative \"Income doesn't stop: about $X\" (deflated)"
      }
    ],
    "relocation": null
  },
  "income-wages-annual": {
    "title": "Wages",
    "group": "cash-flow-and-summary",
    "meaning": "Employment wages modeled for a projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year",
      "person"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.incomes.wages"
    },
    "surfaces": [
      {
        "surface": "chart",
        "selector": "wages"
      },
      {
        "surface": "csv",
        "selector": "wages"
      },
      {
        "surface": "scenarios-page",
        "selector": "Lifetime income \"Wages\""
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "wages source line"
      }
    ],
    "relocation": null
  },
  "inherited-account-final-deadline-year": {
    "title": "finalDeadlineYear",
    "group": "cash-flow-and-summary",
    "meaning": "Final calendar year by which an inherited account must be emptied.",
    "unit": "year",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/accountActivity.ts",
      "symbol": "InheritedAccountYearEvidence.finalDeadlineYear"
    },
    "surfaces": [
      {
        "surface": "report",
        "selector": "inherited account final deadline"
      },
      {
        "surface": "results-table",
        "selector": "Inherited schedule deadline sentence"
      },
      {
        "surface": "report",
        "selector": "inherited-schedules block finalDeadlineYear"
      }
    ],
    "relocation": null
  },
  "inherited-distribution-forced-annual": {
    "title": "Forced inherited-account distribution",
    "group": "rmd",
    "meaning": "Sum of executed required amounts and final-sweep amounts across inherited accounts this year (traditional and Roth character); voluntary draws excluded.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.inheritedDistribution"
    },
    "surfaces": [
      {
        "surface": "cash-flow-drilldown",
        "selector": "inheritedAccountDistribution source line"
      }
    ],
    "relocation": null
  },
  "inherited-distribution-required-annual": {
    "title": "inheritedRequiredAmount",
    "group": "cash-flow-and-summary",
    "meaning": "Required inherited-account distribution dollars due for the account and year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.inheritedAccounts[].requiredAmount"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "inheritedRequiredAmount"
      },
      {
        "surface": "results-table",
        "selector": "Inherited schedules Required column"
      },
      {
        "surface": "report",
        "selector": "inherited-schedules block requiredAmount"
      }
    ],
    "relocation": null
  },
  "inherited-distribution-required-executed-annual": {
    "title": "inheritedExecutedRequiredAmount",
    "group": "cash-flow-and-summary",
    "meaning": "Required inherited-account distribution dollars actually executed for the account and year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.inheritedAccounts[].executedRequiredAmount"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "inheritedExecutedRequiredAmount"
      },
      {
        "surface": "report",
        "selector": "inherited required amount executed"
      },
      {
        "surface": "results-table",
        "selector": "Inherited schedules Executed column"
      },
      {
        "surface": "report",
        "selector": "inherited-schedules block executedRequiredAmount and ReportPage inherited table"
      }
    ],
    "relocation": null
  },
  "inherited-distribution-voluntary-annual": {
    "title": "inheritedVoluntaryAmount",
    "group": "cash-flow-and-summary",
    "meaning": "Inherited-account distribution dollars taken voluntarily beyond the required amount for the account and year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.inheritedAccounts[].voluntaryAmount"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "inheritedVoluntaryAmount"
      },
      {
        "surface": "report",
        "selector": "inherited voluntary distribution"
      },
      {
        "surface": "results-table",
        "selector": "Inherited schedules Voluntary column"
      }
    ],
    "relocation": null
  },
  "insight-annuitization-headroom-illustrative-spia": {
    "title": "Illustrative SPIA premium and income",
    "group": "insights",
    "meaning": "Illustrative single-premium annuity: premium = min(25% of the largest liquid account, $250,000); monthly income = premium × spiaPayoutRate(startAge) / 12.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "figure"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/insights/detectors/annuitizationHeadroom.ts",
      "symbol": "annuitizationHeadroom.screen (premium, monthly)"
    },
    "surfaces": [
      {
        "surface": "insights",
        "selector": "annuitization-headroom card rationale \"Trading $X ... (~$Y/mo)\""
      }
    ],
    "relocation": null
  },
  "insight-asset-location-swappable-exposure": {
    "title": "Swappable class exposure",
    "group": "insights",
    "meaning": "Dollars of bond or stock exposure the preferred asset-location swap would relocate between account wrappers while holding the household mix constant.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/insights/detectors/assetLocation.ts",
      "symbol": "assetLocation.screen (swapped from assetLocationGenerator metadata)"
    },
    "surfaces": [
      {
        "surface": "insights",
        "selector": "asset-location card impact \"Up to $X of class exposure could be relocated\""
      }
    ],
    "relocation": null
  },
  "insight-hecm-buffer-illustrative-credit-line": {
    "title": "Illustrative HECM credit line",
    "group": "insights",
    "meaning": "Initial HECM line of credit = principal limit factor (published table for the youngest borrower age) × home value; the card also sums cash, taxable, equity comp, traditional, Roth and HSA balances as the investable portfolio it compares against.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "figure"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/insights/detectors/hecmBufferCandidate.ts",
      "symbol": "hecmBufferCandidate.screen (lineSize, investable)"
    },
    "surfaces": [
      {
        "surface": "insights",
        "selector": "hecm-buffer-candidate card rationale \"would start near $X (P% of value)\" and the portfolio total"
      }
    ],
    "relocation": null
  },
  "insight-impact-ending-after-tax-estate-delta": {
    "title": "endingAfterTaxEstateDelta",
    "group": "insights",
    "meaning": "Estimated change in ending after-tax estate from an insight action.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/insights/types.ts",
      "symbol": "InsightImpact.endingAfterTaxEstateDelta"
    },
    "surfaces": [
      {
        "surface": "insights",
        "selector": "InsightCardView \"Ending estate delta\" after Preview impact; rough \"≈ ... estate delta\" when no qualitative text"
      }
    ],
    "relocation": null
  },
  "insight-impact-lifetime-tax-delta": {
    "title": "lifetimeTaxDelta",
    "group": "insights",
    "meaning": "Estimated change in lifetime taxes from an insight action.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/insights/types.ts",
      "symbol": "InsightImpact.lifetimeTaxDelta"
    },
    "surfaces": [
      {
        "surface": "insights",
        "selector": "InsightCardView \"Lifetime tax delta\" after Preview impact"
      }
    ],
    "relocation": null
  },
  "insight-irmaa-tier-edge-premium-cliff": {
    "title": "IRMAA tier-edge premium cliff",
    "group": "insights",
    "meaning": "Extra annual Medicare premiums (Part B plus Part D surcharge, all Medicare-age people) that a MAGI just over an IRMAA threshold triggers two years later, versus MAGI one dollar under the threshold.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/insights/detectors/irmaaTierEdge.ts",
      "symbol": "irmaaTierEdge.screen (annualPremiumCliff)"
    },
    "surfaces": [
      {
        "surface": "insights",
        "selector": "irmaa-tier-edge card impact text \"save roughly $X of Medicare premiums\" and the rough estate delta"
      }
    ],
    "relocation": null
  },
  "insight-monte-carlo-success-delta": {
    "title": "Insight Monte Carlo success delta",
    "group": "insights",
    "meaning": "Change in Monte Carlo success rate, in percentage points, between the patched plan and the base plan on 250 shared-seed paths.",
    "unit": "percent",
    "basis": "n/a",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "insights",
        "selector": "InsightCardView \"Monte Carlo success\" line after Preview"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "insight-spending-guardrails-illustrative-floor": {
    "title": "Illustrative guardrail spending floor",
    "group": "insights",
    "meaning": "Required spending floor the guardrail preview uses: the plan's requiredAnnual when set, otherwise 80% of base spending generated by probabilityBandSpendingGuardrailGenerator.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/insights/detectors/spendingGuardrails.ts",
      "symbol": "spendingGuardrails.screen (requiredAnnual from guardrailPatchFromGenerator)"
    },
    "surfaces": [
      {
        "surface": "insights",
        "selector": "spending-guardrails card rationale \"with a $X required floor\""
      }
    ],
    "relocation": null
  },
  "insight-spending-headroom-rough-annual": {
    "title": "Rough annual spending headroom",
    "group": "insights",
    "meaning": "Ending after-tax estate deflated to today, minus the bequest target, divided by the years remaining in the projection.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [
      "figure"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/insights/detectors/spendingHeadroom.ts",
      "symbol": "spendingHeadroom.screen (roughHeadroomPerYear, endingEstateToday)"
    },
    "surfaces": [
      {
        "surface": "insights",
        "selector": "spending-headroom card rationale \"end with roughly $X\" and impact \"≈ $Y/yr of rough headroom\""
      }
    ],
    "relocation": null
  },
  "insight-ss-bridge-gap-total": {
    "title": "Social Security bridge total cost and income",
    "group": "insights",
    "meaning": "Sum over delaying claimants of the bridge ladder cost and of the annual real bridge income sized by sizeBridge, for claimants whose gap years are not already covered by a plan ladder.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "figure"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/insights/detectors/ssBridgeGap.ts",
      "symbol": "ssBridgeGap.screen (totalCost, annualTotal)"
    },
    "surfaces": [
      {
        "surface": "insights",
        "selector": "ss-bridge-gap card rationale \"A TIPS bridge ladder (≈$X today) pays you ... (~$Y/yr)\""
      }
    ],
    "relocation": null
  },
  "insight-state-relocation-lifetime-state-tax-savings": {
    "title": "Lifetime state tax saved by relocating",
    "group": "insights",
    "meaning": "Sum over projection years of deflated (best zero-tax candidate state tax minus baseline state tax), floored at zero, for the best of FL, TX and WA.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/insights/detectors/stateRelocation.ts",
      "symbol": "stateRelocation.evaluate (savings)"
    },
    "surfaces": [
      {
        "surface": "insights",
        "selector": "state-relocation card impact after Preview \"staying in ST costs about $X of lifetime state+local income tax\""
      }
    ],
    "relocation": null
  },
  "insight-widows-penalty-bracket-jump": {
    "title": "Survivor bracket jump",
    "group": "insights",
    "meaning": "Federal tax on the first single-filed survivor year's MAGI computed as Single minus the same income computed as married filing jointly, deflated to today's dollars.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/insights/detectors/widowsPenalty.ts",
      "symbol": "widowsPenalty.screen (bracketJumpToday)"
    },
    "surfaces": [
      {
        "surface": "insights",
        "selector": "widows-penalty-roth card rationale \"cost about $X more (today's $)\""
      }
    ],
    "relocation": null
  },
  "insurance-cash-value-annual": {
    "title": "insuranceCashValue",
    "group": "cash-flow-and-summary",
    "meaning": "Cash surrender value of modeled insurance at the end of the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.insuranceCashValue"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "insuranceCashValue"
      }
    ],
    "relocation": null
  },
  "insurance-death-benefit-annual": {
    "title": "deathBenefit",
    "group": "cash-flow-and-summary",
    "meaning": "Insurance death benefit included in the projection year estate value.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.deathBenefit"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "deathBenefit"
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "lifeInsuranceDeathBenefit source line"
      }
    ],
    "relocation": null
  },
  "irmaa-surcharge-annual": {
    "title": "irmaaSurcharge",
    "group": "medicare-and-aca",
    "meaning": "Income-related Medicare premium surcharge charged during the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.irmaaSurcharge"
    },
    "surfaces": [
      {
        "surface": "scenarios-page",
        "selector": "IRMAA surcharge"
      },
      {
        "surface": "scenarios-page",
        "selector": "Annual ledger comparison \"IRMAA surcharge\" and lifetime \"IRMAA surcharge\" sum"
      }
    ],
    "relocation": null
  },
  "ladder-build-annual-real-income-by-offset": {
    "title": "annualRealIncomeByOffset",
    "group": "ladders-and-valuation",
    "meaning": "Real annual income delivered by the modeled ladder in each future year.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/ladder/ladderMath.ts",
      "symbol": "LadderBuild.annualRealIncomeByOffset"
    },
    "surfaces": [
      {
        "surface": "income-floor",
        "selector": "ladder income by year"
      }
    ],
    "relocation": null
  },
  "ladder-build-target-annual-real-income": {
    "title": "targetAnnualRealIncome",
    "group": "ladders-and-valuation",
    "meaning": "Real annual income the ladder is designed to deliver.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/ladder/ladderMath.ts",
      "symbol": "LadderBuild.targetAnnualRealIncome"
    },
    "surfaces": [
      {
        "surface": "income-floor",
        "selector": "target annual real income"
      }
    ],
    "relocation": null
  },
  "ladder-build-total-cost": {
    "title": "totalCost",
    "group": "ladders-and-valuation",
    "meaning": "Purchase cost of all rungs in the modeled income-floor ladder.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/ladder/ladderMath.ts",
      "symbol": "LadderBuild.totalCost"
    },
    "surfaces": [
      {
        "surface": "income-floor",
        "selector": "ladder total cost"
      }
    ],
    "relocation": null
  },
  "ladder-real-flows-coupons": {
    "title": "coupons",
    "group": "ladders-and-valuation",
    "meaning": "Inflation-adjusted coupon cash flow paid by ladder holdings in a year.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/ladder/ladderMath.ts",
      "symbol": "LadderRealFlows.coupons"
    },
    "surfaces": [
      {
        "surface": "income-floor",
        "selector": "coupon cash flow"
      }
    ],
    "relocation": null
  },
  "ladder-real-flows-maturing-principal": {
    "title": "maturingPrincipal",
    "group": "ladders-and-valuation",
    "meaning": "Inflation-adjusted principal returned by ladder holdings maturing in a year.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/ladder/ladderMath.ts",
      "symbol": "LadderRealFlows.maturingPrincipal"
    },
    "surfaces": [
      {
        "surface": "income-floor",
        "selector": "maturing principal cash flow"
      }
    ],
    "relocation": null
  },
  "ladder-rung-cost": {
    "title": "cost",
    "group": "ladders-and-valuation",
    "meaning": "Purchase cost of a single modeled ladder rung.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/ladder/ladderMath.ts",
      "symbol": "LadderRung.cost"
    },
    "surfaces": [
      {
        "surface": "income-floor",
        "selector": "rung cost"
      }
    ],
    "relocation": null
  },
  "ladder-rung-coupon-rate-pct": {
    "title": "couponRatePct",
    "group": "ladders-and-valuation",
    "meaning": "Annual real coupon rate of a modeled ladder rung.",
    "unit": "percent",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/ladder/ladderMath.ts",
      "symbol": "LadderRung.couponRatePct"
    },
    "surfaces": [
      {
        "surface": "income-floor",
        "selector": "coupon rate"
      }
    ],
    "relocation": null
  },
  "ladder-rung-face": {
    "title": "face",
    "group": "ladders-and-valuation",
    "meaning": "Face value purchased for a modeled ladder rung.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/ladder/ladderMath.ts",
      "symbol": "LadderRung.face"
    },
    "surfaces": [
      {
        "surface": "income-floor",
        "selector": "face value"
      }
    ],
    "relocation": null
  },
  "ladder-value-annual": {
    "title": "Ladder value",
    "group": "ladders-and-valuation",
    "meaning": "Value of the modeled bond/TIPS ladder in a projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year",
      "account"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.ladderValue"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "ladderValue"
      }
    ],
    "relocation": null
  },
  "long-term-care-benefit-annual": {
    "title": "ltcBenefit",
    "group": "cash-flow-and-summary",
    "meaning": "Long-term-care insurance benefit received during the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.expenses.ltcBenefit"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "ltcBenefit"
      }
    ],
    "relocation": null
  },
  "longevity-depletion-year": {
    "title": "Depletion year",
    "group": "longevity",
    "meaning": "First projection year with any spending shortfall; null when investable assets last through the horizon.",
    "unit": "year",
    "basis": "n/a",
    "dimensions": [
      "person"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "ProjectionResult.depletionYear"
    },
    "surfaces": [
      {
        "surface": "results-headline",
        "selector": "KpiBar \"Money lasts ... until YEAR\""
      },
      {
        "surface": "results-headline",
        "selector": "ResultsPage narrative \"This plan runs out of money in YEAR\""
      },
      {
        "surface": "results-table",
        "selector": "Balances chart \"depleted\" reference line and \"Portfolio depletes in YEAR\" callout"
      },
      {
        "surface": "report",
        "selector": "headline-results block depletionYear"
      },
      {
        "surface": "compare-page",
        "selector": "Money lasts row"
      },
      {
        "surface": "scenarios-page",
        "selector": "Headline \"Depletion year\""
      },
      {
        "surface": "ss-page",
        "selector": "Bridge comparison and claim-age tables \"until YEAR / never\""
      },
      {
        "surface": "survivor-page",
        "selector": "Degenerate-timings note \"runs out of money in YEAR\""
      },
      {
        "surface": "relocation-page",
        "selector": "RelocationCandidateRow.depletionYear (carried)"
      },
      {
        "surface": "monte-carlo-page",
        "selector": "Historical stress windows \"Depletes\" column"
      },
      {
        "surface": "insights",
        "selector": "InsightCardView flat-delta note \"The base plan runs out of money in YEAR\""
      }
    ],
    "relocation": null
  },
  "longevity-survival-percentile-age": {
    "title": "Survival-percentile planning age",
    "group": "longevity",
    "meaning": "The oldest integer age a person reaches with probability at least pct/100 on the SSA period life table, optionally with a health hazard multiplier and a joint (either-survives) curve for a couple.",
    "unit": "age",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/survival.ts",
      "symbol": "survivalPercentileAge"
    },
    "surfaces": [
      {
        "surface": "assumptions-card",
        "selector": "SurvivalPercentileModal planning-age preview (household section), clamped to 60..120 before it becomes the plan's planning age"
      }
    ],
    "relocation": null
  },
  "magi-annual": {
    "title": "Modified adjusted gross income",
    "group": "medicare-and-aca",
    "meaning": "MAGI realized in a projection year for tax, ACA, and later IRMAA decisions.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.magi"
    },
    "surfaces": [
      {
        "surface": "chart",
        "selector": "magi"
      },
      {
        "surface": "csv",
        "selector": "magi"
      },
      {
        "surface": "survivor-page",
        "selector": "Tax around the transition cell \"on MAGI a → b\" (death year and first survivor year)"
      },
      {
        "surface": "results-table",
        "selector": "MAGI column"
      },
      {
        "surface": "report",
        "selector": "year-ledger block magi"
      },
      {
        "surface": "scenarios-page",
        "selector": "Annual \"MAGI\""
      },
      {
        "surface": "mcp",
        "selector": "run_projection.years[].magi"
      }
    ],
    "relocation": null
  },
  "mcp-batch-cumulative-tax-objective": {
    "title": "Batch cumulative tax objective",
    "group": "taxes",
    "meaning": "Adapter sum of each evaluated projection year's tax plus penalties.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "adapter",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "mcp",
        "selector": "batch_evaluate.results[].objective"
      }
    ],
    "relocation": null
  },
  "mcp-batch-ending-traditional-objective": {
    "title": "Batch ending traditional balance objective",
    "group": "accounts-and-growth",
    "meaning": "Adapter sum of ending balances for traditional accounts in each evaluated candidate.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "adapter",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "mcp",
        "selector": "batch_evaluate.results[].objective"
      }
    ],
    "relocation": null
  },
  "mcp-compare-ending-after-tax-estate-delta": {
    "title": "MCP scenario ending-estate delta",
    "group": "optimizer-and-comparisons",
    "meaning": "Adapter-computed Plan B minus Plan A ending after-tax estate.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "adapter",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "mcp",
        "selector": "compare_scenarios.deltaEndingAfterTaxEstate"
      }
    ],
    "relocation": null
  },
  "medicare-premiums-annual": {
    "title": "medicarePremiums",
    "group": "medicare-and-aca",
    "meaning": "Total Medicare premiums charged to the household during the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.medicarePremiums"
    },
    "surfaces": [
      {
        "surface": "scenarios-page",
        "selector": "Total Medicare premiums"
      },
      {
        "surface": "scenarios-page",
        "selector": "Annual ledger comparison \"Medicare premiums\" and lifetime \"Total Medicare premiums\" sum"
      },
      {
        "surface": "survivor-page",
        "selector": "SSA-44 premium savings column (difference of two runs of this value)"
      },
      {
        "surface": "mcp",
        "selector": "run_projection.years[].medicarePremiums"
      }
    ],
    "relocation": null
  },
  "monte-carlo-average-longest-cut-spell-years": {
    "title": "Average longest cut spell",
    "group": "monte-carlo",
    "meaning": "Among paths that cut at least once, the average length in years of the longest consecutive run of cut years.",
    "unit": "count",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.adjustments.averageLongestCutSpellYears"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Adjustment tile \"Longest cut spell (average)\""
      }
    ],
    "relocation": null
  },
  "monte-carlo-average-total-shortfall": {
    "title": "Average total shortfall",
    "group": "monte-carlo",
    "meaning": "Mean across all paths of total unfunded spending.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.spendingShortfall.averageTotalShortfallDollars"
    },
    "surfaces": [
      {
        "surface": "scenarios-page",
        "selector": "Risk table \"Average total shortfall\""
      }
    ],
    "relocation": null
  },
  "monte-carlo-average-years-below-target": {
    "title": "Average years below target",
    "group": "monte-carlo",
    "meaning": "Mean across paths of the number of years with a target-lifestyle shortfall above SHORTFALL_EPSILON.",
    "unit": "count",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.averageYearsBelowTarget"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Layered success tile \"Years below target (average)\""
      }
    ],
    "relocation": null
  },
  "monte-carlo-cut-years": {
    "title": "Cut years, average and p90",
    "group": "monte-carlo",
    "meaning": "Among paths that cut at least once, the average and 90th-percentile number of cut years.",
    "unit": "count",
    "basis": "n/a",
    "dimensions": [
      "statistic"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.adjustments.averageCutYears / p90CutYears"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Adjustment tile \"Years cut, typical / worst-case\""
      }
    ],
    "relocation": null
  },
  "monte-carlo-depletion-probability-by-year": {
    "title": "Depletion probability by year",
    "group": "monte-carlo",
    "meaning": "Per depletion year, the share of all paths first depleting that year and the cumulative share depleted by that year.",
    "unit": "probability",
    "basis": "n/a",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.depletionProbabilityByYear[].probability / cumulativeProbability"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "\"Depletion probability by year\" chart: \"First depletion\" bars and cumulative line, aria-label cumulative percent"
      },
      {
        "surface": "scenarios-page",
        "selector": "Risk 'Cumulative depletion probability by year' table (ScenarioRiskComparison.depletionProbabilityByYear[].cumulativeProbability, read at each year from MonteCarloSummary.depletionProbabilityByYear)"
      }
    ],
    "relocation": null
  },
  "monte-carlo-depletion-year-histogram": {
    "title": "First-depletion year counts",
    "group": "monte-carlo",
    "meaning": "Number of paths whose investable assets first deplete in each calendar year (successes excluded).",
    "unit": "count",
    "basis": "n/a",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.depletionYearCounts[].count"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "\"When depleting plans run out\" bar chart and its aria-label total of depleting paths"
      },
      {
        "surface": "monte-carlo-page",
        "selector": "WhySuccessPanel depletion sentence"
      }
    ],
    "relocation": null
  },
  "monte-carlo-ending-after-tax-estate-percentiles": {
    "title": "Ending after-tax estate percentiles",
    "group": "monte-carlo",
    "meaning": "Percentiles (p10, p25, p50, p75, p90) of ending after-tax estate across paths.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "percentile"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.endingAfterTaxEstate.percentiles"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Verdict paragraph \"Median ending estate / worst 10% / best 10%\" (p50, p10, p90)"
      },
      {
        "surface": "monte-carlo-page",
        "selector": "\"Worst-case estate\" tile (p10)"
      },
      {
        "surface": "monte-carlo-page",
        "selector": "Ending-balance histogram aria-label median (p50)"
      },
      {
        "surface": "monte-carlo-page",
        "selector": "Annuitization table \"Median estate\" column and frontier point medians (AnnuitizationPointMetrics / StochasticFrontierPoint medianEndingAfterTaxEstate, p10EndingAfterTaxEstate)"
      },
      {
        "surface": "scenarios-page",
        "selector": "Risk table \"After-tax estate p10 / p50 / p90\""
      }
    ],
    "relocation": null
  },
  "monte-carlo-ending-investable-histogram": {
    "title": "Ending investable balance histogram",
    "group": "monte-carlo",
    "meaning": "Counts of paths per equal-width bin of ending investable balance (30 bins from min to max).",
    "unit": "count",
    "basis": "nominal",
    "dimensions": [
      "bin"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.endingInvestable.histogram (Histogram.min, binWidth, counts)"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "\"Ending balances\" bar chart (counts per bin; bin label from min and binWidth)"
      }
    ],
    "relocation": null
  },
  "monte-carlo-excess-funding-rate": {
    "title": "Excess-layer funding rate",
    "group": "monte-carlo",
    "meaning": "Across all path-years, excess spending funded divided by excess spending intended.",
    "unit": "probability",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.excessFundingRate"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Layered success tile \"Ideal / excess funded\" (second percent)"
      }
    ],
    "relocation": null
  },
  "monte-carlo-expected-shortfall-on-failing-paths": {
    "title": "Expected shortfall on failing paths",
    "group": "monte-carlo",
    "meaning": "Average total unfunded spending across only the paths that depleted.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.downsideRisk.expectedShortfallDollars"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Downside tile \"Typical shortfall when the plan falls short\""
      },
      {
        "surface": "scenarios-page",
        "selector": "Risk table \"Expected shortfall on failing paths\""
      },
      {
        "surface": "monte-carlo-page",
        "selector": "Frontier and annuitization point metrics (expectedShortfallDollars; carried but not charted)"
      }
    ],
    "relocation": null
  },
  "monte-carlo-failing-path-count": {
    "title": "Failing path count",
    "group": "monte-carlo",
    "meaning": "Number of paths that depleted.",
    "unit": "count",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.downsideRisk.failingPathCount"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "WhySuccessPanel \"lasted ... in N of M simulated markets\" (pathCount - failingPathCount)"
      }
    ],
    "relocation": null
  },
  "monte-carlo-failure-rate": {
    "title": "Failure probability",
    "group": "monte-carlo",
    "meaning": "Share of paths that deplete (1 - success rate, computed directly as failingPathCount / pathCount).",
    "unit": "probability",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.downsideRisk.failureRate"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Downside tile \"Chance of running short\" percent"
      }
    ],
    "relocation": null
  },
  "monte-carlo-flexible-goal-outcome-counts": {
    "title": "Flexible goal outcomes across paths",
    "group": "monte-carlo",
    "meaning": "Total counts of flexible one-time goals funded, partially funded, deferred and skipped, summed over all path-years.",
    "unit": "count",
    "basis": "n/a",
    "dimensions": [
      "outcome"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.flexibleGoals.funded / partiallyFunded / deferred / skipped"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Layered success tile \"Flexible goals\" counts"
      }
    ],
    "relocation": null
  },
  "monte-carlo-guardrail-action-counts": {
    "title": "Guardrail actions across path-years",
    "group": "monte-carlo",
    "meaning": "Total number of guardrail cut and raise actions summed over all path-years.",
    "unit": "count",
    "basis": "n/a",
    "dimensions": [
      "action"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.guardrailActionCounts.cut / raise"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Layered success tile \"{cut} cuts · {raise} raises\""
      }
    ],
    "relocation": null
  },
  "monte-carlo-ideal-funding-rate": {
    "title": "Ideal-layer funding rate",
    "group": "monte-carlo",
    "meaning": "Across all path-years, ideal spending funded divided by ideal spending intended.",
    "unit": "probability",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.idealFundingRate"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Layered success tile \"Ideal / excess funded\" (first percent)"
      }
    ],
    "relocation": null
  },
  "monte-carlo-investable-fan-percentiles": {
    "title": "Investable-balance fan percentiles",
    "group": "monte-carlo",
    "meaning": "Per projection year, the 10th, 25th, 50th, 75th and 90th percentiles of end-of-year investable balance across paths (linear-interpolated order statistics).",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year",
      "percentile"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.fan (YearPercentiles)"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "\"Range of outcomes\" fan chart: p10-p90 and p25-p75 bands, median line, and the aria-label figures for the last year"
      },
      {
        "surface": "monte-carlo-page",
        "selector": "WhySuccessPanel decade-out p10 versus p50 sentence"
      },
      {
        "surface": "mcp",
        "selector": "run_monte_carlo.percentiles.p10"
      },
      {
        "surface": "mcp",
        "selector": "run_monte_carlo.percentiles.p25"
      },
      {
        "surface": "mcp",
        "selector": "run_monte_carlo.percentiles.p50"
      },
      {
        "surface": "mcp",
        "selector": "run_monte_carlo.percentiles.p75"
      },
      {
        "surface": "mcp",
        "selector": "run_monte_carlo.percentiles.p90"
      }
    ],
    "relocation": null
  },
  "monte-carlo-max-cut-depth-percentiles": {
    "title": "Deepest cut, median and p90",
    "group": "monte-carlo",
    "meaning": "Among paths that cut at least once, the median and 90th-percentile deepest cut as a fraction of the discretionary layer.",
    "unit": "percent",
    "basis": "n/a",
    "dimensions": [
      "percentile"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.adjustments.medianMaxCutDepth / p90MaxCutDepth"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Adjustment tile \"Typical / worst-case cut depth\""
      }
    ],
    "relocation": null
  },
  "monte-carlo-p90-average-annual-target-shortfall": {
    "title": "p90 average annual target shortfall",
    "group": "monte-carlo",
    "meaning": "90th percentile across paths of the path-average annual target-lifestyle shortfall.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.p90AverageAnnualTargetShortfall"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Layered success tile \"Worst 10% average annual target miss\""
      }
    ],
    "relocation": null
  },
  "monte-carlo-p90-total-shortfall": {
    "title": "p90 cumulative shortfall",
    "group": "monte-carlo",
    "meaning": "90th percentile across all paths of the total unfunded spending over the whole retirement.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.spendingShortfall.p90TotalShortfallDollars (= downsideRisk.p90TotalShortfallDollars)"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Downside tile \"Worst 10% cumulative shortfall\""
      }
    ],
    "relocation": null
  },
  "monte-carlo-paths-with-cut-share": {
    "title": "Probability of a spending cut",
    "group": "monte-carlo",
    "meaning": "Share of paths with at least one guardrail cut year.",
    "unit": "probability",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.adjustments.pathsWithCut"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Adjustment tile \"Chance of a spending cut\""
      },
      {
        "surface": "scenarios-page",
        "selector": "Risk table \"Probability of a spending cut\""
      }
    ],
    "relocation": null
  },
  "monte-carlo-paths-with-raise-share": {
    "title": "Probability of a spending raise",
    "group": "monte-carlo",
    "meaning": "Share of paths with at least one guardrail raise action.",
    "unit": "probability",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.adjustments.pathsWithRaise"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Adjustment tile \"Chance of a raise\""
      }
    ],
    "relocation": null
  },
  "monte-carlo-prob-ending-above-bequest-target": {
    "title": "Probability of clearing the bequest target",
    "group": "monte-carlo",
    "meaning": "Share of paths whose ending after-tax estate is at least the bequest target inflated along that path's realized inflation series; null without a target.",
    "unit": "probability",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.adjustments.probEndingAboveBequestTarget"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Adjustment tile \"Chance of meeting the bequest target\""
      }
    ],
    "relocation": null
  },
  "monte-carlo-prob-ending-surplus": {
    "title": "Probability of ending with a surplus",
    "group": "monte-carlo",
    "meaning": "Share of paths whose ending after-tax estate is positive.",
    "unit": "probability",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.adjustments.probEndingSurplus"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Adjustment tile \"Chance of ending with money left\""
      }
    ],
    "relocation": null
  },
  "monte-carlo-required-floor-success-rate": {
    "title": "Required-floor success probability",
    "group": "monte-carlo",
    "meaning": "Share of paths that funded the required spending floor in every year (a shortfall below SHORTFALL_EPSILON is ignored).",
    "unit": "probability",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.requiredFloorSuccessRate"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Layered success tile \"Required floor met\""
      },
      {
        "surface": "scenarios-page",
        "selector": "Risk table \"Required-floor success rate\""
      },
      {
        "surface": "mcp",
        "selector": "run_monte_carlo.requiredFloorSuccessRate"
      }
    ],
    "relocation": null
  },
  "monte-carlo-success-rate": {
    "title": "Success probability",
    "group": "monte-carlo",
    "meaning": "Share of simulated market paths on which investable assets never deplete before the plan horizon.",
    "unit": "probability",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.successRate"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "SuccessGauge percent and verdict heading"
      },
      {
        "surface": "monte-carlo-page",
        "selector": "Layered success tile \"Any spending shortfall\" (successRate)"
      },
      {
        "surface": "monte-carlo-page",
        "selector": "WhySuccessPanel \"What it counts\" percent"
      },
      {
        "surface": "monte-carlo-page",
        "selector": "Spending vs. success and Retirement age vs. success frontier charts (StochasticFrontierPoint.successRate)"
      },
      {
        "surface": "monte-carlo-page",
        "selector": "Annuitization frontier chart success line and glidepath-only dashed line (AnnuitizationPointMetrics.successRate)"
      },
      {
        "surface": "results-headline",
        "selector": "KpiBar \"Market success\" percent (useMcSuccessRateState headline run)"
      },
      {
        "surface": "optimize-page",
        "selector": "\"Monte Carlo success rate with this claim change\" and the success stat"
      },
      {
        "surface": "scenarios-page",
        "selector": "Risk table \"Portfolio success rate\""
      },
      {
        "surface": "relocation-page",
        "selector": "Success column when Monte Carlo is enabled"
      },
      {
        "surface": "ss-page",
        "selector": "Bridge comparison and claim-age table success columns"
      },
      {
        "surface": "insights",
        "selector": "InsightCardView base and patched 250-path runs behind the Monte Carlo delta line"
      },
      {
        "surface": "mcp",
        "selector": "run_monte_carlo.successRate"
      }
    ],
    "relocation": null
  },
  "monte-carlo-target-attainment-median": {
    "title": "Median target attainment",
    "group": "monte-carlo",
    "meaning": "Median across paths of the share of target-lifestyle spending funded over the path (1 = every target dollar funded).",
    "unit": "probability",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.targetAttainmentPct.p50"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Layered success tile \"Median target attainment\""
      },
      {
        "surface": "scenarios-page",
        "selector": "Risk table \"Median target attainment\""
      }
    ],
    "relocation": null
  },
  "monte-carlo-target-lifestyle-success-rate": {
    "title": "Target-lifestyle success probability",
    "group": "monte-carlo",
    "meaning": "Share of paths that funded full target-lifestyle spending in every year.",
    "unit": "probability",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/run.ts",
      "symbol": "MonteCarloSummary.targetLifestyleSuccessRate"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Layered success tile \"Target lifestyle funded\""
      },
      {
        "surface": "scenarios-page",
        "selector": "Risk table \"Target-lifestyle success rate\""
      }
    ],
    "relocation": null
  },
  "optimization-baseline-after-tax-estate": {
    "title": "baselineAfterTaxEstate",
    "group": "optimizer-and-comparisons",
    "meaning": "Baseline plan after-tax estate used to validate an optimization recommendation.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/optimizePlan.ts",
      "symbol": "ExactLedgerValidation.baseline.endingAfterTaxEstate"
    },
    "surfaces": [
      {
        "surface": "report",
        "selector": "validation baseline after-tax estate"
      },
      {
        "surface": "report",
        "selector": "modeled-findings validation \"Baseline after-tax estate\""
      }
    ],
    "relocation": null
  },
  "optimization-candidate-after-tax-estate": {
    "title": "candidateAfterTaxEstate",
    "group": "optimizer-and-comparisons",
    "meaning": "Candidate plan after-tax estate shown in optimization validation evidence.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/optimizePlan.ts",
      "symbol": "ExactLedgerValidation.candidate.endingAfterTaxEstate"
    },
    "surfaces": [
      {
        "surface": "report",
        "selector": "validation candidate after-tax estate"
      },
      {
        "surface": "report",
        "selector": "modeled-findings validation \"Candidate after-tax estate\""
      }
    ],
    "relocation": null
  },
  "optimizer-recommended-conversion-annual": {
    "title": "Recommended Roth conversion schedule",
    "group": "roth",
    "meaning": "Per-year Roth conversion dollars the optimizer recommends: the solver schedule, the exact-ledger tournament winner's conversions, and the post-processed (cleaned) executable schedule.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year",
      "schedule"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/optimizePlan.ts",
      "symbol": "ExactLedgerTournament.winnerConversions[].amount / ExactLedgerScheduleAdjustment.requested, executed, cleaned"
    },
    "surfaces": [
      {
        "surface": "optimize-page",
        "selector": "Conversion schedule chart bars and \"N year(s)\" schedule summary; post-processing adjustment list"
      },
      {
        "surface": "report",
        "selector": "modeled-findings winner conversions are summed into requested/executed totals"
      },
      {
        "surface": "mcp",
        "selector": "run_optimizer.schedule[].amount"
      },
      {
        "surface": "mcp",
        "selector": "run_optimizer.tournament.winnerConversions[].amount"
      }
    ],
    "relocation": null
  },
  "optimizer-schedule-conversion-total": {
    "title": "Optimizer conversion schedule total",
    "group": "roth",
    "meaning": "Total dollars in a conversion schedule: the raw solver request, the cleaned executable schedule, or the tournament winner's conversions.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "ui-transformation",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "optimize-page",
        "selector": "\"$X of conversions across N years\", \"Raw optimizer request\", \"Cleaned executable schedule\""
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "pension-election-annuity-present-value": {
    "title": "Pension annuity present value",
    "group": "accounts-and-growth",
    "meaning": "Present value of the lifetime pension annuity to the planning age at the curve-anchored discount rate, compared with the lump-sum offer.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/decisions/pensionElection.ts",
      "symbol": "analyzePensionElections (presentValueAtCurveRate, curveRatePct)"
    },
    "surfaces": [
      {
        "surface": "insights",
        "selector": "pension-election-pending card rationale \"the annuity's discounted value (~$X)\" and the discount rate"
      }
    ],
    "relocation": null
  },
  "portfolio-need-annual": {
    "title": "Net portfolio need",
    "group": "spending-and-withdrawals",
    "meaning": "The nonnegative annual amount that must be supplied by the portfolio after income.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.netPortfolioNeed"
    },
    "surfaces": [
      {
        "surface": "results-table",
        "selector": "Bucket lens need per year (BucketYearRow.need) and bucket sums"
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "needBasedPortfolioWithdrawal sizing"
      }
    ],
    "relocation": null
  },
  "projection-result-ending-investable": {
    "title": "endingInvestable",
    "group": "cash-flow-and-summary",
    "meaning": "Investable assets remaining at the end of the projection.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "ProjectionResult.endingInvestable"
    },
    "surfaces": [
      {
        "surface": "compare-page",
        "selector": "ending investable assets"
      },
      {
        "surface": "report",
        "selector": "headline-results block endingInvestable"
      },
      {
        "surface": "scenarios-page",
        "selector": "Headline \"Ending investable assets\""
      }
    ],
    "relocation": null
  },
  "projection-result-ending-net-worth": {
    "title": "endingNetWorth",
    "group": "cash-flow-and-summary",
    "meaning": "Total net worth remaining at the end of the projection.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "ProjectionResult.endingNetWorth"
    },
    "surfaces": [
      {
        "surface": "compare-page",
        "selector": "ending net worth"
      },
      {
        "surface": "results-headline",
        "selector": "KpiBar \"Ending net worth\" and ResultsPage narrative"
      },
      {
        "surface": "report",
        "selector": "headline-results block endingNetWorth and ReportPage KPI"
      },
      {
        "surface": "scenarios-page",
        "selector": "Headline \"Ending net worth\" and estate \"Gross net worth\""
      }
    ],
    "relocation": null
  },
  "projection-summary-average-pre-retirement-savings-rate-pct": {
    "title": "averagePreRetirementSavingsRatePct",
    "group": "cash-flow-and-summary",
    "meaning": "Average share of pre-retirement earnings saved across working years.",
    "unit": "percent",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/compare.ts",
      "symbol": "ProjectionSummary.averagePreRetirementSavingsRatePct"
    },
    "surfaces": [
      {
        "surface": "results-headline",
        "selector": "pre-retirement savings rate"
      },
      {
        "surface": "report",
        "selector": "headline-results block average-pre-retirement-savings-rate-pct and ReportPage KPI"
      },
      {
        "surface": "mcp",
        "selector": "run_projection.summary.averagePreRetirementSavingsRatePct"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.a.averagePreRetirementSavingsRatePct"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.b.averagePreRetirementSavingsRatePct"
      }
    ],
    "relocation": null
  },
  "projection-summary-coast-fire-number": {
    "title": "coastFireNumber",
    "group": "cash-flow-and-summary",
    "meaning": "Current invested amount needed to reach the FI target without further contributions.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/compare.ts",
      "symbol": "ProjectionSummary.coastFireNumber"
    },
    "surfaces": [
      {
        "surface": "results-headline",
        "selector": "Coast FI number"
      },
      {
        "surface": "report",
        "selector": "headline-results block coast-fire-number and ReportPage KPI"
      },
      {
        "surface": "mcp",
        "selector": "run_projection.summary.coastFireNumber"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.a.coastFireNumber"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.b.coastFireNumber"
      }
    ],
    "relocation": null
  },
  "projection-summary-ending-after-tax-estate": {
    "title": "endingAfterTaxEstate",
    "group": "accounts-and-growth",
    "meaning": "Ending net worth after estimated income tax on inherited pre-tax accounts.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/compare.ts",
      "symbol": "ProjectionSummary.endingAfterTaxEstate"
    },
    "surfaces": [
      {
        "surface": "results-headline",
        "selector": "ResultsPage / ReportPage KPI \"After-tax estate\""
      },
      {
        "surface": "report",
        "selector": "headline-results block endingAfterTaxEstate"
      },
      {
        "surface": "scenarios-page",
        "selector": "Headline and estate table \"Ending after-tax estate\" / \"After-tax estate to heirs\""
      },
      {
        "surface": "compare-page",
        "selector": "After-tax estate row"
      },
      {
        "surface": "optimize-page",
        "selector": "Objective the tournament ranks on; claim-age exact estates"
      },
      {
        "surface": "solver-page",
        "selector": "Evidence \"Ending after-tax estate\" and SWR rule rows"
      },
      {
        "surface": "ss-page",
        "selector": "Claim-age sweep, refinement, bridge comparison and survivor tables"
      },
      {
        "surface": "relocation-page",
        "selector": "Ending after-tax estate column (deflated for display)"
      },
      {
        "surface": "monte-carlo-page",
        "selector": "Historical stress windows \"Estate\" column"
      },
      {
        "surface": "insights",
        "selector": "spending-headroom card ending estate (deflated)"
      },
      {
        "surface": "mcp",
        "selector": "run_projection.summary.endingAfterTaxEstate"
      },
      {
        "surface": "mcp",
        "selector": "batch_evaluate.results[].objective"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.a.endingAfterTaxEstate"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.b.endingAfterTaxEstate"
      }
    ],
    "relocation": null
  },
  "projection-summary-ending-investable": {
    "title": "endingInvestable",
    "group": "cash-flow-and-summary",
    "meaning": "Investable assets remaining at the end of the scenario projection.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/compare.ts",
      "symbol": "ProjectionSummary.endingInvestable"
    },
    "surfaces": [
      {
        "surface": "scenarios-page",
        "selector": "ending investable assets"
      },
      {
        "surface": "compare-page",
        "selector": "Ending investable row"
      },
      {
        "surface": "mcp",
        "selector": "run_projection.summary.endingInvestable"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.a.endingInvestable"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.b.endingInvestable"
      }
    ],
    "relocation": null
  },
  "projection-summary-ending-net-worth": {
    "title": "endingNetWorth",
    "group": "cash-flow-and-summary",
    "meaning": "Total net worth remaining at the end of the scenario projection.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/compare.ts",
      "symbol": "ProjectionSummary.endingNetWorth"
    },
    "surfaces": [
      {
        "surface": "results-headline",
        "selector": "ending net worth"
      },
      {
        "surface": "scenarios-page",
        "selector": "Headline \"Ending net worth\" (summary copy)"
      },
      {
        "surface": "mcp",
        "selector": "run_projection.summary.endingNetWorth"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.a.endingNetWorth"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.b.endingNetWorth"
      },
      {
        "surface": "scenarios-page",
        "selector": "Estate table 'Gross net worth' (ScenarioEstateComparison.grossNetWorth reads the summary copy)"
      }
    ],
    "relocation": null
  },
  "projection-summary-fi-age": {
    "title": "fiAge",
    "group": "cash-flow-and-summary",
    "meaning": "Age at which modeled investable assets first reach the financial-independence target.",
    "unit": "age",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/compare.ts",
      "symbol": "ProjectionSummary.fiAge"
    },
    "surfaces": [
      {
        "surface": "results-headline",
        "selector": "financial independence age"
      },
      {
        "surface": "results-headline",
        "selector": "FI section \"(Age N)\""
      },
      {
        "surface": "report",
        "selector": "headline-results block fiAge"
      },
      {
        "surface": "mcp",
        "selector": "run_projection.summary.fiAge"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.a.fiAge"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.b.fiAge"
      }
    ],
    "relocation": null
  },
  "projection-summary-fi-number": {
    "title": "fiNumber",
    "group": "cash-flow-and-summary",
    "meaning": "Today-dollar portfolio target used to identify financial independence.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/compare.ts",
      "symbol": "ProjectionSummary.fiNumber"
    },
    "surfaces": [
      {
        "surface": "results-headline",
        "selector": "financial independence number"
      },
      {
        "surface": "report",
        "selector": "headline-results block fi-number and ReportPage KPI"
      },
      {
        "surface": "chart",
        "selector": "Path to FI chart target line via display-fi-target-annual"
      },
      {
        "surface": "mcp",
        "selector": "run_projection.summary.fiNumber"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.a.fiNumber"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.b.fiNumber"
      }
    ],
    "relocation": null
  },
  "projection-summary-fi-year": {
    "title": "fiYear",
    "group": "cash-flow-and-summary",
    "meaning": "Calendar year in which modeled assets first reach the financial-independence target.",
    "unit": "year",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/compare.ts",
      "symbol": "ProjectionSummary.fiYear"
    },
    "surfaces": [
      {
        "surface": "report",
        "selector": "financial independence year"
      },
      {
        "surface": "results-headline",
        "selector": "FI section \"you reach FI in YEAR (age N)\""
      },
      {
        "surface": "report",
        "selector": "headline-results block fiYear"
      },
      {
        "surface": "mcp",
        "selector": "run_projection.summary.fiYear"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.a.fiYear"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.b.fiYear"
      }
    ],
    "relocation": null
  },
  "projection-summary-lifetime-roth-conversions": {
    "title": "lifetimeRothConversions",
    "group": "roth",
    "meaning": "Total traditional-account dollars converted to Roth across the projection.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/compare.ts",
      "symbol": "ProjectionSummary.lifetimeRothConversions"
    },
    "surfaces": [
      {
        "surface": "report",
        "selector": "Lifetime Roth conversions"
      },
      {
        "surface": "results-headline",
        "selector": "KpiBar \"Roth converted\""
      },
      {
        "surface": "report",
        "selector": "headline-results block lifetimeRothConversions"
      },
      {
        "surface": "mcp",
        "selector": "run_projection.summary.lifetimeRothConversions"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.a.lifetimeRothConversions"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.b.lifetimeRothConversions"
      }
    ],
    "relocation": null
  },
  "projection-summary-lifetime-taxes-and-penalties": {
    "title": "lifetimeTaxesAndPenalties",
    "group": "taxes",
    "meaning": "Total taxes and withdrawal penalties paid across all projection years.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/compare.ts",
      "symbol": "ProjectionSummary.lifetimeTaxesAndPenalties"
    },
    "surfaces": [
      {
        "surface": "results-headline",
        "selector": "Lifetime tax + penalties"
      },
      {
        "surface": "results-headline",
        "selector": "KpiBar \"Lifetime tax\""
      },
      {
        "surface": "report",
        "selector": "headline-results block lifetimeTaxesAndPenalties"
      },
      {
        "surface": "scenarios-page",
        "selector": "Headline \"Lifetime tax plus penalties\""
      },
      {
        "surface": "compare-page",
        "selector": "Lifetime tax row"
      },
      {
        "surface": "solver-page",
        "selector": "Evidence lifetime taxes and SWR rule rows"
      },
      {
        "surface": "ss-page",
        "selector": "Survivor and claim tables lifetime tax"
      },
      {
        "surface": "relocation-page",
        "selector": "Lifetime tax + penalties column"
      },
      {
        "surface": "mcp",
        "selector": "run_projection.summary.lifetimeTaxesAndPenalties"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.a.lifetimeTaxesAndPenalties"
      },
      {
        "surface": "mcp",
        "selector": "compare_scenarios.b.lifetimeTaxesAndPenalties"
      }
    ],
    "relocation": null
  },
  "qcd-annual": {
    "title": "Qualified charitable distribution",
    "group": "rmd",
    "meaning": "Gross qualified charitable distribution physically made in a projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year",
      "account",
      "person"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.qcd / qcdIncomeOffset"
    },
    "surfaces": [
      {
        "surface": "cash-flow-drilldown",
        "selector": "QCD lines"
      },
      {
        "surface": "csv",
        "selector": "qcd"
      },
      {
        "surface": "scenarios-page",
        "selector": "Annual \"QCD\" and lifetime \"QCDs\""
      }
    ],
    "relocation": null
  },
  "relocation-lifetime-state-local-tax": {
    "title": "Lifetime state and local income tax",
    "group": "taxes",
    "meaning": "Sum over projection years of state plus local income tax for a relocation candidate (or the baseline).",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "candidate"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/relocation.ts",
      "symbol": "RelocationCandidateRow.lifetimeStateLocalTax"
    },
    "surfaces": [
      {
        "surface": "relocation-page",
        "selector": "Candidate table \"State+local tax\" column and the drivers panel total"
      },
      {
        "surface": "insights",
        "selector": "state-relocation evaluate reads stateTaxByYear per candidate"
      }
    ],
    "relocation": null
  },
  "relocation-state-tax-driver-savings": {
    "title": "State tax driver savings",
    "group": "taxes",
    "meaning": "For a candidate state, tax with a feature neutralized minus tax as modeled: Social Security treatment, retirement-income exclusion, public-pension exclusion, capital-gains treatment.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "candidate",
      "driver"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/relocation.ts",
      "symbol": "RelocationDrivers.ssTreatmentSavings / retirementExclusionSavings / publicPensionExclusionSavings / capitalGainsTreatmentSavings"
    },
    "surfaces": [
      {
        "surface": "relocation-page",
        "selector": "Drivers panel rows"
      }
    ],
    "relocation": null
  },
  "relocation-tax-comparison": {
    "title": "Relocation candidate deltas and display basis",
    "group": "optimizer-and-comparisons",
    "meaning": "Lifetime tax-plus-penalties delta of each candidate versus the baseline, and the candidate ending estate deflated to the display basis.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "relocation-page",
        "selector": "Candidate table \"vs. baseline\" delta column and deflated ending after-tax estate"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "rmd-required-annual": {
    "title": "requiredAmount",
    "group": "rmd",
    "meaning": "Required minimum distribution dollars taken during the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.rmd"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "rmd"
      },
      {
        "surface": "report",
        "selector": "year ledger RMD"
      },
      {
        "surface": "results-table",
        "selector": "RMD column"
      },
      {
        "surface": "scenarios-page",
        "selector": "Annual \"RMD\" and lifetime \"RMDs\""
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "requiredMinimumDistribution source line"
      }
    ],
    "relocation": null
  },
  "roth-conversion-annual": {
    "title": "Roth conversion",
    "group": "roth",
    "meaning": "Traditional-to-Roth dollars actually converted in a projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year",
      "account",
      "person"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.rothConversion"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "rothConversion"
      },
      {
        "surface": "optimize-page",
        "selector": "conversion schedule"
      },
      {
        "surface": "report",
        "selector": "yearLedger"
      },
      {
        "surface": "results-table",
        "selector": "Conversion column"
      },
      {
        "surface": "scenarios-page",
        "selector": "Annual \"Roth conversion\" and lifetime \"Roth conversions\""
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "namedRothConversion and aggregateRothConversion transfer lines"
      },
      {
        "surface": "mcp",
        "selector": "run_projection.years[].rothConversion"
      }
    ],
    "relocation": null
  },
  "scenario-comparison-cell": {
    "title": "Scenario comparison cell (baseline, proposal, change)",
    "group": "optimizer-and-comparisons",
    "meaning": "For each compared scenario metric, the baseline plan's value, the proposal plan's value and the change (proposal minus baseline, null when either side has no comparable value); the metric's own family says what the value is.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "statistic"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/scenarios/comparison.ts",
      "symbol": "ScalarComparison / NullableScalarComparison (scalar, nullableScalar)"
    },
    "surfaces": [
      {
        "surface": "scenarios-page",
        "selector": "Baseline, Proposal and Change columns of every MetricTable (formatMetricValue, formatScenarioDelta) and of the annual ledger comparison"
      }
    ],
    "relocation": null
  },
  "scenario-irmaa-surcharge-tier-years": {
    "title": "Years in an IRMAA surcharge tier",
    "group": "medicare-and-aca",
    "meaning": "Count of projection years whose IRMAA tier is above 0.",
    "unit": "count",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/scenarios/comparison.ts",
      "symbol": "ScenarioIrmaaComparison.surchargeTierYears"
    },
    "surfaces": [
      {
        "surface": "scenarios-page",
        "selector": "Medicare table \"Years in a surcharge tier\""
      }
    ],
    "relocation": null
  },
  "scenario-lifetime-penalties": {
    "title": "Lifetime penalties",
    "group": "taxes",
    "meaning": "Sum of penalties over the projection.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/scenarios/comparison.ts",
      "symbol": "ScenarioHeadlineComparison.lifetimePenalties (sum of YearResult.penalties)"
    },
    "surfaces": [
      {
        "surface": "scenarios-page",
        "selector": "Headline \"Lifetime penalties\""
      }
    ],
    "relocation": null
  },
  "scenario-lifetime-tax": {
    "title": "Lifetime tax",
    "group": "taxes",
    "meaning": "Sum of settled tax over the projection (penalties excluded).",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/scenarios/comparison.ts",
      "symbol": "ScenarioHeadlineComparison.lifetimeTax (sum of YearResult.tax)"
    },
    "surfaces": [
      {
        "surface": "scenarios-page",
        "selector": "Headline \"Lifetime tax\""
      }
    ],
    "relocation": null
  },
  "sepp-distribution-annual": {
    "title": "SEPP distribution",
    "group": "spending-and-withdrawals",
    "meaning": "Penalty-free 72(t) substantially-equal periodic payment distributed this year (included in traditional withdrawals).",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.sepp"
    },
    "surfaces": [
      {
        "surface": "cash-flow-drilldown",
        "selector": "seppDistribution source line"
      }
    ],
    "relocation": null
  },
  "simple-candidate-evaluation-after-tax-estate-delta": {
    "title": "afterTaxEstateDelta",
    "group": "optimizer-and-comparisons",
    "meaning": "Candidate change in after-tax estate relative to the current plan.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/optimizePlan.ts",
      "symbol": "SimpleCandidateEvaluation.afterTaxEstateDelta"
    },
    "surfaces": [
      {
        "surface": "optimize-page",
        "selector": "after-tax estate improvement"
      },
      {
        "surface": "report",
        "selector": "modeled-findings validation \"After-tax estate delta\" and candidate rows"
      }
    ],
    "relocation": null
  },
  "simple-candidate-evaluation-executed-conversion-total": {
    "title": "executedConversionTotal",
    "group": "optimizer-and-comparisons",
    "meaning": "Roth-conversion dollars actually executed for the evaluated candidate.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/optimizePlan.ts",
      "symbol": "SimpleCandidateEvaluation.executedConversionTotal"
    },
    "surfaces": [
      {
        "surface": "optimize-page",
        "selector": "executed conversions"
      },
      {
        "surface": "report",
        "selector": "modeled-findings validation \"Executed conversions\""
      }
    ],
    "relocation": null
  },
  "simple-candidate-evaluation-incomplete-computation-years": {
    "title": "incompleteComputationYears",
    "group": "optimizer-and-comparisons",
    "meaning": "Projection years with incomplete calculations in the evaluated candidate.",
    "unit": "year",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/optimizePlan.ts",
      "symbol": "SimpleCandidateEvaluation.incompleteComputationYears"
    },
    "surfaces": [
      {
        "surface": "optimize-page",
        "selector": "incomplete computation years"
      }
    ],
    "relocation": null
  },
  "simple-candidate-evaluation-lifetime-tax-delta": {
    "title": "lifetimeTaxDelta",
    "group": "optimizer-and-comparisons",
    "meaning": "Candidate change in lifetime taxes and penalties relative to the current plan.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/optimizePlan.ts",
      "symbol": "SimpleCandidateEvaluation.lifetimeTaxDelta"
    },
    "surfaces": [
      {
        "surface": "optimize-page",
        "selector": "lifetime tax change"
      },
      {
        "surface": "report",
        "selector": "modeled-findings validation \"Lifetime tax delta\" and candidate rows"
      }
    ],
    "relocation": null
  },
  "simple-candidate-evaluation-money-lasts-years-delta": {
    "title": "moneyLastsYearsDelta",
    "group": "optimizer-and-comparisons",
    "meaning": "Change in the number of funded plan years for the candidate versus baseline.",
    "unit": "years",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/optimizePlan.ts",
      "symbol": "SimpleCandidateEvaluation.moneyLastsYearsDelta"
    },
    "surfaces": [
      {
        "surface": "report",
        "selector": "money-lasts years change"
      },
      {
        "surface": "report",
        "selector": "modeled-findings validation \"Money-lasts delta\" and candidate rows"
      }
    ],
    "relocation": null
  },
  "social-security-benefit-annual": {
    "title": "Social Security benefit",
    "group": "social-security",
    "meaning": "Social Security benefit income paid in a projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year",
      "person"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.incomes.socialSecurity / socialSecurityStreams"
    },
    "surfaces": [
      {
        "surface": "chart",
        "selector": "socialSecurity"
      },
      {
        "surface": "csv",
        "selector": "socialSecurity"
      },
      {
        "surface": "survivor-page",
        "selector": "Household Social Security column: incomes.socialSecurity selected from the death year and the first survivor year"
      },
      {
        "surface": "results-table",
        "selector": "Income by source chart (socialSecurity series)"
      },
      {
        "surface": "scenarios-page",
        "selector": "Lifetime income \"Social Security\""
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "socialSecurity source line"
      }
    ],
    "relocation": null
  },
  "social-security-break-even": {
    "title": "age",
    "group": "social-security",
    "meaning": "Age at which cumulative benefits from one claiming strategy overtake another.",
    "unit": "age",
    "basis": "n/a",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "ss-page",
        "selector": "claiming break-even age"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "social-security-bridge-sizing": {
    "title": "Social Security bridge sizing",
    "group": "social-security",
    "meaning": "For a delaying claimant: the forgone age-62 monthly benefit (PIA × claim factor at 62), the annualized bridge amount, the bridge years, and the quoted TIPS-ladder cost on the embedded real-yield curve.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [
      "claimant",
      "figure"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/ladder/bridge.ts",
      "symbol": "sizeBridge (monthlyAge62Benefit, annualRealAmount, ladderCost)"
    },
    "surfaces": [
      {
        "surface": "ss-page",
        "selector": "Bridge panel rows \"$X/yr ($Y/mo, real)\" and ladder cost, and the add-ladders total"
      },
      {
        "surface": "insights",
        "selector": "ss-bridge-gap card via insight-ss-bridge-gap-total"
      }
    ],
    "relocation": null
  },
  "social-security-claiming-sweep-objective": {
    "title": "Claim-age sweep advantage: best versus current, refined versus best",
    "group": "social-security",
    "meaning": "On the Social Security page's claim-age sweep, the best whole-year strategy's ending after-tax estate minus the estate at the plan's current claim ages (the '+$X' beside the verdict), and the month-refined strategy's ending after-tax estate minus the best whole-year strategy's (the '+$Y' under 'To the month').",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "ss-page",
        "selector": "Sweep verdict \"+$X vs current claim ages\" and refinement \"+$Y\" over the best whole-year strategy"
      },
      {
        "surface": "ss-page",
        "selector": "Claim-age heatmap and ranked table read engine candidateSummary.endingAfterTaxEstate directly"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "social-security-computation-summary-counts": {
    "title": "AIME computation year counts",
    "group": "social-security",
    "meaning": "How many years were averaged into AIME and how many of them are $0.",
    "unit": "count",
    "basis": "n/a",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "ss-page",
        "selector": "SocialSecuritySection \"Averages your top N earning years ... M of those years are $0\""
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "social-security-credit-estimate": {
    "title": "Covered-work credit estimate",
    "group": "social-security",
    "meaning": "Estimated Social Security credits (max 40) from the earnings history when the user has not entered a count.",
    "unit": "count",
    "basis": "n/a",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "ss-page",
        "selector": "SocialSecuritySection credits hint \"Estimated N of 40\""
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "social-security-expected-present-value": {
    "title": "expectedPv",
    "group": "social-security",
    "meaning": "Present value of expected Social Security benefits after discounting and weighting payments by survival.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "ss-page",
        "selector": "expected present value of benefits"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "social-security-fica-return-ratio": {
    "title": "Benefits-to-contributions ratio",
    "group": "social-security",
    "meaning": "Expected present value of lifetime benefits divided by employee OASDI tax paid in.",
    "unit": "factor",
    "basis": "n/a",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "ss-page",
        "selector": "Paid-in table \"Ratio (get back ÷ paid in)\""
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "social-security-oasdi-paid-in": {
    "title": "OASDI paid in",
    "group": "social-security",
    "meaning": "Employee OASDI payroll tax paid over the earnings history used by the Social Security analysis.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "ss-page",
        "selector": "Paid-in table \"Paid in (OASDI)\" and \"Employer paid (context)\""
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "social-security-pia-annualized": {
    "title": "PIA annualized",
    "group": "social-security",
    "meaning": "A claimant's monthly primary insurance amount times twelve, as the survivor-switching explainer prints it.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "ui-transformation",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "ss-page",
        "selector": "Survivor switching paragraph \"about $X/yr\""
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "social-security-survivor-switch-pv": {
    "title": "survivorClaimAge",
    "group": "social-security",
    "meaning": "Expected present value of a survivor strategy that switches between own and survivor benefits.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "ss-page",
        "selector": "survivor switching expected PV"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "social-security-zero-year-replacement-gain": {
    "title": "Zero-year replacement PIA gain",
    "group": "social-security",
    "meaning": "Rough monthly PIA gain from replacing one $0 computation year with a year of indexed earnings.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "ss-page",
        "selector": "SocialSecuritySection PIA explainer \"would add roughly $X/mo\""
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "solved-initial-withdrawal-rate-pct": {
    "title": "Solved initial withdrawal rate",
    "group": "spending-and-withdrawals",
    "meaning": "The solved (rounded) baseline spending as a percent of starting investable assets, shown beside the SWR rule rows.",
    "unit": "percent",
    "basis": "n/a",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "solver-page",
        "selector": "SWR comparison \"Your solved plan\" row rate"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "solved-spending-rounded-to-hundred": {
    "title": "Solved spending rounded down",
    "group": "spending-and-withdrawals",
    "meaning": "Maximum sustainable baseline spending rounded down to the nearest $100, as applied to the plan and shown in the shape table.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [],
    "kind": "ui-transformation",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "solver-page",
        "selector": "\"sustain about $X of baseline spending\", Apply-to-Spending amount, per-shape \"$X/yr\""
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "spending-base-annual": {
    "title": "Base spending",
    "group": "spending-and-withdrawals",
    "meaning": "Base living spending modeled for a projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.expenses.baseSpending"
    },
    "surfaces": [
      {
        "surface": "chart",
        "selector": "base"
      },
      {
        "surface": "csv",
        "selector": "baseSpending"
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "requiredLifestyle / targetLifestyle use lines (layered)"
      }
    ],
    "relocation": null
  },
  "spending-care-cost-gross-annual": {
    "title": "careCost",
    "group": "cash-flow-and-summary",
    "meaning": "Gross long-term-care cost incurred during the projection year before insurance benefits.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.expenses.careCost"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "careCost"
      }
    ],
    "relocation": null
  },
  "spending-debt-service-annual": {
    "title": "debtService",
    "group": "cash-flow-and-summary",
    "meaning": "Principal and interest paid on modeled debts during the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.expenses.debtService"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "debtService"
      },
      {
        "surface": "chart",
        "selector": "Spending by category \"Debt payments\""
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "debtService use line"
      }
    ],
    "relocation": null
  },
  "spending-excess-requested-annual": {
    "title": "excessSpending",
    "group": "cash-flow-and-summary",
    "meaning": "Optional spending above the ideal lifestyle amount attempted during the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.expenses.excessSpending"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "excessSpending"
      }
    ],
    "relocation": null
  },
  "spending-excess-shortfall-annual": {
    "title": "excessShortfall",
    "group": "cash-flow-and-summary",
    "meaning": "Unfunded optional spending above the ideal lifestyle amount in the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.excessShortfall"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "excessShortfall"
      }
    ],
    "relocation": null
  },
  "spending-guardrail-factor-annual": {
    "title": "guardrailFactor",
    "group": "cash-flow-and-summary",
    "meaning": "Multiplier applied to flexible spending after the projection year guardrail decision.",
    "unit": "factor",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.expenses.guardrailFactor"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "guardrailFactor"
      }
    ],
    "relocation": null
  },
  "spending-healthcare-annual": {
    "title": "Healthcare expense",
    "group": "medicare-and-aca",
    "meaning": "Healthcare expense charged in a projection year, excluding the separately shown insurance premium channel.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year",
      "person"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.expenses.healthcare"
    },
    "surfaces": [
      {
        "surface": "chart",
        "selector": "healthcare"
      },
      {
        "surface": "csv",
        "selector": "healthcare"
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "healthcare use line"
      }
    ],
    "relocation": null
  },
  "spending-ideal-requested-annual": {
    "title": "idealSpending",
    "group": "cash-flow-and-summary",
    "meaning": "Ideal lifestyle spending requested for the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.expenses.idealSpending"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "idealSpending"
      }
    ],
    "relocation": null
  },
  "spending-ideal-shortfall-annual": {
    "title": "idealShortfall",
    "group": "cash-flow-and-summary",
    "meaning": "Unfunded ideal lifestyle spending in the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.idealShortfall"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "idealShortfall"
      }
    ],
    "relocation": null
  },
  "spending-insurance-premiums-annual": {
    "title": "insurancePremiums",
    "group": "cash-flow-and-summary",
    "meaning": "Insurance premiums charged as expenses during the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.expenses.insurancePremiums"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "insurancePremiums"
      },
      {
        "surface": "chart",
        "selector": "Spending by category \"Insurance premiums\""
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "insurancePremium use line"
      }
    ],
    "relocation": null
  },
  "spending-intended-annual": {
    "title": "intendedSpending",
    "group": "cash-flow-and-summary",
    "meaning": "Total spending the plan intended to fund before available cash constrained it.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.expenses.intendedSpending"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "intendedSpending"
      },
      {
        "surface": "scenarios-page",
        "selector": "Annual \"Intended spending\" and lifetime \"Intended spending\""
      }
    ],
    "relocation": null
  },
  "spending-one-time-goals-annual": {
    "title": "goals",
    "group": "cash-flow-and-summary",
    "meaning": "One-time goal spending paid during the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.expenses.oneTimeGoals"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "goals"
      },
      {
        "surface": "chart",
        "selector": "Spending by category \"One-time goals\""
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "oneTimeGoal use line"
      }
    ],
    "relocation": null
  },
  "spending-property-costs-annual": {
    "title": "propertyCosts",
    "group": "cash-flow-and-summary",
    "meaning": "Property taxes, maintenance, and other modeled property costs paid during the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.expenses.propertyCosts"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "propertyCosts"
      },
      {
        "surface": "chart",
        "selector": "Spending by category \"Property tax + insurance\""
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "propertyCosts use line"
      }
    ],
    "relocation": null
  },
  "spending-required-requested-annual": {
    "title": "requiredSpending",
    "group": "cash-flow-and-summary",
    "meaning": "Essential spending floor requested for the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.expenses.requiredSpending"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "requiredSpending"
      },
      {
        "surface": "results-table",
        "selector": "Required column (layered spending)"
      }
    ],
    "relocation": null
  },
  "spending-required-shortfall-annual": {
    "title": "requiredShortfall",
    "group": "cash-flow-and-summary",
    "meaning": "Unfunded essential spending in the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.requiredShortfall"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "requiredShortfall"
      },
      {
        "surface": "results-table",
        "selector": "Layer miss \"Req\""
      },
      {
        "surface": "scenarios-page",
        "selector": "Annual \"Required shortfall\" and lifetime \"Required-floor shortfall\""
      }
    ],
    "relocation": null
  },
  "spending-shape-delta-vs-flat": {
    "title": "Spending-shape solved delta versus flat",
    "group": "spending-and-withdrawals",
    "meaning": "How much more or less baseline spending each spending shape sustains than the flat shape.",
    "unit": "usd",
    "basis": "real",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "solver-page",
        "selector": "Per-shape table \"vs. flat\" column"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "spending-shortfall-annual": {
    "title": "Spending shortfall",
    "group": "spending-and-withdrawals",
    "meaning": "Unfunded total spending in a projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.shortfall"
    },
    "surfaces": [
      {
        "surface": "chart",
        "selector": "shortfall"
      },
      {
        "surface": "csv",
        "selector": "shortfall"
      },
      {
        "surface": "results-table",
        "selector": "Shortfall column"
      },
      {
        "surface": "scenarios-page",
        "selector": "Annual \"Total shortfall\" and lifetime \"Total spending shortfall\""
      },
      {
        "surface": "mcp",
        "selector": "run_projection.years[].shortfall"
      }
    ],
    "relocation": null
  },
  "spending-target-requested-annual": {
    "title": "targetSpending",
    "group": "cash-flow-and-summary",
    "meaning": "Target lifestyle spending requested for the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.expenses.targetSpending"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "targetSpending"
      },
      {
        "surface": "results-table",
        "selector": "Target column (layered spending)"
      }
    ],
    "relocation": null
  },
  "spending-target-shortfall-annual": {
    "title": "targetShortfall",
    "group": "cash-flow-and-summary",
    "meaning": "Unfunded target lifestyle spending in the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.targetShortfall"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "targetShortfall"
      },
      {
        "surface": "results-table",
        "selector": "Layer miss \"Target\""
      },
      {
        "surface": "scenarios-page",
        "selector": "Annual \"Target shortfall\" and lifetime \"Target-lifestyle shortfall\""
      }
    ],
    "relocation": null
  },
  "spending-total-annual": {
    "title": "Total expenses",
    "group": "spending-and-withdrawals",
    "meaning": "All modeled expenses for a projection year before tax and penalties.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.expenses.total"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "totalExpenses"
      },
      {
        "surface": "report",
        "selector": "yearLedger"
      },
      {
        "surface": "results-table",
        "selector": "expenses"
      },
      {
        "surface": "results-table",
        "selector": "Expenses column"
      },
      {
        "surface": "scenarios-page",
        "selector": "Annual \"Funded spending\" and lifetime \"Funded spending\""
      }
    ],
    "relocation": null
  },
  "stochastic-frontier-variant-axis": {
    "title": "Frontier variant value",
    "group": "monte-carlo",
    "meaning": "The spending level or retirement age each frontier variant was built with (grid multipliers 0.85..1.15 of spending; -2..+2 years of retirement age).",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "variant"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/montecarlo/frontiers.ts",
      "symbol": "StochasticFrontierPoint.x"
    },
    "surfaces": [
      {
        "surface": "monte-carlo-page",
        "selector": "Frontier charts x-axis (spending dollars; retirement age)"
      }
    ],
    "relocation": null
  },
  "surplus-invested-annual": {
    "title": "Surplus invested",
    "group": "cash-flow-and-summary",
    "meaning": "Surplus cash flow invested this year into cash, else taxable, else unassigned.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.surplusInvested"
    },
    "surfaces": [
      {
        "surface": "cash-flow-drilldown",
        "selector": "Summary \"Surplus\" figure and surplusInvestment use/transfer lines"
      }
    ],
    "relocation": null
  },
  "survivor-scenario-row-estate-delta": {
    "title": "estateDelta",
    "group": "social-security",
    "meaning": "Change in after-tax estate from the convert-early survivor lever versus the same death-timing baseline.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "survivor-page",
        "selector": "convert-early after-tax estate delta"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "survivor-scenario-row-lifetime-tax-delta": {
    "title": "Convert-early lifetime tax delta",
    "group": "social-security",
    "meaning": "Lifetime taxes and penalties under the pre-death conversion lever minus the base run, for one death timing.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "survivor-page",
        "selector": "Convert-early lever cell \"(+$X lifetime tax)\""
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "survivor-scenario-row-ssa44premium-savings": {
    "title": "ssa44PremiumSavings",
    "group": "social-security",
    "meaning": "Medicare premium savings produced by applying SSA-44 relief after the modeled life-changing event.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "survivor-page",
        "selector": "IRMAA relief SSA-44"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "survivor-scenario-row-survivor-shortfall-years": {
    "title": "survivorShortfallYears",
    "group": "social-security",
    "meaning": "Number of survivor years in which planned spending is not fully funded.",
    "unit": "count",
    "basis": "n/a",
    "dimensions": [],
    "kind": "ui-native",
    "engineSource": null,
    "surfaces": [
      {
        "surface": "survivor-page",
        "selector": "survivor shortfall years"
      }
    ],
    "relocation": {
      "status": "pending",
      "target": null
    }
  },
  "sustainable-spending-result-max-base-annual": {
    "title": "maxBaseAnnual",
    "group": "cash-flow-and-summary",
    "meaning": "Highest annual base spending that satisfies the solver constraints.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/decisions/spendingSolver.ts",
      "symbol": "SustainableSpendingResult.maxBaseAnnual"
    },
    "surfaces": [
      {
        "surface": "solver-page",
        "selector": "maximum base annual spending"
      },
      {
        "surface": "insights",
        "selector": "spending-headroom card after Preview \"sustains about $X/yr\""
      },
      {
        "surface": "scenarios-page",
        "selector": "Spending capacity \"Solved annual base spending\""
      },
      {
        "surface": "mcp",
        "selector": "solve_max_spending.maxBaseAnnual"
      }
    ],
    "relocation": null
  },
  "sustainable-spending-result-simulation-count": {
    "title": "simulationCount",
    "group": "cash-flow-and-summary",
    "meaning": "Number of deterministic projections evaluated by the spending solver.",
    "unit": "count",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/decisions/spendingSolver.ts",
      "symbol": "SustainableSpendingResult.simulationCount"
    },
    "surfaces": [
      {
        "surface": "solver-page",
        "selector": "simulations run"
      },
      {
        "surface": "scenarios-page",
        "selector": "Spending capacity simulation count column"
      },
      {
        "surface": "mcp",
        "selector": "solve_max_spending.simulationCount"
      }
    ],
    "relocation": null
  },
  "sustainable-spending-result-spending-slack-dollars": {
    "title": "spendingSlackDollars",
    "group": "cash-flow-and-summary",
    "meaning": "Remaining dollar margin between solved spending and the feasibility boundary.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/decisions/spendingSolver.ts",
      "symbol": "SustainableSpendingResult.spendingSlackDollars"
    },
    "surfaces": [
      {
        "surface": "solver-page",
        "selector": "spending feasibility slack"
      },
      {
        "surface": "insights",
        "selector": "spending-headroom card after Preview \"$Y/yr above your current level\""
      },
      {
        "surface": "scenarios-page",
        "selector": "Spending capacity \"Slack vs. current base spending\""
      },
      {
        "surface": "mcp",
        "selector": "solve_max_spending.spendingSlackDollars"
      }
    ],
    "relocation": null
  },
  "swr-rule-result-depletion-year": {
    "title": "depletionYear",
    "group": "optimizer-and-comparisons",
    "meaning": "First year a displayed safe-withdrawal rule runs out of investable assets.",
    "unit": "year",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/decisions/swrComparator.ts",
      "symbol": "SwrRuleResult.depletionYear"
    },
    "surfaces": [
      {
        "surface": "solver-page",
        "selector": "withdrawal rule depletion year"
      }
    ],
    "relocation": null
  },
  "swr-rule-result-end-year": {
    "title": "endYear",
    "group": "optimizer-and-comparisons",
    "meaning": "Final planning year used to evaluate a displayed safe-withdrawal rule.",
    "unit": "year",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/decisions/swrComparator.ts",
      "symbol": "SwrRuleResult.endYear"
    },
    "surfaces": [
      {
        "surface": "solver-page",
        "selector": "withdrawal rule plan end year"
      }
    ],
    "relocation": null
  },
  "swr-rule-result-ending-after-tax-estate": {
    "title": "endingAfterTaxEstate",
    "group": "optimizer-and-comparisons",
    "meaning": "After-tax estate left by a displayed safe-withdrawal rule at the end of the plan.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/decisions/swrComparator.ts",
      "symbol": "SwrRuleResult.endingAfterTaxEstate"
    },
    "surfaces": [
      {
        "surface": "solver-page",
        "selector": "withdrawal rule ending after-tax estate"
      },
      {
        "surface": "solver-page",
        "selector": "SWR rule rows ending after-tax estate (deflated for display)"
      }
    ],
    "relocation": null
  },
  "swr-rule-result-initial-annual-spend": {
    "title": "initialAnnualSpend",
    "group": "optimizer-and-comparisons",
    "meaning": "First-year spending supported by a displayed safe-withdrawal rule.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/decisions/swrComparator.ts",
      "symbol": "SwrRuleResult.initialAnnualSpend"
    },
    "surfaces": [
      {
        "surface": "solver-page",
        "selector": "withdrawal rule initial annual spend"
      }
    ],
    "relocation": null
  },
  "swr-rule-result-initial-rate-pct": {
    "title": "initialRatePct",
    "group": "optimizer-and-comparisons",
    "meaning": "Initial portfolio withdrawal rate used by a displayed safe-withdrawal rule.",
    "unit": "percent",
    "basis": "n/a",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/decisions/swrComparator.ts",
      "symbol": "SwrRuleResult.initialRatePct"
    },
    "surfaces": [
      {
        "surface": "solver-page",
        "selector": "withdrawal rule initial rate"
      }
    ],
    "relocation": null
  },
  "swr-rule-result-lifetime-taxes-and-penalties": {
    "title": "lifetimeTaxesAndPenalties",
    "group": "optimizer-and-comparisons",
    "meaning": "Total taxes and penalties paid under a displayed safe-withdrawal rule.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/decisions/swrComparator.ts",
      "symbol": "SwrRuleResult.lifetimeTaxesAndPenalties"
    },
    "surfaces": [
      {
        "surface": "solver-page",
        "selector": "withdrawal rule lifetime tax and penalties"
      }
    ],
    "relocation": null
  },
  "tax-amt-annual": {
    "title": "Alternative minimum tax",
    "group": "taxes",
    "meaning": "Alternative minimum tax calculated for a projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.amt"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "amt"
      },
      {
        "surface": "results-table",
        "selector": "AMT column when any year has AMT"
      }
    ],
    "relocation": null
  },
  "tax-loss-carryforward-remaining-annual": {
    "title": "capitalLossCarryforwardRemaining",
    "group": "taxes",
    "meaning": "Capital-loss carryforward still available after the projection year tax calculation.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.capitalLossCarryforwardRemaining"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "lossCarryforwardRemaining"
      },
      {
        "surface": "results-table",
        "selector": "Loss carryf'd column and carryforward callout"
      },
      {
        "surface": "report",
        "selector": "ReportPage year table carryforward column"
      }
    ],
    "relocation": null
  },
  "tax-loss-carryforward-used-against-gains-annual": {
    "title": "capitalLossUsedAgainstGains",
    "group": "taxes",
    "meaning": "Capital-loss carryforward applied against gains and ordinary income in the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.capitalLossUsedAgainstGains"
    },
    "surfaces": [
      {
        "surface": "results-table",
        "selector": "Capital-loss carryforward callout \"offset $X of realized gains\""
      }
    ],
    "relocation": null
  },
  "tax-loss-carryforward-used-against-ordinary-annual": {
    "title": "Loss carryforward used against ordinary income",
    "group": "taxes",
    "meaning": "Capital-loss carryforward applied against ordinary income this year, up to the annual limit.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.capitalLossUsedAgainstOrdinary"
    },
    "surfaces": [
      {
        "surface": "results-table",
        "selector": "Capital-loss carryforward callout \"and $Y of ordinary income\""
      }
    ],
    "relocation": null
  },
  "tax-penalties-annual": {
    "title": "Penalties and excise tax",
    "group": "taxes",
    "meaning": "Early-withdrawal penalties plus the IRC §4974 RMD-shortfall excise for the year; never part of tax, AGI or MAGI.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.penalties"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "penalties"
      },
      {
        "surface": "scenarios-page",
        "selector": "Annual \"Penalties\" and lifetime \"Lifetime penalties\""
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "earlyWithdrawalPenalty use line"
      },
      {
        "surface": "mcp",
        "selector": "run_projection.years[].penalties"
      }
    ],
    "relocation": null
  },
  "tax-realized-gains-annual": {
    "title": "realizedGains",
    "group": "taxes",
    "meaning": "Taxable-account capital gains realized during the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.realizedGains"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "realizedGains"
      }
    ],
    "relocation": null
  },
  "tax-total-annual": {
    "title": "Total tax",
    "group": "taxes",
    "meaning": "All tax charged for a projection year, excluding penalties.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.tax"
    },
    "surfaces": [
      {
        "surface": "chart",
        "selector": "tax"
      },
      {
        "surface": "csv",
        "selector": "tax"
      },
      {
        "surface": "report",
        "selector": "yearLedger"
      },
      {
        "surface": "results-table",
        "selector": "tax"
      },
      {
        "surface": "survivor-page",
        "selector": "Tax around the transition cell \"a → b\" (death year and first survivor year)"
      },
      {
        "surface": "scenarios-page",
        "selector": "Annual \"Tax\" and lifetime \"Lifetime tax\""
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "settledTax use line"
      },
      {
        "surface": "mcp",
        "selector": "run_projection.years[].tax"
      }
    ],
    "relocation": null
  },
  "withdrawals-by-category-annual": {
    "title": "Withdrawals by account category",
    "group": "spending-and-withdrawals",
    "meaning": "Dollars withdrawn this year from cash, taxable, traditional, Roth and HSA accounts.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year",
      "category"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/yearLedger.ts",
      "symbol": "YearWithdrawals.cash / taxable / traditional / roth / hsa"
    },
    "surfaces": [
      {
        "surface": "scenarios-page",
        "selector": "Annual \"Traditional withdrawals\" / \"Roth withdrawals\" and lifetime withdrawals by category"
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "needBasedPortfolioWithdrawal and retirementActionWithdrawal source lines"
      }
    ],
    "relocation": null
  },
  "withdrawals-total-annual": {
    "title": "Total withdrawals",
    "group": "spending-and-withdrawals",
    "meaning": "Total account withdrawals used in a projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [
      "year",
      "account"
    ],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.withdrawals.total"
    },
    "surfaces": [
      {
        "surface": "cash-flow-drilldown",
        "selector": "uses/withdrawals"
      },
      {
        "surface": "csv",
        "selector": "withdrawals"
      },
      {
        "surface": "results-table",
        "selector": "Withdrawals column"
      },
      {
        "surface": "report",
        "selector": "year-ledger block withdrawals"
      },
      {
        "surface": "scenarios-page",
        "selector": "Annual \"Total withdrawals\""
      },
      {
        "surface": "mcp",
        "selector": "run_projection.years[].withdrawals"
      }
    ],
    "relocation": null
  },
  "year-result-contributions": {
    "title": "contributions",
    "group": "cash-flow-and-summary",
    "meaning": "Employee and household dollars contributed to investment accounts during the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.contributions"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "contributions"
      },
      {
        "surface": "results-table",
        "selector": "Contrib. column"
      },
      {
        "surface": "report",
        "selector": "year-ledger block contributions and ReportPage year table"
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "contribution use and employeeContribution transfer lines"
      }
    ],
    "relocation": null
  },
  "year-result-employer-match": {
    "title": "employerMatch",
    "group": "cash-flow-and-summary",
    "meaning": "Employer matching contributions credited during the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.employerMatch"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "employerMatch"
      },
      {
        "surface": "results-table",
        "selector": "Match column"
      },
      {
        "surface": "report",
        "selector": "ReportPage year table Match column"
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "employerMatch transfer line"
      }
    ],
    "relocation": null
  },
  "year-result-ltcg-zero-headroom": {
    "title": "ltcgZeroHeadroom",
    "group": "cash-flow-and-summary",
    "meaning": "Additional long-term capital gains available before leaving the zero-percent bracket.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.ltcgZeroHeadroom"
    },
    "surfaces": [
      {
        "surface": "results-table",
        "selector": "0% capital-gains headroom"
      }
    ],
    "relocation": null
  },
  "year-result-tax-exempt-interest": {
    "title": "taxExemptInterest",
    "group": "cash-flow-and-summary",
    "meaning": "Tax-exempt interest income received during the projection year.",
    "unit": "usd",
    "basis": "nominal",
    "dimensions": [],
    "kind": "engine",
    "engineSource": {
      "path": "engine/src/projection/internal/types/result.ts",
      "symbol": "YearResult.taxExemptInterest"
    },
    "surfaces": [
      {
        "surface": "csv",
        "selector": "taxExemptInterest"
      },
      {
        "surface": "chart",
        "selector": "Income by source \"Tax-exempt interest\" series"
      },
      {
        "surface": "scenarios-page",
        "selector": "Annual \"Tax-exempt interest\" and lifetime \"Tax-exempt interest\""
      },
      {
        "surface": "cash-flow-drilldown",
        "selector": "taxExemptInterest source line"
      }
    ],
    "relocation": null
  }
} satisfies Record<string, OutputFamily>

export const OUTPUT_FAMILIES = Object.freeze(families)

export type OutputFamilyId = keyof typeof OUTPUT_FAMILIES

export const outputFamilyIds = Object.freeze(
  Object.keys(OUTPUT_FAMILIES).sort() as readonly OutputFamilyId[],
)
