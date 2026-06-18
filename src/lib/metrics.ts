import type { FullExperiment, ResultEntry } from './types'

export interface MetricDef {
  key: 'FSC' | 'CRC' | 'AUP'
  label: string
  full: string // canonical result_type name
  color: string
  match: (name: string) => boolean
}

// The three headline absorbency metrics, each with a distinct brand-friendly colour.
export const METRICS: MetricDef[] = [
  { key: 'FSC', label: 'FSC', full: 'FSC in saline (g/g)', color: '#0E8A94', match: (n) => /^fsc in saline/i.test(n) },
  { key: 'CRC', label: 'CRC', full: 'CRC in saline (g/g)', color: '#6C5CE0', match: (n) => /^crc in saline/i.test(n) },
  { key: 'AUP', label: 'AUP', full: 'AUP in saline', color: '#FF4700', match: (n) => /^aup in saline/i.test(n) },
]

export const METRIC_COLOR: Record<string, string> = { FSC: '#0E8A94', CRC: '#6C5CE0', AUP: '#FF4700' }

function numFrom(r: ResultEntry): number | null {
  if (r.value_num !== null && r.value_num !== undefined) return r.value_num
  if (r.value === null || r.value === undefined || r.value === '') return null
  const m = String(r.value).replace(/,/g, '').match(/-?\d+\.?\d*/)
  return m ? parseFloat(m[0]) : null
}

// Best numeric value of a metric for an experiment: prefer exact canonical name,
// otherwise the first matching result that has a number.
export function metricValue(exp: FullExperiment, key: MetricDef['key']): number | null {
  const def = METRICS.find((m) => m.key === key)!
  const exact = exp.experiment_results.find((r) => r.result_type === def.full)
  if (exact) {
    const v = numFrom(exact)
    if (v !== null) return v
  }
  for (const r of exp.experiment_results) {
    if (r.result_type && def.match(r.result_type)) {
      const v = numFrom(r)
      if (v !== null) return v
    }
  }
  return null
}

export interface SampleMetrics {
  FSC: number | null
  CRC: number | null
  AUP: number | null
}
export function sampleMetrics(exp: FullExperiment): SampleMetrics {
  return { FSC: metricValue(exp, 'FSC'), CRC: metricValue(exp, 'CRC'), AUP: metricValue(exp, 'AUP') }
}
export function hasAnyMetric(exp: FullExperiment): boolean {
  const m = sampleMetrics(exp)
  return m.FSC !== null || m.CRC !== null || m.AUP !== null
}

// ---- Cost of formulation (preliminary, refined later from the TEA file) ----
import type { Chemical } from './types'

export interface CostResult {
  materialCost: number
  totalCost: number
  massKg: number // total gram-based mass, in kg
  costPerKg: number | null
  complete: boolean // false if some materials couldn't be priced
}

export function formulationCost(exp: FullExperiment, chemicals: Chemical[]): CostResult {
  const priceOf = (name: string | null) => chemicals.find((c) => c.name === name)
  let materialCost = 0
  let grams = 0
  let complete = true
  for (const m of exp.experiment_materials) {
    if (m.mass_g && (m as any).unit === 'g') grams += m.mass_g
    const chem = priceOf(m.name)
    const unit = (m as any).unit ?? 'g'
    if (m.mass_g && chem?.price != null && (chem.price_unit ?? 'g') === unit) {
      materialCost += m.mass_g * chem.price
    } else if (m.mass_g && m.name) {
      complete = false
    }
  }
  const extra = exp.extra_cost ?? 0
  const totalCost = materialCost + extra
  const massKg = grams / 1000
  return {
    materialCost,
    totalCost,
    massKg,
    costPerKg: massKg > 0 ? totalCost / massKg : null,
    complete,
  }
}
