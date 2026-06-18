import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  ResponsiveContainer, ScatterChart, Scatter, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ZAxis, Cell, LabelList, ReferenceLine, ReferenceArea,
} from 'recharts'
import { LineChart as LineIcon, ScatterChart as ScatterIcon, BarChart3, Download, Filter, X, Search, Check, Target, Coins } from 'lucide-react'
import { useData } from '../context/DataContext'
import type { FullExperiment, Benchmark } from '../lib/types'
import { FullLoader, EmptyState, Tabs, Segmented, MetricPill, ChartWatermark } from '../components/ui'
import { METRICS, METRIC_COLOR, sampleMetrics, metricValue, formulationCost } from '../lib/metrics'
import { projectShort } from '../lib/projects'
import { cx, colorFor, parseNum, downloadCSV } from '../lib/utils'

const GRID = '#ECEAE3'
const AXIS = '#9AA0A6'
const tickStyle = { fontSize: 11, fill: '#6C7077', fontFamily: 'JetBrains Mono, monospace' }
const tickBold = { fontSize: 12, fill: '#15181E', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }
const legendStyle = { fontSize: 12, paddingTop: 8, fontWeight: 600 }

export function Graphs() {
  const { loading } = useData()
  const location = useLocation()
  const initialCompare = (location.state as any)?.compareIds as string[] | undefined
  const [tab, setTab] = useState('compare')
  if (loading) return <FullLoader label="Loading data" />
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="animate-fadeUp">
        <h1 className="text-2xl font-semibold tracking-tight">Plot &amp; analyse</h1>
        <p className="mt-1 text-sm text-muted">Compare samples, break results down by work package, material or method, and benchmark performance and cost.</p>
      </div>
      <div className="mt-5">
        <Tabs active={tab} onChange={setTab} tabs={[{ key: 'compare', label: 'Compare samples' }, { key: 'breakdown', label: 'Breakdown' }, { key: 'matrices', label: 'Matrices' }]} />
      </div>
      <div className="mt-5 animate-fadeIn">
        {tab === 'compare' && <CompareTab initial={initialCompare} />}
        {tab === 'breakdown' && <BreakdownTab />}
        {tab === 'matrices' && <MatricesTab />}
      </div>
    </div>
  )
}

/* =====================================================================
   COMPARE — pick experiments, choose metrics, grouped bar chart
   ===================================================================== */
