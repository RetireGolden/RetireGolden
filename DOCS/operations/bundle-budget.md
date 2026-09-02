# Bundle budget: what the built app is allowed to weigh

RetireGolden is an offline-first PWA. Everything a reader can do, they do with code already on the
device — so bundle size is not a page-speed nicety here, it is the install cost and the parse cost on
whatever phone the reader owns. The app had drifted to a 6.3 MB precache before anyone measured it,
because the only signal was Vite's `chunkSizeWarningLimit`, which prints a warning nobody fails on.

[`app/scripts/check-bundle-budget.mjs`](../../app/scripts/check-bundle-budget.mjs) is the gate. It runs
as part of `pnpm --filter retiregolden-web build`, straight after `vite build`, and exits non-zero when
`dist/` is over budget — so the build, and therefore CI and the deploy, fail rather than warn. It is a thin
CLI over [`bundleBudget.mjs`](../../app/scripts/bundleBudget.mjs), which holds the limits, the parsers, and
the evaluation as pure functions with fixture tests in
[`bundleBudget.test.mjs`](../../app/scripts/bundleBudget.test.mjs).

```bash
pnpm build                 # the budget runs inside the app build
pnpm bundle-budget         # print the table against an existing dist/, never fail
```

Both **weigh** a build; neither makes one. `pnpm bundle-budget` (i.e. `--report`) suppresses the failure
exit for an over-budget build so you can read the whole table at once, but with no `app/dist/` at all it
still exits non-zero: there is nothing to report on, and pretending otherwise would be the same fail-open
this gate exists to prevent. Run a build first.

**It fails closed.** Every "could not measure this" path is a failure, not a skipped row: an unreadable or
unparsable `index.html` or `sw.js`, a precache manifest that yields zero entries, a referenced chunk that
is not on disk. A size gate whose parser quietly returns nothing is worse than no gate — the build stays
green and now carries a false assurance. Workbox and Vite own those output formats, so the parsers are
expected to break someday; when they do, the build stops rather than reporting `0.0 KiB`.

Sizes are **KiB (1024 bytes), uncompressed**, matching workbox's own precache report. Vite's build log
prints kB (1000 bytes), so the same chunk reads ~2.4% larger there. Uncompressed rather than gzip on
purpose: gzip flatters exactly the kind of growth this is meant to catch (more of the same code), and
the parse cost that dominates on a low-end device is paid on the decompressed bytes.

## The limits

| Class | Limit | Measured when set | What it protects |
|---|---|---|---|
| planner Web Worker, and **exactly one of them** | 1000 KiB | 903 KiB | The engine simulation core, shipped once |
| engine simulation core (`useProjection`) | 640 KiB | 572 KiB | The deterministic ledger the analysis pages share |
| Learning Center registry | 150 KiB | 124 KiB | Article *metadata* — bodies load per article |
| chart vendor (`CartesianChart`) | 380 KiB | 326 KiB | Recharts and its d3 slices |
| app entry (the script `index.html` loads) | 300 KiB | 248 KiB | The chunk a cold visit blocks on first |
| every other JS chunk | 260 KiB | 206 KiB (`PlanRoutes`) | Route and page chunks staying route-sized |
| all JS together | 4400 KiB | 4049 KiB | "Many new chunks", not just one fat one |
| one stylesheet / all CSS | 64 / 80 KiB | 45 / 52 KiB | The token layer |
| landing critical path | 700 KiB | 596 KiB | Entry + every `modulepreload`: what a cold visit blocks on |
| PWA precache | 4500 KiB | 4179 KiB | Install cost, and the offline guarantee's price |

Each limit is the size measured when the budget landed plus headroom, and the headroom is deliberately
uneven — read the table, not an average:

- The **aggregate** rows are tight, ~8–17%: the precache (4179 → 4500) and the landing critical path
  (596 → 700). These are the two numbers a reader actually pays, and they are the ones that drifted, so
  they get the least slack. Expect to justify growth here, not absorb it. The landing row's slack is
  sized so the entry and the registry could each grow into their own limits and still fit.
- The **per-class chunk** rows sit near 11–21% (worker 903 → 1000, `useProjection` 572 → 640,
  `learningRegistry` 124 → 150, Recharts 326 → 380): enough for a feature landing in a known chunk.
  `learningRegistry` now holds only metadata, about 0.9 KiB per article, so its 26 KiB of slack is
  roughly 25 more articles.
- The **loosest** rows are the ones with the most natural variation: the per-chunk default (206 → 260,
  ~29%) has to fit whatever the next route chunk turns out to weigh, and CSS (45 → 64, ~42%) is small
  enough that percentages there mean little in absolute terms.

The **exactly one worker** rule is the load-bearing one. A bundler builds every worker *entry* in its own
pass, so two entries cannot share a chunk — a second worker entry means a second copy of the ~740 KiB
engine core in `dist/` and in the precache. That is precisely how the app came to ship four of them
(3,147 KiB of near-identical code) before they were collapsed onto
[`workers/planner.worker.ts`](../../packages/planner-ui/src/workers/planner.worker.ts), which dispatches
on a channel tag instead. Off-thread work belongs on that entry, on a new channel. The same invariant is
asserted a second time, from the outside, by planner-ui's
[`pack-smoke.mjs`](../../packages/planner-ui/scripts/pack-smoke.mjs): a scratch Vite consumer of the
published tarball must emit exactly one worker chunk.

