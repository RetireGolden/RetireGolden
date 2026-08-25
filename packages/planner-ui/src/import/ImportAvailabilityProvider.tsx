import type { ReactNode } from 'react'

import { ImportAvailabilityContext } from './importAvailability'

export function ImportAvailabilityProvider({
  enabled,
  resolved = true,
  children,
}: {
  enabled: boolean
  resolved?: boolean
  children: ReactNode
}) {
  return (
    <ImportAvailabilityContext.Provider value={{ enabled: resolved && enabled, resolved }}>
      {children}
    </ImportAvailabilityContext.Provider>
  )
}
