export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const m = String(v).replace(/,/g, '').match(/-?\d+\.?\d*/)
  return m ? parseFloat(m[0]) : null
}

export function fmtDate(d: string | null): string {
  if (!d) return '—'
  const dt = new Date(d + (d.length === 10 ? 'T00:00:00' : ''))
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function initials(name?: string | null): string {
  if (!name) return '?'
  const p = name.trim().split(/\s+/)
  return (p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')
}

// Deterministic, gentle color per owner — used for avatars and chart series
const PALETTE = ['#0E8A94', '#6C5CE0', '#C2453B', '#2F7D5B', '#B7791F', '#3A6EA5', '#A14C8E', '#4B5563']
export function colorFor(key: string): string {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export function downloadCSV(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
