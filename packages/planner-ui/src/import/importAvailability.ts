import { createContext, useContext } from 'react'

export const ImportAvailabilityContext = createContext(true)

export const IMPORT_UNAVAILABLE_MESSAGE =
  'File import is temporarily unavailable. You can keep using existing plans and export backups.'

/** Generic host capability. Omitted providers preserve the package's normal import behavior. */
export function useImportEnabled(): boolean {
  return useContext(ImportAvailabilityContext)
}
