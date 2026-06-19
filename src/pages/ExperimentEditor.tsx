import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, FlaskConical, Beaker, Cog, Gauge, Layers, Ban, Coins, Droplet, Scale, Variable, X, Boxes, Palette } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { FullExperiment, Material, ProcessStep, ResultEntry, AmountUnit, Stage, Batch, Observation } from '../lib/types'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { Modal, Spinner, TypePill, OwnerAvatar, MetricPill, Segmented, useToast, useConfirm } from '../components/ui'
import { Combobox } from '../components/Combobox'
import { cx, fmtDate, parseNum, todayISO } from '../lib/utils'
import { sampleMetrics, formulationCost, computeFSC, computeCRC, computeAUP, ABS_CONST, METRIC_COLOR } from '../lib/metrics'
import { PROJECTS, projectByCode } from '../lib/projects'

type Mode = 'view' | 'edit' | 'new'
let KEY = 0
const k = () => `r${++KEY}`
type MatRow = Material & { _k: string; vary?: boolean; values?: string[]; fromBatch?: boolean }
type ProcRow = ProcessStep & { _k: string; vary?: boolean; values?: string[] }
type ResRow = ResultEntry & { _k: string }
type ObsRow = Observation & { _k: string }
const blankMat = (stage: Stage | null): MatRow => ({ _k: k(), position: null, name: '', mass_g: null, unit: 'g', ratio: '', stage, batch_id: null, fromBatch: false, vary: false, values: [] })
const blankProc = (stage: Stage | null): ProcRow => ({ _k: k(), position: null, process: '', measure: '', value: '', stage, vary: false, values: [] })
const blankRes = (): ResRow => ({ _k: k(), position: null, result_type: '', value: '', value_num: null, comment: '' })
// canonical absorbency result names (final, already-calculated values)
const isFsc = (n: string) => /^fsc in saline/i.test(n)
const isCrc = (n: string) => /^crc in saline/i.test(n)
const isAup = (n: string) => /^aup in saline/i.test(n)
const isCanonMetric = (n?: string | null) => !!n && (isFsc(n) || isCrc(n) || isAup(n))
const blankObs = (): ObsRow => ({ _k: k(), position: null, attribute: '', value: '', stage: null })
const DEFAULT_ATTRS = ['Colour', 'Texture', 'Final structure', 'Consistency', 'Clarity', 'Odour', 'Solubility', 'Foaming', 'General evaluation', 'Outcome']

export function ExperimentModal({ open, experiment, initialMode, onClose }: { open: boolean; experiment: FullExperiment | null; initialMode: Mode; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const { profile, isAdmin } = useAuth()
  const canEdit = !experiment || isAdmin || (!!experiment.created_by && experiment.created_by === profile?.id)
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
        <ExperimentView experiment={experiment} canEdit={canEdit} onEdit={() => setMode('edit')} />
      ) : (
        <ExperimentForm experiment={mode === 'edit' ? experiment : null} canEdit={canEdit} onCancel={() => (experiment ? setMode('view') : onClose())} onSaved={onClose} />
      )}
    </Modal>
  )
}

