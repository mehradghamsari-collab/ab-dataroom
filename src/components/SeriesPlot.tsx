import { useMemo, useState, useEffect } from 'react'
import { ResponsiveContainer, ScatterChart, Scatter, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList } from 'recharts'
import { Check, Download } from 'lucide-react'
import type { FullExperiment } from '../lib/types'
import { metricValue } from '../lib/metrics'
import { detectVaryingParams } from '../lib/series'
import { cx, downloadCSV } from '../lib/utils'

const AXIS = '#9AA0A6', GRID = '#EEF1F3'
const tickStyle = { fontSize: 11, fill: '#6C7077' }
const tickBold = { fontSize: 11, fill: '#3C4147', fontWeight: 600 }

function resultNum(e: FullExperiment, re: RegExp): number | null {
  const row = e.experiment_results.find((r) => r.result_type && re.test(r.result_type))
  if (!row) return null
  if (row.value_num != null) return row.value_num
  const m = String(row.value ?? '').replace(/,/g, '').match(/-?\d+\.?\d*/)
  return m ? parseFloat(m[0]) : null
}
type MKey = 'FSC' | 'CRC' | 'AUP' | 'FSCDI' | 'AUP03'
const METRIC_DEFS: { key: MKey; label: string; color: string; get: (e: FullExperiment) => number | null }[] = [
  { key: 'FSC', label: 'FSC saline', color: '#0E8A94', get: (e) => metricValue(e, 'FSC') },
  { key: 'CRC', label: 'CRC saline', color: '#6C5CE0', get: (e) => metricValue(e, 'CRC') },
  { key: 'AUP', label: 'AUP saline 0.7', color: '#FF4700', get: (e) => metricValue(e, 'AUP') },
  { key: 'FSCDI', label: 'FSC in DI', color: '#0A6E76', get: (e) => resultNum(e, /^fsc in di/i) },
  { key: 'AUP03', label: 'AUP 0.3', color: '#E8A100', get: (e) => resultNum(e, /aup.*0\.3|^aup at 0\.3/i) },
]

