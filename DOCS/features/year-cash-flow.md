# Annual cash-flow reporting contract

The deterministic projection may publish an optional `cashFlow` detail on each
[`YearResult`](../../packages/engine/src/projection/types.ts). It is an identity-bearing reporting model
for the annual ledger in
[`simulate.ts`](../../packages/engine/src/projection/simulate.ts), not a chart model. It describes nominal
Plan-dollar amounts before any display rounding. It contains stable semantic kinds and Plan identities,
but no display labels, colors, coordinates, layout hints, or chart-library types.

`simulatePlan` publishes the detail only when `SimulateOptions.captureAnnualCashFlow` is `true`. The
option defaults off and is intended only for the live deterministic Results projection. Monte Carlo,
optimizer, historical, relocation, and other repeated sweeps leave it off. Capturing reporting detail
must not change balances, tax, withdrawals, shortfalls, warnings, or any other economic output.

## Views and one-role rule

The default view answers “what cash was available to the household, and where did it go?” It is not a
taxable-income view. A second view reports direct transfers that bypass household cash. Post-solve
deposits are retained as a third stage because they change assets after the year's funding decision but
did not fund that decision. Tax character with no physical line to attach to is retained in the separate
`taxCharacterMetadata` array and excluded from all money totals.

| Role | Contract meaning |
|------|------------------|
| `spendableSource` | External or off-ledger cash available to the household during the funding solve. |
| `portfolioFunding` | Cash delivered from a portfolio account to the household by a forced, committed, or need-based distribution. |
| `loanProceeds` | HECM cash, paired economically with an increase in HECM debt and never treated as income. |
| `fundedUse` | The funded part of a requested household use. Only this amount routes through the cash hub. |
| `unfundedUse` | The part of a requested use that did not happen. It is never drawn as cash. |
| `transfer` | A paired debit and credit that bypasses, or follows, the household-cash stage. |
| `nonCashTaxCharacter` | Tax-only metadata on a source or transfer; never another money line. |
| `postSolveDeposit` | A property or insurance receipt deposited after the funding solve and excluded from that year's cash identity. |

Each physical dollar has exactly one role within a view. A dollar may occur once in the household-cash
view and once in the transfer view only when the two lines describe different stages and the transfer
has explicit lineage to the cash line. Employee contributions and surplus investment are the ordinary
examples: cash is used first and the same dollars are then credited to a destination account. RMD-to-QCD
routing is the inverse seam: the transfer records a diversion before that part of the gross RMD becomes
household-available cash. Consumers must never sum linked stages.

Derived aggregates such as `incomes.total`, `baseCashInflows`, `expenses.total`, and
`withdrawals.total` are reconciliation inputs or existing reports, not additional lines. Publishing both
an aggregate and its members as cash roles would double count the same dollars.

## Complete role inventory

The following tables are the publication inventory for the current ledger. “Omitted as an aggregate”
means the named term is accounted for by its decomposed lines but receives no independent line ID.
Zero-amount lines are omitted, and their deterministic ID remains reserved for a future nonzero year, with one exception: an owner's net owned-IRA RMD line is published even at zero whenever that owner's `qcdFromRmd` diversion is positive, so the diversion's lineage target always exists.

### Household-available and portfolio sources

