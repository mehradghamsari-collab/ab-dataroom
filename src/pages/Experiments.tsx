import { useMemo, useState } from 'react'
import { Plus, Search, FlaskConical, SlidersHorizontal, ArrowDownUp, X } from 'lucide-react'
import { useData } from '../context/DataContext'
import type { FullExperiment } from '../lib/types'
import { ExperimentModal } from './ExperimentEditor'
import { FullLoader, EmptyState, TypePill, OwnerAvatar } from '../components/ui'
import { cx, fmtDate } from '../lib/utils'

type Sort = 'en_desc' | 'en_asc' | 'date_desc' | 'date_asc'
const FEATURED = ['FSC in saline (g/g)', 'CRC in saline (g/g)']

function resultMap(e: FullExperiment): Record<string, string> {
  const m: Record<string, string> = {}
  e.experiment_results.forEach((r) => {
    if (r.result_type && r.value != null && !(r.result_type in m)) m[r.result_type] = r.value
  })
  return m
}

function matchText(e: FullExperiment, q: string): boolean {
  if (!q) return true
  const hay = [
    e.en, e.description, e.owner, e.experiment_type, e.method,
    ...e.experiment_materials.map((m) => m.name),
    ...e.experiment_results.map((r) => `${r.result_type} ${r.value}`),
    ...e.experiment_processes.map((p) => p.process),
  ]
    .join(' ')
    .toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((tok) => hay.includes(tok))
}