function CompareTab({ initial }: { initial?: string[] }) {
  const { experiments } = useData()
  const withMetrics = useMemo(() => experiments.filter((e) => { const m = sampleMetrics(e); return m.FSC !== null || m.CRC !== null || m.AUP !== null }), [experiments])
  const [picked, setPicked] = useState<string[]>(initial ?? [])
  const [activeMetrics, setActiveMetrics] = useState<Record<'FSC' | 'CRC' | 'AUP', boolean>>({ FSC: true, CRC: true, AUP: true })

  // preselect from a suggestion if provided
  useEffect(() => { if (initial && initial.length) setPicked(initial) }, [initial])
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

/* =====================================================================
   BREAKDOWN — average metric per work package / method / owner,
   plus drill-down to the individual samples in any group or material.
   ===================================================================== */
type Dim = 'project' | 'method' | 'owner' | 'material'
function BreakdownTab() {
  const { experiments, benchmarks } = useData()
  const [dim, setDim] = useState<Dim>('project')
  const [metric, setMetric] = useState<'FSC' | 'CRC' | 'AUP'>('CRC')
  const [selGroup, setSelGroup] = useState<string | null>(null)
  const [material, setMaterial] = useState<string>('')
  const color = METRIC_COLOR[metric]
  const val = (e: FullExperiment) => sampleMetrics(e)[metric]

  const groupLabel = (e: FullExperiment) =>
    dim === 'project' ? (e.project ? projectShort(e.project) : 'No work package')
      : dim === 'method' ? (e.experiment_type || 'Untyped')
        : (e.owner || 'Unassigned')

  // averages per group (project / method / owner)
  const groups = useMemo(() => {
    const m = new Map<string, FullExperiment[]>()
    experiments.forEach((e) => { const k = groupLabel(e); if (!m.has(k)) m.set(k, []); m.get(k)!.push(e) })
    const rows = [...m.entries()].map(([label, exps]) => {
      const vals = exps.map(val).filter((v): v is number => v !== null)
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      return { label, avg: avg !== null ? Math.round(avg * 10) / 10 : null, n: vals.length, exps }
    }).filter((r) => r.n > 0)
    rows.sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
    return rows.slice(0, 14)
  }, [experiments, dim, metric]) // eslint-disable-line

  // material usage (materials used by ≥2 experiments)
  const materials = useMemo(() => {
    const c = new Map<string, number>()
    experiments.forEach((e) => { const names = new Set(e.experiment_materials.map((mm) => mm.name).filter(Boolean) as string[]); names.forEach((n) => c.set(n, (c.get(n) ?? 0) + 1)) })
    return [...c.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }))
  }, [experiments])
  useEffect(() => { if (dim === 'material' && !material && materials.length) setMaterial(materials[0].name) }, [dim, materials, material])

  // individual samples for the active group / material
  const samples = useMemo(() => {
    let exps: FullExperiment[] = []
    if (dim === 'material') exps = experiments.filter((e) => e.experiment_materials.some((mm) => mm.name === material))
    else if (selGroup) exps = groups.find((g) => g.label === selGroup)?.exps ?? []
    return exps.map((e) => ({ label: `EN${e.en}`, value: val(e), desc: e.description || '' })).filter((d) => d.value !== null)
      .sort((a, b) => (b.value as number) - (a.value as number))
  }, [dim, material, selGroup, groups, experiments, metric]) // eslint-disable-line

  const bm = benchmarks.find((b) => /synth/i.test(b.name)) ?? benchmarks[0]
  const benchVal = bm ? (metric === 'FSC' ? bm.fsc : metric === 'CRC' ? bm.crc : bm.aup) : null
  const truncate = (s: string) => (s.length > 16 ? s.slice(0, 15) + '…' : s)

  return (
    <div className="space-y-5">
      {/* controls */}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-3.5">
        <Segmented<Dim> value={dim} onChange={(v) => { setDim(v); setSelGroup(null) }} options={[
          { value: 'project', label: 'Work package' }, { value: 'method', label: 'Synthesis method' }, { value: 'owner', label: 'Researcher' }, { value: 'material', label: 'Raw material' },
        ]} />
        <div className="flex gap-1.5">
          {(['FSC', 'CRC', 'AUP'] as const).map((k) => (
            <button key={k} onClick={() => setMetric(k)} className={cx('rounded-lg px-3 py-1.5 text-xs font-semibold transition', metric === k ? 'text-white' : 'bg-black/[0.04] text-muted')} style={metric === k ? { background: METRIC_COLOR[k] } : undefined}>{k}</button>
          ))}
        </div>
      </div>

      {dim === 'material' ? (
        <div className="card p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div className="w-full max-w-xs"><Select label="Raw material" value={material} onChange={setMaterial} options={materials.map((m) => m.name)} labels={Object.fromEntries(materials.map((m) => [m.name, `${m.name}  (${m.n})`]))} /></div>
            {samples.length > 0 && <button className="btn-ghost h-7 text-xs text-muted" onClick={() => downloadCSV('material.csv', samples.map((s) => ({ EN: s.label, description: s.desc, [metric]: s.value })))}><Download size={13} /> CSV</button>}
          </div>
          {materials.length === 0 ? <NoData msg="No material is used by two or more experiments yet." />
            : samples.length === 0 ? <NoData msg={`No ${metric} results for samples using this material.`} />
              : <SamplesBar data={samples} color={color} metric={metric} benchVal={benchVal} />}
          <p className="mt-2 text-2xs text-subtle">Every sample whose recipe includes <span className="font-medium text-muted">{material || 'the selected material'}</span>, by {metric}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Average {metric} by {dim === 'project' ? 'work package' : dim === 'method' ? 'synthesis method' : 'researcher'}</h3>
              {groups.length > 0 && <button className="btn-ghost h-7 text-xs text-muted" onClick={() => downloadCSV('breakdown.csv', groups.map((g) => ({ group: g.label, [`avg_${metric}`]: g.avg, samples: g.n })))}><Download size={13} /> CSV</button>}
            </div>
            {groups.length === 0 ? <NoData msg={`No ${metric} results to group yet.`} /> : (
              <div className="relative h-[420px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={groups} margin={{ top: 22, right: 12, bottom: 64, left: 4 }} barCategoryGap="22%">
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tick={tickBold} stroke={AXIS} interval={0} angle={-22} textAnchor="end" height={70} tickFormatter={truncate} />
                    <YAxis tick={tickStyle} stroke={AXIS} width={48} label={{ value: 'g/g', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6C7077', fontWeight: 600, textAnchor: 'middle' } }} />
                    <Tooltip cursor={{ fill: 'rgba(14,138,148,0.06)' }} content={<BarTip metricLabel={`Avg ${metric}`} />} />
                    {benchVal != null && <ReferenceLine y={benchVal} stroke="#9AA0A6" strokeDasharray="4 4" label={{ value: `SYNTHETIC ${benchVal}`, position: 'right', style: { fontSize: 10, fill: '#9AA0A6' } }} />}
                    <Bar dataKey="avg" name={`Avg ${metric}`} fill={color} radius={[5, 5, 0, 0]} maxBarSize={54} cursor="pointer" onClick={(d: any) => setSelGroup(d?.label ?? null)}>
                      <LabelList dataKey="avg" position="top" style={{ fontSize: 11, fontWeight: 700, fill: color, fontFamily: 'JetBrains Mono, monospace' }} />
                      <LabelList dataKey="n" position="insideBottom" offset={6} formatter={(v: any) => `n=${v}`} style={{ fontSize: 9, fill: 'rgba(255,255,255,0.9)', fontFamily: 'JetBrains Mono, monospace' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <ChartWatermark />
              </div>
            )}
            <p className="mt-2 text-2xs text-subtle">Tap a bar to see the individual samples in that group →</p>
          </div>

          <div className="card p-4">
            <h3 className="mb-2 text-sm font-semibold">{selGroup ? `Samples in “${selGroup}”` : 'Samples in group'}</h3>
            {!selGroup ? <NoData msg="Select a group on the left to break it down into individual samples." />
              : samples.length === 0 ? <NoData msg={`No ${metric} results in this group.`} />
                : <SamplesBar data={samples} color={color} metric={metric} benchVal={benchVal} />}
          </div>
        </div>
      )}
    </div>
  )
}

function SamplesBar({ data, color, metric, benchVal }: { data: { label: string; value: number | null; desc: string }[]; color: string; metric: string; benchVal: number | null }) {
  return (
    <div className="relative h-[420px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 22, right: 12, bottom: 54, left: 4 }} barCategoryGap={data.length > 10 ? '14%' : '26%'}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={tickBold} stroke={AXIS} interval={0} angle={data.length > 6 ? -22 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'} height={data.length > 6 ? 60 : 36} />
          <YAxis tick={tickStyle} stroke={AXIS} width={48} label={{ value: 'g/g', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6C7077', fontWeight: 600, textAnchor: 'middle' } }} />
          <Tooltip cursor={{ fill: 'rgba(14,138,148,0.06)' }} content={<SampleTip metric={metric} />} />
          {benchVal != null && <ReferenceLine y={benchVal} stroke="#9AA0A6" strokeDasharray="4 4" label={{ value: `SYNTHETIC ${benchVal}`, position: 'right', style: { fontSize: 10, fill: '#9AA0A6' } }} />}
          <Bar dataKey="value" name={metric} fill={color} radius={[5, 5, 0, 0]} maxBarSize={54}>
            {data.length <= 12 && <LabelList dataKey="value" position="top" style={{ fontSize: 11, fontWeight: 700, fill: color, fontFamily: 'JetBrains Mono, monospace' }} />}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <ChartWatermark />
    </div>
  )
}
function SampleTip({ active, payload, metric }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <div className="data mb-0.5 font-semibold text-ink">{p.label}</div>
      {p.desc && <div className="mb-1 max-w-[200px] truncate text-muted">{p.desc}</div>}
      <div><span className="text-subtle">{metric}: </span><span className="data text-ink">{p.value} g/g</span></div>
    </div>
  )
}
