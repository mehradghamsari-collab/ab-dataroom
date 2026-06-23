import { useMemo, useState, useRef, useEffect, useLayoutEffect } from 'react'
import type { Dispatch, SetStateAction, ClipboardEvent } from 'react'
import { ClipboardPaste, X, Check, ArrowRight, ArrowLeft, AlertTriangle, Sparkles, FlaskConical, Cog, Gauge, Boxes, Plus, Table2, Trash2, Link2, Workflow } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { Modal, Spinner, useToast } from '../components/ui'
import { PROJECTS } from '../lib/projects'
import { cx } from '../lib/utils'

type Step = 'paste' | 'map' | 'options' | 'preview' | 'done'

/* ---------- helpers ---------- */
const pad = (n: number) => String(n).padStart(2, '0')
const norm = (h: string) => (h ?? '').toString().replace(/\s+/g, ' ').trim()

function toISODate(v: any): string | null {
  if (v == null || v === '') return null
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}` // dd/mm/yyyy (GB)
  const d = new Date(s); if (!isNaN(d.getTime())) return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  return null
}
function toNum(v: any): number | null {
  if (v == null || v === '') return null
  const n = parseFloat(String(v).replace(/,/g, '').match(/-?\d+\.?\d*/)?.[0] ?? '')
  return Number.isNaN(n) ? null : n
}
const toInt = (v: any): number | null => { const n = toNum(v); return n == null ? null : Math.round(n) }
const clean = (v: any): string | null => { const s = (v == null ? '' : String(v)).trim(); return s === '' ? null : s }
const matchProject = (v: any): string | null => {
  const s = clean(v); if (!s) return null
  const p = PROJECTS.find((p) => p.code.toLowerCase() === s.toLowerCase() || p.label.toLowerCase() === s.toLowerCase())
  return p?.code ?? null
}

// robust TSV/clipboard parser — handles quoted cells with embedded tabs/newlines
function parseTable(text: string): string[][] {
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []; let row: string[] = [], cell = '', inQ = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQ) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++ } else inQ = false } else cell += c; continue }
    if (c === '"') { inQ = true; continue }
    if (c === '\t') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

interface Analysis {
  base: Record<string, number>
  chem: Record<number, { name?: number; mass?: number; ratio?: number }>
  proc: Record<number, { process?: number; measure?: number; value?: number }>
  res: Record<number, { result?: number; rvalue?: number; comment?: number }>
  std: Record<string, number>
}
function analyze(headers: string[], baseOverride: Record<string, number>, hasHeader: boolean, body: string[][]): Analysis {
  const a: Analysis = { base: {}, chem: {}, proc: {}, res: {}, std: {} }
  const ce = (i: number) => (a.chem[i] ??= {})
  const pe = (i: number) => (a.proc[i] ??= {})
  const re = (i: number) => (a.res[i] ??= {})
  if (hasHeader) {
    headers.forEach((raw, i) => {
      const h = norm(raw); let m: RegExpMatchArray | null
      if (/^en$/i.test(h)) a.base.en = i
      else if (/^date$/i.test(h)) a.base.date = i
      else if (/^owner$/i.test(h)) a.base.owner = i
      else if (/^repeat/i.test(h)) a.base.repeat = i
      else if (/^experiment\s*type$/i.test(h)) a.base.experiment_type = i
      else if (/^desc/i.test(h)) a.base.description = i
      else if (/^method$/i.test(h)) a.base.method = i
      else if (/^(work\s*package|project|wp)$/i.test(h)) a.base.project = i
      else if (/^fsc in saline/i.test(h)) a.std.fsc = i
      else if (/^crc in saline/i.test(h)) a.std.crc = i
      else if (/^aup in saline/i.test(h)) a.std.aup = i
      else if (/^fsc in di/i.test(h)) a.std.fscdi = i
      else if (/^aup\b.*0\.3|aup at 0\.3/i.test(h)) a.std.aup03 = i
      else if ((m = h.match(/^(\d+)\s*-\s*name$/i))) ce(+m[1]).name = i
      else if ((m = h.match(/^(\d+)\s*-\s*mass/i))) ce(+m[1]).mass = i
      else if ((m = h.match(/^(\d+)\s*-\s*ratio$/i))) ce(+m[1]).ratio = i
      else if ((m = h.match(/^(\d+)\s*-\s*process$/i))) pe(+m[1]).process = i
      else if ((m = h.match(/^(\d+)\s*-\s*measure$/i))) pe(+m[1]).measure = i
      else if ((m = h.match(/^(\d+)\s*-\s*value$/i))) pe(+m[1]).value = i
      else if ((m = h.match(/^(\d+)\s*-\s*result$/i))) re(+m[1]).result = i
      else if ((m = h.match(/^(\d+)\s*-\s*rvalue$/i))) re(+m[1]).rvalue = i
      else if ((m = h.match(/^(\d+)\s*-\s*comment$/i))) re(+m[1]).comment = i
    })
  } else {
    // No header row — map by the fixed tracker column order the lab uses:
    // 0-5 base · 6-26 seven chem triplets · 27-62 twelve process triplets · 63 method · 64-67 FSC/CRC/AUP/FSC-DI
    const ncols = body.reduce((m, r) => Math.max(m, r.length), 0)
    a.base = { en: 0, date: 1, owner: 2, repeat: 3, experiment_type: 4, description: 5 }
    const fullLayout = ncols >= 64 // has at least through Method → treat as the standard wide layout
    if (fullLayout) {
      a.base.method = 63
      for (let i = 0; i < 7; i++) { const b = 6 + i * 3; if (b < ncols) a.chem[i + 1] = { name: b, mass: b + 1, ratio: b + 2 } }
      for (let i = 0; i < 12; i++) { const b = 27 + i * 3; if (b < ncols) a.proc[i + 1] = { process: b, measure: b + 1, value: b + 2 } }
      if (64 < ncols) a.std.fsc = 64
      if (65 < ncols) a.std.crc = 65
      if (66 < ncols) a.std.aup = 66
      if (67 < ncols) a.std.fscdi = 67
      if (68 < ncols) a.std.aup03 = 68
    } else {
      // shorter / trimmed paste — keep base by position and read the rightmost purely-numeric columns as FSC/CRC/AUP
      const numericCols: number[] = []
      for (let c = 6; c < ncols; c++) {
        let any = false, allNum = true
        for (const r of body) { const v = (r[c] ?? '').toString().trim(); if (v === '') continue; any = true; if (!/^-?\d+(\.\d+)?$/.test(v)) { allNum = false; break } }
        if (any && allNum) numericCols.push(c)
      }
      const last3 = numericCols.slice(-3)
      ;(['fsc', 'crc', 'aup'] as const).forEach((kk, i) => { if (last3[i] != null) a.std[kk] = last3[i] })
    }
  }
  Object.assign(a.base, baseOverride)
  return a
}
const STD_NAME: Record<string, string> = { fsc: 'FSC in saline (g/g)', crc: 'CRC in saline (g/g)', aup: 'AUP in saline', fscdi: 'FSC in DI water (g/g)', aup03: 'AUP at 0.3 PSI (g/g)' }
// The lab's exact tracker column order (69 columns) — used for the grid editor.
const CANON_HEADERS: string[] = (() => {
  const h = ['EN', 'Date', 'Owner', 'Repeat?', 'Experiment type', 'Description']
  for (let i = 1; i <= 7; i++) h.push(`${i} - Name`, `${i} - Mass (g)`, `${i} - Ratio`)
  for (let i = 1; i <= 12; i++) h.push(i === 1 ? '1- Process' : `${i} - Process`, `${i} - Measure`, `${i} - Value`)
  h.push('Method', 'FSC in saline (g/g)', 'CRC in saline (g/g)', 'AUP in saline (0.7 PSI) (g/g)', 'FSC in DI water (g/g)', 'AUP at 0.3 PSI (g/g)')
  return h
})()
const NCOLS = CANON_HEADERS.length
const BASE_FIELDS = [
  { key: 'en', label: 'EN number', req: true }, { key: 'date', label: 'Date' }, { key: 'owner', label: 'Owner' },
  { key: 'experiment_type', label: 'Experiment type' }, { key: 'description', label: 'Description' },
  { key: 'repeat', label: 'Repeat?' }, { key: 'method', label: 'Method' }, { key: 'project', label: 'Work package' },
]

export function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { experiments, refetchExperiments, refetchRefs } = useData()
  const { profile } = useAuth()
  const toast = useToast()
  const [step, setStep] = useState<Step>('paste')
  const [mode, setMode] = useState<'grid' | 'paste'>('grid')
  const [grid, setGrid] = useState<string[][]>(() => Array.from({ length: 6 }, () => Array(NCOLS).fill('')))
  const [raw, setRaw] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [body, setBody] = useState<string[][]>([])
  const [hasHeader, setHasHeader] = useState(true)
  const [baseOverride, setBaseOverride] = useState<Record<string, number>>({})
  const [inc, setInc] = useState({ materials: true, processes: true, results: true })
  const [projectAll, setProjectAll] = useState('')
  const [updateExisting, setUpdateExisting] = useState(true)
  const [linkBulkBatch, setLinkBulkBatch] = useState(true)
  const [batchParents, setBatchParents] = useState<Set<number>>(new Set())
  const [childOf, setChildOf] = useState<Record<number, number>>({})
  const [activeBatch, setActiveBatch] = useState<number | null>(null)
  const [useManualBatch, setUseManualBatch] = useState(false)
  const [mBatch, setMBatch] = useState<{ name: string; total_made: string; dried_yield: string; notes: string; composition: { name: string; amount: string; unit: string }[] }>({ name: '', total_made: '', dried_yield: '', notes: '', composition: [] })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ added: number; updated: number; skipped: number; mats: number; procs: number; reslt: number; ens: number[]; batch?: string } | null>(null)

  const reset = () => { setStep('paste'); setMode('grid'); setGrid(Array.from({ length: 6 }, () => Array(NCOLS).fill(''))); setRaw(''); setHeaders([]); setBody([]); setHasHeader(true); setBaseOverride({}); setInc({ materials: true, processes: true, results: true }); setProjectAll(''); setUpdateExisting(true); setLinkBulkBatch(true); setBatchParents(new Set()); setChildOf({}); setActiveBatch(null); setUseManualBatch(false); setMBatch({ name: '', total_made: '', dried_yield: '', notes: '', composition: [] }); setResult(null) }
  const close = () => { reset(); onClose() }

  const parseNow = (text: string) => {
    setRaw(text)
    const all = parseTable(text)
    if (all.length < 1) { setHeaders([]); setBody([]); setHasHeader(true); return }
    // A header row contains a recognisable header word (EN, Date, "1 - Name", "FSC in saline"…).
    // If none is found in the first few rows, there is NO header — every row is data (don't drop one).
    let hi = -1
    for (let i = 0; i < Math.min(all.length, 4); i++) {
      if (all[i].some((c) => /^(en|date|owner|description|experiment\s*type|repeat\??|method|fsc in saline|crc in saline|aup in saline)$/i.test(norm(c)) || /^\d+\s*-\s*(name|process|result|measure|value|mass|ratio)/i.test(norm(c)))) { hi = i; break }
    }
    if (hi >= 0) { setHasHeader(true); setHeaders(all[hi].map(norm)); setBody(all.slice(hi + 1)) }
    else { setHasHeader(false); setHeaders([]); setBody(all) }
    setBaseOverride({})
  }
  // Grid mode → feed the table rows (those with an EN) into the same pipeline as a header-led paste.
  const gridRows = useMemo(() => grid.filter((r) => (r[0] ?? '').trim() !== ''), [grid])
  const commitGrid = () => {
    setHasHeader(true); setHeaders(CANON_HEADERS); setBaseOverride({})
    setBody(gridRows.map((r) => { const rr = [...r]; while (rr.length < NCOLS) rr.push(''); return rr }))
  }
  const maxCols = useMemo(() => body.reduce((m, r) => Math.max(m, r.length), 0), [body])
  const colOptions = useMemo(() => (hasHeader ? headers : Array.from({ length: maxCols }, (_, i) => `Column ${i + 1}`)), [hasHeader, headers, maxCols])
  const a = useMemo(() => analyze(headers, baseOverride, hasHeader, body), [headers, baseOverride, hasHeader, body])
  const counts = useMemo(() => ({
    chem: Object.keys(a.chem).length, proc: Object.keys(a.proc).length, res: Object.keys(a.res).length,
    std: Object.keys(a.std).length,
  }), [a])

  const rowToExp = (cells: string[]) => {
    const g = (i?: number) => (i == null ? '' : cells[i] ?? '')
    const en = toInt(g(a.base.en))
    const project = matchProject(g(a.base.project)) ?? (projectAll || null)
    const exp = {
      en, date: toISODate(g(a.base.date)), owner: clean(g(a.base.owner)),
      experiment_type: clean(g(a.base.experiment_type)), description: clean(g(a.base.description)),
      repeat: clean(g(a.base.repeat)), method: clean(g(a.base.method)), project,
      is_two_step: false, discontinued: false, extra_cost: null,
    }
    const materials = inc.materials ? Object.keys(a.chem).map(Number).sort((x, y) => x - y).map((idx) => {
      const c = a.chem[idx]; const name = clean(g(c.name)); if (!name) return null
      return { name, mass_g: toNum(g(c.mass)), unit: 'g', ratio: clean(g(c.ratio)), stage: null, batch_id: null }
    }).filter(Boolean) as any[] : []
    const processes = inc.processes ? Object.keys(a.proc).map(Number).sort((x, y) => x - y).map((idx) => {
      const c = a.proc[idx]; const process = clean(g(c.process)); if (!process) return null
      return { process, measure: clean(g(c.measure)), value: clean(g(c.value)), stage: null }
    }).filter(Boolean) as any[] : []
    const results: any[] = []
    if (inc.results) {
      ;(['fsc', 'crc', 'aup', 'fscdi', 'aup03'] as const).forEach((kk) => { const i = a.std[kk]; const v = clean(g(i)); if (v != null) results.push({ result_type: STD_NAME[kk], value: v, value_num: toNum(v), comment: null }) })
      Object.keys(a.res).map(Number).sort((x, y) => x - y).forEach((idx) => {
        const c = a.res[idx]; const rt = clean(g(c.result)); if (!rt) return
        results.push({ result_type: rt, value: clean(g(c.rvalue)), value_num: toNum(g(c.rvalue)), comment: clean(g(c.comment)) })
      })
    }
    return { en, exp, materials, processes, results }
  }

  const parsed = useMemo(() => body.map(rowToExp), [body, a, inc, projectAll]) // eslint-disable-line
  const existing = useMemo(() => new Set(experiments.map((e) => e.en)), [experiments])
  const idByExistingEn = useMemo(() => new Map(experiments.map((e) => [e.en, e.id] as const)), [experiments])
  const analysisRows = useMemo(() => {
    const seen = new Set<number>(); const newOnes: typeof parsed = []; const updates: typeof parsed = []; let noEn = 0, dup = 0
    for (const p of parsed) {
      if (p.en == null) { noEn++; continue }
      if (seen.has(p.en)) { dup++; continue }
      seen.add(p.en)
      if (existing.has(p.en)) updates.push(p); else newOnes.push(p)
    }
    return { newOnes, updates, noEn, dup }
  }, [parsed, existing])

  const doImport = async () => {
    setBusy(true)
    try {
      const rows = analysisRows.newOnes
      let inserted: any[] = []
      if (rows.length) {
        const { data, error } = await supabase.from('experiments').insert(rows.map((r) => ({ ...r.exp, created_by: profile?.id ?? null }))).select('id,en')
        if (error) throw error
        inserted = (data as any[]) ?? []
      }
      const idByEn = new Map<number, string>(inserted.map((x) => [x.en, x.id]))
      const mats: any[] = [], procs: any[] = [], reslt: any[] = []
      for (const r of rows) {
        const id = r.en != null ? idByEn.get(r.en) : undefined; if (!id) continue
        r.materials.forEach((m, i) => mats.push({ ...m, experiment_id: id, position: i + 1 }))
        r.processes.forEach((p, i) => procs.push({ ...p, experiment_id: id, position: i + 1 }))
        r.results.forEach((x, i) => reslt.push({ ...x, experiment_id: id, position: i + 1 }))
      }
      if (mats.length) { const { error: e } = await supabase.from('experiment_materials').insert(mats); if (e) throw e }
      if (procs.length) { const { error: e } = await supabase.from('experiment_processes').insert(procs); if (e) throw e }
      if (reslt.length) { const { error: e } = await supabase.from('experiment_results').insert(reslt); if (e) throw e }

      // ----- Enrich experiments that already exist (fill in their details) -----
      let updatedCount = 0, uMats = 0, uProcs = 0, uReslt = 0
      if (updateExisting && analysisRows.updates.length) {
        for (const r of analysisRows.updates) {
          const id = r.en != null ? idByExistingEn.get(r.en) : undefined
          if (!id) continue
          const patch: any = {}
          ;(['date', 'owner', 'experiment_type', 'description', 'repeat', 'method', 'project'] as const).forEach((kk) => { if ((r.exp as any)[kk] != null) patch[kk] = (r.exp as any)[kk] })
          if (Object.keys(patch).length) { const { error } = await supabase.from('experiments').update(patch).eq('id', id); if (error) throw error }
          if (r.materials.length) { await supabase.from('experiment_materials').delete().eq('experiment_id', id); const { error: e } = await supabase.from('experiment_materials').insert(r.materials.map((m, i) => ({ ...m, experiment_id: id, position: i + 1 }))); if (e) throw e; uMats += r.materials.length }
          if (r.processes.length) { await supabase.from('experiment_processes').delete().eq('experiment_id', id); const { error: e } = await supabase.from('experiment_processes').insert(r.processes.map((p, i) => ({ ...p, experiment_id: id, position: i + 1 }))); if (e) throw e; uProcs += r.processes.length }
          if (r.results.length) { await supabase.from('experiment_results').delete().eq('experiment_id', id); const { error: e } = await supabase.from('experiment_results').insert(r.results.map((x, i) => ({ ...x, experiment_id: id, position: i + 1 }))); if (e) throw e; uReslt += r.results.length }
          updatedCount++
        }
      }

      // ----- Batches: user-drawn links (parent → children), else one shared batch -----
      let batchLabel = ''
      if (batchParents.size > 0) {
        let made = 0
        for (const parentEn of batchParents) {
          const parentRow = rows.find((r) => r.en === parentEn)
          const parentId = idByEn.get(parentEn)
          if (!parentRow || !parentId) continue
          const comp = parentRow.materials.map((m: any) => ({ name: m.name, amount: m.mass_g, unit: m.unit || 'g' }))
          const { data: b, error: be } = await supabase.from('batches').insert({ code: `B-EN${parentEn}`, name: parentRow.exp.description || `Batch from EN${parentEn}`, composition: comp, owner: parentRow.exp.owner, prepared_date: parentRow.exp.date, notes: 'Created from a pasted experiment (batch link)', created_by: profile?.id ?? null }).select('id,code,name').single()
          if (be) throw be
          const bId = (b as any).id; made++; batchLabel = `${(b as any).code} · ${(b as any).name}`
          const childEns = Object.entries(childOf).filter(([, p]) => Number(p) === parentEn).map(([c]) => Number(c))
          const linkRows = childEns.map((ce) => { const cid = idByEn.get(ce); if (!cid) return null; return { experiment_id: cid, position: 90, name: `${(b as any).code} · ${(b as any).name}`, mass_g: null, unit: 'g', ratio: null, stage: null, batch_id: bId } }).filter(Boolean) as any[]
          if (linkRows.length) { const { error: e } = await supabase.from('experiment_materials').insert(linkRows); if (e) throw e }
        }
        if (made > 1) batchLabel = `${made} batches`
        await refetchRefs()
      } else if (useManualBatch && mBatch.name.trim()) {
        const comp = mBatch.composition.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), amount: c.amount === '' ? null : parseFloat(c.amount), unit: c.unit || 'g' }))
        const { data: b, error: be } = await supabase.from('batches').insert({ name: mBatch.name.trim(), total_made: mBatch.total_made || null, dried_yield: mBatch.dried_yield || null, notes: mBatch.notes || null, composition: comp, created_by: profile?.id ?? null }).select('id,name').single()
        if (be) throw be
        const batchId = (b as any).id; batchLabel = (b as any).name
        const linkRows = rows.map((r) => { const id = r.en != null ? idByEn.get(r.en) : undefined; if (!id) return null; return { experiment_id: id, position: 90, name: batchLabel, mass_g: null, unit: 'g', ratio: null, stage: null, batch_id: batchId } }).filter(Boolean) as any[]
        if (linkRows.length) { const { error: e } = await supabase.from('experiment_materials').insert(linkRows); if (e) throw e }
        await refetchRefs()
      }

      await refetchExperiments()
      setResult({ added: rows.length, updated: updatedCount, skipped: analysisRows.dup + analysisRows.noEn + (updateExisting ? 0 : analysisRows.updates.length), mats: mats.length + uMats, procs: procs.length + uProcs, reslt: reslt.length + uReslt, ens: rows.map((r) => r.en!).filter(Boolean), batch: batchLabel || undefined })
      setStep('done')
    } catch (e: any) { toast(e?.message ?? 'Import failed', 'err') } finally { setBusy(false) }
  }

  const enMapped = a.base.en != null
  const ready = body.length > 0
  const toApply = analysisRows.newOnes.length + (updateExisting ? analysisRows.updates.length : 0)
  const bulkRow = useMemo(() => analysisRows.newOnes.find((r) => /bulk/i.test(r.exp.experiment_type || '')), [analysisRows])
  const continuations = useMemo(() => analysisRows.newOnes.filter((r) => !(bulkRow && r.en === bulkRow.en)).length, [analysisRows, bulkRow])

  return (
    <Modal open={open} onClose={close} size={mode === 'grid' && step === 'paste' ? '2xl' : 'xl'} title="Paste experiments from Excel"
      footer={
        step === 'paste' ? <><button className="btn-ghost" onClick={close}>Cancel</button><button className="btn-primary" onClick={() => { if (mode === 'grid') { commitGrid(); setStep('options') } else setStep('map') }} disabled={mode === 'grid' ? gridRows.length === 0 : !ready}>Continue <ArrowRight size={15} /></button></>
          : step === 'map' ? <><button className="btn-ghost mr-auto" onClick={() => setStep('paste')}><ArrowLeft size={15} /> Back</button><button className="btn-primary" onClick={() => setStep('options')} disabled={!enMapped}>Next <ArrowRight size={15} /></button></>
            : step === 'options' ? <><button className="btn-ghost mr-auto" onClick={() => setStep(mode === 'grid' ? 'paste' : 'map')}><ArrowLeft size={15} /> Back</button><button className="btn-primary" onClick={() => setStep('preview')}>Preview <ArrowRight size={15} /></button></>
              : step === 'preview' ? <><button className="btn-ghost mr-auto" onClick={() => setStep('options')}><ArrowLeft size={15} /> Back</button><button className="btn-primary" onClick={doImport} disabled={busy || toApply === 0}>{busy ? <Spinner className="h-4 w-4" /> : `${analysisRows.newOnes.length > 0 && updateExisting && analysisRows.updates.length > 0 ? `Import ${analysisRows.newOnes.length} · update ${analysisRows.updates.length}` : analysisRows.newOnes.length > 0 ? `Import ${analysisRows.newOnes.length} experiment${analysisRows.newOnes.length === 1 ? '' : 's'}` : `Update ${analysisRows.updates.length} experiment${analysisRows.updates.length === 1 ? '' : 's'}`}`}</button></>
                : <button className="btn-primary" onClick={close}>Done</button>
      }>
      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-2xs font-medium text-subtle">
        {(mode === 'grid' ? (['paste', 'options', 'preview'] as Step[]) : (['paste', 'map', 'options', 'preview'] as Step[])).map((s, i, arr) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cx('rounded-full px-2 py-0.5', step === s ? 'bg-brand text-white' : 'bg-black/[0.05]')}>{i + 1}. {s === 'paste' ? (mode === 'grid' ? 'Table' : 'Paste') : s === 'map' ? 'Match' : s === 'options' ? 'Fill rest' : 'Preview'}</span>
            {i < arr.length - 1 && <ArrowRight size={11} />}
          </span>
        ))}
      </div>

      {step === 'paste' && (
        <div>
          <div className="mb-3 inline-flex rounded-lg bg-black/[0.04] p-0.5 text-xs font-medium">
            <button onClick={() => setMode('grid')} className={cx('flex items-center gap-1.5 rounded-md px-3 py-1.5 transition', mode === 'grid' ? 'bg-surface text-brand-dark shadow-card' : 'text-muted')}><Table2 size={13} /> Fill a table</button>
            <button onClick={() => setMode('paste')} className={cx('flex items-center gap-1.5 rounded-md px-3 py-1.5 transition', mode === 'paste' ? 'bg-surface text-brand-dark shadow-card' : 'text-muted')}><ClipboardPaste size={13} /> Paste raw text</button>
          </div>

          {mode === 'grid' ? (
            <div>
              <p className="mb-2 text-sm text-muted">Each row is one experiment. Copy cells from your Excel sheet and paste them straight into the table — paste a whole block at once and it spreads across the cells, adding rows as needed. Empty cells are fine.</p>
              <GridEditor grid={grid} setGrid={setGrid} />
              <div className="mt-2 flex items-center justify-between">
                <div className="flex gap-2">
                  <button className="btn-soft-teal h-8 px-2.5 text-xs" onClick={() => setGrid((g) => [...g, Array(NCOLS).fill('')])}><Plus size={13} /> Add row</button>
                  <button className="btn-ghost h-8 px-2.5 text-xs" onClick={() => setGrid((g) => [...g, ...Array.from({ length: 5 }, () => Array(NCOLS).fill(''))])}>+ 5 rows</button>
                </div>
                <span className="data text-2xs text-subtle">{gridRows.length} experiment{gridRows.length === 1 ? '' : 's'} with an EN</span>
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-sm text-muted">In Excel, select your experiment rows — <strong>including the header row</strong> (EN, Date, Owner…) if you can — copy them (Ctrl/Cmd+C), then paste below.</p>
              <textarea autoFocus value={raw} onChange={(e) => parseNow(e.target.value)} onPaste={(e) => { const t = e.clipboardData.getData('text'); if (t) { e.preventDefault(); parseNow(t) } }}
                placeholder="Paste here — ideally the header row plus one or more experiment rows…"
                className="field h-44 w-full resize-y font-mono text-xs" />
              {ready ? (
                <div className="mt-3 rounded-lg border border-positive/30 bg-positive/[0.06] p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium text-ink"><Check size={15} className="text-positive" /> Read {body.length} experiment row{body.length === 1 ? '' : 's'} · {hasHeader ? `${headers.length} columns` : 'no header (mapped by position)'}</div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted">
                    <span><FlaskConical size={11} className="mb-0.5 inline" /> {counts.chem} chemical slots</span>
                    <span><Cog size={11} className="mb-0.5 inline" /> {counts.proc} process slots</span>
                    <span><Gauge size={11} className="mb-0.5 inline" /> {counts.std} standard + {counts.res} extra results</span>
                  </div>
                  {!hasHeader && <p className="mt-1.5 text-2xs text-subtle">No header row — columns read in your standard tracker order (EN · date · owner · repeat · type · description · 7 chemicals · 12 process steps · method · FSC/CRC/AUP).</p>}
                </div>
              ) : raw.trim() ? <p className="mt-3 flex items-center gap-1.5 text-xs text-orange-dark"><AlertTriangle size={14} /> Nothing read yet — paste at least one experiment row.</p> : null}
            </div>
          )}
        </div>
      )}

      {step === 'map' && (
        <div>
          <p className="mb-3 flex items-center gap-1.5 text-xs text-muted"><Sparkles size={13} className="text-brand" /> {hasHeader ? 'Matched from your headers — adjust the base fields if needed. Materials, processes and results are detected automatically.' : 'No header row — columns are mapped by position. Adjust below if the order differs.'}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {BASE_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center gap-2">
                <div className="w-36 shrink-0 text-sm">{f.label}{f.req && <span className="text-danger"> *</span>}</div>
                <select className="field h-9 flex-1 text-sm" value={a.base[f.key] ?? -1} onChange={(e) => setBaseOverride({ ...baseOverride, [f.key]: parseInt(e.target.value) })}>
                  <option value={-1}>— ignore —</option>
                  {colOptions.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <ToggleRow on={inc.materials} onChange={(v) => setInc({ ...inc, materials: v })} icon={<FlaskConical size={14} />} label={`Materials — ${counts.chem} chemical slots per row`} />
            <ToggleRow on={inc.processes} onChange={(v) => setInc({ ...inc, processes: v })} icon={<Cog size={14} />} label={`Processes — ${counts.proc} step slots per row`} />
            <ToggleRow on={inc.results} onChange={(v) => setInc({ ...inc, results: v })} icon={<Gauge size={14} />} label={`Results — FSC/CRC/AUP${a.std.fscdi != null ? '/FSC-DI' : ''}${counts.res ? ` + ${counts.res} extra` : ''}`} />
          </div>
          {!enMapped && <p className="mt-3 flex items-center gap-1.5 text-xs text-orange-dark"><AlertTriangle size={14} /> Pick the EN column to continue.</p>}
        </div>
      )}

      {step === 'options' && (
        <div className="space-y-4">
          <p className="text-sm text-muted">A couple of things the spreadsheet doesn't carry — set them here and they'll apply to every pasted row (each experiment stays fully editable afterwards).</p>

          {analysisRows.updates.length > 0 && (
            <div className="rounded-xl border border-brand-ring/50 bg-brand-tint/40 p-3.5">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
                <span className="text-sm">
                  <span className="font-semibold text-brand-dark">{analysisRows.updates.length} of these experiments already exist — fill in their details</span>
                  <span className="mt-0.5 block text-xs text-muted">Updates the chemicals, processes and results of EN{analysisRows.updates.map((r) => r.en).slice(0, 6).join(', EN')}{analysisRows.updates.length > 6 ? '…' : ''} from this paste. Fields the paste leaves blank are kept as they are. Leave unticked to skip them.</span>
                </span>
              </label>
            </div>
          )}

          <div>
            <div className="label mb-1">Work package {a.base.project != null && <span className="text-2xs font-normal text-subtle">(used only where a row has none)</span>}</div>
            <select className="field max-w-xs" value={projectAll} onChange={(e) => setProjectAll(e.target.value)}>
              <option value="">— leave blank —</option>
              {PROJECTS.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
            </select>
          </div>
          <div className="rounded-lg border border-line bg-paper p-3 text-xs text-muted">
            <p><strong className="text-ink">Surface-linking rows:</strong> where a chemical is a prior EN (e.g. <span className="data">EN1, 1.5 g</span>), it imports just as written — the sample name and amount are preserved so the lineage stays visible.</p>
          </div>

          {/* Connect experiments to their batch — visual mind-map */}
          {analysisRows.newOnes.length >= 2 && (
            <BatchLinker
              rows={analysisRows.newOnes.map((r) => ({ en: r.en!, type: r.exp.experiment_type || '', desc: r.exp.description || '' }))}
              parents={batchParents} setParents={setBatchParents}
              childOf={childOf} setChildOf={setChildOf}
              active={activeBatch} setActive={setActiveBatch}
              suggestBulk={bulkRow ? bulkRow.en! : null}
            />
          )}

          {/* Shared batch that isn't among the pasted rows */}
          {batchParents.size === 0 && (
            <div className="rounded-xl border border-line bg-paper p-3.5">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input type="checkbox" checked={useManualBatch} onChange={(e) => setUseManualBatch(e.target.checked)} className="h-4 w-4 accent-brand" />
                <span className="flex items-center gap-1.5 text-sm font-medium text-ink"><Boxes size={14} className="text-brand" /> They came from one shared batch (not in the paste)</span>
              </label>
              {useManualBatch && (
                <div className="mt-3 space-y-2.5">
                  <p className="text-xs text-muted">Add the batch details once and all {analysisRows.newOnes.length} pasted experiments will link to it.</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input className="field" placeholder="Batch name (e.g. 4% XG in water)" value={mBatch.name} onChange={(e) => setMBatch({ ...mBatch, name: e.target.value })} />
                    <input className="field" placeholder="Total made (e.g. 5 L)" value={mBatch.total_made} onChange={(e) => setMBatch({ ...mBatch, total_made: e.target.value })} />
                    <input className="field" placeholder="Dried yield (e.g. 190 g)" value={mBatch.dried_yield} onChange={(e) => setMBatch({ ...mBatch, dried_yield: e.target.value })} />
                    <input className="field" placeholder="Drying / notes" value={mBatch.notes} onChange={(e) => setMBatch({ ...mBatch, notes: e.target.value })} />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between"><span className="text-2xs font-semibold uppercase tracking-wider text-subtle">Composition</span>
                      <button type="button" className="text-2xs font-medium text-brand-dark" onClick={() => setMBatch({ ...mBatch, composition: [...mBatch.composition, { name: '', amount: '', unit: 'g' }] })}>+ Add component</button></div>
                    <div className="space-y-1.5">
                      {mBatch.composition.map((c, i) => (
                        <div key={i} className="grid grid-cols-[1fr_90px_60px_auto] gap-1.5">
                          <input className="field h-8 text-sm" placeholder="Component" value={c.name} onChange={(e) => setMBatch({ ...mBatch, composition: mBatch.composition.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                          <input className="field h-8 text-sm data" placeholder="Amount" value={c.amount} onChange={(e) => setMBatch({ ...mBatch, composition: mBatch.composition.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)) })} />
                          <select className="field h-8 text-sm" value={c.unit} onChange={(e) => setMBatch({ ...mBatch, composition: mBatch.composition.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)) })}><option value="g">g</option><option value="mL">mL</option></select>
                          <button type="button" className="btn-ghost h-8 w-8 p-0 text-subtle hover:text-danger" onClick={() => setMBatch({ ...mBatch, composition: mBatch.composition.filter((_, j) => j !== i) })}><X size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {step === 'preview' && (() => {
        const updRows = updateExisting ? analysisRows.updates : []
        const shown = [...analysisRows.newOnes.map((r) => ({ r, kind: 'new' as const })), ...updRows.map((r) => ({ r, kind: 'update' as const }))]
        return (
          <div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="New to import" value={analysisRows.newOnes.length} tone="brand" />
              <Stat label={updateExisting ? 'To update' : 'Already in app'} value={analysisRows.updates.length} tone={updateExisting ? 'brand' : 'muted'} />
              <Stat label="No EN (skipped)" value={analysisRows.noEn} tone="muted" />
            </div>
            {shown.length === 0 ? (
              <p className="mt-4 rounded-lg border border-line bg-paper px-3 py-3 text-sm text-muted">Nothing to do — every row with an EN is already in the dataroom{updateExisting ? '' : '. Go back and tick “fill in their details” to update them'}.</p>
            ) : (
              <>
                <p className="mt-4 mb-2 text-xs text-muted">First {Math.min(8, shown.length)} shown — each carries its materials, processes and results:</p>
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full min-w-[660px] text-sm">
                    <thead><tr className="border-b border-line bg-paper text-left text-2xs uppercase tracking-wider text-muted">
                      <th className="px-3 py-2">EN</th><th className="px-3 py-2"></th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Owner</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Mat·Proc·Res</th>
                    </tr></thead>
                    <tbody>
                      {shown.slice(0, 8).map(({ r: p, kind }) => (
                        <tr key={p.en} className="border-b border-line last:border-0">
                          <td className="px-3 py-1.5 data font-medium">EN{p.en}</td>
                          <td className="px-3 py-1.5"><span className={cx('rounded px-1.5 py-0.5 text-2xs font-semibold', kind === 'new' ? 'bg-positive/15 text-positive' : 'bg-brand-tint text-brand-dark')}>{kind === 'new' ? 'new' : 'update'}</span></td>
                          <td className="px-3 py-1.5 data text-muted">{p.exp.date ?? '—'}</td>
                          <td className="px-3 py-1.5 text-muted">{p.exp.owner ?? '—'}</td>
                          <td className="px-3 py-1.5 text-muted">{p.exp.experiment_type ?? '—'}</td>
                          <td className="px-3 py-1.5 text-muted">{p.exp.description ?? '—'}</td>
                          <td className="px-3 py-1.5 data text-2xs text-subtle">{p.materials.length}·{p.processes.length}·{p.results.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {shown.length > 8 && <p className="mt-1.5 text-2xs text-subtle">+{shown.length - 8} more</p>}
              </>
            )}
          </div>
        )
      })()}

      {step === 'done' && result && (
        <div className="py-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-positive/15 text-positive"><Check size={28} /></div>
          <h3 className="text-lg font-semibold">{result.added > 0 && result.updated > 0 ? `Imported ${result.added}, updated ${result.updated}` : result.added > 0 ? `Imported ${result.added} experiment${result.added === 1 ? '' : 's'}` : `Updated ${result.updated} experiment${result.updated === 1 ? '' : 's'}`}</h3>
          <p className="mt-1 text-sm text-muted">{result.mats} materials · {result.procs} process steps · {result.reslt} results brought in.{result.skipped > 0 ? ` ${result.skipped} row${result.skipped === 1 ? '' : 's'} skipped.` : ''}</p>
          {result.batch && <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-2.5 py-1 text-xs font-medium text-brand-dark"><Boxes size={13} /> Linked to batch “{result.batch}”</p>}
          {result.ens.length > 0 && <p className="mt-2 data text-xs text-subtle">EN{Math.min(...result.ens)}–EN{Math.max(...result.ens)}</p>}
        </div>
      )}
    </Modal>
  )
}

function ToggleRow({ on, onChange, icon, label }: { on: boolean; onChange: (v: boolean) => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className={cx('flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition', on ? 'border-brand-ring/50 bg-brand-tint/40' : 'border-line bg-paper opacity-60')}>
      <span className={cx('grid h-5 w-5 place-items-center rounded', on ? 'bg-brand text-white' : 'bg-black/10 text-transparent')}><Check size={13} /></span>
      <span className={cx(on ? 'text-brand-dark' : 'text-muted')}>{icon}</span>
      <span className="text-ink">{label}</span>
    </button>
  )
}
function Stat({ label, value, tone }: { label: string; value: number; tone: 'brand' | 'muted' }) {
  return (
    <div className={cx('rounded-xl border p-3 text-center', tone === 'brand' ? 'border-brand-ring/50 bg-brand-tint/40' : 'border-line bg-paper')}>
      <div className={cx('data text-2xl font-bold', tone === 'brand' ? 'text-brand-dark' : 'text-muted')}>{value}</div>
      <div className="text-2xs text-subtle">{label}</div>
    </div>
  )
}

/* ---------- Spreadsheet-style grid editor (one row = one experiment) ---------- */
const GROUPS: { label: string; span: number; bg: string }[] = (() => {
  const arr: { label: string; span: number; bg: string }[] = [{ label: 'Experiment', span: 6, bg: '#0B1F3A' }]
  for (let i = 1; i <= 7; i++) arr.push({ label: `Chem ${i}`, span: 3, bg: i % 2 ? '#0E8A94' : '#0A6E76' })
  for (let i = 1; i <= 12; i++) arr.push({ label: `Proc ${i}`, span: 3, bg: i % 2 ? '#3B3663' : '#2A2747' })
  arr.push({ label: 'Method', span: 1, bg: '#5A4BD0' })
  arr.push({ label: 'Results', span: 5, bg: '#C93A00' })
  return arr
})()
const colW = (h: string) => /description|method/i.test(h) ? 160 : /name$|process$/i.test(h) ? 150 : /measure$/i.test(h) ? 120 : /^date$/i.test(h) ? 100 : /^owner$/i.test(h) ? 92 : /^experiment type$/i.test(h) ? 130 : /^repeat/i.test(h) ? 84 : /^en$/i.test(h) ? 66 : 80

function parseClip(text: string): string[][] {
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []; let row: string[] = [], cell = '', inQ = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQ) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++ } else inQ = false } else cell += c; continue }
    if (c === '"') { inQ = true; continue }
    if (c === '\t') { row.push(cell); cell = ''; continue }
    if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue }
    cell += c
  }
  row.push(cell); rows.push(row)
  if (rows.length > 1 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop()
  return rows
}

function GridEditor({ grid, setGrid }: { grid: string[][]; setGrid: Dispatch<SetStateAction<string[][]>> }) {
  const setCell = (r: number, c: number, v: string) => setGrid((g) => { const ng = g.map((x) => [...x]); ng[r][c] = v; return ng })
  const removeRow = (r: number) => setGrid((g) => (g.length > 1 ? g.filter((_, i) => i !== r) : [Array(NCOLS).fill('')]))
  const onCellPaste = (e: ClipboardEvent, r: number, c: number) => {
    const text = e.clipboardData.getData('text')
    if (!text) return
    if (!text.includes('\t') && !text.includes('\n')) return // single value → normal paste
    e.preventDefault()
    const block = parseClip(text)
    setGrid((g) => {
      const ng = g.map((x) => [...x])
      block.forEach((pr, i) => { const rr = r + i; while (ng.length <= rr) ng.push(Array(NCOLS).fill('')); pr.forEach((val, j) => { const cc = c + j; if (cc < NCOLS) ng[rr][cc] = val }) })
      return ng
    })
  }
  return (
    <div className="overflow-auto rounded-lg border border-line" style={{ maxHeight: '52vh' }}>
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 border-b border-r border-line bg-paper" style={{ minWidth: 44 }} />
            {GROUPS.map((grp, gi) => (
              <th key={gi} colSpan={grp.span} className="border-b border-r border-white/15 px-2 py-1 text-left text-2xs font-semibold uppercase tracking-wider text-white" style={{ background: grp.bg }}>{grp.label}</th>
            ))}
          </tr>
          <tr>
            <th className="sticky left-0 top-0 z-30 border-b border-r border-line bg-paper text-center text-2xs text-subtle" style={{ minWidth: 44 }}>#</th>
            {CANON_HEADERS.map((h, i) => (
              <th key={i} className="sticky top-0 z-20 border-b border-r border-line bg-paper px-1.5 py-1 text-left text-2xs font-medium text-muted" style={{ minWidth: colW(h) }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, r) => (
            <tr key={r} className={cx('group/row', r % 2 === 1 && 'bg-black/[0.015]')}>
              <td className="sticky left-0 z-10 border-b border-r border-line bg-paper px-1 align-middle">
                <div className="flex items-center justify-center gap-0.5">
                  <span className="data text-2xs text-subtle">{r + 1}</span>
                  <button onClick={() => removeRow(r)} className="text-subtle opacity-0 transition hover:text-danger group-hover/row:opacity-100"><Trash2 size={11} /></button>
                </div>
              </td>
              {CANON_HEADERS.map((h, c) => (
                <td key={c} className="border-b border-r border-line p-0">
                  <input value={row[c] ?? ''} onChange={(e) => setCell(r, c, e.target.value)} onPaste={(e) => onCellPaste(e, r, c)} className="w-full bg-transparent px-1.5 py-1 text-xs outline-none focus:bg-brand-tint/60" style={{ minWidth: colW(h) }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ---------- Visual batch linker (mind-map: batch → children with arrows) ---------- */
function BatchLinker({ rows, parents, setParents, childOf, setChildOf, active, setActive, suggestBulk }: {
  rows: { en: number; type: string; desc: string }[]
  parents: Set<number>; setParents: Dispatch<SetStateAction<Set<number>>>
  childOf: Record<number, number>; setChildOf: Dispatch<SetStateAction<Record<number, number>>>
  active: number | null; setActive: Dispatch<SetStateAction<number | null>>
  suggestBulk: number | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<Map<number, HTMLElement>>(new Map())
  const [arrows, setArrows] = useState<{ id: string; d: string; on: boolean }[]>([])
  const parentList = rows.filter((r) => parents.has(r.en))
  const childList = rows.filter((r) => !parents.has(r.en))
  const childKey = JSON.stringify(childOf)
  const parentKey = [...parents].sort((a, b) => a - b).join(',')

  const setNode = (en: number) => (el: HTMLElement | null) => { if (el) nodeRefs.current.set(en, el); else nodeRefs.current.delete(en) }
  const recompute = () => {
    const c = containerRef.current; if (!c) return
    const cb = c.getBoundingClientRect()
    const out: { id: string; d: string; on: boolean }[] = []
    Object.entries(childOf).forEach(([ce, pe]) => {
      const p = nodeRefs.current.get(Number(pe)); const ch = nodeRefs.current.get(Number(ce)); if (!p || !ch) return
      const pr = p.getBoundingClientRect(); const cr = ch.getBoundingClientRect()
      const x1 = pr.right - cb.left, y1 = pr.top + pr.height / 2 - cb.top
      const x2 = cr.left - cb.left, y2 = cr.top + cr.height / 2 - cb.top
      const mx = x1 + Math.max(28, (x2 - x1) / 2)
      out.push({ id: `${pe}-${ce}`, d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`, on: active === Number(pe) })
    })
    setArrows(out)
  }
  const recomputeRef = useRef(recompute); recomputeRef.current = recompute
  useLayoutEffect(() => { recompute() }, [childKey, parentKey, active, rows.length]) // eslint-disable-line
  useEffect(() => {
    const c = containerRef.current; if (!c) return
    const ro = new ResizeObserver(() => recomputeRef.current())
    ro.observe(c)
    const h = () => recomputeRef.current()
    window.addEventListener('resize', h)
    return () => { ro.disconnect(); window.removeEventListener('resize', h) }
  }, [])

  const makeBatch = (en: number) => { setParents((p) => new Set(p).add(en)); setChildOf((c) => { const n = { ...c }; delete n[en]; return n }); setActive(en) }
  const removeBatch = (en: number) => { setParents((p) => { const n = new Set(p); n.delete(en); return n }); setChildOf((c) => Object.fromEntries(Object.entries(c).filter(([, v]) => Number(v) !== en))); setActive((a) => (a === en ? null : a)) }
  const toggleChild = (en: number) => { if (active == null) return; setChildOf((c) => { const n = { ...c }; if (Number(n[en]) === active) delete n[en]; else n[en] = active; return n }) }
  const autoDetect = () => { if (suggestBulk == null) return; setParents(new Set([suggestBulk])); setChildOf(Object.fromEntries(rows.filter((r) => r.en !== suggestBulk).map((r) => [r.en, suggestBulk]))); setActive(suggestBulk) }
  const clearAll = () => { setParents(new Set()); setChildOf({}); setActive(null) }
  const childCount = (en: number) => Object.values(childOf).filter((v) => Number(v) === en).length

  return (
    <div className="rounded-xl border border-[#6C5CE0]/30 bg-[#6C5CE0]/[0.04] p-3.5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-[#5A4BD0]"><Workflow size={15} /> Connect experiments to their batch</span>
        <div className="flex gap-1.5">
          {suggestBulk != null && <button className="btn-ghost h-7 px-2 text-2xs" onClick={autoDetect}><Sparkles size={12} /> Auto: EN{suggestBulk} → rest</button>}
          {(parents.size > 0 || Object.keys(childOf).length > 0) && <button className="btn-ghost h-7 px-2 text-2xs text-muted" onClick={clearAll}>Clear</button>}
        </div>
      </div>
      <p className="mb-3 text-xs text-muted">
        {parents.size === 0
          ? 'Mark the experiment that is the batch (the big prep) with the box icon. Then click the others to link them to it — they’ll draw out as branches.'
          : active != null
            ? <>Linking to <span className="font-semibold text-[#5A4BD0]">EN{active}</span> — click experiments on the right to add or remove them. Pick another batch on the left to switch.</>
            : 'Select a batch on the left, then click experiments on the right to link them.'}
      </p>

      <div ref={containerRef} className="relative grid grid-cols-[1fr_1.1fr] gap-x-10">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: 'visible' }}>
          <defs>
            <marker id="bl-arrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#6C5CE0" /></marker>
            <marker id="bl-arrow-dim" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#C9C4E8" /></marker>
          </defs>
          {arrows.map((a) => <path key={a.id} d={a.d} fill="none" stroke={a.on ? '#6C5CE0' : '#C9C4E8'} strokeWidth={a.on ? 2.2 : 1.6} markerEnd={`url(#${a.on ? 'bl-arrow' : 'bl-arrow-dim'})`} />)}
        </svg>

        {/* Left — batches */}
        <div className="relative z-10 space-y-2">
          <div className="text-2xs font-semibold uppercase tracking-wider text-subtle">Batches</div>
          {parentList.length === 0 && <div className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-2xs text-subtle">No batch yet — mark one on the right →</div>}
          {parentList.map((r) => (
            <div key={r.en} ref={setNode(r.en)} onClick={() => setActive(r.en)}
              className={cx('cursor-pointer rounded-lg border-2 bg-surface px-3 py-2 shadow-sm transition', active === r.en ? 'border-[#6C5CE0] ring-2 ring-[#6C5CE0]/25' : 'border-[#6C5CE0]/40 hover:border-[#6C5CE0]')}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5"><Boxes size={13} className="text-[#5A4BD0]" /><span className="data text-sm font-semibold text-ink">EN{r.en}</span></span>
                <button onClick={(e) => { e.stopPropagation(); removeBatch(r.en) }} className="text-subtle transition hover:text-danger"><X size={13} /></button>
              </div>
              <div className="mt-0.5 flex items-center justify-between">
                <span className="truncate text-2xs text-muted">{r.desc || r.type || 'batch'}</span>
                <span className="ml-2 shrink-0 rounded-full bg-[#6C5CE0]/12 px-1.5 text-2xs font-semibold text-[#5A4BD0]">{childCount(r.en)} linked</span>
              </div>
            </div>
          ))}
        </div>

        {/* Right — experiments */}
        <div className="relative z-10 space-y-2">
          <div className="text-2xs font-semibold uppercase tracking-wider text-subtle">Experiments</div>
          {childList.map((r) => {
            const linked = childOf[r.en] != null
            const onActive = Number(childOf[r.en]) === active
            return (
              <div key={r.en} ref={setNode(r.en)} onClick={() => toggleChild(r.en)}
                className={cx('group/node flex items-center justify-between gap-2 rounded-lg border bg-surface px-3 py-2 transition', active != null ? 'cursor-pointer' : '', onActive ? 'border-[#6C5CE0] bg-[#6C5CE0]/[0.06]' : linked ? 'border-[#6C5CE0]/30' : 'border-line hover:border-line/80')}>
                <span className="min-w-0">
                  <span className="data text-sm font-medium text-ink">EN{r.en}</span>
                  {(r.desc || r.type) && <span className="ml-1.5 truncate text-2xs text-muted">{r.desc || r.type}</span>}
                  {linked && <span className="ml-1.5 text-2xs font-medium text-[#5A4BD0]">→ EN{childOf[r.en]}</span>}
                </span>
                <span className="flex items-center gap-1">
                  {active != null && (onActive ? <Link2 size={14} className="text-[#5A4BD0]" /> : <span className="text-2xs text-subtle opacity-0 transition group-hover/node:opacity-100">link</span>)}
                  <button title="Make this a batch" onClick={(e) => { e.stopPropagation(); makeBatch(r.en) }} className="grid h-6 w-6 place-items-center rounded text-subtle transition hover:bg-[#6C5CE0]/10 hover:text-[#5A4BD0]"><Boxes size={13} /></button>
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