The worker is emitted as an ES-module graph because its one spawn site already uses
`{ type: 'module' }`. That lets selected, high-contract annual publication coordinators remain small
static chunks in both the app and worker graphs instead of forcing their explicit snapshot contracts
back into either already-tight entry. Those chunks stay precached; the split changes parsing and chunk
ownership, not the offline guarantee or the one-worker-entry invariant.

A chunk rolldown names differently after a refactor stops matching its row and falls through to the
260 KiB default. That is intended: a chunk that changed identity should be looked at, not silently
inherit a large allowance. The app entry is the exception — it is identified by the script `index.html`
actually loads, not by an `index-<hash>.js` name pattern, which would also match a dependency that
happens to have an `index.js` internal entry.

## What is *not* precached

The precache is what an install downloads and what an offline visit is guaranteed. Two heavyweight
things are deliberately runtime-cached instead (`runtimeCaching` in
[`app/vite.config.ts`](../../app/vite.config.ts)), and so do not count against the precache budget:

- the ~3 MB HiGHS wasm (optimizer solver) — cache-first, so Optimize works offline after its first
  online use;
- the ~5 MB of Learn illustrations (`/learn/images/*`) — cached as articles are read.

Everything else — the shell, every route chunk, the worker, the Learn article text — stays precached.
**The offline story for the core planner flows is not a budget lever.** Reducing the precache by dropping
core code out of it trades a product guarantee for a number; the reduction from 6.3 MB to 4.1 MB came
entirely from not shipping the same code four times.

## When the budget fails

In order of preference:

1. **Split it.** A page that only some readers open should be a `lazy()` route
   ([`routes/planPages.tsx`](../../packages/planner-ui/src/routes/planPages.tsx),
   [`routes/lazyPages.tsx`](../../packages/planner-ui/src/routes/lazyPages.tsx)), not an eager import in
   a shared chunk.
2. **Check for a duplicate.** Two chunks holding the same dependency usually means an import crossed a
   boundary it did not need to — a worker entry, an eager import from an entry module, a type-only
   import written as a value import.
3. **Raise the limit** (in [`bundleBudget.mjs`](../../app/scripts/bundleBudget.mjs)) **in the same commit,
   with the reason.** The budget is a measured limit, not a preference; a limit raised without a note is
   how the 6.3 MB happened. Never raise `chunkSizeWarningLimit` instead — that changes nothing about what
   ships.

If instead the failure says something is *unmeasured*, the parser broke: check what `vite build` now emits
into `dist/index.html` or what workbox writes into `dist/sw.js`, fix `parseLandingScripts` /
`parsePrecacheUrls`, and add the new shape to the fixtures in `bundleBudget.test.mjs`. Do not "fix" it by
letting the row disappear.

To see where a chunk's weight actually is, build with a plugin that dumps `chunk.modules` from
`generateBundle`, or run `pnpm dlx vite-bundle-visualizer` against `app/`. Neither is a committed
dependency; the budget is.

## The Learn content split

`learningRegistry` used to be 540 KiB (~157 KiB gzipped) and `modulepreload`ed on the landing page,
because the home page's "Start here" links and every `LearnLink` call `getArticle()` synchronously — for
a title and a slug-exists check — and each article carried its `blocks[]` body inline. Over half the
landing payload was article prose nothing on that page renders.

Metadata and body are now separate modules:

- [`learn/articleIndex.ts`](../../packages/planner-ui/src/learn/articleIndex.ts) holds every article's
  metadata and is statically imported, so it is what rides the landing path.
- [`learn/content/`](../../packages/planner-ui/src/learn/content) holds only `blocks[]` bodies, reached
  through the per-article `import()` map in
  [`learn/articleBodies.ts`](../../packages/planner-ui/src/learn/articleBodies.ts). A body is fetched
  when its article page renders, and nothing else pulls one.

That took `learningRegistry` from 540 to 124 KiB and the landing critical path from 1012 to 596 KiB. It
costs about 111 more chunks in `dist/` (78 → 189) and the same in the precache (98 → 209 entries), for
+27 KiB of total JS.

The precache still holds the same content, so what an offline visit can do is unchanged — but *installing*
it is now roughly twice as many requests, and a service-worker install is all-or-nothing: one failed
request fails the install, and the worker retries from scratch on the next visit rather than activating
half-populated. That is a slower, flakier first install on a bad connection, not a lost guarantee, and it
is the price of per-article chunks. If it ever shows up as a real install-failure rate, the lever is
grouping bodies (by category, say) to trade some of the on-demand granularity back for fewer files —
**not** dropping Learn text out of the precache, which would trade the product guarantee for a number.

Both rows were tightened to the new measurement in the same change. Putting article prose back into the
index — an eager import from `articleIndex.ts`, or an article body inlined on a metadata entry — is what
the `learningRegistry` row now exists to catch.
