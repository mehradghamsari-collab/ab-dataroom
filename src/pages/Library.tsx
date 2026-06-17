import { useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Beaker } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import type { Chemical, NamedItem, RefTable } from '../lib/types'
import { Modal, Spinner, EmptyState, useToast, useConfirm, FullLoader } from '../components/ui'
import { cx } from '../lib/utils'

type Tab = 'chemicals' | RefTable
const TABS: { key: Tab; label: string }[] = [
  { key: 'chemicals', label: 'Chemicals' },
  { key: 'experiment_types', label: 'Experiment types' },
  { key: 'process_names', label: 'Processes' },
  { key: 'measure_types', label: 'Measures' },
  { key: 'result_types', label: 'Results' },
]

export function Library() {
  const { loading } = useData()
  const [tab, setTab] = useState<Tab>('chemicals')
  if (loading) return <FullLoader label="Loading library" />

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
      <p className="mt-1 text-sm text-muted">The shared vocabulary behind every experiment. Anything you add here becomes selectable when logging.</p>

      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cx(
              '-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition',
              tab === t.key ? 'border-brand text-brand-dark' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'chemicals' ? <Chemicals /> : <NamedList table={tab} />}
      </div>
    </div>
  )
}

/* ----------------------------- Chemicals ----------------------------- */
const empty: Partial<Chemical> = { name: '', supplier: '', full_name: '', cas_no: '', comments: '' }

function Chemicals() {
  const { chemicals, refetchRefs } = useData()
  const { isAdmin } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Partial<Chemical>>(empty)
  const [busy, setBusy] = useState(false)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    const arr = s
      ? chemicals.filter((c) => [c.name, c.supplier, c.full_name, c.cas_no, c.comments].join(' ').toLowerCase().includes(s))
      : chemicals
    return arr
  }, [chemicals, q])

  const openNew = () => { setDraft(empty); setOpen(true) }
  const openEdit = (c: Chemical) => { setDraft(c); setOpen(true) }

  const save = async () => {
    if (!draft.name?.trim()) return
    setBusy(true)
    try {
      const payload = {
        name: draft.name.trim(),
        supplier: draft.supplier || null,
        full_name: draft.full_name || null,
        cas_no: draft.cas_no || null,
        comments: draft.comments || null,
      }
      const { error } = draft.id
        ? await supabase.from('chemicals').update(payload).eq('id', draft.id)
        : await supabase.from('chemicals').insert(payload)
      if (error) throw error
      await refetchRefs()
      toast(draft.id ? 'Chemical updated' : 'Chemical added')
      setOpen(false)
    } catch (e: any) {
      toast(e?.message ?? 'Could not save', 'err')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (c: Chemical) => {
    if (!(await confirm({ title: `Delete ${c.name}?`, message: 'Existing experiments keep their recorded names; this only removes it from the picker.', confirmLabel: 'Delete', danger: true }))) return
    const { error } = await supabase.from('chemicals').delete().eq('id', c.id)
    if (error) toast(error.message, 'err')
    else { await refetchRefs(); toast('Chemical deleted') }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-subtle" />
          <input className="field pl-9" placeholder="Search chemicals…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="data text-sm text-muted">{list.length}</span>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Add chemical</button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-2xs uppercase tracking-wider text-muted">
              <th className="px-4 py-2.5 font-semibold">Name</th>
              <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Supplier</th>
              <th className="hidden px-4 py-2.5 font-semibold md:table-cell">CAS no.</th>
              <th className="w-20 px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="group border-b border-line last:border-0 hover:bg-paper">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-ink">{c.name}</div>
                  {c.full_name && <div className="text-xs text-subtle">{c.full_name}</div>}
                </td>
                <td className="hidden px-4 py-2.5 text-muted sm:table-cell">{c.supplier || '—'}</td>
                <td className="hidden px-4 py-2.5 md:table-cell"><span className="data text-muted">{c.cas_no || '—'}</span></td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                    <button className="btn-ghost h-8 w-8 p-0 text-muted" onClick={() => openEdit(c)} aria-label="Edit"><Pencil size={15} /></button>
                    {isAdmin && <button className="btn-ghost h-8 w-8 p-0 text-muted hover:text-danger" onClick={() => remove(c)} aria-label="Delete"><Trash2 size={15} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div className="p-8"><EmptyState icon={<Beaker size={26} />} title="No chemicals found" hint="Add a chemical or adjust your search." /></div>}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={draft.id ? 'Edit chemical' : 'Add chemical'}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={busy || !draft.name?.trim()}>{busy ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field label="Name" hint="Include batch / grade so it's identifiable, e.g. CMC (Sigma, 2024, DS=0.9, Mw 250,000)">
            <input className="field" value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
          </Field>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Supplier"><input className="field" value={draft.supplier ?? ''} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} /></Field>
            <Field label="CAS no."><input className="field data" value={draft.cas_no ?? ''} onChange={(e) => setDraft({ ...draft, cas_no: e.target.value })} /></Field>
          </div>
          <Field label="Full name"><input className="field" value={draft.full_name ?? ''} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} /></Field>
          <Field label="Comments"><textarea className="field min-h-[72px] resize-y" value={draft.comments ?? ''} onChange={(e) => setDraft({ ...draft, comments: e.target.value })} /></Field>
        </div>
      </Modal>
    </>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-2xs text-subtle">{hint}</p>}
    </div>
  )
}

/* ----------------------------- Named lists ----------------------------- */
function NamedList({ table }: { table: RefTable }) {
  const data = useData()
  const { isAdmin } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState('')
  const [busy, setBusy] = useState(false)

  const items: NamedItem[] =
    table === 'experiment_types' ? data.types : table === 'process_names' ? data.processes : table === 'measure_types' ? data.measures : data.results

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? items.filter((i) => i.name.toLowerCase().includes(s)) : items
  }, [items, q])

  const add = async () => {
    const name = adding.trim()
    if (!name) return
    setBusy(true)
    try {
      await data.addRef(table, name)
      setAdding('')
      toast('Added')
    } catch (e: any) {
      toast(e?.message ?? 'Could not add', 'err')
    } finally {
      setBusy(false)
    }
  }
  const remove = async (it: NamedItem) => {
    if (!(await confirm({ title: `Delete “${it.name}”?`, message: 'Existing experiments keep their recorded values; this only removes it from the picker.', confirmLabel: 'Delete', danger: true }))) return
    const { error } = await supabase.from(table).delete().eq('id', it.id)
    if (error) toast(error.message, 'err')
    else { await data.refetchRefs(); toast('Deleted') }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-subtle" />
          <input className="field pl-9" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="data text-sm text-muted">{list.length}</span>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          className="field"
          placeholder="Add a new option…"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn-primary shrink-0" onClick={add} disabled={busy || !adding.trim()}>{busy ? <Spinner className="h-4 w-4" /> : <><Plus size={16} /> Add</>}</button>
      </div>

      <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        {list.map((it) => (
          <div key={it.id} className="group flex items-center justify-between px-4 py-2.5 hover:bg-paper">
            <span className="text-sm text-ink">{it.name}</span>
            {isAdmin && (
              <button className="btn-ghost h-8 w-8 p-0 text-subtle opacity-0 transition hover:text-danger group-hover:opacity-100" onClick={() => remove(it)} aria-label="Delete">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
        {list.length === 0 && <div className="px-4 py-8 text-center text-sm text-subtle">Nothing here yet.</div>}
      </div>
    </>
  )
}
