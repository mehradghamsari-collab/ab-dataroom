import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, ScatterChart, Scatter, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ZAxis, Cell, LabelList, ReferenceLine, ReferenceArea,
} from 'recharts'
import { LineChart as LineIcon, ScatterChart as ScatterIcon, BarChart3, Download, Filter, X, Search, Check, Target, Coins } from 'lucide-react'
import { useData } from '../context/DataContext'
import type { FullExperiment, Benchmark } from '../lib/types'
import { FullLoader, EmptyState, Tabs, Segmented, MetricPill, ChartWatermark } from '../components/ui'
import { METRICS, METRIC_COLOR, sampleMetrics, metricValue, formulationCost } from '../lib/metrics'
import { cx, colorFor, parseNum, downloadCSV } from '../lib/utils'

const GRID = '#ECEAE3'
const AXIS = '#9AA0A6'
const tickStyle = { fontSize: 11, fill: '#6C7077', fontFamily: 'JetBrains Mono, monospace' }
const tickBold = { fontSize: 12, fill: '#15181E', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }
const legendStyle = { fontSize: 12, paddingTop: 8, fontWeight: 600 }

export function Graphs() {
  const { loading } = useData()
  const [tab, setTab] = useState('compare')
  if (loading) return <FullLoader label="Loading data" />
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="animate-fadeUp">
        <h1 className="text-2xl font-semibold tracking-tight">Plot &amp; analyse</h1>
        <p className="mt-1 text-sm text-muted">Compare samples, explore relationships, and benchmark performance and cost.</p>
      </div>
      <div className="mt-5">
        <Tabs active={tab} onChange={setTab} tabs={[{ key: 'compare', label: 'Compare samples' }, { key: 'matrices', label: 'Matrices' }, { key: 'explore', label: 'Explore' }]} />
      </div>
      <div className="mt-5 animate-fadeIn">
        {tab === 'compare' && <CompareTab />}
        {tab === 'matrices' && <MatricesTab />}
        {tab === 'explore' && <ExploreTab />}
      </div>
    </div>
  )
}

/* =====================================================================
   COMPARE — pick experiments, choose metrics, grouped bar chart
   ===================================================================== */
