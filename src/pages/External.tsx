import { useMemo, useState } from 'react'
import { Send, Plus, Pencil, Trash2, FlaskConical, Building2, Hash, CalendarDays, ClipboardCheck, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import type { ExternalTest, ExternalTestStatus, FullExperiment } from '../lib/types'
import { Modal, Spinner, EmptyState, useToast, useConfirm, FullLoader } from '../components/ui'
import { Combobox } from '../components/Combobox'
import { cx, fmtDate } from '../lib/utils'

const STATUS: Record<ExternalTestStatus, { label: string; cls: string; dot: string }> = {
  sent: { label: 'Sent', cls: 'bg-[#E7ECF3] text-navy', dot: '#0B1F3A' },
  in_progress: { label: 'In progress', cls: 'bg-[#FBEFE0] text-[#9A6212]', dot: '#C9821B' },
  results_in: { label: 'Results in', cls: 'bg-[#E6EFE9] text-positive', dot: '#1f9d57' },
  cancelled: { label: 'Cancelled', cls: 'bg-black/[0.05] text-muted', dot: '#9AA0A6' },
}

export function External() {
  const { externalTests, experiments, loading } = useData()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<ExternalTest | null>(null)
  const [creating, setCreating] = useState(false)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return externalTests
    return externalTests.filter((t) => [t.sample_label, t.destination, t.delivery_company, t.reference_code, t.result_summary, t.notes].join(' ').toLowerCase().includes(s))
  }, [externalTests, q])

  const counts = useMemo(() => {
    const c: Record<string, number> = { sent: 0, in_progress: 0, results_in: 0, cancelled: 0 }
    externalTests.forEach((t) => { c[t.status] = (c[t.status] ?? 0) + 1 })
    return c
  }, [externalTests])

  if (loading) return <FullLoader label="Loading" />

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3 animate-fadeUp">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Send size={20} className="text-brand" /> External testing</h1>
          <p className="mt-1 text-sm text-muted">Track samples sent out for testing — shipping details, reference codes, and results everyone can see.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Send a sample</button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(Object.keys(STATUS) as ExternalTestStatus[]).map((s) => (
          <span key={s} className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium', STATUS[s].cls)}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS[s].dot }} /> {STATUS[s].label} · {counts[s] ?? 0}
          </span>
        ))}
      </div>

      <div className="relative mt-4 max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-2.5 text-subtle" />
        <input className="field pl-8 text-sm" placeholder="Search sample, lab, reference…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="mt-4 space-y-2.5">
        {list.length === 0 ? (
          <EmptyState icon={<Send size={26} />} title="Nothing sent out yet" hint="Log a sample you've shipped for external testing to keep everyone updated." action={<button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Send a sample</button>} />
        ) : (
          list.map((t) => <TestCard key={t.id} t={t} experiments={experiments} onEdit={() => setEditing(t)} />)
        )}
      </div>

      {(creating || editing) && (
        <TestModal
          test={editing}
          experiments={experiments}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={() => { setCreating(false); setEditing(null); toast('Saved') }}
        />
      )}
    </div>
  )
}

