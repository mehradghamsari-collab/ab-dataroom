import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  ResponsiveContainer, ScatterChart, Scatter, BarChart, Bar, LineChart, Line, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ZAxis, Cell, LabelList, ReferenceLine, ReferenceArea,
} from 'recharts'
import { LineChart as LineIcon, ScatterChart as ScatterIcon, BarChart3, Download, Filter, X, Search, Check, Target, Coins, PieChart as PieIcon, TrendingUp, GitCompareArrows, Palette } from 'lucide-react'
import { useData } from '../context/DataContext'
import type { FullExperiment, Benchmark } from '../lib/types'
import { FullLoader, EmptyState, Tabs, Segmented, MetricPill, ChartWatermark } from '../components/ui'
import { METRICS, METRIC_COLOR, sampleMetrics, metricValue, formulationCost } from '../lib/metrics'
import { PROJECTS, projectShort } from '../lib/projects'
import { cx, colorFor, parseNum, downloadCSV } from '../lib/utils'

const GRID = '#ECEAE3'
const AXIS = '#9AA0A6'
const tickStyle = { fontSize: 11, fill: '#6C7077', fontFamily: 'JetBrains Mono, monospace' }
const tickBold = { fontSize: 12, fill: '#15181E', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }
const legendStyle = { fontSize: 12, paddingTop: 8, fontWeight: 600 }
// Top-aligned legend — keeps series names clear of the bottom x-axis title/labels.
const legendTop = { verticalAlign: 'top' as const, align: 'center' as const, height: 30, wrapperStyle: { fontSize: 12, paddingBottom: 10, fontWeight: 600 } }

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
        <Tabs active={tab} onChange={setTab} tabs={[{ key: 'compare', label: 'Compare samples' }, { key: 'breakdown', label: 'Breakdown' }, { key: 'relationships', label: 'Relationships' }, { key: 'distribution', label: 'Distribution' }, { key: 'qualitative', label: 'Qualitative' }, { key: 'trends', label: 'Trends' }, { key: 'matrices', label: 'Matrices' }]} />
      </div>
      <div className="mt-5 animate-fadeIn">
        {tab === 'compare' && <CompareTab initial={initialCompare} />}
        {tab === 'breakdown' && <BreakdownTab />}
        {tab === 'relationships' && <RelationshipsTab />}
        {tab === 'distribution' && <DistributionTab />}
        {tab === 'qualitative' && <QualitativeTab />}
        {tab === 'trends' && <TrendsTab />}
        {tab === 'matrices' && <MatricesTab />}
      </div>
    </div>
  )
}

/* =====================================================================
   COMPARE — pick experiments, choose metrics, grouped bar chart
   ===================================================================== */
function resultNum(e: FullExperiment, re: RegExp): number | null {
  const row = e.experiment_results.find((r) => r.result_type && re.test(r.result_type))
  if (!row) return null
  if (row.value_num != null) return row.value_num
  const m = String(row.value ?? '').replace(/,/g, '').match(/-?\d+\.?\d*/)
  return m ? parseFloat(m[0]) : null
}
type PlotKey = 'FSC' | 'CRC' | 'AUP' | 'FSCDI' | 'AUP03'
const PLOT_METRICS: { key: PlotKey; label: string; color: string; get: (e: FullExperiment) => number | null }[] = [
  { key: 'FSC', label: 'FSC saline', color: '#0E8A94', get: (e) => metricValue(e, 'FSC') },
  { key: 'CRC', label: 'CRC saline', color: '#6C5CE0', get: (e) => metricValue(e, 'CRC') },
  { key: 'AUP', label: 'AUP saline 0.7', color: '#FF4700', get: (e) => metricValue(e, 'AUP') },
  { key: 'FSCDI', label: 'FSC DI', color: '#0A6E76', get: (e) => resultNum(e, /^fsc in di/i) },
  { key: 'AUP03', label: 'AUP 0.3', color: '#E8A100', get: (e) => resultNum(e, /aup.*0\.3|^aup at 0\.3/i) },
]

