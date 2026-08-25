import { createContext, useContext } from 'react'

export interface ImportAvailability {
  enabled: boolean
  resolved: boolean
}

export const ImportAvailabilityContext = createContext<ImportAvailability>({
  enabled: true,
  resolved: true,
})

export const IMPORT_UNAVAILABLE_MESSAGE =
  'File import is temporarily unavailable. You can keep using existing plans and export backups.'
export const IMPORT_PENDING_MESSAGE = 'Checking whether file import is available…'

/** Generic host capability. Omitted providers preserve the package's normal import behavior. */
export function useImportAvailability(): ImportAvailability {
  return useContext(ImportAvailabilityContext)
}

/** Generic host capability. Omitted providers preserve the package's normal import behavior. */
export function useImportEnabled(): boolean {
  return useImportAvailability().enabled
}
