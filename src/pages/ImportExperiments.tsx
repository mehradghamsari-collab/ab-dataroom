import { useMemo, useState } from 'react'
import { ClipboardPaste, X, Check, ArrowRight, ArrowLeft, AlertTriangle, Sparkles, FlaskConical, Cog, Gauge } from 'lucide-react'
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
function analyze(headers: string[], baseOverride: Record<string, number>): Analysis {
  const a: Analysis = { base: {}, chem: {}, proc: {}, res: {}, std: {} }
  const ce = (i: number) => (a.chem[i] ??= {})
  const pe = (i: number) => (a.proc[i] ??= {})
  const re = (i: number) => (a.res[i] ??= {})
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
  Object.assign(a.base, baseOverride)
  return a
}
const STD_NAME: Record<string, string> = { fsc: 'FSC in saline (g/g)', crc: 'CRC in saline (g/g)', aup: 'AUP in saline', fscdi: 'FSC in DI water (g/g)' }
const BASE_FIELDS = [
  { key: 'en', label: 'EN number', req: true }, { key: 'date', label: 'Date' }, { key: 'owner', label: 'Owner' },
  { key: 'experiment_type', label: 'Experiment type' }, { key: 'description', label: 'Description' },
  { key: 'repeat', label: 'Repeat?' }, { key: 'method', label: 'Method' }, { key: 'project', label: 'Work package' },
]