| `simulate.ts` term(s) | Role and stage | Identity carried | Anti-double-counting and decided treatment |
|------------------------|----------------|------------------|--------------------------------------------|
| `incomes.total` | `spendableSource` subtotal; omitted as an aggregate | None beyond the member lines | It is exactly wages + Social Security + pension + annuity + TIPS cash + recurring + one-time + taxable yield + tax-exempt interest. Never publish it beside those members as another source. |
| `incomes.wages`, `wagesByPerson` | `spendableSource` / `wages` | `incomeStreamId`, `personId` | Gross wages are cash. `wagesByPerson` is supporting SS-test evidence, not another source. |
| `incomes.socialSecurity`, `socialSecurityStreams`, `ssEarningsTestWithheld`, SSDI | `spendableSource` / `socialSecurity` | `incomeStreamId`, `personId` | Publish the amount actually paid after earnings-test/SGA withholding. Withheld benefits are diagnostic only and never cash. |
| `incomes.pension` and its public/private/ordinary subsets | `spendableSource` / `pension` | Pension `accountId`, `personId` when present | The paid amount is one source. Public/private and ordinary subsets are `nonCashTaxCharacter`, not more cash. |
| `incomes.annuity`, `qualifiedAnnuityPayments`, qualified/nonqualified basis splits | `spendableSource` / `annuityPayment` | Annuity contract/account, funding owner where present, and the actual payment recipient's `personId` - in a joint-and-survivor or guaranteed-period year after the annuitant's death, the surviving recipient, not the deceased owner | Gross payment is cash. Qualified and nonqualified basis return is `nonCashTaxCharacter`; it does not reduce the physical payment. |
| `incomes.tipsLadder`, coupon, maturing principal, outstanding-face inflation accretion, `ladderValue` | `spendableSource` / `tipsLadderCash`; accretion is `nonCashTaxCharacter` | `ladderId` | Coupons and maturing principal are one cash line per ladder. Principal return is basis metadata. Phantom OID/accretion is explicitly `tipsPhantomOidIncome`; `ladderValue` is an asset balance, not cash. |
| `incomes.recurring`, its `ordinaryIncome` subset | `spendableSource` / `recurringIncome` | `incomeStreamId`; no person is inferred | Full stream amount is cash. Ordinary treatment is metadata only. |
| `incomes.oneTime`, `ordinaryIncome`, `oneTimeGains` | `spendableSource` / `oneTimeIncome` | `incomeStreamId`; no person is inferred | Full configured amount is one cash source. Ordinary and gain portions are `nonCashTaxCharacter`. |
| `taxableInterest`, ordinary dividends, `qualifiedDividends`, `taxableYield`, `distributedYieldByAccountId` | `spendableSource` / `taxableAccountYield` when distributed | Taxable `accountId` | Publish one physical distributed-yield amount per account. Interest, ordinary-dividend, and qualified-dividend figures characterize that amount and are not additional sources. Reinvested accounts are handled only in the transfer table. |
| Generated `taxExemptInterest`, `yearTaxExemptInterest`, ACA tax-exempt-interest attestation | `spendableSource` / `taxExemptInterest` when distributed; attested excess is `nonCashTaxCharacter` only | Taxable `accountId` for generated cash; household aggregate for an attestation | Generated distributed interest is cash. An attestation may alter MAGI but cannot create cash. Do not add `YearResult.taxExemptInterest` on top of the per-account lines. |
| `ltcBenefit` | Offset inside the net `longTermCare` use; no independent line | Policy and care-event person where present | The reimbursement reduces the requested care use to `netCare`. It is income-tax-free, never ordinary income, and never a spendable source or a second line beside `incomes.total`. |
| Exact-basis `propertySaleProceedsTotal`, selling costs, HECM payoff, ordinary gain, capital gain | `spendableSource` / `propertySaleProceeds` | `propertyAccountId` | Publish net cash after selling costs and HECM payoff. Gain terms are metadata only. The property value reduction and HECM payoff are not second cash uses. |
| `rmdTotal`, `ownedIraRmdTotal`, `qcdFromRmd`, `namedQcdRmdSatisfied`, `rmdNontaxable` | `portfolioFunding` / `requiredMinimumDistribution`; the QCD diversion is a separate `transfer`; basis is `nonCashTaxCharacter` | Employer-plan RMDs carry source `accountId` and owner `personId`; owned-IRA RMDs carry the owner's `requiredDistributionPool` | Employer-plan RMD lines are per account and gross; a QCD can never divert them. Owned-IRA RMD publishes one line per owner: that owner's gross owned-IRA RMD less the owner-attributed `qcdFromRmd` (and any future nonzero `namedQcdRmdSatisfied`), because the ledger attributes the diversion to owners and never to a single account; netting per account would invent an allocation. Per-account gross evidence stays in the runtime/replay channels. Gross owned-IRA RMD is not also emitted, and `withdrawals.traditional` is an existing reporting total, not another line. See the explicit RMD/QCD lineage below. |
| `seppTotal`, `seppNontaxable`, `exogenousStrategyProceeds` | `portfolioFunding` / `seppDistribution`; basis is `nonCashTaxCharacter` | Source `accountId`, `personId` | One account-to-household line. `exogenousStrategyProceeds` and `withdrawals.traditional` repeat the same movement and are omitted. |
| `inheritedTotal`, `inheritedOrdinaryIncome`, `inheritedRothForced`, `inheritedAccounts` | `portfolioFunding` / `inheritedAccountDistribution` | Inherited `accountId`, beneficiary `personId` | Publish forced cash once per account. Traditional/Roth and ordinary character do not create extra lines. Voluntary inherited draws belong to `withdrawalPlan`, not this term. |
| `retirementActionCash`, `retirementActionEquityCompensation`, `retirementActionTaxableProceeds`, `retirementActionProceeds`, `retirementActionOrdinaryIncome`, action gains/losses | `portfolioFunding` / `retirementActionWithdrawal`; tax components are `nonCashTaxCharacter` | `actionId`, `allocationId`, source `accountId`, request person where present | Gross executed proceeds are one allocation-level cash line. Component totals, `withdrawals`, and `realizedGains` do not add more cash. Conversion and QCD actions never join these proceeds. |
| Accepted need-based `withdrawalPlan.byAccountId`, `byCategory`, `taxableSales`, `needBasedOwnedIraCharacter` | `portfolioFunding` / `needBasedPortfolioWithdrawal`; gain/basis splits are `nonCashTaxCharacter` | Source `accountId`, owner when the ledger carries it | Publish the final accepted account map, not probe plans. `byCategory`, taxable sales, and tax character are derived views over these same need-based draws; public `withdrawals` additionally folds RMD, SEPP, inherited, and committed-action totals, so it is a reconciliation check across every portfolio-funding line, never a view of this row alone. |
| Coordinated HECM candidate/final `hecmDraw`, coordinated `cashInflows` adjustment | `loanProceeds` / `hecmCoordinatedDraw` | `propertyAccountId` | Publish only the final accepted coordinated draw, never probe candidates. It is cash plus debt, not income or portfolio funding. |
| `hecmShortfallDraw`, the backstop part of `hecmDraw` | `loanProceeds` / `hecmBackstopDraw` | Each HECM `propertyAccountId` used by the backstop | Although this draw occurs after the accepted portfolio plan and is not inserted back into `cashInflows`, it is current-year cash that funds what would otherwise be an unfunded use. It is therefore included explicitly in the cash identity once, not folded into the coordinated line. |
| `baseCashInflows`, final `cashInflows`, optimizer `exogenousCash` | Derived source subtotals; no independent line | Household aggregate | They are checks over decomposed source lines. `exogenousCash` deliberately omits forced/action funding, and `cashInflows` may include coordinated HECM; none is an “Other” source. |

