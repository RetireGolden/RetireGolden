/**
 * Pre-pass snapshot buffer for annual cash-flow capture.
 *
 * Constructed only when `SimulateOptions.captureAnnualCashFlow` is on.
 * `record*` is legal only in the year loop before `runPostContributionAnnualPass`
 * is entered. In-pass identities go to pass-local maps, never here: this object
 * is live during T0 / staging / settlement re-entries and is not rolled back.
 *
 * Recorders skip `amount <= 0` except where noted. They do not synthesize ids.
 *
 * @see DOCS/features/year-cash-flow.md
 */

export interface RecordedWage {
  readonly incomeStreamId: string
  readonly personId: string
  readonly amount: number
}
export interface RecordedStreamIncome {
  readonly incomeStreamId: string
  readonly amount: number
  readonly taxTreatment: 'ordinary' | 'capitalGain' | 'none'
}
export interface RecordedPension {
  readonly accountId: string
  readonly payeePersonId: string
  readonly amount: number
  readonly source: 'public' | 'private'
}
export interface RecordedAnnuityPayment {
  readonly accountId: string
  readonly recipientPersonId: string
  readonly paid: number
  /** Nonqualified exclusion-ratio return of basis at the pay site. 0 if none. */
  readonly nonqualifiedExcludable: number
  readonly qualifiedIraFunded: boolean
}
export interface RecordedTipsLadderCash {
  readonly ladderId: string
  readonly cash: number
  readonly coupons: number
  readonly maturingPrincipal: number
  readonly accretion: number
}
export interface RecordedDistributedYield {
  readonly accountId: string
  readonly taxableGross: number
  readonly interest: number
  readonly ordinaryDividends: number
  readonly qualified: number
  readonly exempt: number
  readonly reinvest: boolean
}
export interface RecordedPropertySale {
  readonly propertyAccountId: string
  readonly netProceedsAfterHecm: number
  readonly ordinaryGain: number
  readonly capitalGain: number
}
export interface RecordedGoalOutcome {
  readonly goalId: string
  readonly classification: 'required' | 'target' | 'ideal' | 'excess'
  readonly outcome: 'funded' | 'partiallyFunded' | 'skipped' // deferred is not recorded
  readonly requested: number
  readonly fundedNominal: number
}
export interface RecordedAccountAmount {
  readonly accountId: string
  readonly ownerPersonId: string | null
  readonly amount: number
}
export interface RecordedPolicyPremium {
  readonly policyId: string
  readonly subjectPersonId: string
  readonly amount: number
}
export interface RecordedLongTermCare {
  readonly personId: string
  readonly careEventIds: readonly string[]
  readonly gross: number
  readonly benefit: number
  readonly net: number
}
export interface RecordedContribution {
  readonly destinationAccountId: string
  readonly ownerPersonId: string | null
  /** Post-routing requested. Authored desired is not stored. */
  readonly requested: number
  /** Actually credited `allowed` after 3777. 0 when requested > 0 but allowed <= 0. */
  readonly credited: number
}
export interface RecordedEmployerMatch {
  readonly destinationAccountId: string
  readonly ownerPersonId: string | null
  readonly amount: number
}
export interface RecordedAnnuityPurchase {
  readonly fundingAccountId: string
  readonly annuityAccountId: string
  readonly funded: number
  readonly capitalGainOrLoss: number
}
export interface RecordedTipsPurchase {
  readonly fundingAccountId: string
  readonly ladderId: string
  readonly funded: number
  readonly capitalGainOrLoss: number
}
export interface RecordedPensionRollover {
  readonly pensionAccountId: string
  readonly destinationAccountId: string
  readonly ownerPersonId: string | null
  readonly amount: number
}
export interface RecordedRebalancingGain {
  readonly accountId: string
  readonly realizedCapitalGainOrLoss: number
}