export function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { experiments, refetchExperiments } = useData()
  const { profile } = useAuth()
  const toast = useToast()
  const [step, setStep] = useState<Step>('paste')
  const [raw, setRaw] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [body, setBody] = useState<string[][]>([])
  const [baseOverride, setBaseOverride] = useState<Record<string, number>>({})
  const [inc, setInc] = useState({ materials: true, processes: true, results: true })
  const [projectAll, setProjectAll] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ added: number; skipped: number; mats: number; procs: number; reslt: number; ens: number[] } | null>(null)

  const reset = () => { setStep('paste'); setRaw(''); setHeaders([]); setBody([]); setBaseOverride({}); setInc({ materials: true, processes: true, results: true }); setProjectAll(''); setResult(null) }
  const close = () => { reset(); onClose() }

  const parseNow = (text: string) => {
    setRaw(text)
    const all = parseTable(text)
    if (all.length < 2) { setHeaders([]); setBody([]); return }
    let hi = all.findIndex((r) => r.some((c) => /^en$/i.test(norm(c))))
    if (hi < 0) hi = 0
    setHeaders(all[hi].map(norm))
    setBody(all.slice(hi + 1))
    setBaseOverride({})
  }
  const a = useMemo(() => analyze(headers, baseOverride), [headers, baseOverride])
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
      ;(['fsc', 'crc', 'aup', 'fscdi'] as const).forEach((kk) => { const i = a.std[kk]; const v = clean(g(i)); if (v != null) results.push({ result_type: STD_NAME[kk], value: v, value_num: toNum(v), comment: null }) })
      Object.keys(a.res).map(Number).sort((x, y) => x - y).forEach((idx) => {
        const c = a.res[idx]; const rt = clean(g(c.result)); if (!rt) return
        results.push({ result_type: rt, value: clean(g(c.rvalue)), value_num: toNum(g(c.rvalue)), comment: clean(g(c.comment)) })
      })
    }
    return { en, exp, materials, processes, results }
  }

  const parsed = useMemo(() => body.map(rowToExp), [body, a, inc, projectAll]) // eslint-disable-line
  const existing = useMemo(() => new Set(experiments.map((e) => e.en)), [experiments])
  const analysisRows = useMemo(() => {
    const seen = new Set<number>(); const newOnes: typeof parsed = []; let noEn = 0, dup = 0
    for (const p of parsed) { if (p.en == null) { noEn++; continue } if (existing.has(p.en) || seen.has(p.en)) { dup++; continue } seen.add(p.en); newOnes.push(p) }
    return { newOnes, noEn, dup }
  }, [parsed, existing])

  const doImport = async () => {
    setBusy(true)
    try {
      const rows = analysisRows.newOnes
      const { data: inserted, error } = await supabase.from('experiments').insert(rows.map((r) => ({ ...r.exp, created_by: profile?.id ?? null }))).select('id,en')
      if (error) throw error
      const idByEn = new Map<number, string>((inserted as any[]).map((x) => [x.en, x.id]))
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
      await refetchExperiments()
      setResult({ added: rows.length, skipped: analysisRows.dup + analysisRows.noEn, mats: mats.length, procs: procs.length, reslt: reslt.length, ens: rows.map((r) => r.en!).filter(Boolean) })
      setStep('done')
    } catch (e: any) { toast(e?.message ?? 'Import failed', 'err') } finally { setBusy(false) }
  }

  const enMapped = a.base.en != null
  const ready = headers.length > 0 && body.length > 0

  return (
    <Modal open={open} onClose={close} size="xl" title="Paste experiments from Excel"
      footer={
        step === 'paste' ? <><button className="btn-ghost" onClick={close}>Cancel</button><button className="btn-primary" onClick={() => setStep('map')} disabled={!ready}>Continue <ArrowRight size={15} /></button></>
          : step === 'map' ? <><button className="btn-ghost mr-auto" onClick={() => setStep('paste')}><ArrowLeft size={15} /> Back</button><button className="btn-primary" onClick={() => setStep('options')} disabled={!enMapped}>Next <ArrowRight size={15} /></button></>
            : step === 'options' ? <><button className="btn-ghost mr-auto" onClick={() => setStep('map')}><ArrowLeft size={15} /> Back</button><button className="btn-primary" onClick={() => setStep('preview')}>Preview <ArrowRight size={15} /></button></>
              : step === 'preview' ? <><button className="btn-ghost mr-auto" onClick={() => setStep('options')}><ArrowLeft size={15} /> Back</button><button className="btn-primary" onClick={doImport} disabled={busy || analysisRows.newOnes.length === 0}>{busy ? <Spinner className="h-4 w-4" /> : `Import ${analysisRows.newOnes.length} experiment${analysisRows.newOnes.length === 1 ? '' : 's'}`}</button></>
                : <button className="btn-primary" onClick={close}>Done</button>
      }>
      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-2xs font-medium text-subtle">
        {(['paste', 'map', 'options', 'preview'] as Step[]).map((s, i) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cx('rounded-full px-2 py-0.5', step === s ? 'bg-brand text-white' : 'bg-black/[0.05]')}>{i + 1}. {s === 'paste' ? 'Paste' : s === 'map' ? 'Match' : s === 'options' ? 'Fill rest' : 'Preview'}</span>
            {i < 3 && <ArrowRight size={11} />}
          </span>
        ))}
      </div>

      {step === 'paste' && (
        <div>
          <p className="mb-2 text-sm text-muted">In Excel, select your experiment rows <strong>including the header row</strong> (EN, Date, Owner…), copy them (Ctrl/Cmd+C), then paste into the box below. Nothing is saved until you confirm.</p>
          <textarea autoFocus value={raw} onChange={(e) => parseNow(e.target.value)} onPaste={(e) => { const t = e.clipboardData.getData('text'); if (t) { e.preventDefault(); parseNow(t) } }}
            placeholder="Paste here — the header row plus one or more experiment rows…"
            className="field h-44 w-full resize-y font-mono text-xs" />
          {ready ? (
            <div className="mt-3 rounded-lg border border-positive/30 bg-positive/[0.06] p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-ink"><Check size={15} className="text-positive" /> Read {body.length} experiment row{body.length === 1 ? '' : 's'} · {headers.length} columns</div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted">
                <span><FlaskConical size={11} className="mb-0.5 inline" /> {counts.chem} chemical slots</span>
                <span><Cog size={11} className="mb-0.5 inline" /> {counts.proc} process slots</span>
                <span><Gauge size={11} className="mb-0.5 inline" /> {counts.std} standard + {counts.res} extra results</span>
              </div>
            </div>
          ) : raw.trim() ? <p className="mt-3 flex items-center gap-1.5 text-xs text-orange-dark"><AlertTriangle size={14} /> Couldn't find a header row with an “EN” column — make sure you copied the header row too.</p> : null}
        </div>
      )}

      {step === 'map' && (
        <div>
          <p className="mb-3 flex items-center gap-1.5 text-xs text-muted"><Sparkles size={13} className="text-brand" /> Matched from your headers — adjust the base fields if needed. Materials, processes and results are detected automatically.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {BASE_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center gap-2">
                <div className="w-36 shrink-0 text-sm">{f.label}{f.req && <span className="text-danger"> *</span>}</div>
                <select className="field h-9 flex-1 text-sm" value={a.base[f.key] ?? -1} onChange={(e) => setBaseOverride({ ...baseOverride, [f.key]: parseInt(e.target.value) })}>
                  <option value={-1}>— ignore —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
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
        </div>
      )}

      {step === 'preview' && (
        <div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="New to import" value={analysisRows.newOnes.length} tone="brand" />
            <Stat label="Already in app" value={analysisRows.dup} tone="muted" />
            <Stat label="No EN (skipped)" value={analysisRows.noEn} tone="muted" />
          </div>
          {analysisRows.newOnes.length === 0 ? (
            <p className="mt-4 rounded-lg border border-line bg-paper px-3 py-3 text-sm text-muted">Nothing new — every row with an EN is already in the dataroom.</p>
          ) : (
            <>
              <p className="mt-4 mb-2 text-xs text-muted">First {Math.min(8, analysisRows.newOnes.length)} shown — each brings its materials, processes and results:</p>
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[620px] text-sm">
                  <thead><tr className="border-b border-line bg-paper text-left text-2xs uppercase tracking-wider text-muted">
                    <th className="px-3 py-2">EN</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Owner</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Mat·Proc·Res</th>
                  </tr></thead>
                  <tbody>
                    {analysisRows.newOnes.slice(0, 8).map((p) => (
                      <tr key={p.en} className="border-b border-line last:border-0">
                        <td className="px-3 py-1.5 data font-medium">EN{p.en}</td>
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
              {analysisRows.newOnes.length > 8 && <p className="mt-1.5 text-2xs text-subtle">+{analysisRows.newOnes.length - 8} more</p>}
            </>
          )}
        </div>
      )}

      {step === 'done' && result && (
        <div className="py-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-positive/15 text-positive"><Check size={28} /></div>
          <h3 className="text-lg font-semibold">Imported {result.added} experiment{result.added === 1 ? '' : 's'}</h3>
          <p className="mt-1 text-sm text-muted">{result.mats} materials · {result.procs} process steps · {result.reslt} results brought in.{result.skipped > 0 ? ` ${result.skipped} row${result.skipped === 1 ? '' : 's'} skipped.` : ''}</p>
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
