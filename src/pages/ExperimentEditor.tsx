import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, FlaskConical, Beaker, Cog, Gauge } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { FullExperiment, Material, ProcessStep, ResultEntry } from '../lib/types'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { Modal, Spinner, TypePill, OwnerAvatar, useToast, useConfirm } from '../components/ui'
import { Combobox } from '../components/Combobox'
import { cx, fmtDate, parseNum, todayISO } from '../lib/utils'

type Mode = 'view' | 'edit' | 'new'
const blankMat = (): Material => ({ position: null, name: '', mass_g: null, ratio: '' })
const blankProc = (): ProcessStep => ({ position: null, process: '', measure: '', value: '' })
const blankRes = (): ResultEntry => ({ position: null, result_type: '', value: '', value_num: null, comment: '' })

export function ExperimentModal({
  open,
  experiment,
  initialMode,
  onClose,
}: {
  open: boolean
  experiment: FullExperiment | null
  initialMode: Mode
  onClose: () => void
}) {
  const [mode, setMode] = useState<Mode>(initialMode)
  useEffect(() => setMode(initialMode), [initialMode, experiment])

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        mode === 'new'
          ? 'New experiment'
          : experiment
            ? <span className="flex items-center gap-2.5">
                <span className="data rounded-md bg-ink px-2 py-0.5 text-sm font-semibold text-white">EN{experiment.en}</span>
                <span className="truncate">{experiment.description || 'Experiment'}</span>
              </span>
            : 'Experiment'
      }
    >
      {mode === 'view' && experiment ? (
        <ExperimentView experiment={experiment} onEdit={() => setMode('edit')} />
      ) : (
        <ExperimentForm
          experiment={mode === 'edit' ? experiment : null}
          onCancel={() => (experiment ? setMode('view') : onClose())}
          onSaved={onClose}
        />
      )}
    </Modal>
  )
}

/* ----------------------------- Read-only view ----------------------------- */
function ExperimentView({ experiment: e, onEdit }: { experiment: FullExperiment; onEdit: () => void }) {
  const mats = [...e.experiment_materials].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const procs = [...e.experiment_processes].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const res = [...e.experiment_results].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Meta label="Type"><TypePill type={e.experiment_type} /></Meta>
        <Meta label="Owner">
          <span className="flex items-center gap-2">
            <OwnerAvatar name={e.owner} size={22} /> <span className="text-sm">{e.owner || '—'}</span>
          </span>
        </Meta>
        <Meta label="Date"><span className="text-sm">{fmtDate(e.date)}</span></Meta>
        <Meta label="Repeat"><span className="text-sm">{e.repeat || '—'}</span></Meta>
        <div className="ml-auto">
          <button className="btn-outline" onClick={onEdit}>
            <Pencil size={15} /> Edit
          </button>
        </div>
      </div>

      {res.length > 0 && (
        <Section icon={<Gauge size={15} />} title="Results">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {res.map((r, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 rounded-lg border border-line bg-paper px-3 py-2">
                <span className="text-sm text-muted">{r.result_type}</span>
                <span className="data text-sm font-semibold text-ink">{r.value ?? '—'}</span>
              </div>
            ))}
          </div>
          {res.some((r) => r.comment) && (
            <div className="mt-2 space-y-1">
              {res.filter((r) => r.comment).map((r, i) => (
                <p key={i} className="text-sm text-muted"><span className="text-subtle">{r.result_type}:</span> {r.comment}</p>
              ))}
            </div>
          )}
        </Section>
      )}

      <Section icon={<Beaker size={15} />} title={`Materials${mats.length ? ` · ${mats.length}` : ''}`}>
        {mats.length === 0 ? (
          <Empty>No materials recorded.</Empty>
        ) : (
          <DataTable
            head={['#', 'Material', 'Mass (g)', 'Ratio']}
            rows={mats.map((m, i) => [String(i + 1), m.name || '—', fmtNum(m.mass_g), m.ratio || '—'])}
            mono={[true, false, true, true]}
          />
        )}
      </Section>

      <Section icon={<Cog size={15} />} title={`Process${procs.length ? ` · ${procs.length}` : ''}`}>
        {procs.length === 0 ? (
          <Empty>No process steps recorded.</Empty>
        ) : (
          <DataTable
            head={['#', 'Process', 'Measure', 'Value']}
            rows={procs.map((p, i) => [String(i + 1), p.process || '—', p.measure || '—', p.value || '—'])}
            mono={[true, false, false, true]}
          />
        )}
      </Section>

      {e.method && (
        <Section icon={<FlaskConical size={15} />} title="Method">
          <p className="whitespace-pre-wrap rounded-lg border border-line bg-paper px-3.5 py-3 text-sm leading-relaxed text-ink">
            {e.method}
          </p>
        </Section>
      )}
    </div>
  )
}

