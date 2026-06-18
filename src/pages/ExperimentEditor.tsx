import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, FlaskConical, Beaker, Cog, Gauge, Layers, Ban, Coins, Droplet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { FullExperiment, Material, ProcessStep, ResultEntry, AmountUnit, Stage } from '../lib/types'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { Modal, Spinner, TypePill, OwnerAvatar, MetricPill, useToast, useConfirm } from '../components/ui'
import { Combobox } from '../components/Combobox'
import { cx, fmtDate, parseNum, todayISO } from '../lib/utils'
import { sampleMetrics, formulationCost } from '../lib/metrics'
import { PROJECTS, projectByCode } from '../lib/projects'

type Mode = 'view' | 'edit' | 'new'
let KEY = 0
const k = () => `r${++KEY}`
type MatRow = Material & { _k: string }
type ProcRow = ProcessStep & { _k: string }
type ResRow = ResultEntry & { _k: string }
const blankMat = (stage: Stage | null): MatRow => ({ _k: k(), position: null, name: '', mass_g: null, unit: 'g', ratio: '', stage })
const blankProc = (stage: Stage | null): ProcRow => ({ _k: k(), position: null, process: '', measure: '', value: '', stage })
const blankRes = (): ResRow => ({ _k: k(), position: null, result_type: '', value: '', value_num: null, comment: '' })

export function ExperimentModal({ open, experiment, initialMode, onClose }: { open: boolean; experiment: FullExperiment | null; initialMode: Mode; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>(initialMode)
  useEffect(() => setMode(initialMode), [initialMode, experiment])
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        mode === 'new' ? 'New experiment'
          : experiment ? (
            <span className="flex items-center gap-2.5">
              <span className="data rounded-md bg-navy px-2 py-0.5 text-sm font-semibold text-white">EN{experiment.en}</span>
              <span className="truncate">{experiment.description || 'Experiment'}</span>
              {experiment.discontinued && <span className="pill bg-black/[0.06] text-muted">discontinued</span>}
            </span>
          ) : 'Experiment'
      }
    >
      {mode === 'view' && experiment ? (
        <ExperimentView experiment={experiment} onEdit={() => setMode('edit')} />
      ) : (
        <ExperimentForm experiment={mode === 'edit' ? experiment : null} onCancel={() => (experiment ? setMode('view') : onClose())} onSaved={onClose} />
      )}
    </Modal>
  )
}