function TestCard({ t, experiments, onEdit }: { t: ExternalTest; experiments: FullExperiment[]; onEdit: () => void }) {
  const en = t.experiment_id ? experiments.find((e) => e.id === t.experiment_id)?.en : null
  const st = STATUS[t.status]
  return (
    <button onClick={onEdit} className="card card-hover w-full p-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="data text-sm font-semibold text-ink">{t.sample_label || (en ? `EN${en}` : 'Sample')}</span>
          {en && t.sample_label && <span className="pill bg-brand-tint text-brand-dark">EN{en}</span>}
          <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-2xs font-medium', st.cls)}><span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />{st.label}</span>
        </div>
        <span className="text-2xs text-subtle">{t.sent_date ? `Sent ${fmtDate(t.sent_date)}` : ''}</span>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-muted sm:grid-cols-2">
        {t.destination && <span className="flex items-center gap-1.5"><Building2 size={13} className="text-subtle" /> {t.destination}</span>}
        {t.delivery_company && <span className="flex items-center gap-1.5"><Send size={13} className="text-subtle" /> {t.delivery_company}</span>}
        {t.reference_code && <span className="flex items-center gap-1.5"><Hash size={13} className="text-subtle" /> <span className="data">{t.reference_code}</span></span>}
        {t.result_date && <span className="flex items-center gap-1.5"><CalendarDays size={13} className="text-subtle" /> Results {fmtDate(t.result_date)}</span>}
      </div>
      {t.result_summary && (
        <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-positive/25 bg-[#E6EFE9]/50 px-3 py-2">
          <ClipboardCheck size={15} className="mt-0.5 shrink-0 text-positive" />
          <p className="whitespace-pre-wrap text-sm text-ink">{t.result_summary}</p>
        </div>
      )}
      {t.notes && <p className="mt-1.5 text-xs text-subtle">{t.notes}</p>}
    </button>
  )
}

function TestModal({ test, experiments, onClose, onSaved }: { test: ExternalTest | null; experiments: FullExperiment[]; onClose: () => void; onSaved: () => void }) {
  const { profile, isAdmin } = useAuth()
  const { refetchTeam } = useData()
  const confirm = useConfirm()
  const toast = useToast()
  const [expId, setExpId] = useState<string | null>(test?.experiment_id ?? null)
  const [label, setLabel] = useState(test?.sample_label ?? '')
  const [destination, setDestination] = useState(test?.destination ?? '')
  const [delivery, setDelivery] = useState(test?.delivery_company ?? '')
  const [ref, setRef] = useState(test?.reference_code ?? '')
  const [sentDate, setSentDate] = useState(test?.sent_date ?? '')
  const [status, setStatus] = useState<ExternalTestStatus>(test?.status ?? 'sent')
  const [summary, setSummary] = useState(test?.result_summary ?? '')
  const [resultDate, setResultDate] = useState(test?.result_date ?? '')
  const [notes, setNotes] = useState(test?.notes ?? '')
  const [busy, setBusy] = useState(false)

  const enOptions = useMemo(() => experiments.slice(0, 600).map((e) => (e.description ? `EN${e.en} — ${e.description}` : `EN${e.en}`)), [experiments])
  const enValue = expId ? (() => { const e = experiments.find((x) => x.id === expId); return e ? (e.description ? `EN${e.en} — ${e.description}` : `EN${e.en}`) : '' })() : ''
  const setEnFromLabel = (v: string) => {
    const m = v.match(/EN\s*(\d+)/i)
    const e = m ? experiments.find((x) => String(x.en) === m[1]) : undefined
    setExpId(e?.id ?? null)
  }

  const save = async () => {
    setBusy(true)
    const payload = {
      experiment_id: expId, sample_label: label || null, destination: destination || null, delivery_company: delivery || null,
      reference_code: ref || null, sent_date: sentDate || null, status, result_summary: summary || null, result_date: resultDate || null, notes: notes || null,
    }
    try {
      if (test) {
        const { error } = await supabase.from('external_tests').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', test.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('external_tests').insert({ ...payload, created_by: profile?.id ?? null })
        if (error) throw error
      }
      await refetchTeam()
      onSaved()
    } catch (e: any) { toast(e?.message ?? 'Could not save', 'err') } finally { setBusy(false) }
  }

  const remove = async () => {
    if (!test) return
    if (!(await confirm({ title: 'Delete this entry?', message: 'This removes the external-test record for everyone.', confirmLabel: 'Delete', danger: true }))) return
    await supabase.from('external_tests').delete().eq('id', test.id)
    await refetchTeam(); onClose(); toast('Deleted')
  }

  const canDelete = test && (isAdmin || test.created_by === profile?.id)

  return (
    <Modal open onClose={onClose} size="lg" title={test ? 'External test' : 'Send a sample for testing'}
      footer={<>
        {canDelete ? <button className="btn-danger mr-auto" onClick={remove}><Trash2 size={15} /> Delete</button> : null}
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
      </>}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label">Linked experiment <span className="font-normal text-subtle">· optional</span></label>
            <Combobox value={enValue} onChange={setEnFromLabel} options={enOptions} placeholder="Search EN…" /></div>
          <div><label className="label">Sample label</label><input className="field" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. EN512 batch A" /></div>
          <div><label className="label">Testing lab / destination</label><input className="field" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Smithers, external lab" /></div>
          <div><label className="label">Delivery company</label><input className="field" value={delivery} onChange={(e) => setDelivery(e.target.value)} placeholder="e.g. DHL, FedEx" /></div>
          <div><label className="label">Reference / tracking code</label><input className="field data" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. 1Z…" /></div>
          <div><label className="label">Date sent</label><input className="field data" type="date" value={sentDate} onChange={(e) => setSentDate(e.target.value)} /></div>
          <div><label className="label">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(STATUS) as ExternalTestStatus[]).map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)} className={cx('rounded-full border px-3 py-1.5 text-xs font-medium transition', status === s ? STATUS[s].cls + ' border-transparent ring-2 ring-offset-1 ring-current' : 'border-line bg-paper text-muted hover:bg-black/[0.03]')}>{STATUS[s].label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-positive/25 bg-[#E6EFE9]/40 p-3.5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-positive"><ClipboardCheck size={15} /> External results</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px]">
            <div><label className="label">Result summary</label><textarea className="field min-h-[80px]" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What did the external test find? Key values, pass/fail, notes…" /></div>
            <div><label className="label">Result date</label><input className="field data" type="date" value={resultDate} onChange={(e) => setResultDate(e.target.value)} /></div>
          </div>
        </div>
        <div><label className="label">Notes</label><input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else worth recording" /></div>
      </div>
    </Modal>
  )
}