function CompareTab() {
  const { experiments } = useData()
  const withMetrics = useMemo(() => experiments.filter((e) => { const m = sampleMetrics(e); return m.FSC !== null || m.CRC !== null || m.AUP !== null }), [experiments])
  const [picked, setPicked] = useState<string[]>([])
  const [activeMetrics, setActiveMetrics] = useState<Record<'FSC' | 'CRC' | 'AUP', boolean>>({ FSC: true, CRC: true, AUP: true })

  // default: pick the most recent few
  useEffect(() => {
    if (picked.length === 0 && withMetrics.length) setPicked(withMetrics.slice(0, Math.min(5, withMetrics.length)).map((e) => e.id))
  }, [withMetrics]) // eslint-disable-line

  const pickedExps = useMemo(() => picked.map((id) => withMetrics.find((e) => e.id === id)).filter(Boolean) as FullExperiment[], [picked, withMetrics])
  const metricKeys = (['FSC', 'CRC', 'AUP'] as const).filter((k) => activeMetrics[k])

  const data = useMemo(() => pickedExps.map((e) => {
    const m = sampleMetrics(e)
    return { label: `EN${e.en}`, desc: e.description || '', FSC: m.FSC, CRC: m.CRC, AUP: m.AUP }
  }), [pickedExps])

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <ExperimentPicker all={withMetrics} picked={picked} setPicked={setPicked} />
      </div>

      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(['FSC', 'CRC', 'AUP'] as const).map((k) => (
              <button key={k} onClick={() => setActiveMetrics((s) => ({ ...s, [k]: !s[k] }))} className={cx('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all', activeMetrics[k] ? 'text-white' : 'bg-black/[0.04] text-muted')} style={activeMetrics[k] ? { background: METRIC_COLOR[k] } : undefined}>
                {activeMetrics[k] && <Check size={13} />} {k}
              </button>
            ))}
          </div>
          {data.length > 0 && <button className="btn-ghost h-7 text-xs text-muted" onClick={() => downloadCSV('compare.csv', data.map((d) => ({ EN: d.label, description: d.desc, FSC: d.FSC, CRC: d.CRC, AUP: d.AUP })))}><Download size={13} /> CSV</button>}
        </div>

        {data.length === 0 ? (
          <NoData msg="Select one or more experiments to compare." />
        ) : metricKeys.length === 0 ? (
          <NoData msg="Turn on at least one metric (FSC, CRC, AUP)." />
        ) : (
          <div className="relative h-[420px] w-full sm:h-[460px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={data} margin={{ top: 24, right: 12, bottom: 40, left: 4 }} barGap={3} barCategoryGap={data.length > 8 ? '16%' : '26%'}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={tickBold} stroke={AXIS} interval={0} angle={data.length > 6 ? -20 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'} height={data.length > 6 ? 56 : 36} />
                <YAxis tick={tickStyle} stroke={AXIS} width={52} label={{ value: 'g/g', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6C7077', fontWeight: 600, textAnchor: 'middle' } }} />
                <Tooltip cursor={{ fill: 'rgba(14,138,148,0.06)' }} content={<CompareTip />} />
                <Legend wrapperStyle={legendStyle} />
                {metricKeys.map((k) => (
                  <Bar key={k} dataKey={k} name={k} fill={METRIC_COLOR[k]} radius={[5, 5, 0, 0]} maxBarSize={56} isAnimationActive>
                    {data.length <= 8 && <LabelList dataKey={k} position="top" style={{ fontSize: 11, fontWeight: 700, fill: METRIC_COLOR[k], fontFamily: 'JetBrains Mono, monospace' }} formatter={(v: any) => (v == null ? '' : v)} />}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
            <ChartWatermark />
          </div>
        )}
      </div>
    </div>
  )
}

function CompareTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <div className="data mb-1.5 font-semibold text-ink">{label}{payload[0]?.payload?.desc ? <span className="ml-1 font-normal text-muted">{payload[0].payload.desc}</span> : ''}</div>
      <div className="space-y-1">
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            <span className="text-muted">{p.name}</span>
            <span className="data ml-auto font-semibold text-ink">{p.value ?? '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExperimentPicker({ all, picked, setPicked }: { all: FullExperiment[]; picked: string[]; setPicked: (v: string[]) => void }) {
  const [q, setQ] = useState('')
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id])
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const base = s ? all.filter((e) => [`en${e.en}`, e.description, e.owner, e.experiment_type].join(' ').toLowerCase().includes(s)) : all
    return base.slice(0, 80)
  }, [all, q])

  return (
    <div className="card flex max-h-[560px] flex-col p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Experiments</span>
        <span className="data text-xs text-muted">{picked.length} selected</span>
      </div>
      <div className="relative mb-2">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-2.5 text-subtle" />
        <input className="field pl-8 text-sm" placeholder="Search to add…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mb-2 flex gap-1.5">
        <button className="btn-ghost h-7 flex-1 text-xs text-muted" onClick={() => setPicked(filtered.slice(0, 12).map((e) => e.id))}>First 12</button>
        {picked.length > 0 && <button className="btn-ghost h-7 flex-1 text-xs text-muted" onClick={() => setPicked([])}><X size={12} /> Clear</button>}
      </div>
      <div className="-mx-1 flex-1 space-y-0.5 overflow-y-auto px-1">
        {filtered.map((e) => {
          const on = picked.includes(e.id)
          const m = sampleMetrics(e)
          return (
            <button key={e.id} onClick={() => toggle(e.id)} className={cx('flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all', on ? 'border-brand bg-brand-tint' : 'border-transparent hover:bg-black/[0.03]')}>
              <span className={cx('grid h-4 w-4 shrink-0 place-items-center rounded border', on ? 'border-brand bg-brand text-white' : 'border-line')}>{on && <Check size={12} />}</span>
              <span className="min-w-0 flex-1">
                <span className="data text-sm font-medium text-ink">EN{e.en}</span>
                {e.description && <span className="ml-1.5 truncate text-xs text-muted">{e.description}</span>}
              </span>
              <span className="flex shrink-0 gap-1">{(['FSC', 'CRC', 'AUP'] as const).map((k) => m[k] !== null && <span key={k} className="h-1.5 w-1.5 rounded-full" style={{ background: METRIC_COLOR[k] }} />)}</span>
            </button>
          )
        })}
        {filtered.length === 0 && <p className="py-6 text-center text-sm text-subtle">No matches.</p>}
      </div>
    </div>
  )
}