export interface AnnualCashFlowYearSites {
  recordWages(row: RecordedWage): void
  recordRecurringIncome(row: RecordedStreamIncome): void
  recordOneTimeIncome(row: RecordedStreamIncome): void
  recordPension(row: RecordedPension): void
  recordAnnuityPayment(row: RecordedAnnuityPayment): void
  recordTipsLadderCash(row: RecordedTipsLadderCash): void
  recordDistributedYield(row: RecordedDistributedYield): void
  recordPropertySaleProceeds(row: RecordedPropertySale): void
  recordGoalOutcome(row: RecordedGoalOutcome): void
  recordDebtService(row: RecordedAccountAmount): void
  recordPropertyCosts(row: RecordedAccountAmount): void
  recordInsurancePremium(row: RecordedPolicyPremium): void
  recordLongTermCare(row: RecordedLongTermCare): void
  recordContribution(row: RecordedContribution): void
  recordEmployerMatch(row: RecordedEmployerMatch): void
  recordAnnuityPurchase(row: RecordedAnnuityPurchase): void
  recordTipsLadderPurchase(row: RecordedTipsPurchase): void
  recordPensionRollover(row: RecordedPensionRollover): void
  recordRebalancingGain(row: RecordedRebalancingGain): void
  readonly wages: readonly RecordedWage[]
  readonly recurring: readonly RecordedStreamIncome[]
  readonly oneTime: readonly RecordedStreamIncome[]
  readonly pensions: readonly RecordedPension[]
  readonly annuityPayments: readonly RecordedAnnuityPayment[]
  readonly tipsLadderCash: readonly RecordedTipsLadderCash[]
  readonly distributedYield: readonly RecordedDistributedYield[]
  readonly propertySales: readonly RecordedPropertySale[]
  readonly goals: readonly RecordedGoalOutcome[]
  readonly debtService: readonly RecordedAccountAmount[]
  readonly propertyCosts: readonly RecordedAccountAmount[]
  readonly insurancePremiums: readonly RecordedPolicyPremium[]
  readonly longTermCare: readonly RecordedLongTermCare[]
  readonly contributions: readonly RecordedContribution[]
  readonly employerMatch: readonly RecordedEmployerMatch[]
  readonly annuityPurchases: readonly RecordedAnnuityPurchase[]
  readonly tipsPurchases: readonly RecordedTipsPurchase[]
  readonly pensionRollovers: readonly RecordedPensionRollover[]
  readonly rebalancingGains: readonly RecordedRebalancingGain[]
}

function skipNonPositive(amount: number): boolean {
  return amount <= 0
}

class AnnualCashFlowYearSitesBuffer implements AnnualCashFlowYearSites {
  private readonly _wages: RecordedWage[] = []
  private readonly _recurring: RecordedStreamIncome[] = []
  private readonly _oneTime: RecordedStreamIncome[] = []
  private readonly _pensions: RecordedPension[] = []
  private readonly _annuityPayments: RecordedAnnuityPayment[] = []
  private readonly _tipsLadderCash: RecordedTipsLadderCash[] = []
  private readonly _distributedYield: RecordedDistributedYield[] = []
  private readonly _propertySales: RecordedPropertySale[] = []
  private readonly _goals: RecordedGoalOutcome[] = []
  private readonly _debtService: RecordedAccountAmount[] = []
  private readonly _propertyCosts: RecordedAccountAmount[] = []
  private readonly _insurancePremiums: RecordedPolicyPremium[] = []
  private readonly _longTermCare: RecordedLongTermCare[] = []
  private readonly _contributions: RecordedContribution[] = []
  private readonly _employerMatch: RecordedEmployerMatch[] = []
  private readonly _annuityPurchases: RecordedAnnuityPurchase[] = []
  private readonly _tipsPurchases: RecordedTipsPurchase[] = []
  private readonly _pensionRollovers: RecordedPensionRollover[] = []
  private readonly _rebalancingGains: RecordedRebalancingGain[] = []

