import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Benchmark, Chemical, FullExperiment, NamedItem, RefTable, Person, Checkin, ExternalTest, LeaveRequest, WeeklyGoal, SupplierSample, Batch } from '../lib/types'
import { useAuth } from './AuthContext'

interface DataValue {
  loading: boolean
  experiments: FullExperiment[]
  chemicals: Chemical[]
  benchmarks: Benchmark[]
  supplierSamples: SupplierSample[]
  batches: Batch[]
  types: NamedItem[]
  processes: NamedItem[]
  measures: NamedItem[]
  results: NamedItem[]
  owners: string[]
  people: Person[]
  checkins: Checkin[]
  externalTests: ExternalTest[]
  leaveRequests: LeaveRequest[]
  weeklyGoals: WeeklyGoal[]
  refetchExperiments: () => Promise<void>
  refetchRefs: () => Promise<void>
  refetchTeam: () => Promise<void>
  addRef: (table: RefTable, name: string) => Promise<void>
  addChemicalByName: (name: string) => Promise<void>
}

const Ctx = createContext<DataValue>(null as unknown as DataValue)
export const useData = () => useContext(Ctx)

const EXP_SELECT = '*, experiment_materials(*), experiment_processes(*), experiment_results(*), experiment_observations(*)'

export function DataProvider({ children }: { children: ReactNode }) {
  const { isApproved } = useAuth()
  const [loading, setLoading] = useState(true)
  const [experiments, setExperiments] = useState<FullExperiment[]>([])
  const [chemicals, setChemicals] = useState<Chemical[]>([])
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([])
  const [supplierSamples, setSupplierSamples] = useState<SupplierSample[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [types, setTypes] = useState<NamedItem[]>([])
  const [processes, setProcesses] = useState<NamedItem[]>([])
  const [measures, setMeasures] = useState<NamedItem[]>([])
  const [results, setResults] = useState<NamedItem[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [externalTests, setExternalTests] = useState<ExternalTest[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>([])

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
    const { data: bm } = await supabase.from('benchmarks').select('*').order('name')
    setBenchmarks((bm as Benchmark[]) ?? [])
    const { data: ss } = await supabase.from('supplier_samples').select('*').order('name')
    setSupplierSamples((ss as SupplierSample[]) ?? [])
    const { data: ba } = await supabase.from('batches').select('*').order('created_at', { ascending: false })
    setBatches((ba as Batch[]) ?? [])
  }, [])

  const refetchTeam = useCallback(async () => {
    const [pe, ci, et, lr, wg] = await Promise.all([
      supabase.from('profiles').select('id,email,full_name,title,role,is_manager').order('full_name'),
      supabase.from('checkins').select('*').order('created_at', { ascending: false }).limit(400),
      supabase.from('external_tests').select('*').order('created_at', { ascending: false }),
      supabase.from('leave_requests').select('*').order('start_date', { ascending: false }),
      supabase.from('weekly_goals').select('*').order('week_start', { ascending: false }).limit(60),
    ])
    setPeople((pe.data as Person[]) ?? [])
    setCheckins((ci.data as Checkin[]) ?? [])
    setExternalTests((et.data as ExternalTest[]) ?? [])
    setLeaveRequests((lr.data as LeaveRequest[]) ?? [])
    setWeeklyGoals((wg.data as WeeklyGoal[]) ?? [])
  }, [])

  useEffect(() => {
    if (!isApproved) {
      setLoading(false)
      return
    }
    let active = true
    ;(async () => {
      setLoading(true)
      await Promise.all([refetchExperiments(), refetchRefs(), refetchTeam()])
      if (active) setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [isApproved, refetchExperiments, refetchRefs, refetchTeam])

  // Live sync — any change anyone makes triggers a debounced refresh
  const tExp = useRef<ReturnType<typeof setTimeout>>()
  const tRef = useRef<ReturnType<typeof setTimeout>>()
  const tTeam = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    if (!isApproved) return
    const bExp = () => { clearTimeout(tExp.current); tExp.current = setTimeout(refetchExperiments, 400) }
    const bRef = () => { clearTimeout(tRef.current); tRef.current = setTimeout(refetchRefs, 400) }
    const bTeam = () => { clearTimeout(tTeam.current); tTeam.current = setTimeout(refetchTeam, 400) }
    const channel = supabase
      .channel('dataroom-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'experiments' }, bExp)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'experiment_materials' }, bExp)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'experiment_processes' }, bExp)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'experiment_results' }, bExp)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'experiment_observations' }, bExp)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chemicals' }, bRef)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'experiment_types' }, bRef)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'process_names' }, bRef)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'measure_types' }, bRef)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'result_types' }, bRef)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'benchmarks' }, bRef)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_samples' }, bRef)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batches' }, bRef)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins' }, bTeam)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'external_tests' }, bTeam)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, bTeam)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_goals' }, bTeam)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, bTeam)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [isApproved, refetchExperiments, refetchRefs, refetchTeam])

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
    benchmarks,
    supplierSamples,
    batches,
    types,
    processes,
    measures,
    results,
    owners,
    people,
    checkins,
    externalTests,
    leaveRequests,
    weeklyGoals,
    refetchExperiments,
    refetchRefs,
    refetchTeam,
    addRef,
    addChemicalByName,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
