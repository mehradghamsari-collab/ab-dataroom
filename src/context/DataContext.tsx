import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Chemical, FullExperiment, NamedItem, RefTable } from '../lib/types'
import { useAuth } from './AuthContext'

interface DataValue {
  loading: boolean
  experiments: FullExperiment[]
  chemicals: Chemical[]
  types: NamedItem[]
  processes: NamedItem[]
  measures: NamedItem[]
  results: NamedItem[]
  owners: string[]
  refetchExperiments: () => Promise<void>
  refetchRefs: () => Promise<void>
  addRef: (table: RefTable, name: string) => Promise<void>
  addChemicalByName: (name: string) => Promise<void>
}

const Ctx = createContext<DataValue>(null as unknown as DataValue)
export const useData = () => useContext(Ctx)

const EXP_SELECT =
  '*, experiment_materials(*), experiment_processes(*), experiment_results(*)'

export function DataProvider({ children }: { children: ReactNode }) {
  const { isApproved } = useAuth()
  const [loading, setLoading] = useState(true)
  const [experiments, setExperiments] = useState<FullExperiment[]>([])
  const [chemicals, setChemicals] = useState<Chemical[]>([])
  const [types, setTypes] = useState<NamedItem[]>([])
  const [processes, setProcesses] = useState<NamedItem[]>([])
  const [measures, setMeasures] = useState<NamedItem[]>([])
  const [results, setResults] = useState<NamedItem[]>([])

  const refetchExperiments = useCallback(async () => {
    const { data } = await supabase.from('experiments').select(EXP_SELECT).order('en', { ascending: false })
    setExperiments((data as FullExperiment[]) ?? [])
  }, [])

  const refetchRefs = useCallback(async () => {
    const tables: [RefTable, (v: NamedItem[]) => void][] = [
      ['experiment_types', setTypes],
      ['process_names', setProcesses],
      ['measure_types', setMeasures],
      ['result_types', setResults],
    ]
    await Promise.all(
      tables.map(async ([t, set]) => {
        const { data } = await supabase.from(t).select('*').order('name')
        set((data as NamedItem[]) ?? [])
      }),
    )
    const { data: chem } = await supabase.from('chemicals').select('*').order('name')
    setChemicals((chem as Chemical[]) ?? [])
  }, [])

  useEffect(() => {
    if (!isApproved) {
      setLoading(false)
      return
    }
    let active = true
    ;(async () => {
      setLoading(true)
      await Promise.all([refetchExperiments(), refetchRefs()])
      if (active) setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [isApproved, refetchExperiments, refetchRefs])

  // Live sync — any change anyone makes triggers a debounced refresh
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    if (!isApproved) return
    const debounce = (fn: () => void) => {
      clearTimeout(timer.current)
      timer.current = setTimeout(fn, 400)
    }
    const channel = supabase
      .channel('dataroom-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'experiments' }, () =>
        debounce(refetchExperiments),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'experiment_materials' }, () =>
        debounce(refetchExperiments),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'experiment_processes' }, () =>
        debounce(refetchExperiments),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'experiment_results' }, () =>
        debounce(refetchExperiments),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chemicals' }, () => debounce(refetchRefs))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'experiment_types' }, () =>
        debounce(refetchRefs),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'process_names' }, () => debounce(refetchRefs))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'measure_types' }, () => debounce(refetchRefs))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'result_types' }, () => debounce(refetchRefs))
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [isApproved, refetchExperiments, refetchRefs])

  const addRef = useCallback(
    async (table: RefTable, name: string) => {
      const { error } = await supabase.from(table).insert({ name })
      if (error && !error.message.includes('duplicate')) throw error
      await refetchRefs()
    },
    [refetchRefs],
  )

  const addChemicalByName = useCallback(
    async (name: string) => {
      const { error } = await supabase.from('chemicals').insert({ name })
      if (error) throw error
      await refetchRefs()
    },
    [refetchRefs],
  )

  const owners = useMemo(() => {
    const set = new Set<string>()
    experiments.forEach((e) => e.owner && set.add(e.owner))
    return [...set].sort()
  }, [experiments])

  const value: DataValue = {
    loading,
    experiments,
    chemicals,
    types,
    processes,
    measures,
    results,
    owners,
    refetchExperiments,
    refetchRefs,
    addRef,
    addChemicalByName,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
