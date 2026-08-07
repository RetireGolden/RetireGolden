/**
 * What an annuity contract bought with owned-IRA dollars is worth, for the one
 * purpose that needs an answer: the Form 8606 line-6 aggregate.
 *
 * SECTION 408(d)(2)(A) treats all individual retirement plans as one contract
 * for section 72, and section 7701(a)(37)(B) makes a section 408(b) individual
 * retirement annuity an individual retirement plan. A contract held instead as
 * an asset of the section 408(a) trust never left the account at all. Either
 * way Form 8606 line 6 -- "the total value of all your traditional IRAs as of
 * December 31" -- reaches it, and the Form 5498 instructions put the duty to
 * value it on the custodian even for assets with no readily determinable market
 * value.
 *
 * NOTHING SUPPLIES THAT VALUE HERE, and this module is the convention that
 * stands in for it. A Plan annuity account carries a start age, a monthly
 * amount, a COLA and a payout form; it carries no balance field, no contract
 * growth rate the engine reads, and no cash-value schedule. The fair market
 * value of an annuitized contract is an actuarial quantity, and the Form 1099-R
 * instructions for 2026 stop requiring even the issuer to report the year-end
 * value of an annuitized commercial contract, so there is no figure to look up
 * either. What is left is the one quantity the model does know exactly:
 *
 *     contract value = premiums paid in - payments taken out, floored at zero
 *
 * No growth is added, because inventing one would be an actuarial claim from a
 * field (`annualReturnPct`) whose documented meaning is the growth rate of an
 * account balance this account does not have, defaulting to the household's own
 * portfolio assumption. That is a larger assertion than the silence it would
 * replace. The floor exists because a contract value cannot be negative and a
 * denominator must not be reduced by one; a contract that has paid out more
 * than its premium contributes zero here while a living annuitant's contract
 * still has value, which is one of the two directions this convention errs in.
 *
 * Registered, with both directions and their magnitudes, as
 * `irc-408-d-2-C-annuity-contract-close-of-year-value`.
 *
 * DERIVED IN ONE PLACE ON PURPOSE. The simulator seeds and runs this channel;
 * the runtime source series reconstructs it and refuses a published value that
 * disagrees. Both call the functions below, so the two arms cannot drift into
 * agreeing about a figure neither of them computed.
 */
import type { Account, Person, Plan } from '../model/plan.js'
import { isAggregatedIra } from '../strategies/accountEligibility.js'

type AnnuityAccount = Extract<Account, { type: 'annuity' }>

/**
 * The contracts whose value belongs in an owner's line-6 aggregate.
 *
 * Two conditions, and each excludes a contract for its own reason. The purchase
 * must be `qualified`, because a non-qualified purchase is funded from cash,
 * taxable or equity-compensation savings -- Plan validation refuses any other
 * funding for it -- and dollars section 408 never governed do not enter a
 * section 408(d)(2) aggregate by being spent on a contract. The funding account
 * must be an owned, non-inherited traditional IRA, which is what
 * `isAggregatedIra` means; Plan validation requires a qualified purchase to be
 * funded from an owned traditional ACCOUNT but does not require it to be an
 * IRA, so an employer plan reaches here and is excluded on this test. That
 * exclusion is right rather than conservative: an employer plan's pre-tax
 * balance is not in the 408(d)(2) aggregation at all, so a contract its dollars
 * bought is not either, and its payments carry no Form 8606 basis to share. An
 * inherited IRA is a different contract under 408(d)(2) entirely and Plan
 * validation already refuses it as a qualified purchase's source.
 *
 * A ZERO PREMIUM IS NOT A THIRD CONDITION, and it used to be. Excluding it left
 * a contract that pays without having been paid for -- a shape the schema
 * admits, since a premium is merely non-negative -- with no channel, no
 * occurrence, and therefore a payment charged to income in full while the
 * year's other distributions shared the basis. The contract is staged instead:
 * its channel opens at zero, it contributes nothing to line 6 because it holds
 * nothing, and its payments take the year's fraction like every other
 * distribution the aggregate makes. Nothing about 408(d)(2)(B) turns on how the
 * contract was acquired.
 *
 * THE POOL OWNER IS THE FUNDING ACCOUNT'S OWNER, ALWAYS, and that is not the
 * same question as whose age starts the payments. Section 408(d)(2) aggregates
 * one INDIVIDUAL's plans, so the aggregate a contract belongs to is the one
 * whose dollars bought it. An annuity account's `ownerPersonId` does not answer
 * that: it governs whose age `startAge` is measured against and which estate
 * beneficiary rules apply, and it may be `null` for joint, so a Plan can and
 * does name one spouse's contract against the other's IRA. Both owners are
 * carried, each for its own question, and conflating them would silently move
 * either the payments or the denominator.
 *
 * A CROSS-OWNER PURCHASE IS STAGED RATHER THAN REFUSED, which is a position and
 * is worth stating as one. On the engine's own registered reading the premium
 * is not a distribution -- IRC 408(d)(1) reaches only what is paid or
 * distributed OUT -- so the dollars never left the funding owner's section 72
 * contract, and putting the resulting contract in that owner's line-6 aggregate
 * is what follows. The competing reading is that a contract belonging to
 * somebody else could only have been reached by distributing to the owner
 * first, which would make the premium taxable to them; the engine models no
 * such distribution, and that gap is recorded on
 * `irc-408-d-1-ira-annuity-premium-is-not-a-distribution` rather than papered
 * over by refusing to value the contract. Refusing here would have cost more
 * than it bought: the shape is in saved plan files, and the year would fall
 * back to a ledger that drops the contract from line 6 entirely, which is
 * further from either reading than staging it is.
 */
