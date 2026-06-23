import { useMemo, useState } from 'react'
import { Microscope, Plus, Pencil, Trash2, FlaskConical, CalendarDays, Search, Atom } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import type { InstrumentTest, FullExperiment } from '../lib/types'
import { Modal, Spinner, EmptyState, useToast, useConfirm, FullLoader } from '../components/ui'
import { Combobox } from '../components/Combobox'
import { cx, fmtDate } from '../lib/utils'

const PRESET_TECHNIQUES = ['FTIR', 'TGA', 'DSC', 'NMR', 'GPC', 'SEM', 'XRD', 'BET', 'Rheology']
const TECH_COLOR: Record<string, string> = {
  FTIR: '#0E8A94', TGA: '#FF4700', DSC: '#6C5CE0', NMR: '#0B1F3A', GPC: '#1F9D55', SEM: '#C9821B', XRD: '#9A3DB8', BET: '#0A6E76', Rheology: '#D6336C',
}
const colorFor = (t: string) => TECH_COLOR[t] ?? '#5B6770'

export function Characterization() {
  const { instrumentTests, experiments, loading } = useData()
  const [q, setQ] = useState('')
  const [techF, setTechF] = useState<string>('')
  const [editing, setEditing] = useState<InstrumentTest | null>(null)
  const [creating, setCreating] = useState(false)

  const enOf = (id: string | null) => (id ? experiments.find((e) => e.id === id)?.en ?? null : null)
  const techniques = useMemo(() => {
    const s = new Set<string>(PRESET_TECHNIQUES)
    instrumentTests.forEach((t) => t.technique && s.add(t.technique))
    return [...s]
  }, [instrumentTests])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return instrumentTests.filter((t) => {
      if (techF && t.technique !== techF) return false
      if (!needle) return true
      const en = enOf(t.experiment_id)
      return (
        t.technique.toLowerCase().includes(needle) ||
        (t.result_summary ?? '').toLowerCase().includes(needle) ||
        (en != null && `en${en}`.includes(needle.replace(/\s/g, '')))
      )
    })
  }, [instrumentTests, q, techF, experiments])

  if (loading) return <FullLoader label="Loading characterization tests" />

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3 animate-fadeUp">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Characterization</h1>
          <p className="mt-1 text-sm text-muted">Instrument tests run on samples — <span className="data text-ink">{instrumentTests.length}</span> recorded</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={17} /> Record a test</button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 animate-fadeUp" style={{ animationDelay: '40ms' }}>
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-subtle" />
          <input className="field pl-9" placeholder="Search EN, technique, result…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 animate-fadeUp" style={{ animationDelay: '60ms' }}>
        <button onClick={() => setTechF('')} className={cx('rounded-full border px-3 py-1.5 text-xs font-medium transition', !techF ? 'border-brand bg-brand-tint text-brand-dark' : 'border-line bg-paper text-muted hover:bg-black/[0.03]')}>All</button>
        {techniques.map((t) => (
          <button key={t} onClick={() => setTechF(techF === t ? '' : t)} className={cx('rounded-full border px-3 py-1.5 text-xs font-medium transition', techF === t ? 'border-transparent text-white' : 'border-line bg-paper text-muted hover:bg-black/[0.03]')} style={techF === t ? { background: colorFor(t) } : undefined}>{t}</button>
        ))}
      </div>

      <div className="mt-5">
        {list.length === 0 ? (
          <EmptyState icon={<Microscope size={28} />} title={instrumentTests.length === 0 ? 'No tests recorded yet' : 'Nothing matches'} hint={instrumentTests.length === 0 ? 'Record FTIR, TGA, DSC, NMR and other instrument results against an experiment.' : 'Try a different search or filter.'} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((t) => <TestCard key={t.id} t={t} en={enOf(t.experiment_id)} onEdit={() => setEditing(t)} />)}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <TestModal test={editing} experiments={experiments} presets={techniques} onClose={() => { setCreating(false); setEditing(null) }} onSaved={() => { setCreating(false); setEditing(null) }} />
      )}
    </div>
  )
}

function TestCard({ t, en, onEdit }: { t: InstrumentTest; en: number | null; onEdit: () => void }) {
  return (
    <button onClick={onEdit} className="card-hover flex w-full flex-col gap-2.5 p-4 text-left">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ background: colorFor(t.technique) }}><Atom size={12} /> {t.technique}</span>
        {en != null ? <span className="data text-sm font-semibold text-brand-dark">EN{en}</span> : <span className="text-2xs text-subtle">no EN linked</span>}
      </div>
      <p className="min-h-[40px] text-sm text-ink">{t.result_summary || <span className="text-subtle">No summary yet.</span>}</p>
      <div className="flex items-center gap-2 text-2xs text-subtle">
        <CalendarDays size={12} /> {t.test_date ? fmtDate(t.test_date) : 'no date'}
        <Pencil size={12} className="ml-auto" />
      </div>
    </button>
  )
}