/* ----------------------------- Read-only view ----------------------------- */
function ExperimentView({ experiment: e, onEdit }: { experiment: FullExperiment; onEdit: () => void }) {
  const { chemicals } = useData()
  const byStage = (arr: any[], s: Stage | null) => arr.filter((x) => (x.stage ?? null) === s).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const m = sampleMetrics(e)
  const cost = formulationCost(e, chemicals)
  const res = [...e.experiment_results].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  const matStages: { label: string; rows: Material[] }[] = e.is_two_step
    ? [{ label: 'Step 1 · Bulk', rows: byStage(e.experiment_materials, 'bulk') }, { label: 'Step 2 · Surface', rows: byStage(e.experiment_materials, 'surface') }]
    : [{ label: '', rows: byStage(e.experiment_materials, null).length ? byStage(e.experiment_materials, null) : [...e.experiment_materials] }]
  const procStages: { label: string; rows: ProcessStep[] }[] = e.is_two_step
    ? [{ label: 'Step 1 · Bulk', rows: byStage(e.experiment_processes, 'bulk') }, { label: 'Step 2 · Surface', rows: byStage(e.experiment_processes, 'surface') }]
    : [{ label: '', rows: byStage(e.experiment_processes, null).length ? byStage(e.experiment_processes, null) : [...e.experiment_processes] }]

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Meta label="Type"><TypePill type={e.experiment_type} /></Meta>
        <Meta label="Owner"><span className="flex items-center gap-2"><OwnerAvatar name={e.owner} size={22} /> <span className="text-sm">{e.owner || '—'}</span></span></Meta>
        <Meta label="Date"><span className="text-sm">{fmtDate(e.date)}</span></Meta>
        {e.project && projectByCode(e.project) && (
          <Meta label="Work package"><span className="pill" style={{ background: projectByCode(e.project)!.color + '1A', color: projectByCode(e.project)!.color }}>{projectByCode(e.project)!.label}</span></Meta>
        )}
        {e.is_two_step && <Meta label="Format"><span className="pill bg-brand-tint text-brand-dark"><Layers size={11} className="mr-1" />Two-step</span></Meta>}
        {e.repeat && <Meta label="Repeat"><span className="text-sm">{e.repeat}</span></Meta>}
        <div className="ml-auto"><button className="btn-outline" onClick={onEdit}><Pencil size={15} /> Edit</button></div>
      </div>

      {(m.FSC !== null || m.CRC !== null || m.AUP !== null) && (
        <div className="flex flex-wrap gap-2">
          {(['FSC', 'CRC', 'AUP'] as const).map((key) => m[key] !== null && <MetricPill key={key} k={key} value={m[key]} />)}
        </div>
      )}

      {e.discontinued && (
        <div className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-muted">
          <Ban size={15} /> This experiment is marked <span className="font-medium text-ink">discontinued</span> — no results expected.
        </div>
      )}

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
            <div className="mt-2 space-y-1">{res.filter((r) => r.comment).map((r, i) => <p key={i} className="text-sm text-muted"><span className="text-subtle">{r.result_type}:</span> {r.comment}</p>)}</div>
          )}
        </Section>
      )}

      {(cost.materialCost > 0 || e.extra_cost) && (
        <Section icon={<Coins size={15} />} title="Formulation cost">
          <div className="flex flex-wrap gap-2">
            <CostStat label="Materials" value={cost.materialCost} />
            {e.extra_cost ? <CostStat label="Process / other" value={e.extra_cost} /> : null}
            <CostStat label="Total" value={cost.totalCost} strong />
            {cost.costPerKg !== null && <CostStat label="Per kg" value={cost.costPerKg} suffix="/kg" />}
          </div>
          {!cost.complete && <p className="mt-1.5 text-2xs text-subtle">Some materials have no price set — cost is partial. Add prices in Library → Chemicals.</p>}
        </Section>
      )}

      {matStages.map((st, si) => st.rows.length > 0 && (
        <Section key={si} icon={<Beaker size={15} />} title={`Materials${st.label ? ` — ${st.label}` : ''}`}>
          <DataTable head={['#', 'Material', 'Amount', 'Ratio']} rows={st.rows.map((mm, i) => [String(i + 1), mm.name || '—', mm.mass_g != null ? `${mm.mass_g} ${(mm as any).unit ?? 'g'}` : '—', mm.ratio || '—'])} mono={[true, false, true, true]} />
        </Section>
      ))}

      {procStages.map((st, si) => st.rows.length > 0 && (
        <Section key={si} icon={<Cog size={15} />} title={`Process${st.label ? ` — ${st.label}` : ''}`}>
          <DataTable head={['#', 'Process', 'Measure', 'Value']} rows={st.rows.map((p, i) => [String(i + 1), p.process || '—', p.measure || '—', p.value || '—'])} mono={[true, false, false, true]} />
        </Section>
      ))}

      {e.method && (
        <Section icon={<FlaskConical size={15} />} title="Method">
          <p className="whitespace-pre-wrap rounded-lg border border-line bg-paper px-3.5 py-3 text-sm leading-relaxed text-ink">{e.method}</p>
        </Section>
      )}
    </div>
  )
}