/* =====================================================================
   MATRICES — CRC vs AUP, and cost vs performance parity
   ===================================================================== */
function MatricesTab() {
  const [view, setView] = useState<'cra' | 'parity'>('cra')
  return (
    <div className="space-y-4">
      <Segmented value={view} onChange={(v) => setView(v as 'cra' | 'parity')} options={[{ value: 'cra', label: 'CRC vs AUP' }, { value: 'parity', label: 'Cost vs performance' }]} />
      {view === 'cra' ? <CrcAupMatrix /> : <ParityMatrix />}
    </div>
  )
}

function CrcAupMatrix() {
  const { experiments, benchmarks, owners, types } = useData()
  const [colorBy, setColorBy] = useState<'type' | 'owner'>('type')
  const pts = useMemo(() => experiments.map((e) => {
    const m = sampleMetrics(e)
    if (m.CRC === null || m.AUP === null) return null
    return { x: m.CRC, y: m.AUP, en: e.en, owner: e.owner || 'Unassigned', type: e.experiment_type || 'Untyped', kind: 'exp' as const }
  }).filter(Boolean) as any[], [experiments])
  const groups = groupByKey(pts, (p) => (colorBy === 'owner' ? p.owner : p.type))
  const bmPts = benchmarks.filter((b) => b.crc != null && b.aup != null).map((b) => ({ x: b.crc, y: b.aup, name: b.name, kind: 'bm' as const }))

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink"><span className="h-2.5 w-2.5 rounded-full" style={{ background: METRIC_COLOR.CRC }} />CRC <span className="text-subtle">×</span> <span className="h-2.5 w-2.5 rounded-full" style={{ background: METRIC_COLOR.AUP }} />AUP</div>
        <Segmented size="sm" value={colorBy} onChange={(v) => setColorBy(v as 'type' | 'owner')} options={[{ value: 'type', label: 'By type' }, { value: 'owner', label: 'By owner' }]} />
      </div>
      {pts.length === 0 ? <NoData msg="No experiments have both CRC and AUP recorded yet." /> : (
        <div className="relative h-[440px] w-full sm:h-[480px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ScatterChart margin={{ top: 12, right: 18, bottom: 36, left: 8 }}>
              <CartesianGrid stroke={GRID} />
              <XAxis type="number" dataKey="x" name="CRC" tick={tickStyle} stroke={AXIS} label={{ value: 'CRC (g/g)', position: 'insideBottom', offset: -16, style: { fontSize: 12, fill: '#6C7077', fontWeight: 600 } }} />
              <YAxis type="number" dataKey="y" name="AUP" tick={tickStyle} stroke={AXIS} width={56} label={{ value: 'AUP (g/g)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6C7077', fontWeight: 600, textAnchor: 'middle' } }} />
              <ZAxis range={[64, 64]} />
              <Tooltip content={<MatrixTip xl="CRC" yl="AUP" />} />
              <Legend wrapperStyle={legendStyle} />
              {Object.entries(groups).map(([k, d]) => <Scatter key={k} name={k} data={d as any[]} fill={colorFor(k)} fillOpacity={0.75} />)}
              {bmPts.length > 0 && <Scatter name="Benchmarks" data={bmPts} fill="#0B1F3A" shape="diamond" />}
            </ScatterChart>
          </ResponsiveContainer>
          <ChartWatermark />
        </div>
      )}
      {bmPts.length > 0 && <p className="mt-2 text-2xs text-subtle">◆ Navy diamonds are benchmark synthetic samples from the Library.</p>}
    </div>
  )
}