/* ----------------------------- Read-only view ----------------------------- */
function ExperimentView({ experiment: e, canEdit, onEdit }: { experiment: FullExperiment; canEdit: boolean; onEdit: () => void }) {
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
        <div className="ml-auto">{canEdit
          ? <button className="btn-outline" onClick={onEdit}><Pencil size={15} /> Edit</button>
          : <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs text-subtle"><Ban size={13} /> View only · {e.owner || 'owner'}’s experiment</span>}
        </div>
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

      {(e.experiment_observations ?? []).length > 0 && (
        <Section icon={<Palette size={15} />} title="Qualitative observations">
          <div className="flex flex-wrap gap-2">
            {(e.experiment_observations ?? []).map((o, i) => (
              <div key={i} className="rounded-lg border border-orange/30 bg-orange/[0.06] px-3 py-1.5 text-sm">
                {o.attribute && <span className="font-semibold text-orange-dark">{o.attribute}: </span>}
                <span className="text-ink">{o.value || '—'}</span>
              </div>
            ))}
          </div>
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
function ExperimentForm({ experiment, canEdit, onCancel, onSaved }: { experiment: FullExperiment | null; canEdit: boolean; onCancel: () => void; onSaved: () => void }) {
  const { chemicals, types, processes, measures, results, owners, addRef, addChemicalByName, refetchExperiments, batches } = useData()
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
  const [fscMass, setFscMass] = useState<number | null>(experiment?.fsc_mass ?? null)
  const [crcMass, setCrcMass] = useState<number | null>(experiment?.crc_mass ?? null)
  const [aupMass, setAupMass] = useState<number | null>(experiment?.aup_mass ?? null)
  // per-sample absorbency readings for a varying series, keyed by the varying value
  const [seriesReadings, setSeriesReadings] = useState<Record<string, { fsc: string; crc: string; aup: string }>>({})
  const updSeries = (val: string, field: 'fsc' | 'crc' | 'aup', v: string) =>
    setSeriesReadings((prev) => ({ ...prev, [val]: { ...(prev[val] ?? { fsc: '', crc: '', aup: '' }), [field]: v } }))

  const [mats, setMats] = useState<MatRow[]>(
    experiment ? (experiment.experiment_materials.map((m) => ({ ...m, _k: k(), unit: (m as any).unit ?? 'g', fromBatch: !!(m as any).batch_id })) as MatRow[]) : [blankMat(null)],
  )
  const [procs, setProcs] = useState<ProcRow[]>(
    experiment ? (experiment.experiment_processes.map((p) => ({ ...p, _k: k() })) as ProcRow[]) : [blankProc(null)],
  )
  const initRes = experiment?.experiment_results ?? []
  const pickVal = (test: (n: string) => boolean) => { const row = initRes.find((r) => r.result_type && test(r.result_type)); return row ? String(row.value_num ?? row.value ?? '') : '' }
  const [finalFsc, setFinalFsc] = useState(pickVal(isFsc))
  const [finalCrc, setFinalCrc] = useState(pickVal(isCrc))
  const [finalAup, setFinalAup] = useState(pickVal(isAup))
  const [res, setRes] = useState<ResRow[]>(experiment ? (initRes.filter((r) => !isCanonMetric(r.result_type)).map((r) => ({ ...r, _k: k() })) as ResRow[]) : [])
  const hasReadingInit = (experiment?.fsc_mass ?? null) !== null || (experiment?.crc_mass ?? null) !== null || (experiment?.aup_mass ?? null) !== null
  const [absMode, setAbsMode] = useState<'final' | 'reading'>(hasReadingInit ? 'reading' : 'final')
  const [obs, setObs] = useState<ObsRow[]>(experiment ? ((experiment.experiment_observations ?? []).map((o) => ({ ...o, _k: k() })) as ObsRow[]) : [])
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
  const updObs = (key: string, patch: Partial<ObsRow>) => setObs((os) => os.map((o) => (o._k === key ? { ...o, ...patch } : o)))

  // Only one varying factor at a time. Turning one on clears the rest and seeds its
  // values from whatever single value was already typed.
  const markVary = (kind: 'mat' | 'proc', key: string, on: boolean) => {
    setMats((ms) => ms.map((m) => {
      if (kind === 'mat' && m._k === key) {
        const seed = m.values && m.values.length ? m.values : m.mass_g != null ? [String(m.mass_g)] : []
        return { ...m, vary: on, values: on ? seed : m.values ?? [] }
      }
      return { ...m, vary: false }
    }))
    setProcs((ps) => ps.map((p) => {
      if (kind === 'proc' && p._k === key) {
        const seed = p.values && p.values.length ? p.values : p.value ? [p.value] : []
        return { ...p, vary: on, values: on ? seed : p.values ?? [] }
      }
      return { ...p, vary: false }
    }))
  }

  // active varying factor (new experiments only)
  const allowVary = !experiment
  const varyMat = allowVary ? mats.find((m) => m.vary && m.name?.trim() && (m.values?.filter((v) => v.trim()).length ?? 0) > 0) : undefined
  const varyProc = allowVary && !varyMat ? procs.find((p) => p.vary && (p.process?.trim() || p.measure?.trim()) && (p.values?.filter((v) => v.trim()).length ?? 0) > 0) : undefined
  const varyValues = (varyMat?.values ?? varyProc?.values ?? []).map((v) => v.trim()).filter(Boolean)
  const varyCount = varyValues.length
  const varyUnit = varyMat?.unit ?? ''
  const varyLabel = varyMat ? `${varyMat.name} (${varyMat.unit})` : varyProc ? varyProc.measure || varyProc.process || 'process value' : ''

  const batchLabel = (b: Batch) => `${b.code ? b.code + ' · ' : ''}${b.name}`
  const batchOptions = batches.map(batchLabel)
  const pickBatch = (key: string, label: string) => { const b = batches.find((x) => batchLabel(x) === label); updMat(key, { batch_id: b?.id ?? null, name: label }) }

  async function save() {
    setBusy(true)
    try {
      const matsFiltered = mats.filter((m) => m.name?.trim())
      const procsFiltered = procs.filter((p) => p.process?.trim() || p.measure?.trim() || p.value?.trim())
      const cleanMats = matsFiltered.map((m, i) => ({ position: i + 1, name: m.name!.trim(), mass_g: m.mass_g, unit: m.unit, ratio: m.ratio || null, stage: twoStep ? m.stage ?? 'bulk' : null, batch_id: m.batch_id ?? null }))
      const cleanProcs = procsFiltered.map((p, i) => ({ position: i + 1, process: p.process || null, measure: p.measure || null, value: p.value || null, stage: twoStep ? p.stage ?? 'bulk' : null }))
      const cleanRes = res.filter((r) => r.result_type?.trim()).map((r, i) => ({ position: i + 1, result_type: r.result_type!.trim(), value: r.value || null, value_num: parseNum(r.value), comment: r.comment || null }))
      const absFinalRows = absMode === 'final'
        ? ([['FSC in saline (g/g)', finalFsc], ['CRC in saline (g/g)', finalCrc], ['AUP in saline (0.7 PSI) (g/g)', finalAup]] as const)
          .filter(([, v]) => String(v).trim() !== '')
          .map(([name, v]) => ({ position: 0, result_type: name, value: String(v).trim(), value_num: parseNum(String(v)), comment: null }))
        : []
      const cleanResFull = [...cleanRes, ...absFinalRows].map((r, i) => ({ ...r, position: i + 1 }))
      const cleanObs = obs.filter((o) => o.attribute?.trim() || o.value?.trim()).map((o, i) => ({ position: i + 1, attribute: o.attribute?.trim() || null, value: o.value?.trim() || null, stage: null }))

      const noMass = (v: number | null) => (discontinued || absMode === 'final' ? null : v)
      const base = { date: date || null, owner: owner || null, experiment_type: type || null, repeat: repeat || null, description: description || null, method: method || null, is_two_step: twoStep, discontinued, extra_cost: extraCost, project: project || null, fsc_mass: noMass(fscMass), crc_mass: noMass(crcMass), aup_mass: noMass(aupMass) }

      // ----- Varying factor → create a separate experiment per value (new only) -----
      const vMatIdx = matsFiltered.findIndex((m) => m.vary && m.values?.some((v) => v.trim() !== ''))
      const vProcIdx = vMatIdx < 0 ? procsFiltered.findIndex((p) => p.vary && p.values?.some((v) => v.trim() !== '')) : -1
      const series = vMatIdx >= 0 ? matsFiltered[vMatIdx].values! : vProcIdx >= 0 ? procsFiltered[vProcIdx].values! : []
      const seriesVals = series.map((v) => v.trim()).filter(Boolean)

      if (!experiment && seriesVals.length >= 1 && (vMatIdx >= 0 || vProcIdx >= 0)) {
        const unit = vMatIdx >= 0 ? matsFiltered[vMatIdx].unit : ''
        const baseDesc = description?.trim() || ''
        const createdEns: number[] = []
        for (const raw of seriesVals) {
          const matsForThis = cleanMats.map((mm, i) => (i === vMatIdx ? { ...mm, mass_g: parseNum(raw) } : mm))
          const procsForThis = cleanProcs.map((pp, i) => (i === vProcIdx ? { ...pp, value: raw } : pp))
          const suffix = vMatIdx >= 0 ? `${raw} ${unit}`.trim() : `${raw}`
          const desc = baseDesc ? `${baseDesc} — ${suffix}` : `${(cleanMats[vMatIdx]?.name ?? 'run')} ${suffix}`.trim()
          const { data: enData } = await supabase.rpc('get_next_en')
          const en = typeof enData === 'number' ? enData : undefined
          const rdg = seriesReadings[raw] ?? { fsc: '', crc: '', aup: '' }
          const readingNum = (s: string) => (s.trim() === '' ? null : parseNum(s))
          const expRow = {
            ...base, description: desc, en, created_by: profile?.id ?? null,
            fsc_mass: discontinued ? null : readingNum(rdg.fsc),
            crc_mass: discontinued ? null : readingNum(rdg.crc),
            aup_mass: discontinued ? null : readingNum(rdg.aup),
          }
          const { data, error } = await supabase.from('experiments').insert(expRow).select('id,en').single()
          if (error) throw error
          const id = (data as any).id as string
          if (typeof (data as any).en === 'number') createdEns.push((data as any).en)
          const ins = await Promise.all([
            matsForThis.length ? supabase.from('experiment_materials').insert(matsForThis.map((r) => ({ ...r, experiment_id: id }))) : null,
            procsForThis.length ? supabase.from('experiment_processes').insert(procsForThis.map((r) => ({ ...r, experiment_id: id }))) : null,
            cleanRes.length ? supabase.from('experiment_results').insert(cleanRes.map((r) => ({ ...r, experiment_id: id }))) : null,
            cleanObs.length ? supabase.from('experiment_observations').insert(cleanObs.map((r) => ({ ...r, experiment_id: id }))) : null,
          ])
          const e2 = ins.find((r) => r && r.error)?.error
          if (e2) throw e2
        }
        await refetchExperiments()
        const range = createdEns.length ? (createdEns.length > 1 ? ` (EN${Math.min(...createdEns)}–EN${Math.max(...createdEns)})` : ` (EN${createdEns[0]})`) : ''
        toast(`Created ${seriesVals.length} experiments${range}`)
        onSaved()
        return
      }

      // ----- Single experiment (create or edit) -----
      let expId = experiment?.id
      if (experiment) {
        const { error } = await supabase.from('experiments').update(base).eq('id', experiment.id)
        if (error) throw error
        await Promise.all([
          supabase.from('experiment_materials').delete().eq('experiment_id', experiment.id),
          supabase.from('experiment_processes').delete().eq('experiment_id', experiment.id),
          supabase.from('experiment_results').delete().eq('experiment_id', experiment.id),
          supabase.from('experiment_observations').delete().eq('experiment_id', experiment.id),
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
          cleanResFull.length ? supabase.from('experiment_results').insert(withId(cleanResFull)) : null,
          cleanObs.length ? supabase.from('experiment_observations').insert(withId(cleanObs)) : null,
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
      <div className="-mx-5 -mt-4 mb-1 border-b border-line bg-gradient-to-r from-brand-tint via-[#EEF3FB] to-orange-tint/50 px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-navy">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white shadow-card"><FlaskConical size={15} /></span>
          {experiment ? `Editing EN${experiment.en}` : 'New experiment'}
        </div>
        <p className="mt-0.5 text-2xs text-muted">{experiment ? 'Update the details below — changes sync to the team instantly.' : 'Fill in what you know. You can add results and costs any time.'}</p>
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <div><label className="label">Date</label><input type="date" className="field" value={date ?? ''} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label className="label">Owner</label><Combobox value={owner} onChange={setOwner} options={owners} allowFreeText placeholder="Who ran it" onCreate={(v) => setOwner(v)} createLabel={(v) => `Use “${v}”`} /></div>
        <div><label className="label">Experiment type</label><Combobox value={type} onChange={setType} options={typeNames} onCreate={(v) => addRef('experiment_types', v)} placeholder="Select type" /></div>
        <div>
          <label className="label">Repeat?</label>
          <div className="flex gap-1.5">{['Yes', 'No'].map((opt) => (
            <button key={opt} type="button" onClick={() => setRepeat(repeat === opt ? '' : opt)} className={cx('flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition', repeat === opt ? 'border-brand bg-brand-tint text-brand-dark' : 'border-line bg-surface text-muted hover:bg-black/[0.03]')}>{opt}</button>
          ))}</div>
        </div>
        <div className="sm:col-span-2"><label className="label">Description</label><input className="field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short label, e.g. MD4-1" /></div>
      </div>

      <div>
        <label className="label">Work package</label>
        <div className="flex flex-wrap gap-1.5">
          {PROJECTS.map((p) => {
            const on = project === p.code
            return (
              <button key={p.code} type="button" onClick={() => setProject(on ? '' : p.code)} className={cx('rounded-full border px-3 py-1.5 text-xs font-medium transition-all', on ? 'text-white shadow-card' : 'border-line bg-paper text-muted hover:bg-black/[0.03]')} style={on ? { background: p.color, borderColor: p.color } : undefined}>
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Toggle on={twoStep} onChange={toggleTwoStep} icon={<Layers size={15} />} label="Two-step sample" hint="Bulk + surface" />
        <Toggle on={discontinued} onChange={setDiscontinued} icon={<Ban size={15} />} label="Discontinued" hint="No results" tone="muted" />
      </div>

      {allowVary && varyCount >= 1 && (
        <div className="flex items-start gap-2.5 rounded-xl border px-4 py-3" style={{ borderColor: '#6C5CE055', background: '#6C5CE012' }}>
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white" style={{ background: '#6C5CE0' }}><Variable size={15} /></span>
          <div className="text-sm">
            <span className="font-semibold text-ink">Series mode · varying {varyLabel}</span>
            <p className="mt-0.5 text-muted">Submitting creates <span className="font-semibold text-ink">{varyCount}</span> separate experiment{varyCount > 1 ? 's' : ''} — one per value ({varyValues.join(', ')}), identical apart from this factor.</p>
          </div>
        </div>
      )}

      {stages.map((st) => (
        <div key={st.label || 'single'} className={cx(twoStep && 'rounded-xl border p-3.5', twoStep && (st.stage === 'surface' ? 'border-orange/30 bg-orange-tint/30' : 'border-brand/25 bg-brand-tint/25'))}>
          {st.label && <div className={cx('mb-3 flex items-center gap-2 text-sm font-semibold', st.stage === 'surface' ? 'text-orange-dark' : 'text-brand-dark')}><Layers size={14} />{st.label}</div>}
          <RowSection icon={<Beaker size={15} />} title="Materials" tone="teal" onAdd={() => setMats((m) => [...m, blankMat(st.stage)])} addLabel="Add material">
            {mats.filter((m) => (m.stage ?? null) === st.stage).length === 0 && <p className="text-sm text-subtle">No materials yet.</p>}
            {mats.filter((m) => (m.stage ?? null) === st.stage).map((m) => (
              <div key={m._k} className="space-y-2">
                {m.fromBatch ? (
                  <div className="grid grid-cols-[1fr] gap-2 rounded-lg border border-[#6C5CE0]/25 bg-[#6C5CE0]/[0.05] p-2 sm:grid-cols-[minmax(0,1fr)_92px_84px_auto]">
                    <div className="sm:col-span-1">
                      <div className="mb-1 flex items-center gap-1.5 text-2xs font-semibold" style={{ color: '#5A4BD0' }}><Boxes size={12} /> From batch</div>
                      <Combobox value={m.name || ''} onChange={(v) => pickBatch(m._k, v)} options={batchOptions} placeholder="Pick a batch…" />
                    </div>
                    <div><div className="mb-1 text-2xs text-subtle">Portion used</div><input className="field data" type="number" step="any" inputMode="decimal" placeholder="e.g. 1.5" value={m.mass_g ?? ''} onChange={(e) => updMat(m._k, { mass_g: e.target.value === '' ? null : parseFloat(e.target.value) })} /></div>
                    <div><div className="mb-1 text-2xs text-subtle">Unit</div><UnitToggle value={m.unit} onChange={(u) => updMat(m._k, { unit: u })} /></div>
                    <div className="flex items-end"><RemoveBtn onClick={() => setMats((ms) => ms.filter((x) => x._k !== m._k))} /></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-[1fr] gap-2 sm:grid-cols-[minmax(0,1fr)_92px_84px_92px_auto]">
                    <Combobox value={m.name || ''} onChange={(v) => updMat(m._k, { name: v })} options={chemNames} onCreate={(v) => addChemicalByName(v)} placeholder="Chemical" createLabel={(v) => `Add “${v}” to chemicals`} />
                    <input className="field data" type="number" step="any" inputMode="decimal" placeholder={m.vary ? 'varies ↓' : 'Amount'} disabled={!!m.vary} value={m.vary ? '' : m.mass_g ?? ''} onChange={(e) => updMat(m._k, { mass_g: e.target.value === '' ? null : parseFloat(e.target.value) })} />
                    <UnitToggle value={m.unit} onChange={(u) => updMat(m._k, { unit: u })} />
                    <input className="field data" placeholder="Ratio" value={m.ratio ?? ''} onChange={(e) => updMat(m._k, { ratio: e.target.value })} />
                    <div className="flex items-center gap-1">
                      {allowVary && <VaryToggle on={!!m.vary} onClick={() => markVary('mat', m._k, !m.vary)} />}
                      <RemoveBtn onClick={() => setMats((ms) => ms.filter((x) => x._k !== m._k))} />
                    </div>
                  </div>
                )}
                {m.vary && !m.fromBatch && <VaryValues values={m.values ?? []} unitLabel={m.unit} onChange={(vals) => updMat(m._k, { values: vals })} />}
              </div>
            ))}
            <button type="button" onClick={() => setMats((ms) => [...ms, { ...blankMat(st.stage), fromBatch: true }])} className="btn-soft-violet h-8 w-fit px-3 text-xs"><Boxes size={14} /> Use a batch</button>
          </RowSection>

          <div className="mt-4">
            <RowSection icon={<Cog size={15} />} title="Process" tone="navy" onAdd={() => setProcs((p) => [...p, blankProc(st.stage)])} addLabel="Add step">
              {procs.filter((p) => (p.stage ?? null) === st.stage).length === 0 && <p className="text-sm text-subtle">No steps yet.</p>}
              {procs.filter((p) => (p.stage ?? null) === st.stage).map((p) => (
                <div key={p._k} className="space-y-2">
                  <div className="grid grid-cols-[1fr] gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px_auto]">
                    <Combobox value={p.process || ''} onChange={(v) => updProc(p._k, { process: v })} options={procNames} onCreate={(v) => addRef('process_names', v)} placeholder="Process" createLabel={(v) => `Add “${v}”`} />
                    <Combobox value={p.measure || ''} onChange={(v) => updProc(p._k, { measure: v })} options={measureNames} onCreate={(v) => addRef('measure_types', v)} placeholder="Measure" createLabel={(v) => `Add “${v}”`} />
                    <input className="field data" placeholder={p.vary ? 'varies ↓' : 'Value'} disabled={!!p.vary} value={p.vary ? '' : p.value ?? ''} onChange={(e) => updProc(p._k, { value: e.target.value })} />
                    <div className="flex items-center gap-1">
                      {allowVary && <VaryToggle on={!!p.vary} onClick={() => markVary('proc', p._k, !p.vary)} />}
                      <RemoveBtn onClick={() => setProcs((ps) => ps.filter((x) => x._k !== p._k))} />
                    </div>
                  </div>
                  {p.vary && <VaryValues values={p.values ?? []} onChange={(vals) => updProc(p._k, { values: vals })} />}
                </div>
              ))}
            </RowSection>
          </div>
        </div>
      ))}

      {!discontinued && (
        <>
          <div className="rounded-xl border border-orange/25 bg-orange-tint/25 p-3.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2"><Scale size={15} className="text-orange" /><h3 className="text-sm font-semibold">Absorbency</h3></div>
              {!(allowVary && varyCount >= 1) && (
                <Segmented size="sm" value={absMode} onChange={(v) => setAbsMode(v as 'final' | 'reading')} options={[{ value: 'final', label: 'Final values' }, { value: 'reading', label: 'From readings' }]} />
              )}
            </div>
            {allowVary && varyCount >= 1 ? (
              <>
                <p className="mb-3 text-xs text-muted">Enter the test masses for each value in the series — each row becomes that sample’s FSC, CRC and AUP.</p>
                <div className="space-y-2">
                  {varyValues.map((val, i) => {
                    const r = seriesReadings[val] ?? { fsc: '', crc: '', aup: '' }
                    return (
                      <div key={val + i} className="rounded-lg border border-line bg-surface p-2.5">
                        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ background: '#6C5CE0' }}><Variable size={12} /><span className="data">{val}{varyUnit ? ` ${varyUnit}` : ''}</span></div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <MiniAbs mkey="FSC" raw={r.fsc} compute={computeFSC} onChange={(v) => updSeries(val, 'fsc', v)} placeholder="swollen mass (g)" />
                          <MiniAbs mkey="CRC" raw={r.crc} compute={computeCRC} onChange={(v) => updSeries(val, 'crc', v)} placeholder="after centrifuge (g)" />
                          <MiniAbs mkey="AUP" raw={r.aup} compute={computeAUP} onChange={(v) => updSeries(val, 'aup', v)} placeholder="after AUP (g)" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : absMode === 'final' ? (
              <>
                <p className="mb-3 text-xs text-muted">Enter the final absorbency you already calculated (g absorbed per g dry gel). These save straight as the experiment’s results.</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <FinalAbs mkey="FSC" value={finalFsc} setValue={setFinalFsc} label="FSC in saline" />
                  <FinalAbs mkey="CRC" value={finalCrc} setValue={setFinalCrc} label="CRC in saline" />
                  <FinalAbs mkey="AUP" value={finalAup} setValue={setFinalAup} label="AUP in saline (0.7 PSI)" />
                </div>
              </>
            ) : (
              <>
                <p className="mb-3 text-xs text-muted">Enter the measured sample mass after each test — the app converts to g absorbed per g dry gel.</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <AbsInput mkey="FSC" reading={fscMass} setReading={setFscMass} compute={computeFSC} label="FSC" caption="Mass of swollen gel (g)" hint={`= ((mass − ${ABS_CONST.fsc.tare}) − ${ABS_CONST.fsc.dry}) / ${ABS_CONST.fsc.dry}`} />
                  <AbsInput mkey="CRC" reading={crcMass} setReading={setCrcMass} compute={computeCRC} label="CRC" caption="Mass after centrifuge (g)" hint={`= (mass − ${ABS_CONST.crc.tare}) / ${ABS_CONST.crc.dry}`} />
                  <AbsInput mkey="AUP" reading={aupMass} setReading={setAupMass} compute={computeAUP} label="AUP" caption="Mass after AUP test (g)" hint={`= (mass − ${ABS_CONST.aup.tare}) / ${ABS_CONST.aup.dry}`} />
                </div>
              </>
            )}
          </div>

          <RowSection icon={<Gauge size={15} />} title="Other results" tone="violet" onAdd={() => setRes((r) => [...r, blankRes()])} addLabel="Add result">
            {res.length === 0 && <p className="text-sm text-subtle">Optional — add any other measurements (pH, gel fraction, notes…).</p>}
            {res.map((r) => (
              <div key={r._k} className="grid grid-cols-[1fr] gap-2 sm:grid-cols-[minmax(0,1.2fr)_120px_minmax(0,1fr)_auto]">
                <Combobox value={r.result_type || ''} onChange={(v) => updRes(r._k, { result_type: v })} options={resultNames} onCreate={(v) => addRef('result_types', v)} placeholder="Result type" createLabel={(v) => `Add “${v}”`} />
                <input className="field data" placeholder="Value" value={r.value ?? ''} onChange={(e) => updRes(r._k, { value: e.target.value })} />
                <input className="field" placeholder="Comment (optional)" value={r.comment ?? ''} onChange={(e) => updRes(r._k, { comment: e.target.value })} />
                <RemoveBtn onClick={() => setRes((rs) => rs.filter((x) => x._k !== r._k))} />
              </div>
            ))}
          </RowSection>

          <div className="mt-4">
            <RowSection icon={<Palette size={15} />} title="Qualitative observations" tone="orange" onAdd={() => setObs((o) => [...o, blankObs()])} addLabel="Add observation">
              {obs.length === 0 && <p className="text-sm text-subtle">Describe what the product looks/feels like — colour, texture, final structure, general evaluation. Useful when a sample isn’t good enough for absorbency testing.</p>}
              {obs.map((o) => (
                <div key={o._k} className="grid grid-cols-[1fr] gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_auto]">
                  <Combobox value={o.attribute || ''} onChange={(v) => updObs(o._k, { attribute: v })} options={DEFAULT_ATTRS} placeholder="Attribute (e.g. Colour)" />
                  <input className="field" placeholder="Observation (e.g. pale yellow, brittle foam)" value={o.value ?? ''} onChange={(e) => updObs(o._k, { value: e.target.value })} />
                  <RemoveBtn onClick={() => setObs((os) => os.filter((x) => x._k !== o._k))} />
                </div>
              ))}
            </RowSection>
          </div>
        </>
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
          {experiment && canEdit && (
            <button className="btn-danger" onClick={async () => {
              if (await confirm({ title: `Delete EN${experiment.en}?`, message: 'This removes the experiment and all its data. This cannot be undone.', confirmLabel: 'Delete', danger: true })) {
                await supabase.from('experiments').delete().eq('id', experiment.id); await refetchExperiments(); toast('Experiment deleted'); onSaved()
              }
            }}><Trash2 size={15} /> Delete</button>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : experiment ? 'Save changes' : varyCount >= 2 ? `Create ${varyCount} experiments` : 'Create experiment'}</button>
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
function MiniAbs({ mkey, raw, compute, onChange, placeholder }: { mkey: 'FSC' | 'CRC' | 'AUP'; raw: string; compute: (n: number) => number; onChange: (v: string) => void; placeholder: string }) {
  const color = METRIC_COLOR[mkey]
  const num = raw.trim() === '' ? null : parseFloat(raw)
  const v = num == null || Number.isNaN(num) ? null : compute(num)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-2xs font-bold tracking-wide" style={{ color }}>{mkey}</span>
        <span className="data text-2xs font-bold tabular-nums" style={{ color }}>{v != null ? `${v} g/g` : '—'}</span>
      </div>
      <input className="field data h-9" type="number" step="any" inputMode="decimal" placeholder={placeholder} value={raw} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function VaryToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title="Vary this value across a set of experiments" aria-label="Vary this value" className={cx('grid h-9 w-9 place-items-center rounded-lg border transition', on ? 'border-transparent text-white shadow-card' : 'border-line text-subtle hover:bg-black/[0.03]')} style={on ? { background: '#6C5CE0' } : undefined}>
      <Variable size={15} />
    </button>
  )
}

function VaryValues({ values, unitLabel, onChange }: { values: string[]; unitLabel?: string; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const parts = draft.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
    if (parts.length) onChange([...values, ...parts])
    setDraft('')
  }
  return (
    <div className="rounded-lg border p-2.5" style={{ borderColor: '#6C5CE055', background: '#6C5CE00D' }}>
      <div className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold" style={{ color: '#5A4BD0' }}><Variable size={12} /> Varying values{unitLabel ? ` (${unitLabel})` : ''}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {values.map((v, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ background: '#6C5CE0' }}>
            <span className="data">{v}{unitLabel ? ` ${unitLabel}` : ''}</span>
            <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))} className="opacity-80 transition hover:opacity-100"><X size={11} /></button>
          </span>
        ))}
        <input className="field data h-8 w-28 flex-none" value={draft} inputMode="decimal" placeholder="add value…" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }} />
        <button type="button" onClick={add} className="btn-ghost h-8 px-2 text-xs" style={{ color: '#5A4BD0' }}><Plus size={13} /> Add</button>
      </div>
      <p className="mt-1.5 text-2xs text-subtle">{values.length > 0 ? `${values.length} value${values.length > 1 ? 's' : ''} → ${values.length} experiment${values.length > 1 ? 's' : ''}. Press Enter or Add for each.` : 'Type a value and press Enter. Each one becomes its own experiment.'}</p>
    </div>
  )
}

function AbsInput({ mkey, reading, setReading, compute, label, caption, hint }: { mkey: 'FSC' | 'CRC' | 'AUP'; reading: number | null; setReading: (v: number | null) => void; compute: (n: number) => number; label: string; caption: string; hint: string }) {
  const color = METRIC_COLOR[mkey]
  const v = reading == null || Number.isNaN(reading) ? null : compute(reading)
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold tracking-wide" style={{ color }}>{label}</span>
        <span className="data text-sm font-bold tabular-nums" style={{ color }}>{v != null ? `${v} g/g` : '—'}</span>
      </div>
      <input className="field data mt-2" type="number" step="any" inputMode="decimal" placeholder="mass (g)" value={reading ?? ''} onChange={(e) => setReading(e.target.value === '' ? null : parseFloat(e.target.value))} />
      <p className="mt-1.5 text-2xs leading-tight text-subtle">{caption}</p>
      <p className="data text-[10px] leading-tight text-subtle/80">{hint}</p>
    </div>
  )
}

function FinalAbs({ mkey, value, setValue, label }: { mkey: 'FSC' | 'CRC' | 'AUP'; value: string; setValue: (v: string) => void; label: string }) {
  const color = METRIC_COLOR[mkey]
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold tracking-wide" style={{ color }}>{label}</span>
        <span className="text-2xs text-subtle">g/g</span>
      </div>
      <input className="field data mt-2" type="number" step="any" inputMode="decimal" placeholder="final value" value={value} onChange={(e) => setValue(e.target.value)} />
      <p className="mt-1.5 text-2xs leading-tight text-subtle">Already-calculated result</p>
    </div>
  )
}

function RowSection({ icon, title, onAdd, addLabel, tone = 'teal', children }: { icon: React.ReactNode; title: string; onAdd: () => void; addLabel: string; tone?: 'teal' | 'navy' | 'orange' | 'violet'; children: React.ReactNode }) {
  const iconColor = tone === 'navy' ? 'text-navy' : tone === 'orange' ? 'text-orange' : tone === 'violet' ? 'text-[#5A4BD0]' : 'text-brand'
  const addClass = tone === 'navy' ? 'btn-soft-navy' : tone === 'orange' ? 'btn-soft-orange' : tone === 'violet' ? 'btn-soft-violet' : 'btn-soft-teal'
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2"><span className={iconColor}>{icon}</span><h3 className="text-sm font-semibold">{title}</h3></div>
        <button type="button" className={cx(addClass, 'h-8 px-2.5')} onClick={onAdd}><Plus size={15} /> {addLabel}</button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
function RemoveBtn({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="btn-ghost h-9 w-9 shrink-0 self-start p-0 text-subtle hover:text-danger" aria-label="Remove row"><Trash2 size={16} /></button>
}