function CostStat({ label, value, suffix, strong }: { label: string; value: number; suffix?: string; strong?: boolean }) {
  return (
    <div className={cx('rounded-lg border px-3 py-2', strong ? 'border-brand-ring bg-brand-tint' : 'border-line bg-paper')}>
      <div className="text-2xs uppercase tracking-wider text-muted">{label}</div>
      <div className={cx('data text-sm font-semibold', strong ? 'text-brand-dark' : 'text-ink')}>{value.toFixed(2)}{suffix ?? ''}</div>
    </div>
  )
}
function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="label mb-1">{label}</div>{children}</div>
}
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="animate-fadeUp">
      <div className="mb-2 flex items-center gap-2 text-muted"><span className="text-brand">{icon}</span><h3 className="text-sm font-semibold text-ink">{title}</h3></div>
      {children}
    </div>
  )
}
function DataTable({ head, rows, mono }: { head: string[]; rows: string[][]; mono?: boolean[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line bg-paper text-left text-2xs uppercase tracking-wider text-muted">{head.map((h, i) => <th key={i} className={cx('px-3 py-2 font-semibold', i === 0 && 'w-10')}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, ri) => <tr key={ri} className="border-b border-line last:border-0">{r.map((c, ci) => <td key={ci} className={cx('px-3 py-2 align-top', mono?.[ci] && 'data', ci === 0 && 'text-subtle')}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

/* ------------------------------- Edit form -------------------------------- */
function ExperimentForm({ experiment, onCancel, onSaved }: { experiment: FullExperiment | null; onCancel: () => void; onSaved: () => void }) {
  const { chemicals, types, processes, measures, results, owners, addRef, addChemicalByName, refetchExperiments } = useData()
  const { profile } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const [date, setDate] = useState(experiment?.date ?? todayISO())
  const [owner, setOwner] = useState(experiment?.owner ?? profile?.full_name ?? '')
  const [type, setType] = useState(experiment?.experiment_type ?? '')
  const [project, setProject] = useState(experiment?.project ?? '')
  const [repeat, setRepeat] = useState(experiment?.repeat ?? '')
  const [description, setDescription] = useState(experiment?.description ?? '')
  const [method, setMethod] = useState(experiment?.method ?? '')
  const [twoStep, setTwoStep] = useState(experiment?.is_two_step ?? false)
  const [discontinued, setDiscontinued] = useState(experiment?.discontinued ?? false)
  const [extraCost, setExtraCost] = useState<number | null>(experiment?.extra_cost ?? null)

  const [mats, setMats] = useState<MatRow[]>(
    experiment ? (experiment.experiment_materials.map((m) => ({ ...m, _k: k(), unit: (m as any).unit ?? 'g' })) as MatRow[]) : [blankMat(null)],
  )
  const [procs, setProcs] = useState<ProcRow[]>(
    experiment ? (experiment.experiment_processes.map((p) => ({ ...p, _k: k() })) as ProcRow[]) : [blankProc(null)],
  )
  const [res, setRes] = useState<ResRow[]>(experiment ? (experiment.experiment_results.map((r) => ({ ...r, _k: k() })) as ResRow[]) : [])
  const [busy, setBusy] = useState(false)

  const chemNames = useMemo(() => chemicals.map((c) => c.name), [chemicals])
  const typeNames = useMemo(() => types.map((t) => t.name), [types])
  const procNames = useMemo(() => processes.map((p) => p.name), [processes])
  const measureNames = useMemo(() => measures.map((m) => m.name), [measures])
  const resultNames = useMemo(() => results.map((r) => r.name), [results])

  const liveCost = useMemo(() => {
    let mat = 0, complete = true
    for (const m of mats) {
      if (!m.name || m.mass_g == null) continue
      const chem = chemicals.find((c) => c.name === m.name)
      if (chem?.price != null && (chem.price_unit ?? 'g') === m.unit) mat += m.mass_g * chem.price
      else complete = false
    }
    return { mat, total: mat + (extraCost ?? 0), complete }
  }, [mats, chemicals, extraCost])

  function toggleTwoStep(on: boolean) {
    setTwoStep(on)
    if (on) {
      setMats((ms) => ms.map((m) => ({ ...m, stage: m.stage ?? 'bulk' })))
      setProcs((ps) => ps.map((p) => ({ ...p, stage: p.stage ?? 'bulk' })))
    } else {
      setMats((ms) => ms.map((m) => ({ ...m, stage: null })))
      setProcs((ps) => ps.map((p) => ({ ...p, stage: null })))
    }
  }

  const updMat = (key: string, patch: Partial<MatRow>) => setMats((ms) => ms.map((m) => (m._k === key ? { ...m, ...patch } : m)))
  const updProc = (key: string, patch: Partial<ProcRow>) => setProcs((ps) => ps.map((p) => (p._k === key ? { ...p, ...patch } : p)))
  const updRes = (key: string, patch: Partial<ResRow>) => setRes((rs) => rs.map((r) => (r._k === key ? { ...r, ...patch } : r)))

  async function save() {
    setBusy(true)
    try {
      const cleanMats = mats.filter((m) => m.name?.trim()).map((m, i) => ({ position: i + 1, name: m.name!.trim(), mass_g: m.mass_g, unit: m.unit, ratio: m.ratio || null, stage: twoStep ? m.stage ?? 'bulk' : null }))
      const cleanProcs = procs.filter((p) => p.process?.trim() || p.measure?.trim() || p.value?.trim()).map((p, i) => ({ position: i + 1, process: p.process || null, measure: p.measure || null, value: p.value || null, stage: twoStep ? p.stage ?? 'bulk' : null }))
      const cleanRes = res.filter((r) => r.result_type?.trim()).map((r, i) => ({ position: i + 1, result_type: r.result_type!.trim(), value: r.value || null, value_num: parseNum(r.value), comment: r.comment || null }))

      const base = { date: date || null, owner: owner || null, experiment_type: type || null, repeat: repeat || null, description: description || null, method: method || null, is_two_step: twoStep, discontinued, extra_cost: extraCost, project: project || null }

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
        const { data, error } = await supabase.from('experiments').insert({ ...base, en: typeof enData === 'number' ? enData : undefined, created_by: profile?.id ?? null }).select('id').single()
        if (error) throw error
        expId = (data as { id: string }).id
      }
      if (expId) {
        const withId = <T,>(rows: T[]) => rows.map((r) => ({ ...r, experiment_id: expId }))
        const ins = await Promise.all([
          cleanMats.length ? supabase.from('experiment_materials').insert(withId(cleanMats)) : null,
          cleanProcs.length ? supabase.from('experiment_processes').insert(withId(cleanProcs)) : null,
          cleanRes.length ? supabase.from('experiment_results').insert(withId(cleanRes)) : null,
        ])
        const err = ins.find((r) => r && r.error)?.error
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

  const stages: { stage: Stage | null; label: string }[] = twoStep
    ? [{ stage: 'bulk', label: 'Step 1 · Bulk preparation' }, { stage: 'surface', label: 'Step 2 · Surface crosslinking' }]
    : [{ stage: null, label: '' }]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <div><label className="label">Date</label><input type="date" className="field" value={date ?? ''} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label className="label">Owner</label><Combobox value={owner} onChange={setOwner} options={owners} allowFreeText placeholder="Who ran it" onCreate={(v) => setOwner(v)} createLabel={(v) => `Use “${v}”`} /></div>
        <div><label className="label">Experiment type</label><Combobox value={type} onChange={setType} options={typeNames} onCreate={(v) => addRef('experiment_types', v)} placeholder="Select type" /></div>
        <div>
          <label className="label">Work package</label>
          <select className="field cursor-pointer" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">— Select project —</option>
            {PROJECTS.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Repeat?</label>
          <div className="flex gap-1.5">{['Yes', 'No'].map((opt) => (
            <button key={opt} type="button" onClick={() => setRepeat(repeat === opt ? '' : opt)} className={cx('flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition', repeat === opt ? 'border-brand bg-brand-tint text-brand-dark' : 'border-line bg-surface text-muted hover:bg-black/[0.03]')}>{opt}</button>
          ))}</div>
        </div>
        <div className="sm:col-span-2"><label className="label">Description</label><input className="field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short label, e.g. MD4-1" /></div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Toggle on={twoStep} onChange={toggleTwoStep} icon={<Layers size={15} />} label="Two-step sample" hint="Bulk + surface" />
        <Toggle on={discontinued} onChange={setDiscontinued} icon={<Ban size={15} />} label="Discontinued" hint="No results" tone="muted" />
      </div>

      {stages.map((st) => (
        <div key={st.label || 'single'} className={cx(twoStep && 'rounded-xl border border-line bg-paper/60 p-3.5')}>
          {st.label && <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy"><Layers size={14} className="text-brand" />{st.label}</div>}
          <RowSection icon={<Beaker size={15} />} title="Materials" onAdd={() => setMats((m) => [...m, blankMat(st.stage)])} addLabel="Add material">
            {mats.filter((m) => (m.stage ?? null) === st.stage).length === 0 && <p className="text-sm text-subtle">No materials yet.</p>}
            {mats.filter((m) => (m.stage ?? null) === st.stage).map((m) => (
              <div key={m._k} className="grid grid-cols-[1fr] gap-2 sm:grid-cols-[minmax(0,1fr)_92px_84px_92px_auto]">
                <Combobox value={m.name || ''} onChange={(v) => updMat(m._k, { name: v })} options={chemNames} onCreate={(v) => addChemicalByName(v)} placeholder="Chemical" createLabel={(v) => `Add “${v}” to chemicals`} />
                <input className="field data" type="number" step="any" inputMode="decimal" placeholder="Amount" value={m.mass_g ?? ''} onChange={(e) => updMat(m._k, { mass_g: e.target.value === '' ? null : parseFloat(e.target.value) })} />
                <UnitToggle value={m.unit} onChange={(u) => updMat(m._k, { unit: u })} />
                <input className="field data" placeholder="Ratio" value={m.ratio ?? ''} onChange={(e) => updMat(m._k, { ratio: e.target.value })} />
                <RemoveBtn onClick={() => setMats((ms) => ms.filter((x) => x._k !== m._k))} />
              </div>
            ))}
          </RowSection>

          <div className="mt-4">
            <RowSection icon={<Cog size={15} />} title="Process" onAdd={() => setProcs((p) => [...p, blankProc(st.stage)])} addLabel="Add step">
              {procs.filter((p) => (p.stage ?? null) === st.stage).length === 0 && <p className="text-sm text-subtle">No steps yet.</p>}
              {procs.filter((p) => (p.stage ?? null) === st.stage).map((p) => (
                <div key={p._k} className="grid grid-cols-[1fr] gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px_auto]">
                  <Combobox value={p.process || ''} onChange={(v) => updProc(p._k, { process: v })} options={procNames} onCreate={(v) => addRef('process_names', v)} placeholder="Process" createLabel={(v) => `Add “${v}”`} />
                  <Combobox value={p.measure || ''} onChange={(v) => updProc(p._k, { measure: v })} options={measureNames} onCreate={(v) => addRef('measure_types', v)} placeholder="Measure" createLabel={(v) => `Add “${v}”`} />
                  <input className="field data" placeholder="Value" value={p.value ?? ''} onChange={(e) => updProc(p._k, { value: e.target.value })} />
                  <RemoveBtn onClick={() => setProcs((ps) => ps.filter((x) => x._k !== p._k))} />
                </div>
              ))}
            </RowSection>
          </div>
        </div>
      ))}

      {!discontinued && (
        <RowSection icon={<Gauge size={15} />} title="Results" onAdd={() => setRes((r) => [...r, blankRes()])} addLabel="Add result">
          {res.length === 0 && <p className="text-sm text-subtle">No results yet — add them now or later.</p>}
          {res.map((r) => (
            <div key={r._k} className="grid grid-cols-[1fr] gap-2 sm:grid-cols-[minmax(0,1.2fr)_120px_minmax(0,1fr)_auto]">
              <Combobox value={r.result_type || ''} onChange={(v) => updRes(r._k, { result_type: v })} options={resultNames} onCreate={(v) => addRef('result_types', v)} placeholder="Result type" createLabel={(v) => `Add “${v}”`} />
              <input className="field data" placeholder="Value" value={r.value ?? ''} onChange={(e) => updRes(r._k, { value: e.target.value })} />
              <input className="field" placeholder="Comment (optional)" value={r.comment ?? ''} onChange={(e) => updRes(r._k, { comment: e.target.value })} />
              <RemoveBtn onClick={() => setRes((rs) => rs.filter((x) => x._k !== r._k))} />
            </div>
          ))}
        </RowSection>
      )}

      <div className="rounded-xl border border-line bg-paper/60 p-3.5">
        <div className="mb-2.5 flex items-center gap-2"><Coins size={15} className="text-brand" /><h3 className="text-sm font-semibold">Formulation cost <span className="font-normal text-subtle">· optional</span></h3></div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-3">
          <div>
            <label className="label">Process / overhead cost</label>
            <input className="field data" type="number" step="any" inputMode="decimal" placeholder="e.g. 1.50" value={extraCost ?? ''} onChange={(e) => setExtraCost(e.target.value === '' ? null : parseFloat(e.target.value))} />
          </div>
          <div className="flex items-end sm:col-span-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Materials <span className="data font-semibold text-ink">{liveCost.mat.toFixed(2)}</span></span>
              <span className="text-subtle">+ overhead</span>
              <span className="rounded-md bg-brand-tint px-2 py-1 text-brand-dark">Total <span className="data font-semibold">{liveCost.total.toFixed(2)}</span></span>
            </div>
          </div>
        </div>
        <p className="mt-2 text-2xs text-subtle">{liveCost.mat === 0 ? 'Add prices to chemicals in Library to compute material cost.' : liveCost.complete ? 'Material cost from chemical prices in Library.' : 'Partial — some materials have no price set.'} Final costing refines automatically once a TEA file is imported.</p>
      </div>

      <div><label className="label">Method</label><textarea className="field min-h-[120px] resize-y leading-relaxed" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Describe the procedure…" /></div>

      <div className="sticky bottom-0 -mx-5 -mb-4 flex items-center justify-between gap-2 border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <div>
          {experiment && (
            <button className="btn-danger" onClick={async () => {
              if (await confirm({ title: `Delete EN${experiment.en}?`, message: 'This removes the experiment and all its data. This cannot be undone.', confirmLabel: 'Delete', danger: true })) {
                await supabase.from('experiments').delete().eq('id', experiment.id); await refetchExperiments(); toast('Experiment deleted'); onSaved()
              }
            }}><Trash2 size={15} /> Delete</button>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : experiment ? 'Save changes' : 'Create experiment'}</button>
        </div>
      </div>
    </div>
  )
}

function UnitToggle({ value, onChange }: { value: AmountUnit; onChange: (u: AmountUnit) => void }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-line">
      {(['g', 'mL'] as AmountUnit[]).map((u) => (
        <button key={u} type="button" onClick={() => onChange(u)} className={cx('flex-1 px-2 py-2 text-xs font-semibold transition', value === u ? (u === 'mL' ? 'bg-brand text-white' : 'bg-navy text-white') : 'bg-surface text-muted hover:bg-black/[0.03]')}>
          {u === 'mL' ? <Droplet size={12} className="mx-auto" /> : 'g'}
        </button>
      ))}
    </div>
  )
}
function Toggle({ on, onChange, icon, label, hint, tone }: { on: boolean; onChange: (v: boolean) => void; icon: React.ReactNode; label: string; hint?: string; tone?: 'brand' | 'muted' }) {
  const active = tone === 'muted' ? 'border-ink/30 bg-black/[0.05] text-ink' : 'border-brand bg-brand-tint text-brand-dark'
  return (
    <button type="button" onClick={() => onChange(!on)} className={cx('flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all', on ? active : 'border-line bg-surface text-muted hover:bg-black/[0.02]')}>
      <span className={cx('grid h-7 w-7 place-items-center rounded-lg', on ? 'bg-white/70' : 'bg-black/[0.04]')}>{icon}</span>
      <span className="text-left leading-tight">{label}{hint && <span className="block text-2xs font-normal text-subtle">{hint}</span>}</span>
      <span className={cx('ml-1 h-4 w-7 rounded-full p-0.5 transition-colors', on ? 'bg-brand' : 'bg-black/15')}><span className={cx('block h-3 w-3 rounded-full bg-white transition-transform', on && 'translate-x-3')} /></span>
    </button>
  )
}
function RowSection({ icon, title, onAdd, addLabel, children }: { icon: React.ReactNode; title: string; onAdd: () => void; addLabel: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2"><span className="text-brand">{icon}</span><h3 className="text-sm font-semibold">{title}</h3></div>
        <button type="button" className="btn-ghost h-8 text-brand-dark" onClick={onAdd}><Plus size={15} /> {addLabel}</button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
function RemoveBtn({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="btn-ghost h-9 w-9 shrink-0 self-start p-0 text-subtle hover:text-danger" aria-label="Remove row"><Trash2 size={16} /></button>
}