### Requested uses, funding, and residuals

Every `YearCashFlowUseLine` carries `requestedPlanDollars`, `fundedPlanDollars`, and
`unfundedPlanDollars`. The final portfolio/HECM shortage is attributed to use lines before publication;
shortfall is never a source and never traverses the cash hub.

Guardrail cuts and flexible-goal outcomes are assigned to their own lines first. Any remaining post-HECM
cash shortage follows the existing `attributeShortfall` layer order (excess, ideal, target, then required).
Within a layer whose producing ledger facts do not choose among multiple positive candidate uses, the
reporting publisher allocates that layer's shortage pro rata by each line's remaining requested amount.
This is deterministic reporting attribution, performed in the engine; it does not infer an owner or alter
the economic ledger. If the post-HECM shortage exceeds every requested spending line, the residual is attributed, in order, to the settled-tax line, then to penalty lines, then - last - to contribution lines, pro rata by remaining requested amount within each group, so the cash identity still closes on a year whose liabilities outrun its cash. A contribution reaches that last resort only in the committed-credit edge: the ledger credits contributions (an unvested equity-compensation destination, for example) before the funding solve, so the credit physically exists even when no source funded it; the use line then shows the unfunded remainder while its linked transfer still records the full committed credit, and the two amounts deliberately differ by exactly that remainder.