function TestModal({ test, experiments, presets, onClose, onSaved }: { test: InstrumentTest | null; experiments: FullExperiment[]; presets: string[]; onClose: () => void; onSaved: () => void }) {
  const { profile, isAdmin } = useAuth()
  const { refetchTeam } = useData()
  const confirm = useConfirm()
  const toast = useToast()
  const [expId, setExpId] = useState<string | null>(test?.experiment_id ?? null)
  const [technique, setTechnique] = useState(test?.technique ?? '')
  const [summary, setSummary] = useState(test?.result_summary ?? '')
  const [testDate, setTestDate] = useState(test?.test_date ?? '')
  const [busy, setBusy] = useState(false)

  const enOptions = useMemo(() => experiments.slice(0, 600).map((e) => (e.description ? `EN${e.en} — ${e.description}` : `EN${e.en}`)), [experiments])
  const enValue = expId ? (() => { const e = experiments.find((x) => x.id === expId); return e ? (e.description ? `EN${e.en} — ${e.description}` : `EN${e.en}`) : '' })() : ''
  const setEnFromLabel = (v: string) => { const m = v.match(/EN\s*(\d+)/i); const e = m ? experiments.find((x) => String(x.en) === m[1]) : undefined; setExpId(e?.id ?? null) }

  const save = async () => {
    if (!technique.trim()) { toast('Pick a technique first', 'err'); return }
    setBusy(true)
    const payload = { experiment_id: expId, technique: technique.trim(), result_summary: summary || null, test_date: testDate || null }
    try {
      if (test) {
        const { error } = await supabase.from('instrument_tests').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', test.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('instrument_tests').insert({ ...payload, created_by: profile?.id ?? null })
        if (error) throw error
      }
      await refetchTeam(); toast('Saved'); onSaved()
    } catch (e: any) { toast(e?.message ?? 'Could not save', 'err') } finally { setBusy(false) }
  }

  const remove = async () => {
    if (!test) return
    if (!(await confirm({ title: 'Delete this test?', message: 'This removes the characterization record for everyone.', confirmLabel: 'Delete', danger: true }))) return
    await supabase.from('instrument_tests').delete().eq('id', test.id)
    await refetchTeam(); onClose(); toast('Deleted')
  }
  const canDelete = test && (isAdmin || test.created_by === profile?.id)

  return (
    <Modal open onClose={onClose} size="lg" title={test ? 'Characterization test' : 'Record a characterization test'}
      footer={<>
        {canDelete ? <button className="btn-danger mr-auto" onClick={remove}><Trash2 size={15} /> Delete</button> : null}
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className="label">Experiment <span className="font-normal text-subtle">· which sample was tested</span></label>
          <Combobox value={enValue} onChange={setEnFromLabel} options={enOptions} placeholder="Search EN…" />
          {!expId && <p className="mt-1 text-2xs text-subtle">Optional, but linking an EN keeps the result with the sample.</p>}
        </div>

        <div>
          <label className="label">Technique</label>
          <div className="flex flex-wrap items-center gap-1.5">
            {presets.map((t) => (
              <button key={t} type="button" onClick={() => setTechnique(t)} className={cx('rounded-full border px-3 py-1.5 text-xs font-semibold transition', technique === t ? 'border-transparent text-white' : 'border-line bg-paper text-muted hover:bg-black/[0.03]')} style={technique === t ? { background: colorFor(t) } : undefined}>{t}</button>
            ))}
            <input className="field h-8 w-40 text-sm" placeholder="or type another…" value={presets.includes(technique) ? '' : technique} onChange={(e) => setTechnique(e.target.value)} />
          </div>
          <p className="mt-1 text-2xs text-subtle">FTIR, TGA, DSC, NMR, GPC, SEM… or add your own.</p>
        </div>

        <div>
          <label className="label">Result — short explanation</label>
          <textarea className="field min-h-[90px]" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="e.g. FTIR confirms carboxylate peak at 1560 cm⁻¹; no residual acrylic acid. TGA shows 8% bound water, decomposition onset ~240 °C." />
        </div>

        <div className="sm:max-w-[200px]"><label className="label">Test date</label><input className="field data" type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} /></div>
      </div>
    </Modal>
  )
}