export function ownedIraFundedAnnuityContracts(
  plan: Readonly<Plan>,
): { contract: AnnuityAccount; funding: Account; ownerPersonId: string }[] {
  const accountById = new Map(plan.accounts.map((account) => [account.id, account]))
  const contracts: {
    contract: AnnuityAccount
    funding: Account
    ownerPersonId: string
  }[] = []
  for (const account of plan.accounts) {
    if (account.type !== 'annuity') continue
    const purchase = account.purchase
    if (purchase === undefined || purchase.taxQualification !== 'qualified') continue
    const funding = accountById.get(purchase.fundingAccountId)
    if (funding === undefined || !isAggregatedIra(funding) ||
        funding.ownerPersonId === null) continue
    contracts.push({ contract: account, funding, ownerPersonId: funding.ownerPersonId })
  }
  return contracts.sort((left, right) =>
    left.contract.id < right.contract.id ? -1 : left.contract.id > right.contract.id ? 1 : 0)
}

/** The contract's annual payment in `year`, before any payout-form fraction. */
export function annuityContractAnnualPaymentPlanDollars(
  contract: Readonly<AnnuityAccount>,
  startCalendarYear: number,
  year: number,
): number {
  if (year < startCalendarYear) return 0
  return contract.monthlyAmount * 12 *
    Math.pow(1 + contract.colaPct / 100, year - startCalendarYear)
}

/**
 * The channel's opening value at the projection start.
 *
 * Zero for every contract this projection will buy itself: the premium has not
 * been paid, so there is nothing to open with, and the purchase year credits
 * the whole premium when it arrives.
 *
 * A contract bought BEFORE the projection start is the case this function
 * exists for. Its premium left the funding IRA in a year the ledger never runs,
 * so the Plan's opening IRA balance already excludes it and no
 * `annuityFundingTransfer` will ever be recorded for it -- yet the contract is
 * in the section 408(d)(2) aggregate from the first projected year, and its
 * payments are distributions from it. Leaving it out would keep the very defect
 * this channel closes, open on one shape and silently.
 *
 * So its opening value is the same convention run over the years the projection
 * did not simulate: the premium, less every payment the contract made between
 * its start age and the projection start. Those payments are exactly derivable
 * -- the amount is the Plan's monthly figure grown by the Plan's COLA, and the
 * payout-form fraction is 1 in every one of those years, because the owner is a
 * member of the household at the projection start and therefore was alive
 * throughout them. It is not an estimate the caller could get wrong; it is the
 * same arithmetic the projection would have performed had it started earlier.
 */
export function openingAnnuityContractValuePlanDollars(
  contract: Readonly<AnnuityAccount>,
  owner: Readonly<Person>,
  projectionStartTaxYear: number,
  /**
   * The premium the contract could actually have received, which is the Plan's
   * quoted figure held to the QLAC cap for the purchase year. The caller
   * supplies it because the cap is a parameter-pack figure indexed to that
   * year, and this module holds no pack.
   *
   * WHAT IT STILL CANNOT KNOW is whether the funding account could pay it. A
   * purchase inside the projection funds `min(premium, spendable)` and the
   * channel is credited with what actually moved; a purchase before the
   * projection started moved its dollars in a year the ledger never ran, so
   * there is no balance to have been short of and the quoted figure is the only
   * one there is. That residual is registered on
   * `irc-408-d-2-C-annuity-contract-close-of-year-value`.
   */
  cappedPremiumPlanDollars: number,
): number {
  const purchase = contract.purchase
  if (purchase === undefined || purchase.year >= projectionStartTaxYear) return 0
  const startCalendarYear =
    Number(owner.dob.slice(0, 4)) + contract.startAge
  let value = Math.max(0, Math.min(purchase.premium, cappedPremiumPlanDollars))
  const firstPayingYear = Math.max(startCalendarYear, purchase.year)
  for (let year = firstPayingYear; year < projectionStartTaxYear; year += 1) {
    value -= annuityContractAnnualPaymentPlanDollars(
      contract, startCalendarYear, year,
    )
    if (value <= 0) return 0
  }
  return value
}