| `simulate.ts` term(s) | Role and stage | Identity carried | Anti-double-counting and decided treatment |
|------------------------|----------------|------------------|--------------------------------------------|
| `requiredLifestyle`, `targetLifestyle`, `idealLifestyle`, `excessLifestyle`; `targetLifestyleFunded`, `idealLifestyleFunded`, `excessLifestyleFunded` | `fundedUse` + `unfundedUse`, one line per spending layer | Household aggregate only | Requested is the pre-guardrail layer. Funded reflects guardrail and final cash availability; unfunded is the remainder. `baseSpending` is the funded subtotal and is omitted. |
| `oneTimeGoalsFunded`, `fundedNominal`, `unfundedNominal`, `requiredGoalsFunded`, `targetGoalsFunded`, `idealGoalsFunded`, `excessGoalsFunded`, all four `skipped*Nominal` terms, `goalOutcomeCounts` | `fundedUse` + `unfundedUse` / `oneTimeGoal` | `goalId`; classification determines the use layer, never ownership | Publish one line per goal outcome that the ledger settles this year: funded, partially funded, or skipped dollars are funded/unfunded as booked. A goal the guardrail DEFERS to a later year is excluded from this year's requested amounts entirely - the ledger increments only the deferred count and does not book `unfundedNominal` into the year's shortfall, so publishing it as a current-year unfunded use would invent a miss the projection does not record; deferral stays diagnostic until the goal resolves. Classification totals and outcome counts are existing summaries only. |
| `debtService` | `fundedUse` + `unfundedUse` / `debtService` | Debt `accountId` where captured | Principal and interest remain one cash use. Debt-balance reduction is not a transfer line. No owner is inferred. |
| `propertyCosts` | `fundedUse` + `unfundedUse` / `propertyCosts` | `propertyAccountId` where captured | Property tax and homeowner insurance are one carrying-cost line per property, not a property purchase. |
| Property purchase | Unsupported: no line and no amount | None | The ledger initializes property balances but has no annual purchase cash term. A nonzero purchase must fail with `unsupportedLedgerTerm`, never appear as “Other.” |
| Final fixed-point `healthcare`; `medicarePremiums`, `irmaaSurcharge`, `irmaaTier`; `acaGrossEnrollmentPremium`, `economicNetPremium` | `fundedUse` + `unfundedUse` / `healthcare` | Household aggregate; person identity only where the final ledger retains it | Publish final healthcare after ACA/tax convergence. Medicare and IRMAA are subsets. ACA support is already netted; do not publish a subsidy source or the gross and net premium as two uses. |
| `insurancePremiums` | `fundedUse` + `unfundedUse` / `insurancePremium` | `policyId`, insured/owner person available at the producer | One use per policy. The household aggregate is omitted. |
| Gross `careCost`, `netCare`, `ltcBenefit` | `fundedUse` + `unfundedUse` / `longTermCare` on the net amount | Care-event `personId`, plus every contributing durable `CareEvent.id` as `careEvent` references on the per-person line; policy identity documented on the offset | The requested use is `netCare = careCost - ltcBenefit`, matching the ledger amount that enters required spending. Gross cost and the reimbursement are documented components of this one line, not two lines, so the benefit is never double counted. |
| Requested contribution amounts, capped `allowed`, final `contributions`, `ownedNonRothIraContributions` | `fundedUse` + `unfundedUse` / `contribution`, followed by a lineage-linked `transfer` | Destination `accountId`, owner `personId` where present | Requested is the destination's request after statutory routing - a mandatorily redirected Roth catch-up counts toward the Roth destination it is actually credited to, even when that account's authored request is zero, so `requested = funded + unfunded` holds per line without negative amounts; the authored pre-routing request is preserved as documented attribution, never as a second money line. Funded is the allowed/credited amount after legal caps; unfunded is the rejected remainder. The account credit is the later transfer stage, not a source. |
| `traditionalInflow`, `otherInflow`, `taxableInflow` | Derived transfer-credit buckets; no independent line | Aggregate bucket only | These optimizer channels repeat contribution and match credits. They are neither household inflows nor extra uses. |
| Settled `tax` | `fundedUse` + `unfundedUse` / `settledTax`, separately subtotaled in reconciliation | Household tax unit only | `requested = tax`; the line is fully funded except when the residual shortfall attribution below reaches it - non-cash taxable events (phantom OID, a Roth conversion) can leave a liability larger than every spendable dollar, and forcing `funded = tax` would then make an honest year unreconcilable. The pluggable calculator does not publish a settled federal/state split. `advisoryFederalTax.detail.totalTax` is never substituted or added. |
| Final `penalties` and the traditional, HSA, and Roth early-withdrawal effects | `fundedUse` / `earlyWithdrawalPenalty`, separately subtotaled in reconciliation | Source `accountId` and owner when present; otherwise no inferred identity | Publish the settled penalty once, classed by the closed `YearCashFlowPenaltyClass` vocabulary; like tax, a penalty line carries an unfunded portion only when the residual shortfall attribution reaches it. Traditional, HSA, and employer designated-Roth penalties are account-attributed (designated-Roth `roth:` pools are per account); owned Roth-IRA early effects pool per owner (`rothira:`), so that line is per owner, never a guessed member account. SEPP is excluded from this flow. |
| `surplus`, `surplusInvested` | `fundedUse` / `surplusInvestment`, followed by a lineage-linked `transfer` | Chosen destination account or `unassignedCash` | The residual is not another source. The use closes the cash identity; the transfer records the later account credit. |
| `spendingNeedBeforeTax`, fixed-point `requiredNeed` | Derived solve inputs; no independent line | Household aggregate | They are iteration requirements, not requested uses and not cash. |
| `withdrawalPlan.shortfall` | Provisional `unfundedUse` subtotal; no independent final line | Household aggregate | It is pre-HECM. The backstop loan proceeds reduce it before final use-line attribution. |
| `shortfallAfterHecm`, `shortfall`, `requiredShortfall`, `targetShortfall`, `idealShortfall`, `excessShortfall` | Final `unfundedUse` attribution; scalar fields are omitted as extra lines | Spending layer only; no goal/account owner is inferred | The sum is represented in use-line `unfundedPlanDollars`. Layer scalars and `flexibleGoals.unfundedAmount` are checks, never a cash source or separate “shortfall” edge. |
| `expenses.total`, `requiredSpending`, `targetSpending`, `idealSpending`, `excessSpending`, `intendedSpending`, `expenses.oneTimeGoals`, existing `YearExpenses` component totals | Derived use reports; no independent line | Existing aggregate identity only | These overlap the decomposed use lines. In particular, intended/skipped layer reports are not interchangeable with funded `expenses.total`. |