const fmtNum = (n: number | null) => (n === null || n === undefined ? '—' : String(n))
function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      {children}
    </div>
  )
}
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-muted">
        <span className="text-brand">{icon}</span>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </div>
      {children}
    </div>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-subtle">{children}</p>
}
function DataTable({ head, rows, mono }: { head: string[]; rows: string[][]; mono?: boolean[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-paper text-left text-2xs uppercase tracking-wider text-muted">
            {head.map((h, i) => (
              <th key={i} className={cx('px-3 py-2 font-semibold', i === 0 && 'w-10')}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-line last:border-0">
              {r.map((c, ci) => (
                <td key={ci} className={cx('px-3 py-2 align-top', mono?.[ci] && 'data', ci === 0 && 'text-subtle')}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------- Edit form -------------------------------- */
function ExperimentForm({
  experiment,
  onCancel,
  onSaved,
}: {
  experiment: FullExperiment | null
  onCancel: () => void
  onSaved: () => void
}) {
  const { chemicals, types, processes, measures, results, owners, addRef, addChemicalByName, refetchExperiments } = useData()
  const { profile } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const [date, setDate] = useState(experiment?.date ?? todayISO())
  const [owner, setOwner] = useState(experiment?.owner ?? profile?.full_name ?? '')
  const [type, setType] = useState(experiment?.experiment_type ?? '')
  const [repeat, setRepeat] = useState(experiment?.repeat ?? '')
  const [description, setDescription] = useState(experiment?.description ?? '')
  const [method, setMethod] = useState(experiment?.method ?? '')
  const [mats, setMats] = useState<Material[]>(
    experiment ? [...experiment.experiment_materials].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) : [blankMat()],
  )
  const [procs, setProcs] = useState<ProcessStep[]>(
    experiment ? [...experiment.experiment_processes].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) : [blankProc()],
  )
  const [res, setRes] = useState<ResultEntry[]>(
    experiment ? [...experiment.experiment_results].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) : [],
  )
  const [busy, setBusy] = useState(false)

  const chemNames = useMemo(() => chemicals.map((c) => c.name), [chemicals])
  const typeNames = useMemo(() => types.map((t) => t.name), [types])
  const procNames = useMemo(() => processes.map((p) => p.name), [processes])
  const measureNames = useMemo(() => measures.map((m) => m.name), [measures])
  const resultNames = useMemo(() => results.map((r) => r.name), [results])

  const upd = <T,>(list: T[], i: number, patch: Partial<T>, set: (v: T[]) => void) =>
    set(list.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))

  async function save() {
    setBusy(true)
    try {
      const cleanMats = mats
        .filter((m) => m.name?.trim())
        .map((m, i) => ({ position: i + 1, name: m.name!.trim(), mass_g: m.mass_g, ratio: m.ratio || null }))
      const cleanProcs = procs
        .filter((p) => p.process?.trim() || p.measure?.trim() || p.value?.trim())
        .map((p, i) => ({ position: i + 1, process: p.process || null, measure: p.measure || null, value: p.value || null }))
      const cleanRes = res
        .filter((r) => r.result_type?.trim())
        .map((r, i) => ({
          position: i + 1,
          result_type: r.result_type!.trim(),
          value: r.value || null,
          value_num: parseNum(r.value),
          comment: r.comment || null,
        }))

      const base = {
        date: date || null,
        owner: owner || null,
        experiment_type: type || null,
        repeat: repeat || null,
        description: description || null,
        method: method || null,
      }

      let expId = experiment?.id
      if (experiment) {
        const { error } = await supabase.from('experiments').update(base).eq('id', experiment.id)
        if (error) throw error
        await Promise.all([
          supabase.from('experiment_materials').delete().eq('experiment_id', experiment.id),
          supabase.from('experiment_processes').delete().eq('experiment_id', experiment.id),
          supabase.from('experiment_results').delete().eq('experiment_id', experiment.id),
        ])
      } else {
        const { data: enData } = await supabase.rpc('get_next_en')
        const nextEn = typeof enData === 'number' ? enData : undefined
        const { data, error } = await supabase
          .from('experiments')
          .insert({ ...base, en: nextEn, created_by: profile?.id ?? null })
          .select('id')
          .single()
        if (error) throw error
        expId = (data as { id: string }).id
      }

      if (expId) {
        const withId = <T,>(rows: T[]) => rows.map((r) => ({ ...r, experiment_id: expId }))
        const inserts = await Promise.all([
          cleanMats.length ? supabase.from('experiment_materials').insert(withId(cleanMats)) : null,
          cleanProcs.length ? supabase.from('experiment_processes').insert(withId(cleanProcs)) : null,
          cleanRes.length ? supabase.from('experiment_results').insert(withId(cleanRes)) : null,
        ])
        const err = inserts.find((r) => r && r.error)?.error
        if (err) throw err
      }

      await refetchExperiments()
      toast(experiment ? 'Experiment updated' : 'Experiment created')
      onSaved()
    } catch (err: any) {
      toast(err?.message ?? 'Could not save', 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header fields */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <div>
          <label className="label">Date</label>
          <input type="date" className="field" value={date ?? ''} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Owner</label>
          <Combobox value={owner} onChange={setOwner} options={owners} allowFreeText placeholder="Who ran it" onCreate={(v) => setOwner(v)} createLabel={(v) => `Use “${v}”`} />
        </div>
        <div>
          <label className="label">Experiment type</label>
          <Combobox value={type} onChange={setType} options={typeNames} onCreate={(v) => addRef('experiment_types', v)} placeholder="Select type" />
        </div>
        <div>
          <label className="label">Repeat?</label>
          <div className="flex gap-1.5">
            {['Yes', 'No'].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setRepeat(repeat === opt ? '' : opt)}
                className={cx(
                  'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition',
                  repeat === opt ? 'border-brand bg-brand-tint text-brand-dark' : 'border-line bg-surface text-muted hover:bg-black/[0.03]',
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <input className="field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short label, e.g. MD4-1" />
        </div>
      </div>

      {/* Materials */}
      <RowSection
        icon={<Beaker size={15} />}
        title="Materials"
        onAdd={() => setMats([...mats, blankMat()])}
        addLabel="Add material"
      >
        {mats.length === 0 && <p className="text-sm text-subtle">No materials yet.</p>}
        {mats.map((m, i) => (
          <div key={i} className="grid grid-cols-[1fr] gap-2 sm:grid-cols-[minmax(0,1fr)_110px_120px_auto]">
            <Combobox
              value={m.name || ''}
              onChange={(v) => upd(mats, i, { name: v }, setMats)}
              options={chemNames}
              onCreate={(v) => addChemicalByName(v)}
              placeholder="Chemical"
              createLabel={(v) => `Add “${v}” to chemicals`}
            />
            <input
              className="field data"
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="Mass g"
              value={m.mass_g ?? ''}
              onChange={(e) => upd(mats, i, { mass_g: e.target.value === '' ? null : parseFloat(e.target.value) }, setMats)}
            />
            <input className="field data" placeholder="Ratio" value={m.ratio ?? ''} onChange={(e) => upd(mats, i, { ratio: e.target.value }, setMats)} />
            <RemoveBtn onClick={() => setMats(mats.filter((_, idx) => idx !== i))} />
          </div>
        ))}
      </RowSection>

      {/* Process */}
      <RowSection icon={<Cog size={15} />} title="Process" onAdd={() => setProcs([...procs, blankProc()])} addLabel="Add step">
        {procs.length === 0 && <p className="text-sm text-subtle">No steps yet.</p>}
        {procs.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr] gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px_auto]">
            <Combobox value={p.process || ''} onChange={(v) => upd(procs, i, { process: v }, setProcs)} options={procNames} onCreate={(v) => addRef('process_names', v)} placeholder="Process" createLabel={(v) => `Add “${v}”`} />
            <Combobox value={p.measure || ''} onChange={(v) => upd(procs, i, { measure: v }, setProcs)} options={measureNames} onCreate={(v) => addRef('measure_types', v)} placeholder="Measure" createLabel={(v) => `Add “${v}”`} />
            <input className="field data" placeholder="Value" value={p.value ?? ''} onChange={(e) => upd(procs, i, { value: e.target.value }, setProcs)} />
            <RemoveBtn onClick={() => setProcs(procs.filter((_, idx) => idx !== i))} />
          </div>
        ))}
      </RowSection>

      {/* Results */}
      <RowSection icon={<Gauge size={15} />} title="Results" onAdd={() => setRes([...res, blankRes()])} addLabel="Add result">
        {res.length === 0 && <p className="text-sm text-subtle">No results yet — add them now or later.</p>}
        {res.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr] gap-2 sm:grid-cols-[minmax(0,1.2fr)_120px_minmax(0,1fr)_auto]">
            <Combobox value={r.result_type || ''} onChange={(v) => upd(res, i, { result_type: v }, setRes)} options={resultNames} onCreate={(v) => addRef('result_types', v)} placeholder="Result type" createLabel={(v) => `Add “${v}”`} />
            <input className="field data" placeholder="Value" value={r.value ?? ''} onChange={(e) => upd(res, i, { value: e.target.value }, setRes)} />
            <input className="field" placeholder="Comment (optional)" value={r.comment ?? ''} onChange={(e) => upd(res, i, { comment: e.target.value }, setRes)} />
            <RemoveBtn onClick={() => setRes(res.filter((_, idx) => idx !== i))} />
          </div>
        ))}
      </RowSection>

      {/* Method */}
      <div>
        <label className="label">Method</label>
        <textarea className="field min-h-[120px] resize-y leading-relaxed" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Describe the procedure…" />
      </div>

      <div className="sticky bottom-0 -mx-5 -mb-4 flex items-center justify-between gap-2 border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <div>
          {experiment && (
            <button
              className="btn-danger"
              onClick={async () => {
                if (await confirm({ title: `Delete EN${experiment.en}?`, message: 'This removes the experiment and all its data. This cannot be undone.', confirmLabel: 'Delete', danger: true })) {
                  await supabase.from('experiments').delete().eq('id', experiment.id)
                  await refetchExperiments()
                  toast('Experiment deleted')
                  onSaved()
                }
              }}
            >
              <Trash2 size={15} /> Delete
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : experiment ? 'Save changes' : 'Create experiment'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RowSection({ icon, title, onAdd, addLabel, children }: { icon: React.ReactNode; title: string; onAdd: () => void; addLabel: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-brand">{icon}</span>
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <button type="button" className="btn-ghost h-8 text-brand-dark" onClick={onAdd}>
          <Plus size={15} /> {addLabel}
        </button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="btn-ghost h-9 w-9 shrink-0 self-start p-0 text-subtle hover:text-danger" aria-label="Remove row">
      <Trash2 size={16} />
    </button>
  )
}
