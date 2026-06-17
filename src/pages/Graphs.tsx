import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, ScatterChart, Scatter, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ZAxis, Cell,
} from 'recharts'
import { LineChart as LineIcon, ScatterChart as ScatterIcon, BarChart3, Download, Filter, X } from 'lucide-react'
import { useData } from '../context/DataContext'
import type { FullExperiment } from '../lib/types'
import { FullLoader, EmptyState } from '../components/ui'
import { cx, colorFor, parseNum, downloadCSV } from '../lib/utils'

type ChartType = 'scatter' | 'bar' | 'line'
type Agg = 'avg' | 'max' | 'min' | 'count'
const GRID = '#ECEAE3'
const AXIS = '#9AA0A6'

interface Row {
  en: number | null
  owner: string
  type: string
  date: string | null
  metrics: Record<string, number>
}

function buildRows(exps: FullExperiment[]): { rows: Row[]; numericFields: string[] } {
  const fieldSet = new Set<string>()
  const rows = exps.map((e) => {
    const metrics: Record<string, number> = {}
    e.experiment_results.forEach((r) => {
      if (!r.result_type) return
      const n = r.value_num ?? parseNum(r.value)
      if (n !== null && !(r.result_type in metrics)) {
        metrics[r.result_type] = n
        fieldSet.add(r.result_type)
      }
    })
    return { en: e.en, owner: e.owner || 'Unassigned', type: e.experiment_type || 'Untyped', date: e.date, metrics }
  })
  return { rows, numericFields: [...fieldSet].sort() }
}