### Direct transfers, tax character, and post-solve deposits

| `simulate.ts` term(s) | Role and stage | Source → destination identity | Anti-double-counting and decided treatment |
|------------------------|----------------|-------------------------------|--------------------------------------------|
| Allowed employee `contributions`; contribution runtime credits | `transfer` / `employeeContribution` after the contribution use | `householdCash` → destination `accountId`; owner where present | Debit and credit equal the committed credited amount; when the last-resort residual attribution reaches a contribution line, that credit exceeds the funded portion of the use and the difference is the use line's unfunded remainder. `sameDollarLaterStage` lineage points to that use; never sum the two views. |
| `employerMatch` and its runtime credit | `transfer` / `employerMatch` | `employer` → destination employer account and owner | Employer match is explicitly not household cash and not a household use. It is never folded into income or “Other.” |
| Funded annuity premium, `exogenousStrategyDebits`, `annuityContractPremiumCredit` | `transfer` / `annuityPurchase` | Funding `accountId` → annuity contract/account; funding owner where present | Debit and contract credit are one transfer; a gain or loss realized by funding the premium from an appreciated taxable or equity-compensation account is `capitalGain` metadata on this transfer, never folded into the standalone rebalancing row. Later annuity payments are separate future-year spendable sources. Underfunded premium requests do not create household shortfall. |
| Funded TIPS purchase debit | `transfer` / `tipsLadderPurchase` | Funding `accountId` → `ladderId` | It is an asset purchase, not spending; a gain or loss realized by the funding sale is `capitalGain` metadata on this transfer, never folded into the standalone rebalancing row. Future coupon/principal cash is a later source and does not duplicate the purchase. |
| `rolloverInflow` | `transfer` / `pensionRollover` | External pension plan/account → destination traditional `accountId` and owner | The elected offer never enters household cash. The stopped pension stream is reflected by its absence, not a negative use. |
| Named conversion debit/credit, `namedRothConversionExecuted` | `transfer` / `namedRothConversion` | Source traditional `accountId`/allocation → destination Roth `accountId`; `actionId`, `allocationId`, `personId` | Principal moves once. `namedRothConversionNontaxable` and `committedConversionOrdinaryIncome` are metadata on the transfer, not spendable income or a second link. Refused/unexecuted named amounts do not transfer. |
| Aggregate `rothConversion`, its source allocations and destination credits | `transfer` / `aggregateRothConversion` | Source traditional `accountId` → owner-eligible Roth `accountId` | Executed principal only. Taxable and basis character are metadata. Aggregate conversions remain excluded from committed named-conversion income to avoid pricing them twice. |
| `qcdFromRmd` | `transfer` / `qualifiedCharitableDistribution` with `divertedBeforeHouseholdCash` lineage | Owner `requiredDistributionPool` → `charity`; owner attribution when available | The gross RMD is debited upstream, but this routed part is excluded from the RMD cash-view amount. It is not another account debit and is never a household use. Its `divertedBeforeHouseholdCash` lineage is a complement pointer to the owner's net RMD line (published even at a zero net), never a claim that the gift nests inside that cash amount. |
| Beyond-RMD aggregate `beyondRmd` / moving `legacyQcd`, `exogenousStrategyAccountMovement` | `transfer` / `qualifiedCharitableDistribution` | Owned IRA `accountId`/owner → `charity` | It never entered `baseCashInflows`, so it is not subtracted there and has no cash-view line. Requested residual is unavailable and is not invented. |
| `namedQcdExecuted` | `transfer` / `qualifiedCharitableDistribution` | Named source `accountId`/donor → `charity`; `actionId`, `allocationId` | Exact executed gift only; the charity endpoint carries the request's durable `designationId`, which the aggregate strategy's anonymous charity endpoint omits. Requested/unexecuted evidence stays in the action publication and does not become a household use. |
| `namedQcdRmdSatisfied`, `namedQcdIncomeOffset` | No zero movement line today; reserved QCD transfer seam and `nonCashTaxCharacter` metadata | Named QCD identities if the seam becomes nonzero | `namedQcdRmdSatisfied` is structurally zero because the annual pass distributes the full RMD first. Omit it now. A future positive value uses RMD-diversion lineage and must not subtract the same dollars twice. |
| `qcdIncomeOffset`, `qcdNonQualifiedOrdinaryIncome` | `nonCashTaxCharacter` on the corresponding QCD transfer | Same donor/action/account evidence as the gift | Exclusion or includible excess changes tax character, never the physical gift amount. |
| `taxableYieldReinvested` and the post-solve account/basis credit | `transfer` / `reinvestedYield` | `accountYield(accountId)` → the same taxable `accountId` | Reinvested gross yield is excluded from spendable sources exactly once. Its credit is not account growth and not a household use. |
| `surplus` deposit | `transfer` / `surplusInvestment` after the surplus use | `householdCash` → selected cash/taxable account or `unassignedCash` | `sameDollarLaterStage` lineage points to the surplus use. The selected destination is stable cash first, taxable second, otherwise unassigned. |
| Rebalancing and rebalancing taxable sales | No cash/transfer line; realized gain only is `nonCashTaxCharacter` | Account identity where the tax evidence carries it | Rebalancing remains inside an account's investments and is unsupported as a cash-flow edge. Any realized gain affects tax metadata only; never fold it into “Other.” |
| Legacy property `expectedNetProceeds ?? value`, less HECM payoff | `postSolveDeposit` / `legacyPropertySaleDeposit` | `propertyAccountId` → actual `deposit` destination | This path is explicitly excluded from current-year cash reconciliation because it runs after the solve. Exact-basis sale proceeds use the earlier spendable-source path; the two paths are mutually exclusive. |
| Permanent-life `deathBenefit`, policy cash value zeroing | `postSolveDeposit` / `lifeInsuranceDeathBenefit` | `policyId`, insured `personId` → actual `deposit` destination | The payout is `max(deathBenefit, cashValue)`. Cash value is zeroed, so neither it nor the deposit is counted twice. It did not fund the current-year solve. |
| Runtime occurrences/applications, action publications/executions, `committedActionAccountMovement`, optimizer `exogenousStrategyAccountMovement`/`exogenousStrategyProceeds` | Evidence or derived movement totals; no additional role | Preserve their action/account/person identities when composing the lines above | These channels help construct identity-bearing lines but are not themselves another reporting view. |

