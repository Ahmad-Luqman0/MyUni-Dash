import { createContext } from 'react'

/** What every section can ask of the page: reload the data, or clear the filters that may be hiding it. */
export interface DashActions { retry: () => void; clearFilters: () => void; narrowed: string[] }
export const DashContext = createContext<DashActions>({ retry: () => {}, clearFilters: () => {}, narrowed: [] })
