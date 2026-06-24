// Detect, across a set of experiments, which input parameter actually varies —
// so plots can put that on the X axis instead of the experiment number.
import type { FullExperiment } from './types'
import { materialIsBatch } from './materialCosts'

export interface VaryingParam {
  key: string
  label: string
  unit: string | null
  kind: 'material' | 'ratio' | 'process'
  valueByExp: Record<string, number> // expId -> numeric value
  distinct: number
  coverage: number // how many of the selected experiments have this parameter
}

const toNum = (v: unknown): number | null => {
  if (v == null || v === '') return null
  if (typeof v === 'number') return isFinite(v) ? v : null
  const m = String(v).replace(/,/g, '').match(/-?\d+\.?\d*/)
  return m ? parseFloat(m[0]) : null
}

const shortName = (name: string) => {
  const base = name.split('(')[0].trim()
  return (base || name).slice(0, 22)
}
const unitFromMeasure = (measure: string): string | null => {
  const m = measure.match(/\(([^)]+)\)/)
  return m ? m[1] : null
}
const normKey = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

interface Param { key: string; label: string; unit: string | null; kind: VaryingParam['kind']; value: number }

// All numeric parameters of a single experiment.
function paramsOf(e: FullExperiment): Param[] {
  const out: Param[] = []
  const seen = new Set<string>()
  for (const m of e.experiment_materials) {
    if (!m.name || materialIsBatch(m.name)) continue
    const amt = toNum(m.mass_g)
    if (amt != null) {
      const key = 'm:' + normKey(m.name)
      if (!seen.has(key)) { out.push({ key, label: `${shortName(m.name)} amount`, unit: (m as any).unit ?? 'g', kind: 'material', value: amt }); seen.add(key) }
    }
    const ratio = toNum(m.ratio)
    if (ratio != null) {
      const key = 'r:' + normKey(m.name)
      if (!seen.has(key)) { out.push({ key, label: `${shortName(m.name)} ratio`, unit: null, kind: 'ratio', value: ratio }); seen.add(key) }
    }
  }
  for (const p of e.experiment_processes) {
    const v = toNum(p.value)
    if (v == null) continue
    const proc = (p.process || '').trim()
    const meas = (p.measure || '').trim()
    if (!proc && !meas) continue
    const key = 'p:' + normKey(proc + '|' + meas)
    if (seen.has(key)) continue
    const measClean = meas.replace(/\([^)]*\)/g, '').trim()
    const label = proc && measClean ? `${proc} · ${measClean}` : proc || measClean || meas
    out.push({ key, label, unit: unitFromMeasure(meas), kind: 'process', value: v })
    seen.add(key)
  }
  return out
}

// Rank parameters that differ across the selected experiments.
export function detectVaryingParams(exps: FullExperiment[]): VaryingParam[] {
  const n = exps.length
  if (n < 2) return []
  const acc = new Map<string, { label: string; unit: string | null; kind: VaryingParam['kind']; byExp: Record<string, number> }>()
  for (const e of exps) {
    for (const p of paramsOf(e)) {
      let a = acc.get(p.key)
      if (!a) { a = { label: p.label, unit: p.unit, kind: p.kind, byExp: {} }; acc.set(p.key, a) }
      a.byExp[e.id] = p.value
    }
  }
  const params: VaryingParam[] = []
  for (const [key, a] of acc) {
    const vals = Object.values(a.byExp)
    const distinct = new Set(vals.map((v) => Math.round(v * 1e6) / 1e6)).size
    if (distinct < 2) continue
    params.push({ key, label: a.label, unit: a.unit, kind: a.kind, valueByExp: a.byExp, distinct, coverage: vals.length })
  }
  // Best first: present in every selected sample, then most distinct levels, then materials/process before ratio.
  const spread = (p: VaryingParam) => { const v = Object.values(p.valueByExp); return Math.max(...v) - Math.min(...v) }
  params.sort((x, y) => {
    const fullX = x.coverage === n ? 1 : 0, fullY = y.coverage === n ? 1 : 0
    if (fullX !== fullY) return fullY - fullX
    if (y.distinct !== x.distinct) return y.distinct - x.distinct
    if (y.coverage !== x.coverage) return y.coverage - x.coverage
    return spread(y) - spread(x)
  })
  return params
}