## Stable line IDs

Line IDs are deterministic semantic keys, not labels. They are stable across repeated runs of the same
Plan and across years in which the same semantic line recurs. A line may be absent in a zero year and
return later with the same ID.

Every dynamic segment below is `E(value)`: the value with any unpaired UTF-16 surrogate first replaced by U+FFFD, then escaped with JavaScript `encodeURIComponent`. The replacement makes the encoder total over every schema-valid Plan ID - a raw `encodeURIComponent` throws on lone surrogates and would abort capture instead of failing closed. Two IDs that collide only through this replacement surface as `duplicateLineId` and the year publishes `notReconciled`.
Literal colons delimit segments, so escaping `:` and `%` makes the grammar collision-free. Publishers
must not use array positions, execution order, amounts, localized text, owner guesses, or the projection
year as a disambiguator. Lines are emitted in lexicographic ID order, and duplicate IDs make the year
`notReconciled`.

| Kind(s) | ID grammar |
|---------|------------|
| Wage, Social Security, recurring, one-time | `source:<kind>:E(incomeStreamId)` |
| Pension, annuity payment | `source:<kind>:E(accountId)` |
| TIPS ladder cash | `source:tipsLadderCash:E(ladderId)` |
| Distributed taxable yield, tax-exempt interest | `source:<kind>:E(accountId)` |
| Exact or legacy property sale | `source:<kind>:E(propertyAccountId)` |
| SEPP, inherited distribution, need-based withdrawal | `source:<kind>:E(sourceAccountId)` |
| Employer-plan RMD | `source:requiredMinimumDistribution:account:E(accountId)` |
| Owned-IRA RMD (per owner, net of the QCD diversion) | `source:requiredMinimumDistribution:ownedIraPool:E(personId)` |
| Committed ordinary withdrawal | `source:retirementActionWithdrawal:E(actionId):E(allocationId)` |
| Coordinated/backstop HECM | `source:<kind>:E(propertyAccountId)` |
| Life death benefit | `source:lifeInsuranceDeathBenefit:E(policyId)` |
| Lifestyle layers | `use:requiredLifestyle:household`, `use:targetLifestyle:household`, `use:idealLifestyle:household`, or `use:excessLifestyle:household` |
| One-time goal | `use:oneTimeGoal:E(goalId)` |
| Debt service, property cost, insurance premium | `use:<kind>:E(accountOrPolicyId)` |
| Healthcare | `use:healthcare:household` |
| LTC care | `use:longTermCare:E(personId)` |
| Settled tax | `use:settledTax:household` |
| Penalty | `use:earlyWithdrawalPenalty:account:E(sourceAccountId):E(penaltyClass)` for account-attributed traditional and HSA penalties; `use:earlyWithdrawalPenalty:account:E(sourceAccountId):rothEarly` for employer designated-Roth accounts, whose `roth:` pools are per account, so two designated-Roth accounts of one owner remain two lines; `use:earlyWithdrawalPenalty:rothPool:E(personId):rothEarly` only for the owned Roth-IRA (`rothira:`) owner-wide aggregation; `use:earlyWithdrawalPenalty:household:E(penaltyClass)` only when the ledger truly has no source identity. `penaltyClass` is the closed set `traditionalEarly` \| `hsaNonMedical` \| `rothEarly` (`YearCashFlowPenaltyClass`). The `account:` / `rothPool:` / `household:` discriminants keep an account ID that happens to equal `household` collision-free. The class is also published as `YearCashFlowUseLine.penaltyClass`; consumers read the field, never the ID. |
| Contribution | `use:contribution:E(destinationAccountId)` |
| Surplus investment | `use:surplusInvestment:account:E(accountId)` or `use:surplusInvestment:unassignedCash` |
| Named conversion | `transfer:namedRothConversion:E(actionId):E(allocationId)` |
| Aggregate conversion | `transfer:aggregateRothConversion:E(sourceAccountId):E(destinationAccountId)` |
| Named QCD | `transfer:qualifiedCharitableDistribution:named:E(actionId):E(allocationId)` |
| Aggregate beyond-RMD QCD | `transfer:qualifiedCharitableDistribution:beyondRmd:E(personId):E(sourceAccountId)` |
| RMD-diverted QCD | `transfer:qualifiedCharitableDistribution:rmd:E(personId)` |
| Employee contribution, employer match, reinvested yield | `transfer:<kind>:E(destinationAccountId)` |
| Annuity or TIPS purchase | `transfer:<kind>:E(destinationContractOrLadderId)` |
| Pension rollover | `transfer:pensionRollover:E(pensionAccountId):E(destinationAccountId)` |
| Surplus transfer | `transfer:surplusInvestment:account:E(accountId)` or `transfer:surplusInvestment:unassignedCash` |
| Standalone TIPS OID | `metadata:tipsPhantomOidIncome:E(ladderId)` |
| Attested tax-exempt excess | `metadata:taxExemptInterestAttestedExcess:household` |
| Standalone rebalancing gain | `metadata:capitalGain:rebalancing:E(accountId)` |

