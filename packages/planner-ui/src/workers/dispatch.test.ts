/**
 * The planner worker's routing, exercised directly.
 *
 * Every runner falls back to an in-process solve when `Worker` is undefined,
 * which is what a jsdom suite gets — so without this file the worker's own
 * channel arms have no coverage at all, and only Results/Monte Carlo are
 * touched in e2e. What is asserted here is the wiring that the fallback path
 * can never prove: each channel reaches its own runner, the response `type`
 * is the one that runner's `interpret` expects, the Monte Carlo sub-kinds
 * route apart, path buffers are handed over as transfers, and a throw becomes
 * an error message rather than a hung promise.
 *
 * The runners themselves are stubbed: their math is covered by their own
 * tests, and re-running a real projection here would test the engine again
 * instead of the dispatch.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../mc/runRequest', () => ({
  runMcRequest: vi.fn(),
  runFrontierRequest: vi.fn(() => 'frontier-result'),
  runHistoricalStressSuiteRequest: vi.fn(() => 'historical-result'),
  runRiskBasedGuardrailRequest: vi.fn(() => 'risk-based-result'),
}))
vi.mock('../optimize/runOptimize', () => ({ runOptimizeRequest: vi.fn() }))
vi.mock('../optimize/runSpendingSolve', () => ({ runSpendingSolveRequest: vi.fn(() => 'spending-result') }))
vi.mock('../relocation/runRelocation', () => ({ runRelocationCompareRequest: vi.fn(() => 'relocation-result') }))

import {
  runFrontierRequest,
  runHistoricalStressSuiteRequest,
  runMcRequest,
  runRiskBasedGuardrailRequest,
} from '../mc/runRequest'
import { runOptimizeRequest } from '../optimize/runOptimize'
import { runSpendingSolveRequest } from '../optimize/runSpendingSolve'
import { runRelocationCompareRequest } from '../relocation/runRelocation'
import { dispatchPlannerWorkerRequest, type PlannerWorkerRequest } from './dispatch'

type Posted = { msg: { type: string; [k: string]: unknown }; transfer?: Transferable[] }

function makeHost() {
  const posted: Posted[] = []
  return {
    posted,
    host: {
      post: (msg: { type: string }, transfer?: Transferable[]) => {
        posted.push({ msg: msg, transfer })
      },
      wasmUrl: () => '/assets/highs.wasm',
    },
  }
}

/** The dispatch only reads `channel`; each surface's payload is opaque to it. */
const envelope = (channel: string, request: unknown) => ({ channel, request }) as unknown as PlannerWorkerRequest

// `clearAllMocks` would clear the call log but keep implementations, so a
// per-test `mockImplementation` (the throwing runners below) would leak into
// whatever runs next. Reset everything and re-arm the defaults instead, so
// each test starts from the same place regardless of order.
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(runFrontierRequest).mockReturnValue('frontier-result' as never)
  vi.mocked(runHistoricalStressSuiteRequest).mockReturnValue('historical-result' as never)
  vi.mocked(runRiskBasedGuardrailRequest).mockReturnValue('risk-based-result' as never)
  vi.mocked(runSpendingSolveRequest).mockReturnValue('spending-result' as never)
  vi.mocked(runRelocationCompareRequest).mockReturnValue('relocation-result' as never)
  vi.mocked(runOptimizeRequest).mockResolvedValue('optimize-result' as never)
  vi.mocked(runMcRequest).mockReturnValue({ paths: [] } as never)
})

describe('channel routing', () => {
  it('sends spendingSolve to the spending solver and answers `done`', async () => {
    const { posted, host } = makeHost()
    await dispatchPlannerWorkerRequest(envelope('spendingSolve', { plan: 'p', startYear: 2026 }), host)

    expect(runSpendingSolveRequest).toHaveBeenCalledWith({ plan: 'p', startYear: 2026 })
    expect(runRelocationCompareRequest).not.toHaveBeenCalled()
    expect(posted).toEqual([{ msg: { type: 'done', result: 'spending-result' }, transfer: undefined }])
  })

  it('sends relocation to the relocation sweep and answers `done`', async () => {
    const { posted, host } = makeHost()
    await dispatchPlannerWorkerRequest(envelope('relocation', { plan: 'p', candidates: [] }), host)

    expect(runRelocationCompareRequest).toHaveBeenCalledWith({ plan: 'p', candidates: [] })
    expect(runSpendingSolveRequest).not.toHaveBeenCalled()
    expect(posted).toEqual([{ msg: { type: 'done', result: 'relocation-result' }, transfer: undefined }])
  })

  it('sends optimize to the optimizer, handing it the wasm URL', async () => {
    const { posted, host } = makeHost()
    await dispatchPlannerWorkerRequest(envelope('optimize', { plan: 'p' }), host)

    expect(runOptimizeRequest).toHaveBeenCalledTimes(1)
    const [request, wasmUrl] = vi.mocked(runOptimizeRequest).mock.calls[0]
    expect(request).toEqual({ plan: 'p' })
    expect((wasmUrl as () => string)()).toBe('/assets/highs.wasm')
    expect(posted).toEqual([{ msg: { type: 'done', result: 'optimize-result' }, transfer: undefined }])
  })

  it('rejects an unknown channel instead of silently doing nothing', async () => {
    const { posted, host } = makeHost()
    await expect(dispatchPlannerWorkerRequest(envelope('nope', {}), host)).rejects.toThrow(
      /Unknown planner worker channel: nope/,
    )
    expect(posted).toEqual([])
  })
})