function ParityMatrix() {
  const { experiments, benchmarks, chemicals } = useData()
  const usableBm = benchmarks.filter((b) => b.price != null && (b.fsc != null || b.crc != null || b.aup != null))
  const [bmId, setBmId] = useState<string>('')
  const [metric, setMetric] = useState<'FSC' | 'CRC' | 'AUP'>('CRC')
  useEffect(() => { if (!bmId && usableBm.length) setBmId(usableBm[0].id) }, [usableBm]) // eslint-disable-line
  const bm = usableBm.find((b) => b.id === bmId)

  const pts = useMemo(() => {
    if (!bm || bm.price == null) return []
    const bMetric = metric === 'FSC' ? bm.fsc : metric === 'CRC' ? bm.crc : bm.aup
    if (bMetric == null || bMetric === 0) return []
    return experiments.map((e) => {
      const cost = formulationCost(e, chemicals)
      const mv = metricValue(e, metric)
      if (cost.costPerKg == null || cost.costPerKg <= 0 || mv == null) return null
      return { x: (cost.costPerKg / bm.price!) * 100, y: (mv / bMetric) * 100, en: e.en, type: e.experiment_type || 'Untyped', cost: cost.costPerKg, mv, kind: 'exp' as const }
    }).filter(Boolean) as any[]
  }, [experiments, chemicals, bm, metric])

  if (usableBm.length === 0) {
    return <div className="card p-4"><EmptyState icon={<Target size={26} />} title="Add a priced benchmark first" hint="In Library → Benchmarks, add a synthetic sample with a price per kg and its FSC/CRC/AUP. You also need experiments with chemical prices set so a cost-per-kg can be computed." /></div>
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label mb-0">Benchmark</span>
          <select className="field h-9 w-auto cursor-pointer py-1 text-sm" value={bmId} onChange={(e) => setBmId(e.target.value)}>
            {usableBm.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <Segmented size="sm" value={metric} onChange={(v) => setMetric(v as 'FSC' | 'CRC' | 'AUP')} options={(['FSC', 'CRC', 'AUP'] as const).map((k) => ({ value: k, label: k }))} />
      </div>

      {pts.length === 0 ? (
        <NoData msg="No experiments can be costed against this benchmark yet. Set chemical prices (Library → Chemicals) and make sure the benchmark has a price and this metric." />
      ) : (
        <>
          <div className="relative h-[440px] w-full sm:h-[480px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <ScatterChart margin={{ top: 12, right: 18, bottom: 36, left: 8 }}>
                {/* winning quadrant: cheaper (x<100) and better (y>100) */}
                <ReferenceArea x1={0} x2={100} y1={100} y2={100000} fill="#0E8A94" fillOpacity={0.06} />
                <CartesianGrid stroke={GRID} />
                <XAxis type="number" dataKey="x" name="Price parity" tick={tickStyle} stroke={AXIS} domain={[0, 'dataMax']} label={{ value: 'Price parity  (% of benchmark — lower is cheaper)', position: 'insideBottom', offset: -16, style: { fontSize: 11, fill: '#6C7077', fontWeight: 600 } }} />
                <YAxis type="number" dataKey="y" name="Performance parity" tick={tickStyle} stroke={AXIS} width={56} domain={[0, 'dataMax']} label={{ value: 'Performance %', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#6C7077', fontWeight: 600, textAnchor: 'middle' } }} />
                <ZAxis range={[64, 64]} />
                <ReferenceLine x={100} stroke="#B7791F" strokeDasharray="4 4" />
                <ReferenceLine y={100} stroke="#B7791F" strokeDasharray="4 4" />
                <Tooltip content={<ParityTip metric={metric} />} />
                <Scatter data={pts} fill={METRIC_COLOR[metric]} fillOpacity={0.8} />
              </ScatterChart>
            </ResponsiveContainer>
            <ChartWatermark />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-subtle">
            <span><span className="inline-block h-2 w-3 rounded-sm" style={{ background: '#0E8A94', opacity: 0.25 }} /> shaded = cheaper <em>and</em> stronger than benchmark</span>
            <span>dashed lines = benchmark (100%)</span>
            <span>cost-per-kg is preliminary until the TEA file is imported</span>
          </div>
        </>
      )}
    </div>
  )
}

function MatrixTip({ active, payload, xl, yl }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      {p.kind === 'bm' ? <div className="mb-1 font-semibold text-navy">◆ {p.name}</div> : <div className="data mb-1 font-semibold text-ink">EN{p.en}</div>}
      {p.type && p.kind !== 'bm' && <div className="text-muted">{p.type}</div>}
      <div className="mt-1"><span className="text-subtle">{xl}: </span><span className="data text-ink">{round(p.x)}</span> · <span className="text-subtle">{yl}: </span><span className="data text-ink">{round(p.y)}</span></div>
    </div>
  )
}
function ParityTip({ active, payload, metric }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <div className="data mb-1 font-semibold text-ink">EN{p.en}</div>
      <div className="space-y-0.5">
        <div><span className="text-subtle">Performance: </span><span className="data font-semibold" style={{ color: METRIC_COLOR[metric] }}>{round(p.y)}%</span> <span className="text-subtle">of benchmark {metric}</span></div>
        <div><span className="text-subtle">Price: </span><span className="data font-semibold text-ink">{round(p.x)}%</span> <span className="text-subtle">of benchmark /kg</span></div>
        <div className="text-subtle">≈ {round(p.cost)} /kg · {metric} {round(p.mv)}</div>
      </div>
    </div>
  )
}

/* =====================================================================
   EXPLORE — flexible scatter / bar / line over any numeric result
   ===================================================================== */
interface Row { en: number | null; owner: string; type: string; date: string | null; metrics: Record<string, number> }
function buildRows(exps: FullExperiment[]): { rows: Row[]; numericFields: string[] } {
  const fieldSet = new Set<string>()
  const rows = exps.map((e) => {
    const metrics: Record<string, number> = {}
    e.experiment_results.forEach((r) => {
      if (!r.result_type) return
      const n = r.value_num ?? parseNum(r.value)
      if (n !== null && !(r.result_type in metrics)) { metrics[r.result_type] = n; fieldSet.add(r.result_type) }
    })
    return { en: e.en, owner: e.owner || 'Unassigned', type: e.experiment_type || 'Untyped', date: e.date, metrics }
  })
  return { rows, numericFields: [...fieldSet].sort() }
}

type ChartType = 'scatter' | 'bar' | 'line'
type Agg = 'avg' | 'max' | 'min' | 'count'

function ExploreTab() {
  const { experiments, owners, types } = useData()
  const { rows, numericFields } = useMemo(() => buildRows(experiments), [experiments])
  const [chart, setChart] = useState<ChartType>('scatter')
  const [xField, setXField] = useState('')
  const [yField, setYField] = useState('')
  const [groupBy, setGroupBy] = useState<'owner' | 'type'>('type')
  const [agg, setAgg] = useState<Agg>('avg')
  const [colorBy, setColorBy] = useState<'none' | 'owner' | 'type'>('type')
  const [ownerF, setOwnerF] = useState<string[]>([])
  const [typeF, setTypeF] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    if (numericFields.length && !xField) setXField(numericFields.find((f) => /crc/i.test(f)) ?? numericFields[0])
    if (numericFields.length && !yField) setYField(numericFields.find((f) => /fsc/i.test(f)) ?? numericFields[1] ?? numericFields[0])
  }, [numericFields, xField, yField])

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  const filtered = useMemo(() => rows.filter((r) => (ownerF.length === 0 || ownerF.includes(r.owner)) && (typeF.length === 0 || typeF.includes(r.type))), [rows, ownerF, typeF])

  if (numericFields.length === 0) return <EmptyState title="No numeric results yet" hint="Once experiments have numeric results (FSC, CRC, AUP…), you can plot them here." />

  return (
    <div>
      <div className="flex justify-end">
        <button className={cx('btn-outline', (ownerF.length + typeF.length) && 'border-brand-ring text-brand-dark')} onClick={() => setShowFilters((s) => !s)}>
          <Filter size={15} /> Filters{ownerF.length + typeF.length > 0 && <span className="data ml-0.5 rounded bg-brand px-1.5 text-2xs text-white">{ownerF.length + typeF.length}</span>}
        </button>
      </div>
      {showFilters && (
        <div className="mt-3 space-y-3 rounded-xl border border-line bg-surface p-3.5 animate-scaleIn">
          <ChipRow label="Owner" options={owners} selected={ownerF} onToggle={(v) => toggle(ownerF, v, setOwnerF)} />
          <ChipRow label="Type" options={types.map((t) => t.name)} selected={typeF} onToggle={(v) => toggle(typeF, v, setTypeF)} />
          {(ownerF.length + typeF.length > 0) && <button className="btn-ghost h-7 text-xs text-muted" onClick={() => { setOwnerF([]); setTypeF([]) }}><X size={13} /> Clear</button>}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        <div className="card h-fit space-y-4 p-4">
          <div>
            <label className="label">Chart type</label>
            <div className="grid grid-cols-3 gap-1.5">
              {([['scatter', ScatterIcon, 'Scatter'], ['bar', BarChart3, 'Bar'], ['line', LineIcon, 'Trend']] as const).map(([v, Icon, lbl]) => (
                <button key={v} onClick={() => setChart(v)} className={cx('flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition', chart === v ? 'border-brand bg-brand-tint text-brand-dark' : 'border-line text-muted hover:bg-black/[0.03]')}>
                  <Icon size={17} /> {lbl}
                </button>
              ))}
            </div>
          </div>
          {chart === 'scatter' && (<>
            <Select label="X axis" value={xField} onChange={setXField} options={numericFields} />
            <Select label="Y axis" value={yField} onChange={setYField} options={numericFields} />
            <Select label="Colour by" value={colorBy} onChange={(v) => setColorBy(v as any)} options={['none', 'owner', 'type']} labels={{ none: 'None', owner: 'Owner', type: 'Type' }} />
          </>)}
          {chart === 'bar' && (<>
            <Select label="Group by" value={groupBy} onChange={(v) => setGroupBy(v as any)} options={['type', 'owner']} labels={{ type: 'Type', owner: 'Owner' }} />
            <Select label="Metric" value={yField} onChange={setYField} options={numericFields} />
            <Select label="Aggregate" value={agg} onChange={(v) => setAgg(v as any)} options={['avg', 'max', 'min', 'count']} labels={{ avg: 'Average', max: 'Maximum', min: 'Minimum', count: 'Count' }} />
          </>)}
          {chart === 'line' && (<>
            <Select label="X axis" value={xField} onChange={setXField} options={['en', ...numericFields]} labels={{ en: 'EN (sequence)' }} />
            <Select label="Y axis" value={yField} onChange={setYField} options={numericFields} />
            <Select label="Series" value={colorBy} onChange={(v) => setColorBy(v as any)} options={['none', 'owner', 'type']} labels={{ none: 'Single line', owner: 'Owner', type: 'Type' }} />
          </>)}
        </div>

        <div className="card min-h-[460px] p-4">
          <ExploreChart chart={chart} rows={filtered} xField={xField} yField={yField} groupBy={groupBy} agg={agg} colorBy={colorBy} />
        </div>
      </div>
    </div>
  )
}

function ExploreChart({ chart, rows, xField, yField, groupBy, agg, colorBy }: { chart: ChartType; rows: Row[]; xField: string; yField: string; groupBy: 'owner' | 'type'; agg: Agg; colorBy: 'none' | 'owner' | 'type' }) {
  if (chart === 'scatter') {
    const pts = rows.filter((r) => r.metrics[xField] !== undefined && r.metrics[yField] !== undefined).map((r) => ({ x: r.metrics[xField], y: r.metrics[yField], en: r.en, owner: r.owner, type: r.type }))
    if (!pts.length) return <NoData />
    const groups = colorBy === 'none' ? { All: pts } : groupByKey(pts, (p) => (colorBy === 'owner' ? p.owner : p.type))
    return (
      <ChartFrame onExport={() => downloadCSV('scatter.csv', pts.map((p) => ({ EN: p.en, owner: p.owner, type: p.type, [xField]: p.x, [yField]: p.y })))} count={pts.length}>
        <ScatterChart margin={{ top: 12, right: 16, bottom: 30, left: 6 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis type="number" dataKey="x" name={xField} tick={tickStyle} stroke={AXIS} label={axisLabel(xField, 'x')} />
          <YAxis type="number" dataKey="y" name={yField} tick={tickStyle} stroke={AXIS} label={axisLabel(yField, 'y')} width={56} />
          <ZAxis range={[60, 60]} />
          <Tooltip content={<PointTip xField={xField} yField={yField} />} />
          {colorBy !== 'none' && <Legend wrapperStyle={legendStyle} />}
          {Object.entries(groups).map(([k, data]) => <Scatter key={k} name={k} data={data} fill={colorBy === 'none' ? '#0E8A94' : colorFor(k)} fillOpacity={0.78} />)}
        </ScatterChart>
      </ChartFrame>
    )
  }
  if (chart === 'bar') {
    const buckets = groupByKey(rows.filter((r) => r.metrics[yField] !== undefined || agg === 'count'), (r) => (groupBy === 'owner' ? r.owner : r.type))
    const data = Object.entries(buckets).map(([k, rs]) => {
      const vals = rs.map((r) => r.metrics[yField]).filter((v) => v !== undefined)
      let value = 0
      if (agg === 'count') value = rs.length
      else if (vals.length) value = agg === 'avg' ? vals.reduce((a, b) => a + b, 0) / vals.length : agg === 'max' ? Math.max(...vals) : Math.min(...vals)
      return { label: k, value: Math.round(value * 1000) / 1000, n: rs.length }
    }).sort((a, b) => b.value - a.value)
    if (!data.length) return <NoData />
    const metricLabel = agg === 'count' ? 'Experiments' : `${agg} · ${yField}`
    return (
      <ChartFrame onExport={() => downloadCSV('bar.csv', data.map((d) => ({ [groupBy]: d.label, [metricLabel]: d.value, count: d.n })))} count={data.reduce((a, d) => a + d.n, 0)}>
        <BarChart data={data} margin={{ top: 12, right: 16, bottom: 30, left: 6 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={tickBold} stroke={AXIS} interval={0} angle={data.length > 4 ? -12 : 0} textAnchor={data.length > 4 ? 'end' : 'middle'} height={data.length > 4 ? 52 : 30} />
          <YAxis tick={tickStyle} stroke={AXIS} width={56} label={axisLabel(metricLabel, 'y')} />
          <Tooltip cursor={{ fill: 'rgba(14,138,148,0.06)' }} content={<BarTip metricLabel={metricLabel} />} />
          <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={68}>{data.map((d) => <Cell key={d.label} fill={colorFor(d.label)} />)}</Bar>
        </BarChart>
      </ChartFrame>
    )
  }
  const xIsEn = xField === 'en'
  const valid = rows.filter((r) => r.metrics[yField] !== undefined && (xIsEn ? r.en !== null : r.metrics[xField] !== undefined))
  if (!valid.length) return <NoData />
  const series = colorBy === 'none' ? { Trend: valid } : groupByKey(valid, (r) => (colorBy === 'owner' ? r.owner : r.type))
  const seriesData = Object.entries(series).map(([k, rs]) => ({ name: k, data: rs.map((r) => ({ x: xIsEn ? r.en! : r.metrics[xField], y: r.metrics[yField], en: r.en })).sort((a, b) => (a.x as number) - (b.x as number)) }))
  return (
    <ChartFrame onExport={() => downloadCSV('trend.csv', valid.map((r) => ({ EN: r.en, series: colorBy === 'none' ? 'Trend' : colorBy === 'owner' ? r.owner : r.type, [xField]: xIsEn ? r.en : r.metrics[xField], [yField]: r.metrics[yField] })))} count={valid.length}>
      <LineChart margin={{ top: 12, right: 16, bottom: 30, left: 6 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis type="number" dataKey="x" name={xField} tick={tickStyle} stroke={AXIS} domain={['dataMin', 'dataMax']} label={axisLabel(xIsEn ? 'EN' : xField, 'x')} allowDuplicatedCategory={false} />
        <YAxis type="number" dataKey="y" tick={tickStyle} stroke={AXIS} width={56} label={axisLabel(yField, 'y')} />
        <Tooltip content={<PointTip xField={xIsEn ? 'EN' : xField} yField={yField} />} />
        {colorBy !== 'none' && <Legend wrapperStyle={legendStyle} />}
        {seriesData.map((s) => <Line key={s.name} type="monotone" dataKey="y" data={s.data} name={s.name} stroke={colorBy === 'none' ? '#0E8A94' : colorFor(s.name)} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />)}
      </LineChart>
    </ChartFrame>
  )
}

/* ---------------- shared helpers ---------------- */
const round = (n: number) => Math.round(n * 10) / 10
function axisLabel(text: string, axis: 'x' | 'y') {
  const t = text.length > 26 ? text.slice(0, 24) + '…' : text
  return axis === 'x'
    ? { value: t, position: 'insideBottom', offset: -16, style: { fontSize: 11, fill: '#6C7077', fontWeight: 600 } }
    : { value: t, angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#6C7077', textAnchor: 'middle', fontWeight: 600 } }
}
function groupByKey<T>(arr: T[], key: (x: T) => string): Record<string, T[]> {
  const o: Record<string, T[]> = {}
  arr.forEach((x) => { const k = key(x); (o[k] ||= []).push(x) })
  return o
}
function ChartFrame({ children, onExport, count }: { children: React.ReactElement; onExport: () => void; count: number }) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-2xs uppercase tracking-wider text-subtle"><span className="data text-muted">{count}</span> points</span>
        <button className="btn-ghost h-7 text-xs text-muted" onClick={onExport}><Download size={13} /> CSV</button>
      </div>
      <div className="relative h-[400px] w-full flex-1 sm:h-[440px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>{children}</ResponsiveContainer>
        <ChartWatermark />
      </div>
    </div>
  )
}
function NoData({ msg }: { msg?: string }) {
  return <div className="grid h-full min-h-[420px] place-items-center px-6 text-center text-sm text-subtle">{msg ?? 'No data for this combination — try other fields or clear filters.'}</div>
}
function PointTip({ active, payload, xField, yField }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      {p.en != null && <div className="data mb-1 font-semibold text-ink">EN{p.en}</div>}
      {p.owner && <div className="text-muted">{p.owner}{p.type ? ` · ${p.type}` : ''}</div>}
      <div className="mt-1 space-y-0.5">
        <div><span className="text-subtle">{xField}: </span><span className="data text-ink">{p.x}</span></div>
        <div><span className="text-subtle">{yField}: </span><span className="data text-ink">{p.y}</span></div>
      </div>
    </div>
  )
}
function BarTip({ active, payload, metricLabel }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <div className="mb-0.5 font-semibold text-ink">{p.label}</div>
      <div><span className="text-subtle">{metricLabel}: </span><span className="data text-ink">{p.value}</span></div>
      <div className="text-subtle">{p.n} experiments</div>
    </div>
  )
}
function Select({ label, value, onChange, options, labels }: { label: string; value: string; onChange: (v: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="field cursor-pointer" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}</select>
    </div>
  )
}
function ChipRow({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  if (!options.length) return null
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">{options.map((o) => <button key={o} onClick={() => onToggle(o)} className={cx('rounded-full border px-3 py-1 text-xs font-medium transition', selected.includes(o) ? 'border-brand bg-brand-tint text-brand-dark' : 'border-line bg-paper text-muted hover:bg-black/[0.03]')}>{o}</button>)}</div>
    </div>
  )
}
