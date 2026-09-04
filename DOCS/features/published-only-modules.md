# Published-only modules and their private consumer

Three modules in `packages/planner-ui` have **no call site in this repository**. They are not dead
code and they are not scaffolding: each is a published, stability-promised subpath of
`@retiregolden/planner-ui`, and the code that calls it lives in the private RetireGolden-Pro repo.
This note records which consumer pins which subpath, what exercises each module here, and what a
contract change to one of them costs.

It exists because the missing call site changes how a change to these files has to be reviewed. For
every other module in the package, a reviewer can read the caller and see what a reshaped argument or
a new failure reason does. Here there is nothing local to read, so the tests, the pack smoke, and the
stability promise in [`packages/planner-ui/README.md`](../../packages/planner-ui/README.md) are the
whole contract, and a break that slips past them surfaces in a repository this one cannot see.

## The three modules

| Module | Published subpath | What exercises it in this repo | Consumer |
| --- | --- | --- | --- |
| [`src/data/completeExport.ts`](../../packages/planner-ui/src/data/completeExport.ts) (596 lines) | `@retiregolden/planner-ui/complete-export` | `completeExport.test.ts` (386 lines) plus `completeExportManifest.fixture.json`, which also asserts the exports-map entry and that the subpath and the source module export the same names; `scripts/pack-smoke.mjs` imports the packed subpath and requires an empty object to be refused as `not_complete_export` | RetireGolden-Pro is the **sole producer** of the `.rgcomplete` container; this package deliberately contains no writer, only the read/verify half. See [planning-record.md](planning-record.md). |
| [`src/import/documentText.ts`](../../packages/planner-ui/src/import/documentText.ts) (1,396 lines) | `@retiregolden/planner-ui/document-text` | `documentText.test.ts` (1,726 lines); `documentBenchmark.ts` with `documentCorpus.ts` and `pdfFixtures.ts`, which measure extraction against a synthetic corpus and are excluded from the tarball by the `files` deny-list; `scripts/pack-smoke.mjs` builds the packed subpath with **no** `pdfjs-dist` installed and requires the answer `pdfjs_unavailable` rather than a throw | The Pro intake workbench. Nothing in the free import wizard reaches it: `/import` still takes no PDF upload. See [document-parsing-spike.md](document-parsing-spike.md) and [imports-and-migration.md](imports-and-migration.md#not-a-wizard-source-the-pdf-text-extraction-spike). |
| [`src/import/migrationSource.ts`](../../packages/planner-ui/src/import/migrationSource.ts) (1,227 lines) | `@retiregolden/planner-ui/migration-source` | `migrationSource.test.ts` (1,045 lines), which also guards that the subpath stays browser-free and never loads the PDF implementation at run time; `importSecurity.test.ts`; `provenance.test.ts` for the `mapper: 'migrationSource'` round trip; `scripts/pack-smoke.mjs` imports `MIGRATION_ADAPTERS` and `identifyMigrationExport` from the packed subpath | The same Pro intake and migration workbench. Its own header names the workbench plan rather than the repo; [imports-and-migration.md](imports-and-migration.md#migration-from-other-planning-tools) is where the split is written down, including that Pro keeps the extracted page text this module deliberately never carries. |

`scripts/pack-smoke.mjs` runs against a real `npm pack` tarball in the `build` job of
[`azure-static-web-apps-retiregolden.yml`](../../.github/workflows/azure-static-web-apps-retiregolden.yml)
and again in [`publish-planner-ui.yml`](../../.github/workflows/publish-planner-ui.yml) before a
release. It is what proves the three subpaths resolve, build, and answer from the packed package
rather than only from the source tree.

## A contract change here needs a coordinated release

None of these subpaths can be changed and verified against its caller in one commit. The consumer
installs a **published** `@retiregolden/planner-ui`, so the sequence is:

1. Land the change here, with the co-located tests and pack smoke updated in the same commit.
2. Release the package (tag `planner-ui-v<version>`; see
   [operations/ci-cd-and-deploy.md](../operations/ci-cd-and-deploy.md#package-releases) for the OIDC
   publish flow and the manual approval gate).
3. Update the consumer's pinned range and fix the call sites there.

Two consequences follow, and both are the reason to be conservative in these files.

**A break is caught one release late.** This is the same argument [testing.md](../testing.md#test-taxonomy)
makes for the plan-file-format round trip that lives in the MCP repo: a guard hosted on the producer
side could only ever test a published consumer, one release behind the change that broke it. Here the
asymmetry runs the other way, but the lag is identical, and there is no guard at all until the
consumer upgrades.

**The stability promise is what stands in for the missing call site.** Each of the three subpaths is
covered by an explicit promise in [`packages/planner-ui/README.md`](../../packages/planner-ui/README.md):
exported names, signatures, and payload shapes change only with a semver-major release, while new
failure reasons, new summary fields, new label values, and new vendors may arrive in a minor, so a
consumer must treat an unrecognized value as "cannot read this" rather than assume a closed union.
Additive stays additive. Anything that narrows what an older consumer can read is a major, whatever
the local tests say.

## What "no in-repo consumer" does not mean

It does not mean the modules are unreachable or unverified. Between them, the co-located suites,
`importSecurity.test.ts`, `provenance.test.ts`, the document benchmark, and the pack smoke exercise
the extraction path, the identification path, the refusal vocabulary, the provenance round trip, the
browser-free and DOM-free constraints, and the packed-tarball resolution. What is missing is only the
local reader of the output, so a reviewer of a change to these files should ask what an existing
consumer of the **previous** shape would do with the new one, since no code in this tree will answer
that question.
