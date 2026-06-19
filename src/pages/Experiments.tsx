import { useMemo, useState } from 'react'
import { Plus, Search, FlaskConical, SlidersHorizontal, ArrowDownUp, X, User, ClipboardPaste, CheckSquare, Trash2, Check } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import type { FullExperiment } from '../lib/types'
import { ExperimentModal } from './ExperimentEditor'
import { ImportModal } from './ImportExperiments'
import { FullLoader, EmptyState, TypePill, OwnerAvatar, MetricPill, Segmented, Spinner, useToast, useConfirm } from '../components/ui'
import { supabase } from '../lib/supabase'
import { sampleMetrics } from '../lib/metrics'
import { PROJECTS, projectByCode } from '../lib/projects'
import { cx, fmtDate } from '../lib/utils'

type Sort = 'en_desc' | 'en_asc' | 'date_desc' | 'date_asc'
type Status = 'all' | 'active' | 'discontinued'

function matchText(e: FullExperiment, q: string): boolean {
  if (!q) return true
  const hay = [
    e.en, e.description, e.owner, e.experiment_type, e.method,
    ...e.experiment_materials.map((m) => m.name),
    ...e.experiment_results.map((r) => `${r.result_type} ${r.value}`),
    ...e.experiment_processes.map((p) => p.process),
  ].join(' ').toLowerCase()
  return q.toLowerCase().split(/\s+/).every((tok) => hay.includes(tok))
}

