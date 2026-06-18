import { useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Beaker, Coins, Target, Package, X, FlaskConical } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import type { AmountUnit, Benchmark, Chemical, NamedItem, RefTable, SupplierSample, FullExperiment } from '../lib/types'
import { Modal, Spinner, EmptyState, useToast, useConfirm, FullLoader, Segmented, MetricPill } from '../components/ui'
import { Combobox } from '../components/Combobox'
import { sampleMetrics, METRIC_COLOR } from '../lib/metrics'
import { cx } from '../lib/utils'

type Tab = 'chemicals' | 'benchmarks' | 'supplier_samples' | RefTable
const TABS: { key: Tab; label: string }[] = [
  { key: 'chemicals', label: 'Chemicals' },
  { key: 'supplier_samples', label: 'Supplier samples' },
  { key: 'benchmarks', label: 'Benchmarks' },
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
        {tab === 'chemicals' ? <Chemicals /> : tab === 'supplier_samples' ? <SupplierSamples /> : tab === 'benchmarks' ? <Benchmarks /> : <NamedList table={tab as RefTable} />}
      </div>
    </div>
  )
}

/* ----------------------------- Chemicals ----------------------------- */
const empty: Partial<Chemical> = { name: '', supplier: '', full_name: '', cas_no: '', comments: '', price: null, price_unit: 'g', currency: 'USD' }

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
        price: draft.price ?? null,
        price_unit: draft.price_unit ?? 'g',
        currency: draft.currency || 'USD',
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
              <th className="hidden px-4 py-2.5 text-right font-semibold lg:table-cell">Price</th>
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
                <td className="hidden px-4 py-2.5 text-right lg:table-cell">{c.price != null ? <span className="data text-ink">{c.price} <span className="text-2xs text-subtle">{c.currency || 'USD'}/{c.price_unit || 'g'}</span></span> : <span className="text-subtle">—</span>}</td>
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
          <Field label="Price · optional" hint="Cost per unit of this material. Used to estimate formulation cost (refined later from the TEA file).">
            <div className="flex flex-wrap items-center gap-2">
              <input className="field data w-28" type="number" step="any" inputMode="decimal" placeholder="0.00" value={draft.price ?? ''} onChange={(e) => setDraft({ ...draft, price: e.target.value === '' ? null : parseFloat(e.target.value) })} />
              <Segmented value={(draft.price_unit ?? 'g') as AmountUnit} onChange={(u) => setDraft({ ...draft, price_unit: u })} size="sm" options={[{ value: 'g', label: 'per g' }, { value: 'mL', label: 'per mL' }]} />
              <input className="field w-20" placeholder="USD" value={draft.currency ?? 'USD'} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} />
            </div>
          </Field>
          <Field label="Comments"><textarea className="field min-h-[72px] resize-y" value={draft.comments ?? ''} onChange={(e) => setDraft({ ...draft, comments: e.target.value })} /></Field>
        </div>
      </Modal>
    </>
  )
}

/* ----------------------------- Supplier samples ----------------------------- */
const emptySupplier: Partial<SupplierSample> = { name: '', supplier: '', code: '', cost_per_ton: null, degree_substitution: '', purity: '', viscosity: '', colour: '', experiment_ids: [], notes: '' }

function perfOf(ids: string[], experiments: FullExperiment[]) {
  const exps = ids.map((id) => experiments.find((e) => e.id === id)).filter(Boolean) as FullExperiment[]
  const avg = (key: 'FSC' | 'CRC' | 'AUP') => {
    const vals = exps.map((e) => sampleMetrics(e)[key]).filter((v): v is number => v != null)
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null
  }
  return { FSC: avg('FSC'), CRC: avg('CRC'), AUP: avg('AUP'), n: exps.length }
}

