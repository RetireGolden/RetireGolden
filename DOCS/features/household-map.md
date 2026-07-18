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
invents an edge the schema does not carry, and never infers a legal relationship. The
`UNSUPPORTED_RELATIONSHIPS` ids match this table row-for-row (test-enforced in
`householdGraph.test.ts` — change one, change both).

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
| Home-equity line | `property.hecm` (attribute of the property; requires `primaryResidence`) — surfaced as a note on the property node ("HECM line of credit (opened YYYY)") |
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

## Graph selector (`engine/household/householdGraph.ts`)

`buildHouseholdGraph(plan)` is a pure, deterministic selector producing typed nodes and edges:

- **Nodes** — `person`, `formerSpouse`, `income` (wages / Social Security / recurring / one-time),
  `guaranteedIncome` (pension / annuity), `account` (cash / taxable / equity comp / traditional /
  Roth / HSA), `property`, `debt`, `insurance` (LTC / permanent life), `ladder` (TIPS), and
  categorical `estate` destinations (surviving spouse / non-spouse heirs / charity / estate).
  Node ids are stable and derived from plan entity ids (`person:<id>`, `acct:<id>`, `inc:<id>`,
  `ins:<id>`, `ladder:<id>`, `fs:<streamId>:<formerSpouseId>`, `estate:<destination>`), so layout
  and tests survive unrelated plan edits. Raw id components are injectively encoded
  (`encodeIdComponent`: `\` → `\\`, `:` → `\:`, `>` → `\>`) so entity ids containing delimiters can
  never forge a structural `:` or the `->` arrow in an edge id — well-behaved ids stay unchanged
  and human-readable. Duplicate entity ids within a collection (the schema doesn't forbid them —
  imports can carry them) are disambiguated with an ordinal suffix (`:2`, `:3`, … — collision-proof
  under the encoding) and every occurrence is flagged as an attention fact ("Duplicate account id
  … — provenance ambiguous").
- **Amounts** are the plan's own stored figures (balance, property value, debt owed, annual/monthly
  amounts) tagged with an `amountKind` — the selector never computes derived dollars beyond exact
  sums of stored values.
- **Edges** — `owns`, `receives`, `covers` (insurance → insured), `beneficiary`,
  `survivor` (pension/annuity continuation), `funds` (annuity purchase, pension lump-sum rollover,
  ladder purchase), `formerSpouseOf`. Joint ownership emits one edge per household member flagged
  `joint`.
- **Completeness** per node (`complete` / `partial` / `unknown` + factual `missing` strings):
  e.g. an investable account with no estate destination, a person with no Social Security record,
  a Social Security stream with neither PIA nor an earnings record (`unknown` — an empty earnings
  array counts as absent, mirroring `simulate`), a planned property sale with no basis or proceeds
  estimate, a 0%-survivor pension or life-only annuity in a two-person household, an ownerless
  pension/annuity. **One-person plans never draw a spouse**: a spouse estate destination, a
  spouse-sole-beneficiary assertion, or a >0% pension survivor share in a single-person plan is
  stale data — it is suppressed from the diagram and flagged as a `missing` fact instead.
- **Notes** per node carry factual schema attachments that are not separate nodes — today a
  property's HECM line of credit ("HECM line of credit (opened YYYY)").
- **Edge-id uniqueness**: a spouse estate destination combined with the spouse-sole-beneficiary
  assertion emits one labeled `sole beneficiary` edge, never two edges with a colliding id.
- **Provenance**: every node carries `source` (the plan path it was read from, e.g. `accounts[3]`)
  and `editSurface` (semantic id of the planner screen where it is edited; the UI maps it to a
  route). Estate destination nodes take both from the first plan field that referenced them — the
  `estate` destination, reachable only via a permanent-life beneficiary, carries insurance
  provenance.
- **Totals** (`assets` = investable + property, `investable`, `property`, `liabilities`,
  `netWorth = assets − liabilities`) are sums of *entered* values — deliberately distinct from the
  projection's simulated net worth, and reconciled 1:1 against the report model's accounts block in
  `planner-ui/src/integration/householdGraphReconciliation.test.ts` across the whole example
  library.

## Map page (`planner-ui/src/householdMap/`)

`/plan/:planId/household-map`, in the Explore rail group. `layout.ts` is a deterministic layered
layout (fixed columns People → Income → Accounts → Property & debt → Protection & estate; rows
follow plan entry order; pure data, no dollars — covered by stable-layout snapshot tests).
`mapViewModel.ts` produces the sanitized render model: pixel positions, edge paths, formatted
labels — and under the privacy toggle ("Hide amounts") the view model contains **no dollar strings
at all** (test-enforced). The toggle is workspace-wide: it drives a `PrivacyContext` provided by
`PlanWorkspace`, so the KPI bar above the page masks its dollar values (`•••`, unit captions
included) while hide is active, and restores automatically when the toggle goes off or the user
navigates away from the map page — the screen-share promise covers the whole window, not just the
canvas. The model is reusable for report embedding
later — with `hasAmount` preserved so placeholders ("•••"/"hidden") appear only where a real
amount is concealed. The view model also phrases every edge per node (`relations`), so topology is
never confined to the aria-hidden SVG. `HouseholdMapPage.tsx` renders HTML node cards
(react-router deep links to each item's edit screen) over an SVG edge layer: zoom control, person
focus, group filters, arrow-key navigation between cards plus natural tab order (entity ids are
CSS-escaped, so ids containing quotes can't break navigation), a "Text list of this map"
`<details>` table — including a "Connected to" relationships column — as the non-visual
equivalent, a "What needs attention" panel (every `missing` fact with a link to fix it), and the
out-of-model panel from `UNSUPPORTED_RELATIONSHIPS`. Edge annotations ("joint", survivor %,
marriage years) render on the diagram, so joint holding is visually distinct from two individual
ownership edges. Totals are labeled "as entered" to keep them distinct from the projection.

**Person-focus traversal rule** (`connectedNodeIds`): seed with edges touching the focus person
directly (what they own/receive; what covers, names, or unlocks them), then grow to a fixpoint
along *attachment* edges only (beneficiary / survivor / funds endpoints of kept nodes) so the
result is independent of plan entry order. Ownership/receives edges are never re-traversed from
kept non-focus nodes — a jointly held account never pulls in the other member or their side of the
map (test-enforced with negative assertions).

**Print** targets Letter landscape via a `@page` rule inside the page's own mounted `<style>` (so
it never leaks into other planner printouts). The printed artifact is the map alone: the workspace
KPI bar (which shows real dollar values even when map amounts are hidden), rail, header, and the
page's auxiliary panels are hidden in print, and the canvas is scaled to fit one page from its
actual layout size (no hard-coded shrink, no cards sliced across page breaks). Long names truncate
visually with the full name preserved in the tooltip and accessible label.

Feature-off discipline: the map is read-only over the plan — it writes nothing, adds no schema
fields, and touches no engine ledger path, so `npm run cases:diff` is unchanged by its presence.