export function Experiments() {
  const { experiments, loading, types, owners } = useData()
  const [q, setQ] = useState('')
  const [typeF, setTypeF] = useState<string[]>([])
  const [ownerF, setOwnerF] = useState<string[]>([])
  const [sort, setSort] = useState<Sort>('en_desc')
  const [showFilters, setShowFilters] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<FullExperiment | null>(null)
  const [mode, setMode] = useState<'view' | 'edit' | 'new'>('view')

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const list = useMemo(() => {
    let out = experiments.filter(
      (e) =>
        matchText(e, q) &&
        (typeF.length === 0 || (e.experiment_type && typeF.includes(e.experiment_type))) &&
        (ownerF.length === 0 || (e.owner && ownerF.includes(e.owner))),
    )
    out = [...out].sort((a, b) => {
      if (sort === 'en_desc') return (b.en ?? 0) - (a.en ?? 0)
      if (sort === 'en_asc') return (a.en ?? 0) - (b.en ?? 0)
      const da = a.date ?? '', db = b.date ?? ''
      return sort === 'date_desc' ? db.localeCompare(da) : da.localeCompare(db)
    })
    return out
  }, [experiments, q, typeF, ownerF, sort])

  const openExp = (e: FullExperiment) => {
    setActive(e)
    setMode('view')
    setOpen(true)
  }
  const openNew = () => {
    setActive(null)
    setMode('new')
    setOpen(true)
  }

  const activeFilters = typeF.length + ownerF.length

  if (loading) return <FullLoader label="Loading experiments" />

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Experiments</h1>
          <p className="mt-1 text-sm text-muted">
            <span className="data font-medium text-ink">{list.length}</span>
            {list.length !== experiments.length && <span className="text-subtle"> of {experiments.length}</span>} records
          </p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={17} /> New experiment
        </button>
      </div>

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-subtle" />
          <input
            className="field pl-9"
            placeholder="Search EN, description, chemical, owner…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          className={cx('btn-outline', activeFilters && 'border-brand-ring text-brand-dark')}
          onClick={() => setShowFilters((s) => !s)}
        >
          <SlidersHorizontal size={15} /> Filters
          {activeFilters > 0 && <span className="data ml-0.5 rounded bg-brand px-1.5 text-2xs text-white">{activeFilters}</span>}
        </button>
        <div className="relative">
          <select
            className="field cursor-pointer appearance-none pr-9"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
          >
            <option value="en_desc">EN ↓ (newest)</option>
            <option value="en_asc">EN ↑ (oldest)</option>
            <option value="date_desc">Date ↓</option>
            <option value="date_asc">Date ↑</option>
          </select>
          <ArrowDownUp size={14} className="pointer-events-none absolute right-3 top-3 text-subtle" />
        </div>
      </div>

      {showFilters && (
        <div className="mt-3 space-y-3 rounded-xl border border-line bg-surface p-3.5">
          <FilterGroup label="Type" options={types.map((t) => t.name)} selected={typeF} onToggle={(v) => toggle(typeF, v, setTypeF)} />
          <FilterGroup label="Owner" options={owners} selected={ownerF} onToggle={(v) => toggle(ownerF, v, setOwnerF)} />
          {activeFilters > 0 && (
            <button className="btn-ghost h-7 text-xs text-muted" onClick={() => { setTypeF([]); setOwnerF([]) }}>
              <X size={13} /> Clear filters
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="mt-5">
        {list.length === 0 ? (
          <EmptyState
            icon={<FlaskConical size={28} />}
            title={experiments.length === 0 ? 'No experiments yet' : 'No matches'}
            hint={experiments.length === 0 ? 'Create your first experiment to start the shared record.' : 'Try a different search or clear the filters.'}
            action={experiments.length === 0 ? <button className="btn-primary" onClick={openNew}><Plus size={16} /> New experiment</button> : undefined}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-xl border border-line bg-surface shadow-card md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper text-left text-2xs uppercase tracking-wider text-muted">
                    <th className="px-4 py-2.5 font-semibold">EN</th>
                    <th className="px-4 py-2.5 font-semibold">Date</th>
                    <th className="px-4 py-2.5 font-semibold">Owner</th>
                    <th className="px-4 py-2.5 font-semibold">Type</th>
                    <th className="px-4 py-2.5 font-semibold">Description</th>
                    {FEATURED.map((f) => (
                      <th key={f} className="px-4 py-2.5 text-right font-semibold">{f.replace(' (g/g)', '')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((e) => {
                    const rm = resultMap(e)
                    return (
                      <tr
                        key={e.id}
                        onClick={() => openExp(e)}
                        className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-brand-tint/40"
                      >
                        <td className="px-4 py-2.5"><span className="data font-semibold text-ink">EN{e.en}</span></td>
                        <td className="px-4 py-2.5 text-muted">{fmtDate(e.date)}</td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-2"><OwnerAvatar name={e.owner} size={22} /><span className="text-ink">{e.owner || '—'}</span></span>
                        </td>
                        <td className="px-4 py-2.5"><TypePill type={e.experiment_type} /></td>
                        <td className="max-w-[280px] truncate px-4 py-2.5 text-ink">{e.description || <span className="text-subtle">—</span>}</td>
                        {FEATURED.map((f) => (
                          <td key={f} className="px-4 py-2.5 text-right">
                            {rm[f] ? <span className="data font-medium">{rm[f]}</span> : <span className="text-subtle">—</span>}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2.5 md:hidden">
              {list.map((e) => {
                const rm = resultMap(e)
                return (
                  <button
                    key={e.id}
                    onClick={() => openExp(e)}
                    className="card flex w-full flex-col gap-2 p-3.5 text-left active:bg-brand-tint/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="data font-semibold text-ink">EN{e.en}</span>
                      <TypePill type={e.experiment_type} />
                    </div>
                    {e.description && <p className="text-sm font-medium text-ink">{e.description}</p>}
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <OwnerAvatar name={e.owner} size={18} />
                      <span>{e.owner || '—'}</span>
                      <span className="text-subtle">·</span>
                      <span>{fmtDate(e.date)}</span>
                    </div>
                    {FEATURED.some((f) => rm[f]) && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {FEATURED.filter((f) => rm[f]).map((f) => (
                          <span key={f} className="chip"><span>{f.replace(' (g/g)', '')}</span><span className="data font-semibold text-ink">{rm[f]}</span></span>
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      <ExperimentModal open={open} experiment={active} initialMode={mode} onClose={() => setOpen(false)} />
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
          <button
            key={o}
            onClick={() => onToggle(o)}
            className={cx(
              'rounded-full border px-3 py-1 text-xs font-medium transition',
              selected.includes(o) ? 'border-brand bg-brand-tint text-brand-dark' : 'border-line bg-paper text-muted hover:bg-black/[0.03]',
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}