function SupplierSamples() {
  const { supplierSamples, experiments, refetchRefs } = useData()
  const { isAdmin, profile } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Partial<SupplierSample>>(emptySupplier)
  const [busy, setBusy] = useState(false)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return supplierSamples
    return supplierSamples.filter((x) => [x.name, x.supplier, x.code, x.colour, x.notes].join(' ').toLowerCase().includes(s))
  }, [supplierSamples, q])

  const openNew = () => { setDraft(emptySupplier); setOpen(true) }
  const openEdit = (x: SupplierSample) => { setDraft({ ...x }); setOpen(true) }

  const save = async () => {
    if (!draft.name?.trim()) return
    setBusy(true)
    try {
      const payload = {
        name: draft.name.trim(), supplier: draft.supplier || null, code: draft.code || null,
        cost_per_ton: draft.cost_per_ton ?? null, degree_substitution: draft.degree_substitution || null,
        purity: draft.purity || null, viscosity: draft.viscosity || null, colour: draft.colour || null,
        experiment_ids: draft.experiment_ids ?? [], notes: draft.notes || null,
      }
      const { error } = draft.id
        ? await supabase.from('supplier_samples').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', draft.id)
        : await supabase.from('supplier_samples').insert({ ...payload, created_by: profile?.id ?? null })
      if (error) throw error
      await refetchRefs(); toast(draft.id ? 'Sample updated' : 'Sample added'); setOpen(false)
    } catch (e: any) { toast(e?.message ?? 'Could not save', 'err') } finally { setBusy(false) }
  }

  const remove = async (x: SupplierSample) => {
    if (!(await confirm({ title: `Delete ${x.name}?`, message: 'This removes the supplier sample for everyone.', confirmLabel: 'Delete', danger: true }))) return
    const { error } = await supabase.from('supplier_samples').delete().eq('id', x.id)
    if (error) { toast(error.message, 'err') } else { await refetchRefs(); toast('Deleted') }
  }

  const enOptions = useMemo(() => experiments.slice(0, 600).map((e) => (e.description ? `EN${e.en} — ${e.description}` : `EN${e.en}`)), [experiments])
  const addExp = (label: string) => {
    const m = label.match(/EN\s*(\d+)/i)
    const e = m ? experiments.find((x) => String(x.en) === m[1]) : undefined
    if (e && !(draft.experiment_ids ?? []).includes(e.id)) setDraft({ ...draft, experiment_ids: [...(draft.experiment_ids ?? []), e.id] })
  }
  const draftPerf = perfOf(draft.experiment_ids ?? [], experiments)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-subtle" />
          <input className="field pl-9" placeholder="Search supplier samples…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="data text-sm text-muted">{list.length}</span>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Add sample</button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-2xs uppercase tracking-wider text-muted">
              <th className="px-4 py-2.5 font-semibold">Material</th>
              <th className="px-4 py-2.5 text-right font-semibold">Cost/ton</th>
              <th className="px-4 py-2.5 font-semibold">DS</th>
              <th className="px-4 py-2.5 font-semibold">Purity</th>
              <th className="px-4 py-2.5 font-semibold">Viscosity</th>
              <th className="px-4 py-2.5 font-semibold">Colour</th>
              <th className="px-4 py-2.5 font-semibold">Performance</th>
              <th className="w-16 px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((x) => {
              const p = perfOf(x.experiment_ids, experiments)
              return (
                <tr key={x.id} className="group border-b border-line last:border-0 hover:bg-paper">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-ink">{x.name}</div>
                    <div className="text-xs text-subtle">{[x.supplier, x.code].filter(Boolean).join(' · ') || '—'}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right">{x.cost_per_ton != null ? <span className="data text-ink">${x.cost_per_ton}<span className="text-2xs text-subtle">/t</span></span> : <span className="text-subtle">—</span>}</td>
                  <td className="px-4 py-2.5"><span className="data text-muted">{x.degree_substitution || '—'}</span></td>
                  <td className="px-4 py-2.5"><span className="data text-muted">{x.purity || '—'}</span></td>
                  <td className="px-4 py-2.5"><span className="data text-muted">{x.viscosity || '—'}</span></td>
                  <td className="px-4 py-2.5 text-muted">{x.colour || '—'}</td>
                  <td className="px-4 py-2.5">
                    {p.n === 0 ? <span className="text-subtle">—</span> : (
                      <div className="flex flex-wrap items-center gap-1">
                        {(['FSC', 'CRC', 'AUP'] as const).map((k) => p[k] != null && <span key={k} className="rounded px-1.5 py-0.5 text-2xs font-semibold text-white" style={{ background: METRIC_COLOR[k] }}>{k} {p[k]}</span>)}
                        <span className="text-2xs text-subtle">· {p.n} exp</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                      <button className="btn-ghost h-8 w-8 p-0 text-muted" onClick={() => openEdit(x)} aria-label="Edit"><Pencil size={15} /></button>
                      {(isAdmin || x.created_by === profile?.id) && <button className="btn-ghost h-8 w-8 p-0 text-muted hover:text-danger" onClick={() => remove(x)} aria-label="Delete"><Trash2 size={15} /></button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {list.length === 0 && <div className="p-8"><EmptyState icon={<Package size={26} />} title="No supplier samples yet" hint="Add a raw material received from a supplier — its cost, specs, and performance from your experiments." action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Add sample</button>} /></div>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={draft.id ? 'Edit supplier sample' : 'Add supplier sample'}
        footer={<>
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy || !draft.name?.trim()}>{busy ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
        </>}>
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Material" hint="e.g. Xanthan Gum"><input className="field" value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus /></Field>
            <Field label="Supplier"><input className="field" value={draft.supplier ?? ''} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            <Field label="Code"><input className="field data" value={draft.code ?? ''} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="XN0" /></Field>
            <Field label="Cost / ton ($)"><input className="field data" type="number" step="any" inputMode="decimal" value={draft.cost_per_ton ?? ''} onChange={(e) => setDraft({ ...draft, cost_per_ton: e.target.value === '' ? null : parseFloat(e.target.value) })} placeholder="1800" /></Field>
            <Field label="Degree of subst."><input className="field data" value={draft.degree_substitution ?? ''} onChange={(e) => setDraft({ ...draft, degree_substitution: e.target.value })} placeholder="0.8" /></Field>
            <Field label="Purity %"><input className="field data" value={draft.purity ?? ''} onChange={(e) => setDraft({ ...draft, purity: e.target.value })} placeholder=">95" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Viscosity"><input className="field data" value={draft.viscosity ?? ''} onChange={(e) => setDraft({ ...draft, viscosity: e.target.value })} placeholder="1200-1800 mPa·s" /></Field>
            <Field label="Colour"><input className="field" value={draft.colour ?? ''} onChange={(e) => setDraft({ ...draft, colour: e.target.value })} placeholder="White / off-white" /></Field>
          </div>

          <Field label="Performance — link experiments" hint="Pick the experiments that represent this material. FSC/CRC/AUP are averaged from them automatically.">
            <Combobox value="" onChange={addExp} options={enOptions} placeholder="Search EN to add…" />
            {(draft.experiment_ids ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(draft.experiment_ids ?? []).map((id) => {
                  const e = experiments.find((x) => x.id === id)
                  return (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2.5 py-1 text-xs font-medium text-brand-dark">
                      <FlaskConical size={11} /><span className="data">EN{e?.en ?? '?'}</span>
                      <button type="button" onClick={() => setDraft({ ...draft, experiment_ids: (draft.experiment_ids ?? []).filter((i) => i !== id) })} className="opacity-70 transition hover:opacity-100"><X size={11} /></button>
                    </span>
                  )
                })}
              </div>
            )}
            {draftPerf.n > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-2">
                <span className="text-2xs text-subtle">Averaged from {draftPerf.n} experiment{draftPerf.n > 1 ? 's' : ''}:</span>
                {(['FSC', 'CRC', 'AUP'] as const).map((k) => draftPerf[k] != null && <MetricPill key={k} k={k} value={draftPerf[k]} size="sm" />)}
              </div>
            )}
          </Field>

          <Field label="Notes"><textarea className="field min-h-[60px] resize-y" value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
        </div>
      </Modal>
    </>
  )
}