function CompareTab({ initial }: { initial?: string[] }) {
  const { experiments } = useData()
  const withMetrics = useMemo(() => experiments.filter((e) => PLOT_METRICS.some((pm) => pm.get(e) !== null)), [experiments])
  const [picked, setPicked] = useState<string[]>(initial ?? [])
  const [activeMetrics, setActiveMetrics] = useState<Record<PlotKey, boolean>>({ FSC: true, CRC: true, AUP: true, FSCDI: false, AUP03: false })

  useEffect(() => { if (initial && initial.length) setPicked(initial) }, [initial])
  useEffect(() => {
    if (picked.length === 0 && withMetrics.length) setPicked(withMetrics.slice(0, Math.min(5, withMetrics.length)).map((e) => e.id))
  }, [withMetrics]) // eslint-disable-line

  const pickedExps = useMemo(() => picked.map((id) => withMetrics.find((e) => e.id === id)).filter(Boolean) as FullExperiment[], [picked, withMetrics])
  const activeDefs = PLOT_METRICS.filter((pm) => activeMetrics[pm.key])

  const data = useMemo(() => pickedExps.map((e) => {
    const row: any = { label: `EN${e.en}`, desc: e.description || '' }
    PLOT_METRICS.forEach((pm) => { row[pm.key] = pm.get(e) })
    return row
  }), [pickedExps])

  const onlyOne = activeDefs.length === 1 ? activeDefs[0] : null

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <ExperimentPicker all={withMetrics} picked={picked} setPicked={setPicked} />
      </div>

      <div className="card p-4">
        <div className="mb-1 text-xs text-muted">Pick one metric to compare it alone (e.g. only CRC, only FSC in DI), or several to see them side by side.</div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {PLOT_METRICS.map((pm) => (
              <button key={pm.key} onClick={() => setActiveMetrics((s) => ({ ...s, [pm.key]: !s[pm.key] }))} className={cx('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all', activeMetrics[pm.key] ? 'text-white' : 'bg-black/[0.04] text-muted')} style={activeMetrics[pm.key] ? { background: pm.color } : undefined}>
                {activeMetrics[pm.key] && <Check size={13} />} {pm.label}
              </button>
            ))}
          </div>
          {data.length > 0 && <button className="btn-ghost h-7 text-xs text-muted" onClick={() => downloadCSV('compare.csv', data.map((d) => { const o: any = { EN: d.label, description: d.desc }; PLOT_METRICS.forEach((pm) => { o[pm.label] = d[pm.key] }); return o }))}><Download size={13} /> CSV</button>}
        </div>

        {data.length === 0 ? (
          <NoData msg="Select one or more experiments to compare." />
        ) : activeDefs.length === 0 ? (
          <NoData msg="Turn on at least one metric to plot." />
        ) : (
          <div className="relative h-[420px] w-full sm:h-[460px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={data} margin={{ top: 8, right: 12, bottom: 40, left: 4 }} barGap={3} barCategoryGap={data.length > 8 ? '16%' : '26%'}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={tickBold} stroke={AXIS} interval={0} angle={data.length > 6 ? -20 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'} height={data.length > 6 ? 56 : 36} />
                <YAxis tick={tickStyle} stroke={AXIS} width={52} label={{ value: onlyOne ? `${onlyOne.label} (g/g)` : 'g/g', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6C7077', fontWeight: 600, textAnchor: 'middle' } }} />
                <Tooltip cursor={{ fill: 'rgba(14,138,148,0.06)' }} content={<CompareTip />} />
                <Legend {...legendTop} />
                {activeDefs.map((pm) => (
                  <Bar key={pm.key} dataKey={pm.key} name={pm.label} fill={pm.color} radius={[5, 5, 0, 0]} maxBarSize={56} isAnimationActive>
                    {data.length <= 8 && <LabelList dataKey={pm.key} position="top" style={{ fontSize: 11, fontWeight: 700, fill: pm.color, fontFamily: 'JetBrains Mono, monospace' }} formatter={(v: any) => (v == null ? '' : v)} />}
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
  const [ownerF, setOwnerF] = useState('')
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id])
  const owners = useMemo(() => [...new Set(all.map((e) => e.owner).filter(Boolean) as string[])].sort(), [all])
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    let base = all
    if (ownerF) base = base.filter((e) => (e.owner || '') === ownerF)
    if (s) base = base.filter((e) => [`en${e.en}`, e.description, e.owner, e.experiment_type].join(' ').toLowerCase().includes(s))
    return base.slice(0, 120)
  }, [all, q, ownerF])

  return (
    <div className="card flex max-h-[600px] flex-col p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Experiments</span>
        <span className="data text-xs text-muted">{picked.length} selected</span>
      </div>
      {owners.length > 0 && (
        <div className="mb-2">
          <select className="field h-9 w-full cursor-pointer py-1 text-sm" value={ownerF} onChange={(e) => setOwnerF(e.target.value)}>
            <option value="">All owners</option>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      )}
      <div className="relative mb-2">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-2.5 text-subtle" />
        <input className="field pl-8 text-sm" placeholder="Search to add…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mb-2 flex gap-1.5">
        <button className="btn-ghost h-7 flex-1 text-xs text-muted" onClick={() => setPicked([...new Set([...picked, ...filtered.map((e) => e.id)])])}>Select all shown{ownerF ? ` (${filtered.length})` : ''}</button>
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
                {e.owner && <span className="ml-1.5 text-2xs text-subtle">{e.owner}</span>}
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
            <ScatterChart margin={{ top: 8, right: 18, bottom: 36, left: 8 }}>
              <CartesianGrid stroke={GRID} />
              <XAxis type="number" dataKey="x" name="CRC" tick={tickStyle} stroke={AXIS} label={{ value: 'CRC (g/g)', position: 'insideBottom', offset: -16, style: { fontSize: 12, fill: '#6C7077', fontWeight: 600 } }} />
              <YAxis type="number" dataKey="y" name="AUP" tick={tickStyle} stroke={AXIS} width={56} label={{ value: 'AUP (g/g)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6C7077', fontWeight: 600, textAnchor: 'middle' } }} />
              <ZAxis range={[64, 64]} />
              <Tooltip content={<MatrixTip xl="CRC" yl="AUP" />} />
              <Legend {...legendTop} />
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

/* =====================================================================
   RELATIONSHIPS — scatter of a result (FSC/CRC/AUP) vs a formulation
   factor (a material's amount, cost, or another metric) + best-fit trend.
   ===================================================================== */
const round2 = (x: number) => Math.round(x * 100) / 100
function projColor(short: string) { const p = PROJECTS.find((p) => projectShort(p.code) === short || p.label === short); return p?.color ?? colorFor(short) }

function RelationshipsTab() {
  const { experiments, chemicals } = useData()
  const [metric, setMetric] = useState<'FSC' | 'CRC' | 'AUP'>('FSC')
  const [xKey, setXKey] = useState<string>('cost')
  const materials = useMemo(() => {
    const c = new Map<string, number>()
    experiments.forEach((e) => { const names = new Set(e.experiment_materials.map((m) => m.name).filter(Boolean) as string[]); names.forEach((n) => c.set(n, (c.get(n) ?? 0) + 1)) })
    return [...c.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }))
  }, [experiments])
  const X_BASE = [{ value: 'cost', label: 'Cost per kg' }, { value: 'FSC', label: 'FSC (g/g)' }, { value: 'CRC', label: 'CRC (g/g)' }, { value: 'AUP', label: 'AUP (g/g)' }]
  const xLabel = xKey.startsWith('mat:') ? `${xKey.slice(4)} amount (g)` : X_BASE.find((o) => o.value === xKey)?.label ?? xKey

  const xOf = (e: FullExperiment): number | null => {
    if (xKey === 'cost') return formulationCost(e, chemicals).costPerKg ?? null
    if (xKey === 'FSC' || xKey === 'CRC' || xKey === 'AUP') return sampleMetrics(e)[xKey]
    if (xKey.startsWith('mat:')) { const nm = xKey.slice(4); const mm = e.experiment_materials.filter((m) => m.name === nm); return mm.length ? mm.reduce((s, m) => s + (m.mass_g ?? 0), 0) : null }
    return null
  }
  const points = useMemo(() => experiments.map((e) => { const x = xOf(e); const y = sampleMetrics(e)[metric]; return x != null && y != null ? { x, y, label: `EN${e.en}`, project: e.project } : null }).filter(Boolean) as { x: number; y: number; label: string; project: string | null }[], [experiments, xKey, metric, chemicals]) // eslint-disable-line

  const fit = useMemo(() => {
    const n = points.length; if (n < 2) return null
    const mx = points.reduce((s, p) => s + p.x, 0) / n, my = points.reduce((s, p) => s + p.y, 0) / n
    let num = 0, den = 0; points.forEach((p) => { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2 })
    if (den === 0) return null
    const slope = num / den, intercept = my - slope * mx
    let ssRes = 0, ssTot = 0; points.forEach((p) => { ssRes += (p.y - (slope * p.x + intercept)) ** 2; ssTot += (p.y - my) ** 2 })
    const xs = points.map((p) => p.x), xmin = Math.min(...xs), xmax = Math.max(...xs)
    return { slope, r2: ssTot === 0 ? 0 : 1 - ssRes / ssTot, seg: [{ x: xmin, y: slope * xmin + intercept }, { x: xmax, y: slope * xmax + intercept }] }
  }, [points])
  const color = METRIC_COLOR[metric]

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-3.5">
        <div className="flex items-center gap-2"><span className="text-xs font-medium text-muted">Result (Y):</span>
          {(['FSC', 'CRC', 'AUP'] as const).map((k) => <button key={k} onClick={() => setMetric(k)} className={cx('rounded-lg px-3 py-1.5 text-xs font-semibold transition', metric === k ? 'text-white' : 'bg-black/[0.04] text-muted')} style={metric === k ? { background: METRIC_COLOR[k] } : undefined}>{k}</button>)}
        </div>
        <div className="w-full max-w-xs"><Select label="Factor (X)" value={xKey} onChange={setXKey} options={[...X_BASE.map((o) => o.value), ...materials.map((m) => `mat:${m.name}`)]} labels={Object.fromEntries([...X_BASE.map((o) => [o.value, o.label]), ...materials.map((m) => [`mat:${m.name}`, `Amount · ${m.name} (${m.n})`])])} /></div>
      </div>
      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{metric} vs {xLabel}</h3>
          {fit && <span className="data text-2xs text-subtle">trend R² = {fit.r2.toFixed(2)} · slope {fit.slope.toFixed(3)}</span>}
        </div>
        {points.length < 2 ? <NoData msg="Not enough samples have both values recorded for this combination yet." /> : (
          <div className="relative h-[460px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <ScatterChart margin={{ top: 12, right: 20, bottom: 44, left: 8 }}>
                <CartesianGrid stroke={GRID} />
                <XAxis type="number" dataKey="x" name={xLabel} tick={tickStyle} stroke={AXIS} label={{ value: xLabel, position: 'insideBottom', offset: -16, style: { fontSize: 12, fill: '#6C7077', fontWeight: 600 } }} />
                <YAxis type="number" dataKey="y" name={metric} tick={tickStyle} stroke={AXIS} width={52} label={{ value: `${metric} (g/g)`, angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6C7077', fontWeight: 600, textAnchor: 'middle' } }} />
                <Tooltip content={<RelTip xl={xLabel} yl={metric} />} />
                {fit && <ReferenceLine ifOverflow="extendDomain" segment={fit.seg as any} stroke="#0B1F3A" strokeDasharray="5 4" strokeWidth={1.5} />}
                <Scatter data={points} fillOpacity={0.72}>{points.map((p, i) => <Cell key={i} fill={p.project ? projColor(projectShort(p.project)) : color} />)}</Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <ChartWatermark />
          </div>
        )}
        <p className="mt-2 text-2xs text-subtle">Each dot is a sample (coloured by work package). The dashed line is the best-fit trend — R² near 1 means a strong relationship.</p>
      </div>
    </div>
  )
}
function RelTip({ active, payload, xl, yl }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop"><div className="data mb-0.5 font-semibold text-ink">{p.label}</div><div className="text-muted">{xl}: <span className="data text-ink">{round2(p.x)}</span></div><div className="text-muted">{yl}: <span className="data text-ink">{p.y} g/g</span></div></div>
}

/* =====================================================================
   DISTRIBUTION — pie of the experiment mix + histogram of a metric.
   ===================================================================== */
function DistributionTab() {
  const { experiments } = useData()
  const [dim, setDim] = useState<'project' | 'method' | 'owner'>('project')
  const [metric, setMetric] = useState<'FSC' | 'CRC' | 'AUP'>('FSC')

  const pieData = useMemo(() => {
    const m = new Map<string, number>()
    experiments.forEach((e) => { const k = dim === 'project' ? (e.project ? projectShort(e.project) : 'No WP') : dim === 'method' ? (e.experiment_type || 'Untyped') : (e.owner || 'Unassigned'); m.set(k, (m.get(k) ?? 0) + 1) })
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [experiments, dim])
  const total = pieData.reduce((s, d) => s + d.value, 0)

  const hist = useMemo(() => {
    const vals = experiments.map((e) => sampleMetrics(e)[metric]).filter((v): v is number => v != null)
    if (!vals.length) return []
    const min = Math.min(...vals), max = Math.max(...vals)
    if (min === max) return [{ bin: `${min}`, count: vals.length }]
    const bins = 8, w = (max - min) / bins
    const arr = Array.from({ length: bins }, (_, i) => ({ lo: min + i * w, hi: min + (i + 1) * w, count: 0 }))
    vals.forEach((v) => { let i = Math.floor((v - min) / w); if (i >= bins) i = bins - 1; if (i < 0) i = 0; arr[i].count++ })
    return arr.map((b) => ({ bin: `${Math.round(b.lo)}–${Math.round(b.hi)}`, count: b.count }))
  }, [experiments, metric])

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="card p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><PieIcon size={15} className="text-brand" /> Experiment mix</h3>
          <Segmented size="sm" value={dim} onChange={(v) => setDim(v as any)} options={[{ value: 'project', label: 'Work package' }, { value: 'method', label: 'Method' }, { value: 'owner', label: 'Owner' }]} />
        </div>
        {pieData.length === 0 ? <NoData msg="No experiments yet." /> : (
          <div className="relative h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="52%" outerRadius={118} innerRadius={56} paddingAngle={2} label={(e: any) => `${Math.round((e.value / total) * 100)}%`} labelLine={false}>
                  {pieData.map((d, i) => <Cell key={i} fill={dim === 'project' ? projColor(d.name) : colorFor(d.name)} />)}
                </Pie>
                <Tooltip content={<PieTip total={total} />} />
                <Legend {...legendTop} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-1 text-2xs text-subtle">{total} experiments · share by {dim === 'project' ? 'work package' : dim}.</p>
      </div>

      <div className="card p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><BarChart3 size={15} style={{ color: METRIC_COLOR[metric] }} /> {metric} distribution</h3>
          <div className="flex gap-1.5">{(['FSC', 'CRC', 'AUP'] as const).map((k) => <button key={k} onClick={() => setMetric(k)} className={cx('rounded-lg px-2.5 py-1 text-xs font-semibold transition', metric === k ? 'text-white' : 'bg-black/[0.04] text-muted')} style={metric === k ? { background: METRIC_COLOR[k] } : undefined}>{k}</button>)}</div>
        </div>
        {hist.length === 0 ? <NoData msg={`No ${metric} values recorded yet.`} /> : (
          <div className="relative h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={hist} margin={{ top: 16, right: 12, bottom: 46, left: 4 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="bin" tick={tickStyle} stroke={AXIS} interval={0} angle={-20} textAnchor="end" height={56} />
                <YAxis allowDecimals={false} tick={tickStyle} stroke={AXIS} width={36} label={{ value: 'samples', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#6C7077', fontWeight: 600, textAnchor: 'middle' } }} />
                <Tooltip cursor={{ fill: 'rgba(14,138,148,0.06)' }} content={<HistTip metric={metric} />} />
                <Bar dataKey="count" fill={METRIC_COLOR[metric]} radius={[4, 4, 0, 0]} maxBarSize={60}><LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 700, fill: METRIC_COLOR[metric], fontFamily: 'JetBrains Mono, monospace' }} /></Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-1 text-2xs text-subtle">How many samples fall in each {metric} band (g/g).</p>
      </div>
    </div>
  )
}
function PieTip({ active, payload, total }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop"><span className="font-semibold text-ink">{p.name}</span><span className="text-muted"> · {p.value} ({Math.round((p.value / total) * 100)}%)</span></div>
}
function HistTip({ active, payload, label, metric }: any) {
  if (!active || !payload?.length) return null
  return <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop"><div className="data font-semibold text-ink">{metric} {label}</div><div className="text-muted">{payload[0].value} sample{payload[0].value === 1 ? '' : 's'}</div></div>
}

/* =====================================================================
   TRENDS — performance and activity over time (per month).
   ===================================================================== */
function monthLabel(k: string) { const [y, m] = k.split('-'); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) }
function TrendsTab() {
  const { experiments, benchmarks } = useData()
  const [metric, setMetric] = useState<'FSC' | 'CRC' | 'AUP'>('FSC')
  const monthly = useMemo(() => {
    const m = new Map<string, { sum: number; n: number; count: number }>()
    experiments.forEach((e) => {
      if (!e.date) return
      const key = e.date.slice(0, 7)
      const cur = m.get(key) ?? { sum: 0, n: 0, count: 0 }
      cur.count++
      const v = sampleMetrics(e)[metric]; if (v != null) { cur.sum += v; cur.n++ }
      m.set(key, cur)
    })
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => ({ month: k, label: monthLabel(k), avg: v.n ? Math.round((v.sum / v.n) * 10) / 10 : null, count: v.count }))
  }, [experiments, metric])
  const hasAvg = monthly.some((d) => d.avg != null)
  const bm = benchmarks.find((b) => /synth/i.test(b.name)) ?? benchmarks[0]
  const benchVal = bm ? (metric === 'FSC' ? bm.fsc : metric === 'CRC' ? bm.crc : bm.aup) : null

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-3.5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><TrendingUp size={15} className="text-brand" /> Performance &amp; activity over time</h3>
        <div className="flex gap-1.5">{(['FSC', 'CRC', 'AUP'] as const).map((k) => <button key={k} onClick={() => setMetric(k)} className={cx('rounded-lg px-3 py-1.5 text-xs font-semibold transition', metric === k ? 'text-white' : 'bg-black/[0.04] text-muted')} style={metric === k ? { background: METRIC_COLOR[k] } : undefined}>{k}</button>)}</div>
      </div>
      <div className="card p-4">
        <h3 className="mb-2 text-sm font-semibold">Average {metric} per month</h3>
        {!hasAvg ? <NoData msg={`No dated experiments with ${metric} yet.`} /> : (
          <div className="relative h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={monthly} margin={{ top: 16, right: 18, bottom: 24, left: 4 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={tickStyle} stroke={AXIS} height={28} interval="preserveStartEnd" />
                <YAxis tick={tickStyle} stroke={AXIS} width={48} label={{ value: 'g/g', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6C7077', fontWeight: 600, textAnchor: 'middle' } }} />
                <Tooltip cursor={{ stroke: GRID }} />
                {benchVal != null && <ReferenceLine y={benchVal} stroke="#9AA0A6" strokeDasharray="4 4" label={{ value: `SYNTHETIC ${benchVal}`, position: 'right', style: { fontSize: 10, fill: '#9AA0A6' } }} />}
                <Line type="monotone" dataKey="avg" name={`Avg ${metric}`} stroke={METRIC_COLOR[metric]} strokeWidth={2.5} dot={{ r: 3, fill: METRIC_COLOR[metric] }} connectNulls>
                  <LabelList dataKey="avg" position="top" style={{ fontSize: 10, fontWeight: 700, fill: METRIC_COLOR[metric], fontFamily: 'JetBrains Mono, monospace' }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
            <ChartWatermark />
          </div>
        )}
      </div>
      <div className="card p-4">
        <h3 className="mb-2 text-sm font-semibold">Experiments logged per month</h3>
        {monthly.length === 0 ? <NoData msg="No dated experiments yet." /> : (
          <div className="relative h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={monthly} margin={{ top: 14, right: 18, bottom: 24, left: 4 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={tickStyle} stroke={AXIS} height={28} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={tickStyle} stroke={AXIS} width={36} />
                <Tooltip cursor={{ fill: 'rgba(14,138,148,0.06)' }} />
                <Bar dataKey="count" name="Experiments" fill="#0E8A94" radius={[4, 4, 0, 0]} maxBarSize={44}><LabelList dataKey="count" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#0A6E76', fontFamily: 'JetBrains Mono, monospace' }} /></Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

/* =====================================================================
   QUALITATIVE — frequency & share of observed attributes (colour,
   texture, structure, evaluation…) across experiments.
   ===================================================================== */
function QualitativeTab() {
  const { experiments } = useData()
  const allObs = useMemo(() => experiments.flatMap((e) => (e.experiment_observations ?? []).map((o) => ({ attribute: (o.attribute || '').trim(), value: (o.value || '').trim(), en: e.en }))).filter((o) => o.attribute && o.value), [experiments])
  const attrs = useMemo(() => {
    const m = new Map<string, number>()
    allObs.forEach((o) => m.set(o.attribute, (m.get(o.attribute) ?? 0) + 1))
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a)
  }, [allObs])
  const [attr, setAttr] = useState('')
  const active = attr && attrs.includes(attr) ? attr : attrs[0] ?? ''
  const data = useMemo(() => {
    const m = new Map<string, { label: string; count: number }>()
    allObs.filter((o) => o.attribute === active).forEach((o) => { const key = o.value.toLowerCase(); const cur = m.get(key) ?? { label: o.value, count: 0 }; cur.count++; m.set(key, cur) })
    return [...m.values()].sort((a, b) => b.count - a.count)
  }, [allObs, active])
  const expWithObs = useMemo(() => experiments.filter((e) => (e.experiment_observations ?? []).length).length, [experiments])

  if (attrs.length === 0) return <div className="card p-4"><NoData msg="No qualitative observations yet — add them on an experiment under “Qualitative observations” (colour, texture, final structure…)." /></div>

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-3.5">
        <div className="flex items-center gap-2 text-sm">
          <Palette size={15} className="text-orange" /><span className="text-muted">Attribute</span>
          <select className="field h-9 w-52" value={active} onChange={(e) => setAttr(e.target.value)}>{attrs.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        </div>
        <span className="data text-2xs text-subtle">{allObs.length} observations · {expWithObs} experiments</span>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><BarChart3 size={15} className="text-orange" /> {active} — frequency</h3>
          <div className="relative h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={data} margin={{ top: 16, right: 12, bottom: 70, left: 4 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={tickBold} stroke={AXIS} interval={0} angle={-28} textAnchor="end" height={84} tickFormatter={(s: string) => (s.length > 16 ? s.slice(0, 15) + '…' : s)} />
                <YAxis allowDecimals={false} tick={tickStyle} stroke={AXIS} width={36} label={{ value: 'samples', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#6C7077', fontWeight: 600, textAnchor: 'middle' } }} />
                <Tooltip cursor={{ fill: 'rgba(255,71,0,0.06)' }} content={<QualTip attr={active} />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={64}>
                  {data.map((d, i) => <Cell key={i} fill={colorFor(d.label)} />)}
                  <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 700, fill: '#15181E', fontFamily: 'JetBrains Mono, monospace' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <ChartWatermark />
          </div>
        </div>
        <div className="card p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><PieIcon size={15} className="text-orange" /> {active} — share</h3>
          <div className="relative h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={118} innerRadius={56} paddingAngle={2}>
                  {data.map((d, i) => <Cell key={i} fill={colorFor(d.label)} />)}
                </Pie>
                <Tooltip content={<QualTip attr={active} />} />
                <Legend {...legendTop} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
function QualTip({ active, payload, attr }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const label = p.payload?.label ?? p.name
  return <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop"><span className="font-semibold text-ink">{attr}: {label}</span><span className="text-muted"> · {p.value ?? p.payload?.count}</span></div>
}