  recordWages(row: RecordedWage): void {
    if (skipNonPositive(row.amount)) return
    this._wages.push(row)
  }
  recordRecurringIncome(row: RecordedStreamIncome): void {
    if (skipNonPositive(row.amount)) return
    this._recurring.push(row)
  }
  recordOneTimeIncome(row: RecordedStreamIncome): void {
    if (skipNonPositive(row.amount)) return
    this._oneTime.push(row)
  }
  recordPension(row: RecordedPension): void {
    if (skipNonPositive(row.amount)) return
    this._pensions.push(row)
  }
  recordAnnuityPayment(row: RecordedAnnuityPayment): void {
    if (skipNonPositive(row.paid)) return
    this._annuityPayments.push(row)
  }
  recordTipsLadderCash(row: RecordedTipsLadderCash): void {
    // Keep accretion-only rows so a later stage can emit phantom-OID metadata
    // without a second walk of the ladder. Source emission still omits cash <= 0.
    if (
      skipNonPositive(row.cash) &&
      skipNonPositive(row.coupons) &&
      skipNonPositive(row.maturingPrincipal) &&
      skipNonPositive(row.accretion)
    ) return
    this._tipsLadderCash.push(row)
  }
  recordDistributedYield(row: RecordedDistributedYield): void {
    if (skipNonPositive(row.taxableGross) && skipNonPositive(row.exempt)) return
    this._distributedYield.push(row)
  }
  recordPropertySaleProceeds(row: RecordedPropertySale): void {
    if (skipNonPositive(row.netProceedsAfterHecm)) return
    this._propertySales.push(row)
  }
  recordGoalOutcome(row: RecordedGoalOutcome): void {
    if (skipNonPositive(row.requested) && skipNonPositive(row.fundedNominal)) return
    this._goals.push(row)
  }
  recordDebtService(row: RecordedAccountAmount): void {
    if (skipNonPositive(row.amount)) return
    this._debtService.push(row)
  }
  recordPropertyCosts(row: RecordedAccountAmount): void {
    if (skipNonPositive(row.amount)) return
    this._propertyCosts.push(row)
  }
  recordInsurancePremium(row: RecordedPolicyPremium): void {
    if (skipNonPositive(row.amount)) return
    this._insurancePremiums.push(row)
  }
  recordLongTermCare(row: RecordedLongTermCare): void {
    if (skipNonPositive(row.net) && skipNonPositive(row.gross)) return
    this._longTermCare.push(row)
  }
  recordContribution(row: RecordedContribution): void {
    // Post-routing requested > 0 with credited 0 is a real unfunded use.
    if (skipNonPositive(row.requested) && skipNonPositive(row.credited)) return
    this._contributions.push(row)
  }
  recordEmployerMatch(row: RecordedEmployerMatch): void {
    if (skipNonPositive(row.amount)) return
    this._employerMatch.push(row)
  }
  recordAnnuityPurchase(row: RecordedAnnuityPurchase): void {
    if (skipNonPositive(row.funded) && row.capitalGainOrLoss === 0) return
    this._annuityPurchases.push(row)
  }
  recordTipsLadderPurchase(row: RecordedTipsPurchase): void {
    if (skipNonPositive(row.funded) && row.capitalGainOrLoss === 0) return
    this._tipsPurchases.push(row)
  }
  recordPensionRollover(row: RecordedPensionRollover): void {
    if (skipNonPositive(row.amount)) return
    this._pensionRollovers.push(row)
  }
  recordRebalancingGain(row: RecordedRebalancingGain): void {
    // Realized losses are negative; only a true zero is omitted.
    if (row.realizedCapitalGainOrLoss === 0) return
    this._rebalancingGains.push(row)
  }

  get wages(): readonly RecordedWage[] { return this._wages }
  get recurring(): readonly RecordedStreamIncome[] { return this._recurring }
  get oneTime(): readonly RecordedStreamIncome[] { return this._oneTime }
  get pensions(): readonly RecordedPension[] { return this._pensions }
  get annuityPayments(): readonly RecordedAnnuityPayment[] { return this._annuityPayments }
  get tipsLadderCash(): readonly RecordedTipsLadderCash[] { return this._tipsLadderCash }
  get distributedYield(): readonly RecordedDistributedYield[] { return this._distributedYield }
  get propertySales(): readonly RecordedPropertySale[] { return this._propertySales }
  get goals(): readonly RecordedGoalOutcome[] { return this._goals }
  get debtService(): readonly RecordedAccountAmount[] { return this._debtService }
  get propertyCosts(): readonly RecordedAccountAmount[] { return this._propertyCosts }
  get insurancePremiums(): readonly RecordedPolicyPremium[] { return this._insurancePremiums }
  get longTermCare(): readonly RecordedLongTermCare[] { return this._longTermCare }
  get contributions(): readonly RecordedContribution[] { return this._contributions }
  get employerMatch(): readonly RecordedEmployerMatch[] { return this._employerMatch }
  get annuityPurchases(): readonly RecordedAnnuityPurchase[] { return this._annuityPurchases }
  get tipsPurchases(): readonly RecordedTipsPurchase[] { return this._tipsPurchases }
  get pensionRollovers(): readonly RecordedPensionRollover[] { return this._pensionRollovers }
  get rebalancingGains(): readonly RecordedRebalancingGain[] { return this._rebalancingGains }
}

export function createAnnualCashFlowYearSites(): AnnualCashFlowYearSites {
  return new AnnualCashFlowYearSitesBuffer()
}