/* ----------------------------- Benchmarks ----------------------------- */
const emptyBm: Partial<Benchmark> = { name: '', fsc: null, crc: null, aup: null, price: null, notes: '' }

function Benchmarks() {
  const { benchmarks, refetchRefs } = useData()
  const { isAdmin } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Partial<Benchmark>>(emptyBm)
  const [busy, setBusy] = useState(false)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? benchmarks.filter((b) => [b.name, b.notes].join(' ').toLowerCase().includes(s)) : benchmarks
  }, [benchmarks, q])

  const save = async () => {
    if (!draft.name?.trim()) return
    setBusy(true)
    try {
      const payload = { name: draft.name.trim(), fsc: draft.fsc ?? null, crc: draft.crc ?? null, aup: draft.aup ?? null, price: draft.price ?? null, notes: draft.notes || null }
      const { error } = draft.id ? await supabase.from('benchmarks').update(payload).eq('id', draft.id) : await supabase.from('benchmarks').insert(payload)
      if (error) throw error
      await refetchRefs()
      toast(draft.id ? 'Benchmark updated' : 'Benchmark added')
      setOpen(false)
    } catch (e: any) {
      toast(e?.message ?? 'Could not save', 'err')
    } finally {
      setBusy(false)
    }
  }
  const remove = async (b: Benchmark) => {
    if (!(await confirm({ title: `Delete ${b.name}?`, message: 'This removes the benchmark from parity analysis.', confirmLabel: 'Delete', danger: true }))) return
    const { error } = await supabase.from('benchmarks').delete().eq('id', b.id)
    if (error) toast(error.message, 'err')
    else { await refetchRefs(); toast('Benchmark deleted') }
  }

  return (
    <>
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-line bg-brand-tint/40 px-4 py-3">
        <Target size={18} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-sm text-ink">Benchmarks are your <span className="font-medium">synthetic reference samples</span>. Enter their FSC, CRC, AUP and price per kg here, and the Plot page can measure every experiment's performance and cost against them.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-subtle" />
          <input className="field pl-9" placeholder="Search benchmarks…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="data text-sm text-muted">{list.length}</span>
        <button className="btn-primary" onClick={() => { setDraft(emptyBm); setOpen(true) }}><Plus size={16} /> Add benchmark</button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-2xs uppercase tracking-wider text-muted">
              <th className="px-4 py-2.5 font-semibold">Name</th>
              <th className="px-4 py-2.5 text-right font-semibold">FSC</th>
              <th className="px-4 py-2.5 text-right font-semibold">CRC</th>
              <th className="px-4 py-2.5 text-right font-semibold">AUP</th>
              <th className="hidden px-4 py-2.5 text-right font-semibold sm:table-cell">Price /kg</th>
              <th className="w-20 px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id} className="group border-b border-line last:border-0 hover:bg-paper">
                <td className="px-4 py-2.5"><div className="font-medium text-ink">{b.name}</div>{b.notes && <div className="text-xs text-subtle">{b.notes}</div>}</td>
                <td className="px-4 py-2.5 text-right data text-ink">{b.fsc ?? '—'}</td>
                <td className="px-4 py-2.5 text-right data text-ink">{b.crc ?? '—'}</td>
                <td className="px-4 py-2.5 text-right data text-ink">{b.aup ?? '—'}</td>
                <td className="hidden px-4 py-2.5 text-right data text-muted sm:table-cell">{b.price ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                    <button className="btn-ghost h-8 w-8 p-0 text-muted" onClick={() => { setDraft(b); setOpen(true) }} aria-label="Edit"><Pencil size={15} /></button>
                    {isAdmin && <button className="btn-ghost h-8 w-8 p-0 text-muted hover:text-danger" onClick={() => remove(b)} aria-label="Delete"><Trash2 size={15} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div className="p-8"><EmptyState icon={<Target size={26} />} title="No benchmarks yet" hint="Add a synthetic reference sample to unlock parity analysis." action={<button className="btn-primary" onClick={() => { setDraft(emptyBm); setOpen(true) }}><Plus size={16} /> Add benchmark</button>} /></div>}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={draft.id ? 'Edit benchmark' : 'Add benchmark'}
        footer={<><button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy || !draft.name?.trim()}>{busy ? <Spinner className="h-4 w-4" /> : 'Save'}</button></>}
      >
        <div className="space-y-3.5">
          <Field label="Name" hint="e.g. Commercial SAP A, or a competitor grade"><input className="field" value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus /></Field>
          <div className="grid grid-cols-3 gap-3">
            {(['fsc', 'crc', 'aup'] as const).map((key) => (
              <Field key={key} label={`${key.toUpperCase()} (g/g)`}>
                <input className="field data" type="number" step="any" inputMode="decimal" placeholder="0" value={(draft[key] as number | null) ?? ''} onChange={(e) => setDraft({ ...draft, [key]: e.target.value === '' ? null : parseFloat(e.target.value) })} />
              </Field>
            ))}
          </div>
          <Field label="Price per kg · optional" hint="Used for the price-parity matrix."><input className="field data" type="number" step="any" inputMode="decimal" placeholder="0.00" value={draft.price ?? ''} onChange={(e) => setDraft({ ...draft, price: e.target.value === '' ? null : parseFloat(e.target.value) })} /></Field>
          <Field label="Notes"><input className="field" value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
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
