import type { FullExperiment, Person, LeaveRequest } from './types'
import { sampleMetrics } from './metrics'

/* ---------- dates ---------- */
export const pad2 = (n: number) => String(n).padStart(2, '0')
export function isoDate(d: Date): string { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
export function weekStart(d: Date = new Date()): Date {
  const x = new Date(d); const day = (x.getDay() + 6) % 7 // Monday = 0
  x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x
}
export function weekStartISO(d: Date = new Date()): string { return isoDate(weekStart(d)) }
export function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export function fmtTime(iso: string): string { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }
export function fmtDayTime(iso: string): string { return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }
export function fmtRange(a: string, b: string): string {
  const da = new Date(a), db = new Date(b)
  const opt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return a === b ? da.toLocaleDateString([], opt) : `${da.toLocaleDateString([], opt)} – ${db.toLocaleDateString([], opt)}`
}
export function eachDate(startISO: string, endISO: string): string[] {
  const out: string[] = []
  let d = new Date(startISO + 'T00:00:00'); const end = new Date(endISO + 'T00:00:00')
  while (d <= end) { out.push(isoDate(d)); d = addDays(d, 1) }
  return out
}
export function countWeekdays(startISO: string, endISO: string): number {
  return eachDate(startISO, endISO).filter((iso) => { const wd = new Date(iso + 'T00:00:00').getDay(); return wd !== 0 && wd !== 6 }).length
}

/* ---------- roster ---------- */
export function personById(people: Person[], id: string | null): Person | undefined {
  return id ? people.find((p) => p.id === id) : undefined
}
export function personName(people: Person[], id: string | null): string {
  const p = personById(people, id)
  return p?.full_name || p?.email?.split('@')[0] || 'Someone'
}

/* ---------- leave usage ---------- */
export function holidayWeekdaysUsed(requests: LeaveRequest[], userId: string, year: number): number {
  return requests
    .filter((r) => r.user_id === userId && r.type === 'holiday' && r.status === 'approved' && new Date(r.start_date + 'T00:00:00').getFullYear() === year)
    .reduce((sum, r) => sum + countWeekdays(r.start_date, r.end_date), 0)
}

/* ---------- experiment-set detection (for plot suggestions) ---------- */
export interface ExpSet {
  key: string
  owner: string
  date: string
  project: string | null
  ids: string[]
  ens: number[]
  withResults: number
}
// Researchers log a synthesis set in one sitting → same owner + same date.
export function detectSets(experiments: FullExperiment[], opts: { minSize?: number; max?: number } = {}): ExpSet[] {
  const minSize = opts.minSize ?? 2
  const groups = new Map<string, FullExperiment[]>()
  for (const e of experiments) {
    if (!e.date || !e.owner) continue
    const key = `${e.owner}__${e.date}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(e)
  }
  const sets: ExpSet[] = []
  for (const [key, list] of groups) {
    if (list.length < minSize) continue
    const sorted = [...list].sort((a, b) => (a.en ?? 0) - (b.en ?? 0))
    const projects = new Set(sorted.map((e) => e.project).filter(Boolean))
    sets.push({
      key,
      owner: sorted[0].owner!,
      date: sorted[0].date!,
      project: projects.size === 1 ? (sorted[0].project ?? null) : null,
      ids: sorted.map((e) => e.id),
      ens: sorted.map((e) => e.en).filter((n): n is number => n != null),
      withResults: sorted.filter((e) => { const m = sampleMetrics(e); return m.FSC !== null || m.CRC !== null || m.AUP !== null }).length,
    })
  }
  sets.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.ids.length - a.ids.length))
  return opts.max ? sets.slice(0, opts.max) : sets
}
