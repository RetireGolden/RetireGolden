/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({
  props: [] as Array<{ importEnabled?: boolean; importResolved?: boolean }>,
  resolveImport: undefined as undefined | ((enabled: boolean) => void),
}))

vi.mock('@retiregolden/planner-ui', () => ({
  PlannerApp: (props: { importEnabled?: boolean; importResolved?: boolean }) => {
    harness.props.push(props)
    return null
  },
}))

vi.mock('./importFeature', () => ({
  loadImportFeature: () =>
    new Promise<boolean>((resolve) => {
      harness.resolveImport = resolve
    }),
}))

import { HostApp } from './HostApp'

afterEach(() => {
  harness.props.length = 0
})

describe('HostApp import availability bootstrap', () => {
  it('mounts the shell fail closed as pending, then publishes the resolved result', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<HostApp />)
    })
    expect(harness.props.at(-1)).toMatchObject({ importEnabled: false, importResolved: false })

    await act(async () => {
      harness.resolveImport?.(true)
      await Promise.resolve()
    })
    expect(harness.props.at(-1)).toMatchObject({ importEnabled: true, importResolved: true })

    await act(async () => root.unmount())
    container.remove()
  })
})