describe('the monteCarlo channel routes its four request kinds apart', () => {
  it.each([
    ['frontiers', 'frontiersDone', 'frontier-result', runFrontierRequest],
    ['historicalSuites', 'historicalSuitesDone', 'historical-result', runHistoricalStressSuiteRequest],
    ['riskBasedGuardrails', 'riskBasedDone', 'risk-based-result', runRiskBasedGuardrailRequest],
  ])('%s answers `%s`', async (kind, responseType, result, runner) => {
    const { posted, host } = makeHost()
    await dispatchPlannerWorkerRequest(envelope('monteCarlo', { kind }), host)

    expect(runner).toHaveBeenCalledTimes(1)
    expect(posted).toEqual([{ msg: { type: responseType, result }, transfer: undefined }])
  })

  it('transfers the path buffers on a plain monteCarlo run rather than copying them', async () => {
    const paths = [
      { investableByYear: new Float64Array([1, 2]) },
      { investableByYear: new Float64Array([3, 4]) },
    ]
    vi.mocked(runMcRequest).mockReturnValue({ paths } as never)
    const { posted, host } = makeHost()

    await dispatchPlannerWorkerRequest(envelope('monteCarlo', { kind: 'monteCarlo', progressEvery: 10 }), host)

    expect(posted).toHaveLength(1)
    expect(posted[0].msg.type).toBe('done')
    expect(posted[0].transfer).toEqual(paths.map((p) => p.investableByYear.buffer))
  })

  it('streams progress only on the requested interval', async () => {
    vi.mocked(runMcRequest).mockImplementation(((_req: unknown, onProgress: (n: number) => void) => {
      for (let completed = 1; completed <= 20; completed++) onProgress(completed)
      return { paths: [] }
    }) as never)
    const { posted, host } = makeHost()

    await dispatchPlannerWorkerRequest(envelope('monteCarlo', { kind: 'monteCarlo', progressEvery: 10 }), host)

    const progress = posted.filter((p) => p.msg.type === 'progress').map((p) => p.msg.completed)
    expect(progress).toEqual([10, 20])
  })

  it('reports risk-based guardrail progress as it solves', async () => {
    vi.mocked(runRiskBasedGuardrailRequest).mockImplementation(((
      _req: unknown,
      onProgress: (n: number) => void,
    ) => {
      onProgress(5)
      return 'risk-based-result'
    }) as never)
    const { posted, host } = makeHost()

    await dispatchPlannerWorkerRequest(envelope('monteCarlo', { kind: 'riskBasedGuardrails' }), host)

    expect(posted.map((p) => p.msg.type)).toEqual(['progress', 'riskBasedDone'])
  })
})

describe('failures', () => {
  it.each([
    ['spendingSolve', runSpendingSolveRequest],
    ['relocation', runRelocationCompareRequest],
  ])('propagates a %s runner throw so the entry can post an error', async (channel, runner) => {
    vi.mocked(runner).mockImplementation(() => {
      throw new Error('solver blew up')
    })
    const { posted, host } = makeHost()

    await expect(dispatchPlannerWorkerRequest(envelope(channel, {}), host)).rejects.toThrow('solver blew up')
    expect(posted).toEqual([])
  })

  it('propagates a rejected optimize solve', async () => {
    vi.mocked(runOptimizeRequest).mockRejectedValue(new Error('wasm missing'))
    const { host } = makeHost()

    await expect(dispatchPlannerWorkerRequest(envelope('optimize', {}), host)).rejects.toThrow('wasm missing')
  })
})