export function Graphs() {
  const { experiments, loading, owners, types } = useData()
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

  // sensible defaults once fields are known
  useEffect(() => {
    if (numericFields.length && !xField) setXField(numericFields[0])
    if (numericFields.length && !yField) setYField(numericFields[1] ?? numericFields[0])
  }, [numericFields, xField, yField])

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (ownerF.length === 0 || ownerF.includes(r.owner)) &&
          (typeF.length === 0 || typeF.includes(r.type)),
      ),
    [rows, ownerF, typeF],
  )

  if (loading) return <FullLoader label="Loading data" />

  if (numericFields.length === 0) {
    return (
      <Wrap>
        <EmptyState title="No numeric results yet" hint="Once experiments have numeric results (FSC, CRC, AUP…), you can plot and compare them here." />
      </Wrap>
    )
  }

  return (
    <Wrap>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Graphs</h1>
          <p className="mt-1 text-sm text-muted">Plot and compare results across experiments.</p>
        </div>
        <button className={cx('btn-outline', (ownerF.length + typeF.length) && 'border-brand-ring text-brand-dark')} onClick={() => setShowFilters((s) => !s)}>
          <Filter size={15} /> Filters
          {ownerF.length + typeF.length > 0 && <span className="data ml-0.5 rounded bg-brand px-1.5 text-2xs text-white">{ownerF.length + typeF.length}</span>}
        </button>
      </div>

      {showFilters && (
        <div className="mt-3 space-y-3 rounded-xl border border-line bg-surface p-3.5">
          <ChipRow label="Owner" options={owners} selected={ownerF} onToggle={(v) => toggle(ownerF, v, setOwnerF)} />
          <ChipRow label="Type" options={types.map((t) => t.name)} selected={typeF} onToggle={(v) => toggle(typeF, v, setTypeF)} />
          {(ownerF.length + typeF.length > 0) && (
            <button className="btn-ghost h-7 text-xs text-muted" onClick={() => { setOwnerF([]); setTypeF([]) }}><X size={13} /> Clear</button>
          )}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        {/* Controls */}
        <div className="card h-fit space-y-4 p-4">
          <div>
            <label className="label">Chart type</label>
            <div className="grid grid-cols-3 gap-1.5">
              {([['scatter', ScatterIcon, 'Scatter'], ['bar', BarChart3, 'Bar'], ['line', LineIcon, 'Trend']] as const).map(([v, Icon, lbl]) => (
                <button
                  key={v}
                  onClick={() => setChart(v)}
                  className={cx('flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition', chart === v ? 'border-brand bg-brand-tint text-brand-dark' : 'border-line text-muted hover:bg-black/[0.03]')}
                >
                  <Icon size={17} /> {lbl}
                </button>
              ))}
            </div>
          </div>

          {chart === 'scatter' && (
            <>
              <Select label="X axis" value={xField} onChange={setXField} options={numericFields} />
              <Select label="Y axis" value={yField} onChange={setYField} options={numericFields} />
              <Select label="Colour by" value={colorBy} onChange={(v) => setColorBy(v as any)} options={['none', 'owner', 'type']} labels={{ none: 'None', owner: 'Owner', type: 'Type' }} />
            </>
          )}
          {chart === 'bar' && (
            <>
              <Select label="Group by" value={groupBy} onChange={(v) => setGroupBy(v as any)} options={['type', 'owner']} labels={{ type: 'Type', owner: 'Owner' }} />
              <Select label="Metric" value={yField} onChange={setYField} options={numericFields} />
              <Select label="Aggregate" value={agg} onChange={(v) => setAgg(v as any)} options={['avg', 'max', 'min', 'count']} labels={{ avg: 'Average', max: 'Maximum', min: 'Minimum', count: 'Count' }} />
            </>
          )}
          {chart === 'line' && (
            <>
              <Select label="X axis" value={xField} onChange={setXField} options={['en', ...numericFields]} labels={{ en: 'EN (sequence)' }} />
              <Select label="Y axis" value={yField} onChange={setYField} options={numericFields} />
              <Select label="Series" value={colorBy} onChange={(v) => setColorBy(v as any)} options={['none', 'owner', 'type']} labels={{ none: 'Single line', owner: 'Owner', type: 'Type' }} />
            </>
          )}
        </div>

        {/* Chart */}
        <div className="card min-h-[460px] p-4">
          <Chart chart={chart} rows={filtered} xField={xField} yField={yField} groupBy={groupBy} agg={agg} colorBy={colorBy} />
        </div>
      </div>
    </Wrap>
  )
}

function Chart({ chart, rows, xField, yField, groupBy, agg, colorBy }: {
  chart: ChartType; rows: Row[]; xField: string; yField: string; groupBy: 'owner' | 'type'; agg: Agg; colorBy: 'none' | 'owner' | 'type'
}) {
  /* ---------------- Scatter ---------------- */
  if (chart === 'scatter') {
    const pts = rows
      .filter((r) => r.metrics[xField] !== undefined && r.metrics[yField] !== undefined)
      .map((r) => ({ x: r.metrics[xField], y: r.metrics[yField], en: r.en, owner: r.owner, type: r.type }))
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
          {Object.entries(groups).map(([k, data]) => (
            <Scatter key={k} name={k} data={data} fill={colorBy === 'none' ? '#0E8A94' : colorFor(k)} fillOpacity={0.78} />
          ))}
        </ScatterChart>
      </ChartFrame>
    )
  }

  /* ---------------- Bar ---------------- */
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
          <XAxis dataKey="label" tick={tickStyle} stroke={AXIS} interval={0} angle={data.length > 4 ? -12 : 0} textAnchor={data.length > 4 ? 'end' : 'middle'} height={data.length > 4 ? 52 : 30} />
          <YAxis tick={tickStyle} stroke={AXIS} width={56} label={axisLabel(metricLabel, 'y')} />
          <Tooltip cursor={{ fill: 'rgba(14,138,148,0.06)' }} content={<BarTip metricLabel={metricLabel} />} />
          <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={68}>
            {data.map((d) => <Cell key={d.label} fill={colorFor(d.label)} />)}
          </Bar>
        </BarChart>
      </ChartFrame>
    )
  }

  /* ---------------- Line / trend ---------------- */
  const xIsEn = xField === 'en'
  const valid = rows.filter((r) => r.metrics[yField] !== undefined && (xIsEn ? r.en !== null : r.metrics[xField] !== undefined))
  if (!valid.length) return <NoData />
  const series = colorBy === 'none' ? { Trend: valid } : groupByKey(valid, (r) => (colorBy === 'owner' ? r.owner : r.type))
  const seriesData = Object.entries(series).map(([k, rs]) => ({
    name: k,
    data: rs
      .map((r) => ({ x: xIsEn ? r.en! : r.metrics[xField], y: r.metrics[yField], en: r.en }))
      .sort((a, b) => (a.x as number) - (b.x as number)),
  }))
  return (
    <ChartFrame
      onExport={() => downloadCSV('trend.csv', valid.map((r) => ({ EN: r.en, series: colorBy === 'none' ? 'Trend' : colorBy === 'owner' ? r.owner : r.type, [xField]: xIsEn ? r.en : r.metrics[xField], [yField]: r.metrics[yField] })))}
      count={valid.length}
    >
      <LineChart margin={{ top: 12, right: 16, bottom: 30, left: 6 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis type="number" dataKey="x" name={xField} tick={tickStyle} stroke={AXIS} domain={['dataMin', 'dataMax']} label={axisLabel(xIsEn ? 'EN' : xField, 'x')} allowDuplicatedCategory={false} />
        <YAxis type="number" dataKey="y" tick={tickStyle} stroke={AXIS} width={56} label={axisLabel(yField, 'y')} />
        <Tooltip content={<PointTip xField={xIsEn ? 'EN' : xField} yField={yField} />} />
        {colorBy !== 'none' && <Legend wrapperStyle={legendStyle} />}
        {seriesData.map((s) => (
          <Line key={s.name} type="monotone" dataKey="y" data={s.data} name={s.name} stroke={colorBy === 'none' ? '#0E8A94' : colorFor(s.name)} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
        ))}
      </LineChart>
    </ChartFrame>
  )
}

/* ---------------- chart helpers ---------------- */
const tickStyle = { fontSize: 11, fill: '#6C7077', fontFamily: 'JetBrains Mono, monospace' }
const legendStyle = { fontSize: 12, paddingTop: 8 }
function axisLabel(text: string, axis: 'x' | 'y') {
  const t = text.length > 26 ? text.slice(0, 24) + '…' : text
  return axis === 'x'
    ? { value: t, position: 'insideBottom', offset: -16, style: { fontSize: 11, fill: '#6C7077' } }
    : { value: t, angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#6C7077', textAnchor: 'middle' } }
}
function groupByKey<T>(arr: T[], key: (x: T) => string): Record<string, T[]> {
  const o: Record<string, T[]> = {}
  arr.forEach((x) => {
    const k = key(x)
    ;(o[k] ||= []).push(x)
  })
  return o
}
function ChartFrame({ children, onExport, count }: { children: React.ReactElement; onExport: () => void; count: number }) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-2xs uppercase tracking-wider text-subtle">
          <span className="data text-muted">{count}</span> points
        </span>
        <button className="btn-ghost h-7 text-xs text-muted" onClick={onExport}><Download size={13} /> CSV</button>
      </div>
      <div className="min-h-[400px] flex-1">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </div>
  )
}
function NoData() {
  return <div className="grid h-full min-h-[400px] place-items-center text-sm text-subtle">No data for this combination — try other fields or clear filters.</div>
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

/* ---------------- small inputs ---------------- */
function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
}
function Select({ label, value, onChange, options, labels }: { label: string; value: string; onChange: (v: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="field cursor-pointer" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>{labels?.[o] ?? o}</option>
        ))}
      </select>
    </div>
  )
}
function ChipRow({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  if (!options.length) return null
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o} onClick={() => onToggle(o)} className={cx('rounded-full border px-3 py-1 text-xs font-medium transition', selected.includes(o) ? 'border-brand bg-brand-tint text-brand-dark' : 'border-line bg-paper text-muted hover:bg-black/[0.03]')}>{o}</button>
        ))}
      </div>
    </div>
  )
}