If a producer has a nonzero amount but lacks an identity required by its grammar, it must not synthesize
an ordinal or owner. The year publishes `notReconciled` with `missingRequiredIdentity` or
`unsupportedLedgerTerm`, and the UI refuses to graph it.

## Conservation and failure contract

At the engine's native floating-point precision, with the applied tolerance published in the
reconciliation block, every report must satisfy:

```text
spendable sources
  + portfolio funding
  + loan proceeds
= funded household uses
  + settled tax
  + penalties
  + funded contributions
  + surplus investment
```

Net long-term care (gross care cost less the policy reimbursement) is the funded household use; the reimbursement is never a source. Coordinated and
backstop HECM draws both appear under loan proceeds. Post-solve deposits and every transfer are excluded
from both sides.

The second identity is linewise and annual:

```text
requested uses = funded uses + unfunded uses
```

The transfer view also pairs debits and credits:

```text
transfer debits = transfer credits
```

`YearCashFlowReconciliation` publishes both sides, their differences, the applied tolerance, paired
transfer totals, a status of `reconciled` or `notReconciled`, reason codes, and exact diagnostics. Native
precision means the engine's unrounded JavaScript numbers and its explicit floating-point tolerance;
there is no cent rounding or display formatting in reconciliation. Currency formatting, today-dollar
conversion, aggregation for legibility, and rounding-error presentation belong to the UI and are
specified separately. Physical flow amounts are nonnegative. `capitalGain` tax-character metadata may
be negative for a realized loss; tax-character metadata never enters a money total.

A failed year is still published so it can be diagnosed. It is not silently repaired with an “Other,”
rounding plug, synthetic source, or synthetic owner. Any graphical consumer must refuse to graph a
`notReconciled` year and show a non-chart failure state derived from the machine-readable diagnostics.

## Non-goals

- This is an annual reporting contract, not a transaction register or tax form.
- It never infers ownership, source accounts, goal identity, policy identity, or federal/state tax splits
  that the ledger does not carry.
- Roth conversions are direct transfers. Taxable conversion character is metadata and conversion
  principal is never spendable income.
- Shortfall is never cash. Only `fundedPlanDollars` routes through the household-cash view.
- The contract is edition-neutral. Given the same Plan, options, and engine version, detail does not vary
  by web, desktop, or another host edition.
- It does not contain presentation labels, colors, node order, coordinates, chart-library objects, or UI
  rounding.