export function SeriesPlot({ exps, height = 380 }: { exps: FullExperiment[]; height?: number }) {
  const present = useMemo(() => METRIC_DEFS.filter((md) => exps.some((e) => md.get(e) != null)), [exps])
  const params = useMemo(() => detectVaryingParams(exps), [exps])

  const [active, setActive] = useState<Record<string, boolean>>({})
  const [xKey, setXKey] = useState<string>('auto')

  // default-on the first available metric (prefer FSC) whenever the present set changes
  useEffect(() => {
    setActive((prev) => {
      const anyOn = present.some((p) => prev[p.key])
      if (anyOn || present.length === 0) return prev
      const first = present.find((p) => p.key === 'FSC') ?? present[0]
      return { ...prev, [first.key]: true }
    })
  }, [present])

  const activeDefs = present.filter((p) => active[p.key])
  const effectiveX = xKey === 'auto' ? (params[0]?.key ?? 'en') : xKey
  const xParam = params.find((p) => p.key === effectiveX)

  if (exps.length < 1) return <Empty msg="Select experiments to plot them." />
  if (present.length === 0) return <Empty msg="None of the selected experiments have plottable results yet." />

  const xLabel = xParam ? `${xParam.label}${xParam.unit ? ` (${xParam.unit})` : ''}` : 'Experiment'

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {present.map((pm) => (
            <button key={pm.key} onClick={() => setActive((s) => ({ ...s, [pm.key]: !s[pm.key] }))} className={cx('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all', active[pm.key] ? 'text-white' : 'bg-black/[0.05] text-muted hover:bg-black/[0.08]')} style={active[pm.key] ? { background: pm.color } : undefined}>
              {active[pm.key] && <Check size={13} />} {pm.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-2xs font-medium text-subtle">X axis</label>
          <select value={xKey} onChange={(e) => setXKey(e.target.value)} className="field h-8 w-auto min-w-[170px] py-1 text-xs">
            <option value="auto">Auto{params[0] ? ` · ${params[0].label}` : ' · experiment #'}</option>
            {params.map((p) => <option key={p.key} value={p.key}>{p.label}{p.unit ? ` (${p.unit})` : ''} · {p.distinct} levels</option>)}
            <option value="en">Experiment number</option>
          </select>
        </div>
      </div>

      {params.length === 0 && effectiveX === 'en' && (
        <p className="mb-1.5 text-2xs text-subtle">No single input parameter varies cleanly across this selection — showing by experiment number. Pick a tighter sample set (e.g. one series) to plot a response curve.</p>
      )}

      <div className="relative min-h-0 flex-1" style={{ height }}>
        {activeDefs.length === 0 ? <Empty msg="Turn on at least one result to plot." /> : xParam ? (
          <SeriesScatter exps={exps} xParam={xParam} xLabel={xLabel} defs={activeDefs} />
        ) : (
          <ByExperimentBars exps={exps} defs={activeDefs} />
        )}
      </div>
    </div>
  )
}

function SeriesScatter({ exps, xParam, xLabel, defs }: { exps: FullExperiment[]; xParam: ReturnType<typeof detectVaryingParams>[number]; xLabel: string; defs: typeof METRIC_DEFS }) {
  const series = defs.map((d) => ({
    def: d,
    pts: exps
      .map((e) => ({ x: xParam.valueByExp[e.id], y: d.get(e), en: e.en }))
      .filter((p) => p.x != null && p.y != null)
      .sort((a, b) => (a.x as number) - (b.x as number)),
  })).filter((s) => s.pts.length > 0)

  const exportCsv = () => {
    const rows = exps.map((e) => { const o: any = { EN: `EN${e.en}`, [xLabel]: xParam.valueByExp[e.id] ?? '' }; defs.forEach((d) => (o[d.label] = d.get(e) ?? '')); return o })
    downloadCSV('series.csv', rows)
  }

  return (
    <>
      <button className="btn-ghost absolute right-0 top-0 z-10 h-7 text-xs text-muted" onClick={exportCsv}><Download size={13} /> CSV</button>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ScatterChart margin={{ top: 10, right: 18, bottom: 42, left: 8 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis type="number" dataKey="x" name={xLabel} tick={tickBold} stroke={AXIS} domain={['dataMin', 'dataMax']} tickCount={6}
            label={{ value: xLabel, position: 'insideBottom', offset: -18, style: { fontSize: 12, fill: '#6C7077', fontWeight: 600 } }} />
          <YAxis type="number" dataKey="y" tick={tickStyle} stroke={AXIS} width={50} label={{ value: 'g/g', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6C7077', fontWeight: 600, textAnchor: 'middle' } }} />
          <Tooltip cursor={{ strokeDasharray: '4 4' }} content={<SeriesTip xLabel={xLabel} />} />
          <Legend verticalAlign="top" height={28} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Scatter key={s.def.key} name={s.def.label} data={s.pts} fill={s.def.color} line={{ stroke: s.def.color, strokeWidth: 2 }} lineType="joint">
              <LabelList dataKey="y" position="top" style={{ fontSize: 10, fontWeight: 700, fill: s.def.color, fontFamily: 'JetBrains Mono, monospace' }} />
            </Scatter>
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </>
  )
}

function ByExperimentBars({ exps, defs }: { exps: FullExperiment[]; defs: typeof METRIC_DEFS }) {
  const data = [...exps].sort((a, b) => (a.en ?? 0) - (b.en ?? 0)).map((e) => {
    const row: any = { label: `EN${e.en}` }
    defs.forEach((d) => (row[d.key] = d.get(e)))
    return row
  })
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={data} margin={{ top: 10, right: 12, bottom: 42, left: 4 }} barGap={3} barCategoryGap={data.length > 8 ? '16%' : '26%'}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={tickBold} stroke={AXIS} interval={0} angle={data.length > 6 ? -25 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'} height={data.length > 6 ? 58 : 36} />
        <YAxis tick={tickStyle} stroke={AXIS} width={50} label={{ value: 'g/g', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6C7077', fontWeight: 600, textAnchor: 'middle' } }} />
        <Tooltip cursor={{ fill: 'rgba(14,138,148,0.06)' }} />
        <Legend verticalAlign="top" height={28} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        {defs.map((d) => (
          <Bar key={d.key} dataKey={d.key} name={d.label} fill={d.color} radius={[5, 5, 0, 0]} maxBarSize={54}>
            {data.length <= 8 && <LabelList dataKey={d.key} position="top" style={{ fontSize: 10, fontWeight: 700, fill: d.color, fontFamily: 'JetBrains Mono, monospace' }} formatter={(v: any) => (v == null ? '' : v)} />}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

function SeriesTip({ active, payload, xLabel }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <div className="mb-1 font-semibold text-ink">EN{p?.en}</div>
      <div className="text-subtle">{xLabel}: <span className="data text-ink">{p?.x}</span></div>
      {payload.map((s: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5" style={{ color: s.color }}><span className="data">{s.name}: {s.payload?.y}</span></div>
      ))}
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed border-line bg-paper px-6 text-center text-sm text-muted">{msg}</div>
}
