# Bundle budget: what the built app is allowed to weigh

RetireGolden is an offline-first PWA. Everything a reader can do, they do with code already on the
device — so bundle size is not a page-speed nicety here, it is the install cost and the parse cost on
whatever phone the reader owns. The app had drifted to a 6.3 MB precache before anyone measured it,
because the only signal was Vite's `chunkSizeWarningLimit`, which prints a warning nobody fails on.

[`app/scripts/check-bundle-budget.mjs`](../../app/scripts/check-bundle-budget.mjs) is the gate. It runs
as part of `pnpm --filter retiregolden-web build`, straight after `vite build`, and exits non-zero when
`dist/` is over budget — so the build, and therefore CI and the deploy, fail rather than warn.

```bash
pnpm build                 # the budget runs inside the app build
pnpm bundle-budget         # print the table against an existing dist/, never fail
```

Sizes are **KiB (1024 bytes), uncompressed**, matching workbox's own precache report. Vite's build log
prints kB (1000 bytes), so the same chunk reads ~2.4% larger there. Uncompressed rather than gzip on
purpose: gzip flatters exactly the kind of growth this is meant to catch (more of the same code), and
the parse cost that dominates on a low-end device is paid on the decompressed bytes.

## The limits

| Class | Limit | Measured when set | What it protects |
|---|---|---|---|
| planner Web Worker, and **exactly one of them** | 1000 KiB | 903 KiB | The engine simulation core, shipped once |
| engine simulation core (`useProjection`) | 640 KiB | 572 KiB | The deterministic ledger the analysis pages share |
| Learning Center registry | 600 KiB | 540 KiB | Article prose |
| chart vendor (`CartesianChart`) | 380 KiB | 326 KiB | Recharts and its d3 slices |
| app entry (`index`), exactly one | 300 KiB | 248 KiB | What a cold visit blocks on |
| every other JS chunk | 260 KiB | 201 KiB (`PlanRoutes`) | Route and page chunks staying route-sized |
| all JS together | 4400 KiB | 4022 KiB | "Many new chunks", not just one fat one |
| one stylesheet / all CSS | 64 / 80 KiB | 45 / 52 KiB | The token layer |
| landing critical path | 1100 KiB | 1012 KiB | Entry + every `modulepreload`: what a cold visit blocks on |
| PWA precache | 4500 KiB | 4152 KiB | Install cost, and the offline guarantee's price |

Each limit is the size measured when the budget landed plus roughly 10–25% headroom: ordinary feature
work fits, a structural regression does not.

The **exactly one worker** rule is the load-bearing one. A bundler builds every worker *entry* in its own
pass, so two entries cannot share a chunk — a second worker entry means a second copy of the ~740 KiB
engine core in `dist/` and in the precache. That is precisely how the app came to ship four of them
(3,147 KiB of near-identical code) before they were collapsed onto
[`workers/planner.worker.ts`](../../packages/planner-ui/src/workers/planner.worker.ts), which dispatches
on a channel tag instead. Off-thread work belongs on that entry, on a new channel.

A chunk rolldown names differently after a refactor stops matching its row and falls through to the
260 KiB default. That is intended: a chunk that changed identity should be looked at, not silently
inherit a large allowance.

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
3. **Raise the limit, in the same commit, with the reason.** The budget is a measured limit, not a
   preference; a limit raised without a note is how the 6.3 MB happened. Never raise
   `chunkSizeWarningLimit` instead — that changes nothing about what ships.

To see where a chunk's weight actually is, build with a plugin that dumps `chunk.modules` from
`generateBundle`, or run `pnpm dlx vite-bundle-visualizer` against `app/`. Neither is a committed
dependency; the budget is.

## Known, and not fixed here

`learningRegistry` (540 KiB, ~157 KiB gzipped) is `modulepreload`ed on the landing page, because the home
page's "Start here" links and every `LearnLink` call `getArticle()` synchronously — for a title and a
slug-exists check. The chunk is over half the landing payload and almost all of it is article prose that
nothing on that page renders. Fixing it means separating each article's metadata from its `blocks[]`
across the ~110 modules in [`learn/content/`](../../packages/planner-ui/src/learn/content) and making the
registry's article-body access asynchronous. That is a content-model change, not a packaging one, so it
is deliberately out of scope for the budget work and tracked separately.

Which is why the landing critical path is the one number the splits did **not** move: 1,035 kB before,
1,036 kB after. Everything else got materially smaller; that row is a ratchet holding the line until the
Learn content is split.
