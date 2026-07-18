# Household map

A one-page topology view of the household — people, income sources, accounts, property, debts,
insurance, and estate destinations, with the relationships between them — derived entirely from the
canonical `Plan`. The map is a *reading* of plan data (the same discipline as the report model): it
stores no dollar values of its own, computes no money math, and every box deep-links to the planner
screen where that item is edited. Its discovery value is honesty in both directions: it shows what
has been entered, flags what is missing (no beneficiary destination, no Social Security record, a
planned sale with no basis), and states plainly which relationships the plan schema cannot express
rather than inferring them.

## Taxonomy: what the plan schema can and cannot express

This audit is the ground truth behind the graph model. "Supported" means a first-class schema field
in `engine/model/plan.ts` the graph can read; "not expressible" relationships are listed in the
graph's `unsupported` set (`UNSUPPORTED_RELATIONSHIPS`) and surfaced on the page — the graph never
invents an edge the schema does not carry, and never infers a legal relationship.

### Supported relationships

| Relationship | Schema source |
|---|---|
| Household members (1–2 adults) | `household.people` (id, name, DOB, sex, retirement age, longevity) |
| Filing status | `household.filingStatus` (`single` / `marriedFilingJointly` only) |
| Account ownership | `accountBase.ownerPersonId` (a person, or `null` = joint); traditional/Roth/HSA must be individually owned (schema-enforced) |
| Income attribution | `wages.personId`, `socialSecurity.personId`; recurring/one-time income is household-level (no person link) |
| Former spouses on a Social Security record | `socialSecurityIncome.formerSpouses[]` (`divorced` / `deceased`, DOB, PIA estimate, marriage years) — unlocks divorced-spousal / survivor benefits; former spouses are **unnamed** in the schema |
| Estate destination of an account | `accountBase.estateBeneficiary` — **categorical** (`spouse` / `nonSpouse` / `charity` + charity %), not a named person |
| HSA beneficiary shorthand | `hsa.beneficiary` (`spouse` / `nonSpouse`; superseded by `estateBeneficiary` when both present) |
| Spouse-sole-beneficiary assertion on a traditional account | `traditional.spouseSoleBeneficiary` (RMD joint-life divisor gate) |
| Life-insurance insured + beneficiary | `permanentLife.insured` (person), `permanentLife.beneficiary` (a household person id or `'estate'`) — the only *named-person* beneficiary in the schema |
| LTC policy owner/insured | `ltc.owner` (one person, owner = insured) |
| Pension survivor continuation | `pension.survivorPct` (percent to a surviving spouse) |
| Annuity survivor form | `annuity.payoutForm` (`lifeOnly` / `periodCertain` / `jointSurvivor` + survivor %) |
| Funding relationships | `annuity.purchase.fundingAccountId`, `pension.lumpSumElection.rolloverAccountId`, `tipsLadder.purchase.fundingAccountId` |
| Home-equity line | `property.hecm` (attribute of the property; requires `primaryResidence`) |
| Qualifying-dependent assertion | `household.hasQualifyingDependent` (a boolean tax assertion, **not** a person) |

### Not expressible in the schema (shown as out-of-model, never inferred)

| Gap | What the schema actually has |
|---|---|
| Children / dependents as people | Only the `hasQualifyingDependent` boolean and expense line items; no dependent entities, ages, or relationships |
| Trusts, LLCs, and other entities | No entity ownership at all — every account is owned by a household person or jointly; "deep entity/trust modeling" is an explicit product non-goal |
| Named (non-household) beneficiaries | Estate destinations are categories (`spouse` / `nonSpouse` / `charity`); only permanent life can name a person, and only a *household* person |
| Contingent / per-beneficiary splits | Single destination per account (plus a charity %); no primary-vs-contingent chain, no percentage splits across heirs |
| More than two adults | `household.people` is capped at 2 |
| Legal relationship between the two adults | Only filing status; an unmarried two-person household carries no partner/relationship data |
| Former spouses as people | Former spouses exist only as benefit-unlock records on a Social Security stream — no name, no assets, no other links |
| Term life / disability / umbrella / health policies | Insurance is LTC + permanent life only (health coverage is modeled as expense configuration, not a policy) |
| Debt collateral | Debts are standalone; a mortgage is not linked to the property it secures |
| Income–asset linkage | Rental income is a recurring stream with no link to the property that produces it |
| External estate documents | Wills, trusts-as-documents, POAs are out of scope (product non-goal: no estate-document drafting or legal conclusions) |
