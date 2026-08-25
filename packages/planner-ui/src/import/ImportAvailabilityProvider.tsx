import type { ReactNode } from 'react'

import { ImportAvailabilityContext } from './importAvailability'

export function ImportAvailabilityProvider({
  enabled,
  children,
}: {
  enabled: boolean
  children: ReactNode
}) {
  return <ImportAvailabilityContext.Provider value={enabled}>{children}</ImportAvailabilityContext.Provider>
}
