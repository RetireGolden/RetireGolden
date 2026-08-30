## 13. Default assumptions (user-overridable)

These are the **forward-looking** defaults a planner can override on the Assumptions screen (and the
longevity module), as distinct from the dated **rule packs** in §1–§12. Defaults live in
`createEmptyPlan` (`engine/model/plan.ts`) and the UI; the values below are what the code ships today, each
with the reputable source behind it. The deep dive into these — one Learning Center article per assumption —
is planned in
the `assumptions-deep-dive-and-learning-center` plan (private planning docs),
which is also where the full per-source notes and any recommended default changes are tracked. Verified June
2026; re-validate on the cadence in [maintenance-schedule.md](../../maintenance-schedule.md).

| Assumption | Default (shipped) | Sourced basis |
|------------|-------------------|---------------|
| General inflation | 2.5% | SSA 2025 Trustees ultimate **CPI-W 2.4%**; Fed long-run goal **2.0%** (PCE); CBO long-run **~2.2% CPI**; Philly Fed SPF 10-yr **~2.4%**. 2.5% is mildly conservative. |
| Healthcare extra inflation | +3% over CPI | Sourced to HealthView 2026 long-term retiree healthcare inflation **5.8% ≈ 2× CPI**, Medicare Part B **~7%/yr**. +3% is a defensible, slightly-conservative default. |
| Default return (blended, plan-wide) | 5.5% nominal | Between forward-looking CMAs (Vanguard 2026 US equity **4–5%**, bonds ~4%; J.P. Morgan 2026 60/40 **6.4%**, US large cap 6.7%) and long-run historical (~8–9% balanced). |
| US stocks nominal return | 7–8% (μ), σ ≈ 16% | Long-run historical ~10% nominal/~7% real; forward CMAs lower (4–7%). UI estimator uses **7%** (`ASSET_RETURN`, illustrative, pre-fee). |
| Bonds nominal | 4–4.5%, σ ≈ 6% | Vanguard/JPM 2026 forward ~4.0–4.6%; UI estimator **4%**. |
| Cash | 2.5–3% | UI estimator **2.5%**. |
| SS COLA | = inflation | Statutorily **CPI-W**-linked (SSA); 2026 COLA 2.8%, ultimate 2.4%. |
| SS trust-fund haircut | off; 2034 / −17% when on | **2026 Trustees:** combined OASDI depletes **2034** (Q3), **83% payable** (−17%); OASI alone **2032** (Q4), 78% (−22%). |
| Plan end age | longevity module planning age, floor 95 | per person; aligns with Academy/SOA **Actuaries Longevity Illustrator** guidance to plan to the 75th–90th survival percentile (joint for couples). |
| State effective tax override | 0 (use modeled per-state brackets) | Override mechanism; per-state research in [state-tax-research/](../state-tax-research/). |
| Local income tax | 0% | Optional flat user-entered local layer on state taxable income; default off because local taxes vary by county/city/municipality. |
| Recent annual MAGI | 0 | Input seed for IRMAA's 2-year lookback in early projection years (not a forecast). |
| Heir tax rate (after-tax estate) | 25% | SECURE Act 10-year rule typically drains inherited pre-tax IRAs in heirs' peak-earning years ⇒ mid-bracket (22–24%) + possible state. |
| Survivor spending percentage | 100% (no change) | Optional; scales base + phase spending in years when one member of a couple survives. Studies of retired couples typically land at **60–80%** of couple spending (housing/utilities barely drop; food, travel, and one person's healthcare do). |
| Bequest target | 0 / off | `expenses.bequestTargetDollars` (today's dollars); an after-tax-estate floor consumed by the "How much can I spend?" solver and the estate-floor / max-sustainable-spending objective policies (`objectivePolicyForPlan`). Absent = no floor. See [features/optimizer.md](../../features/optimizer.md). |
| Safe withdrawal rate (FI number) | 4% | `assumptions.safeWithdrawalRatePct`; the Bengen/Trinity 4% rule as the lens for the derived FI number and Coast-FIRE metrics (accumulation planning), not a spending rule the ledger enforces. |
| Retirement smile profile | −10% at 75, −20% at 85 (preset writes ordinary phases) | Blanchett, ["Exploring the Retirement Consumption Puzzle"](https://www.financialplanningassociation.org/article/journal/MAY14-exploring-retirement-consumption-puzzle) (JFP 2014): real retiree spending declines ~1%/yr through the mid-80s — the "retirement spending smile." |

Sources: [SSA 2025 Long-Range Economic Assumptions](https://www.ssa.gov/oact/TR/2025/2025_Long-Range_Economic_Assumptions.pdf),
[CBO 2026–2036 Outlook](https://www.cbo.gov/publication/62105),
[HealthView 2026 Retirement Healthcare Costs Data Report](https://hvsfinancial.com/wp-content/uploads/2026/02/2026-Data-Report.pdf),
[Vanguard 2026 Economic & Market Outlook](https://corporate.vanguard.com/content/corporatesite/us/en/corp/vemo/2026-outlook-economic-upside-stock-market-downside.html),
[J.P. Morgan 2026 Long-Term Capital Market Assumptions](https://am.jpmorgan.com/us/en/asset-management/adv/insights/portfolio-insights/ltcma/),
[SSA 2025 Trustees Report summary](https://www.ssa.gov/oact/TRSUM/tr25summary.pdf),
[Actuaries Longevity Illustrator (Academy of Actuaries / SOA)](https://www.longevityillustrator.org/).