export function Experiments() {
  const { experiments, loading, types, owners, refetchExperiments } = useData()
  const { profile } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [q, setQ] = useState('')
  const [typeF, setTypeF] = useState<string[]>([])
  const [ownerF, setOwnerF] = useState<string[]>([])
  const [projectF, setProjectF] = useState<string[]>([])
  const [status, setStatus] = useState<Status>('all')
  const [mine, setMine] = useState(false)
  const [sort, setSort] = useState<Sort>('en_desc')
  const [showFilters, setShowFilters] = useState(false)
  const [open, setOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [active, setActive] = useState<FullExperiment | null>(null)
  const [mode, setMode] = useState<'view' | 'edit' | 'new'>('view')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busyDel, setBusyDel] = useState(false)

  const myKeys = useMemo(() => {
    const out = new Set<string>()
    if (profile?.full_name) out.add(profile.full_name.toLowerCase())
    if (profile?.email) out.add(profile.email.split('@')[0].toLowerCase())
    return out
  }, [profile])

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const list = useMemo(() => {
    let out = experiments.filter(
      (e) =>
        matchText(e, q) &&
        (typeF.length === 0 || (e.experiment_type && typeF.includes(e.experiment_type))) &&
        (ownerF.length === 0 || (e.owner && ownerF.includes(e.owner))) &&
        (projectF.length === 0 || (e.project && projectF.includes(e.project))) &&
        (status === 'all' || (status === 'discontinued' ? e.discontinued : !e.discontinued)) &&
        (!mine || (e.owner && myKeys.has(e.owner.toLowerCase()))),
    )
    out = [...out].sort((a, b) => {
      if (sort === 'en_desc') return (b.en ?? 0) - (a.en ?? 0)
      if (sort === 'en_asc') return (a.en ?? 0) - (b.en ?? 0)
      const da = a.date ?? '', db = b.date ?? ''
      return sort === 'date_desc' ? db.localeCompare(da) : da.localeCompare(db)
    })
    return out
  }, [experiments, q, typeF, ownerF, projectF, status, mine, myKeys, sort])

  const openExp = (e: FullExperiment) => { setActive(e); setMode('view'); setOpen(true) }
  const openNew = () => { setActive(null); setMode('new'); setOpen(true) }
  const activeFilters = typeF.length + ownerF.length + projectF.length + (status !== 'all' ? 1 : 0)

  const shown = useMemo(() => list.slice(0, 400), [list])
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allShownSelected = shown.length > 0 && shown.every((e) => selected.has(e.id))
  const toggleAll = () => setSelected((s) => { const n = new Set(s); if (allShownSelected) shown.forEach((e) => n.delete(e.id)); else shown.forEach((e) => n.add(e.id)); return n })
  const exitSelect = () => { setSelecting(false); setSelected(new Set()) }
  const onRowClick = (e: FullExperiment) => { if (selecting) toggleSel(e.id); else openExp(e) }
  const deleteSelected = async () => {
    const ids = [...selected]; if (!ids.length) return
    const ok = await confirm({ title: `Delete ${ids.length} experiment${ids.length === 1 ? '' : 's'}?`, message: 'This permanently removes the selected experiments and all of their chemicals, processes, results and observations. This cannot be undone.', confirmLabel: `Delete ${ids.length}`, danger: true })
    if (!ok) return
    setBusyDel(true)
    try {
      const { data, error } = await supabase.from('experiments').delete().in('id', ids).select('id')
      if (error) throw error
      const n = (data as any[])?.length ?? 0
      await refetchExperiments()
      exitSelect()
      toast(n === ids.length ? `Deleted ${n} experiment${n === 1 ? '' : 's'}` : `Deleted ${n} of ${ids.length} — the rest aren't yours to remove`, n > 0 ? 'ok' : 'err')
    } catch (e: any) { toast(e?.message ?? 'Delete failed', 'err') } finally { setBusyDel(false) }
  }

  if (loading) return <FullLoader label="Loading experiments" />

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3 animate-fadeUp">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Experiments</h1>
          <p className="mt-1 text-sm text-muted"><span className="data font-medium text-ink">{list.length}</span>{list.length !== experiments.length && <span className="text-subtle"> of {experiments.length}</span>} records</p>
        </div>
        <div className="flex items-center gap-2">
          {experiments.length > 0 && (selecting
            ? <button className="btn-ghost" onClick={exitSelect}><X size={16} /> Done</button>
            : <button className="btn-outline" onClick={() => setSelecting(true)}><CheckSquare size={16} /> Select</button>)}
          <button className="btn-outline" onClick={() => setImporting(true)}><ClipboardPaste size={16} /> Paste import</button>
          <button className="btn-primary" onClick={openNew}><Plus size={17} /> New experiment</button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 animate-fadeUp" style={{ animationDelay: '40ms' }}>
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-subtle" />
          <input className="field pl-9" placeholder="Search EN, description, chemical, owner…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button onClick={() => setMine((m) => !m)} className={cx('btn-outline', mine && 'border-brand bg-brand-tint text-brand-dark')}><User size={15} /> Mine</button>
        <button className={cx('btn-outline', activeFilters && 'border-brand-ring text-brand-dark')} onClick={() => setShowFilters((s) => !s)}>
          <SlidersHorizontal size={15} /> Filters{activeFilters > 0 && <span className="data ml-0.5 rounded bg-brand px-1.5 text-2xs text-white">{activeFilters}</span>}
        </button>
        <div className="relative">
          <select className="field cursor-pointer appearance-none pr-9" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="en_desc">EN ↓ (newest)</option>
            <option value="en_asc">EN ↑ (oldest)</option>
            <option value="date_desc">Date ↓</option>
            <option value="date_asc">Date ↑</option>
          </select>
          <ArrowDownUp size={14} className="pointer-events-none absolute right-3 top-3 text-subtle" />
        </div>
      </div>

      {showFilters && (
        <div className="mt-3 space-y-3 rounded-xl border border-line bg-surface p-3.5 animate-scaleIn">
          <div>
            <div className="label mb-1.5">Status</div>
            <Segmented value={status} onChange={(v) => setStatus(v as Status)} size="sm" options={[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'discontinued', label: 'Discontinued' }]} />
          </div>
          <FilterGroup label="Type" options={types.map((t) => t.name)} selected={typeF} onToggle={(v) => toggle(typeF, v, setTypeF)} />
          <FilterGroup label="Owner" options={owners} selected={ownerF} onToggle={(v) => toggle(ownerF, v, setOwnerF)} />
          <div>
            <div className="label mb-1.5">Work package</div>
            <div className="flex flex-wrap gap-1.5">
              {PROJECTS.map((p) => {
                const on = projectF.includes(p.code)
                return (
                  <button key={p.code} onClick={() => toggle(projectF, p.code, setProjectF)} className={cx('rounded-full border px-3 py-1 text-xs font-medium transition', on ? 'text-white' : 'border-line bg-paper text-muted hover:bg-black/[0.03]')} style={on ? { background: p.color, borderColor: p.color } : undefined}>
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>
          {(activeFilters > 0 || mine) && (
            <button className="btn-ghost h-7 text-xs text-muted" onClick={() => { setTypeF([]); setOwnerF([]); setProjectF([]); setStatus('all'); setMine(false) }}><X size={13} /> Clear all</button>
          )}
        </div>
      )}

      <div className="mt-5">
        {list.length === 0 ? (
          <EmptyState icon={<FlaskConical size={28} />} title={experiments.length === 0 ? 'No experiments yet' : 'No matches'} hint={experiments.length === 0 ? 'Create your first experiment to start the shared record.' : 'Try a different search or clear the filters.'} action={experiments.length === 0 ? <button className="btn-primary" onClick={openNew}><Plus size={16} /> New experiment</button> : undefined} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-xl border border-line bg-surface shadow-card md:block animate-fadeUp">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper text-left text-2xs uppercase tracking-wider text-muted">
                    {selecting && <th className="w-10 px-3 py-2.5"><input type="checkbox" checked={allShownSelected} onChange={toggleAll} className="h-4 w-4 cursor-pointer accent-brand align-middle" title="Select all shown" /></th>}
                    <th className="px-4 py-2.5 font-semibold">EN</th>
                    <th className="px-4 py-2.5 font-semibold">Date</th>
                    <th className="px-4 py-2.5 font-semibold">Owner</th>
                    <th className="px-4 py-2.5 font-semibold">Type</th>
                    <th className="px-4 py-2.5 font-semibold">Description</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Results</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((e) => {
                    const m = sampleMetrics(e)
                    return (
                      <tr key={e.id} onClick={() => onRowClick(e)} className={cx('cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-brand-tint/40', selected.has(e.id) && 'bg-brand-tint/70', e.discontinued && 'opacity-60')}>
                        {selecting && <td className="px-3 py-2.5" onClick={(ev) => { ev.stopPropagation(); toggleSel(e.id) }}><input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSel(e.id)} className="h-4 w-4 cursor-pointer accent-brand align-middle" /></td>}
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-2">
                            {e.project && projectByCode(e.project) && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: projectByCode(e.project)!.color }} title={projectByCode(e.project)!.label} />}
                            <span className="data font-semibold text-ink">EN{e.en}</span>
                            {e.discontinued && <span className="pill bg-black/[0.06] text-muted">disc.</span>}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted">{fmtDate(e.date)}</td>
                        <td className="px-4 py-2.5"><span className="flex items-center gap-2"><OwnerAvatar name={e.owner} size={22} /><span className="text-ink">{e.owner || '—'}</span></span></td>
                        <td className="px-4 py-2.5"><TypePill type={e.experiment_type} /></td>
                        <td className="max-w-[260px] truncate px-4 py-2.5 text-ink">{e.description || <span className="text-subtle">—</span>}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1">
                            {(['FSC', 'CRC', 'AUP'] as const).map((key) => m[key] !== null && <MetricPill key={key} k={key} value={m[key]} size="sm" />)}
                            {m.FSC === null && m.CRC === null && m.AUP === null && <span className="text-subtle">—</span>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {list.length > 400 && <div className="border-t border-line bg-paper px-4 py-2 text-center text-2xs text-subtle">Showing first 400 — refine with search or filters to see more.</div>}
            </div>

            {/* Mobile cards */}
            <div className="space-y-2.5 md:hidden">
              {shown.slice(0, 200).map((e, i) => {
                const m = sampleMetrics(e)
                return (
                  <button key={e.id} onClick={() => onRowClick(e)} className={cx('card-hover stagger flex w-full flex-col gap-2 p-3.5 text-left', selected.has(e.id) && 'ring-2 ring-brand', e.discontinued && 'opacity-70')} style={{ ['--i' as any]: Math.min(i, 12) }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        {selecting && <span className={cx('grid h-4 w-4 place-items-center rounded border', selected.has(e.id) ? 'border-brand bg-brand text-white' : 'border-line')}>{selected.has(e.id) && <Check size={11} />}</span>}
                        <span className="data font-semibold text-ink">EN{e.en}</span>
                      </span>
                      <TypePill type={e.experiment_type} />
                    </div>
                    {e.description && <p className="text-sm font-medium text-ink">{e.description}</p>}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <OwnerAvatar name={e.owner} size={18} /><span>{e.owner || '—'}</span><span className="text-subtle">·</span><span>{fmtDate(e.date)}</span>
                      {e.project && projectByCode(e.project) && <span className="pill" style={{ background: projectByCode(e.project)!.color + '1A', color: projectByCode(e.project)!.color }}>{projectByCode(e.project)!.code}</span>}
                      {e.discontinued && <span className="pill bg-black/[0.06] text-muted">discontinued</span>}
                    </div>
                    {(m.FSC !== null || m.CRC !== null || m.AUP !== null) && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">{(['FSC', 'CRC', 'AUP'] as const).map((key) => m[key] !== null && <MetricPill key={key} k={key} value={m[key]} size="sm" />)}</div>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {selecting && (
        <div className="pointer-events-none sticky bottom-4 z-30 mt-4 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-line bg-surface px-4 py-2 shadow-lg animate-fadeUp">
            <span className="text-sm"><span className="data font-semibold text-ink">{selected.size}</span> selected</span>
            <button className="btn-ghost h-8 px-2.5 text-xs" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>Clear</button>
            <button className="btn-danger h-8 px-3 text-xs" onClick={deleteSelected} disabled={selected.size === 0 || busyDel}>{busyDel ? <Spinner className="h-4 w-4" /> : <><Trash2 size={14} /> Delete</>}</button>
          </div>
        </div>
      )}

      <ExperimentModal open={open} experiment={active} initialMode={mode} onClose={() => setOpen(false)} />
      <ImportModal open={importing} onClose={() => setImporting(false)} />
    </div>
  )
}

function FilterGroup({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  if (options.length === 0) return null
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o} onClick={() => onToggle(o)} className={cx('rounded-full border px-3 py-1 text-xs font-medium transition', selected.includes(o) ? 'border-brand bg-brand-tint text-brand-dark' : 'border-line bg-paper text-muted hover:bg-black/[0.03]')}>{o}</button>
        ))}
      </div>
    </div>
  )
}
