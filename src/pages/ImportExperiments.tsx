import { useMemo, useRef, useState } from 'react'
import { UploadCloud, FileSpreadsheet, X, Check, ArrowRight, ArrowLeft, AlertTriangle, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { Modal, Spinner, useToast } from '../components/ui'
import { METRICS } from '../lib/metrics'
import { PROJECTS } from '../lib/projects'
import { cx } from '../lib/utils'

type Step = 'upload' | 'map' | 'preview' | 'done'

const FIELDS: { key: string; label: string; group: string; hint?: string }[] = [
  { key: 'en', label: 'EN number', group: 'Key', hint: 'required — used to spot new rows & avoid duplicates' },
  { key: 'date', label: 'Date', group: 'Details' },
  { key: 'owner', label: 'Owner / researcher', group: 'Details' },
  { key: 'experiment_type', label: 'Type / synthesis method', group: 'Details' },
  { key: 'project', label: 'Work package', group: 'Details' },
  { key: 'description', label: 'Description', group: 'Details' },
  { key: 'repeat', label: 'Repeat of', group: 'Details' },
  { key: 'method', label: 'Method / notes', group: 'Details' },
  { key: 'fsc_mass', label: 'FSC — swollen-gel mass (g)', group: 'Absorbency · raw masses (app calculates g/g)' },
  { key: 'crc_mass', label: 'CRC — after-centrifuge mass (g)', group: 'Absorbency · raw masses (app calculates g/g)' },
  { key: 'aup_mass', label: 'AUP — after-AUP mass (g)', group: 'Absorbency · raw masses (app calculates g/g)' },
  { key: 'fsc_val', label: 'FSC result (g/g)', group: 'Absorbency · final values (already calculated)' },
  { key: 'crc_val', label: 'CRC result (g/g)', group: 'Absorbency · final values (already calculated)' },
  { key: 'aup_val', label: 'AUP result (g/g)', group: 'Absorbency · final values (already calculated)' },
]

const GUESS: Record<string, RegExp> = {
  en: /^(en|exp.*(no|num|id)|experiment.*(no|num|id)|\bid\b)/i,
  date: /date/i,
  owner: /owner|research|operator|\bby\b|author/i,
  experiment_type: /type|synthesis|reaction/i,
  project: /project|work.?package|\bwp\b|programme|program/i,
  description: /desc|title|sample.*name|^name$|comment/i,
  repeat: /repeat|replicate/i,
  method: /method|procedure|protocol/i,
  fsc_mass: /fsc.*(mass|swollen|gel)|swollen/i,
  crc_mass: /crc.*(mass|centrifu)|centrifu/i,
  aup_mass: /aup.*(mass|load|pressure)/i,
  fsc_val: /fsc/i,
  crc_val: /crc/i,
  aup_val: /aup/i,
}

const pad = (n: number) => String(n).padStart(2, '0')
function toISODate(v: any): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'string') { const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}` }
  let d: Date
  if (v instanceof Date) d = v
  else if (typeof v === 'number' && v > 20000 && v < 70000) d = new Date(Math.round((v - 25569) * 86400000))
  else d = new Date(String(v))
  if (isNaN(d.getTime())) return null
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
function toNum(v: any): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, '').match(/-?\d+\.?\d*/)?.[0] ?? '')
  return Number.isNaN(n) ? null : n
}
function toInt(v: any): number | null {
  const n = toNum(v)
  return n == null ? null : Math.round(n)
}
function matchProject(v: any): string | null {
  if (v == null || v === '') return null
  const s = String(v).trim().toLowerCase()
  const p = PROJECTS.find((p) => p.code.toLowerCase() === s || p.label.toLowerCase() === s || p.label.toLowerCase().includes(s))
  return p?.code ?? null
}
const str = (v: any): string | null => (v == null || String(v).trim() === '' ? null : String(v).trim())

export function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { experiments, refetchExperiments } = useData()
  const { profile } = useAuth()
  const toast = useToast()
  const wbRef = useRef<any>(null)
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [sheet, setSheet] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<any[][]>([])
  const [mapping, setMapping] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [result, setResult] = useState<{ added: number; skipped: number; ens: number[] } | null>(null)

  const reset = () => { wbRef.current = null; setStep('upload'); setFileName(''); setSheetNames([]); setSheet(''); setHeaders([]); setRows([]); setMapping({}); setResult(null) }
  const close = () => { reset(); onClose() }

  const loadSheet = (name: string) => {
    const XLSX = (window as any).__xlsx
    const ws = wbRef.current.Sheets[name]
    const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' })
    const hdr = (aoa[0] ?? []).map((h: any) => String(h ?? '').trim())
    const body = aoa.slice(1).filter((r) => r.some((c: any) => String(c ?? '').trim() !== ''))
    setHeaders(hdr)
    setRows(body)
    // auto-guess mapping (each header used at most once)
    const used = new Set<number>()
    const guessed: Record<string, number> = {}
    for (const f of FIELDS) {
      const idx = hdr.findIndex((h: string, i: number) => !used.has(i) && h && GUESS[f.key]?.test(h))
      if (idx >= 0) { guessed[f.key] = idx; used.add(idx) }
      else guessed[f.key] = -1
    }
    setMapping(guessed)
  }

  const onFile = async (file: File) => {
    setParsing(true)
    try {
      const XLSX = await import('xlsx')
      ;(window as any).__xlsx = XLSX
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true })
      wbRef.current = wb
      setFileName(file.name)
      setSheetNames(wb.SheetNames)
      const first = wb.SheetNames[0]
      setSheet(first)
      loadSheet(first)
      setStep('map')
    } catch (e: any) {
      toast(e?.message ?? 'Could not read that file', 'err')
    } finally {
      setParsing(false)
    }
  }

  // parse rows using current mapping
  const parsed = useMemo(() => {
    const get = (r: any[], key: string) => { const i = mapping[key]; return i == null || i < 0 ? '' : r[i] }
    return rows.map((r) => ({
      en: toInt(get(r, 'en')),
      date: toISODate(get(r, 'date')),
      owner: str(get(r, 'owner')),
      experiment_type: str(get(r, 'experiment_type')),
      project: matchProject(get(r, 'project')),
      description: str(get(r, 'description')),
      repeat: str(get(r, 'repeat')),
      method: str(get(r, 'method')),
      fsc_mass: toNum(get(r, 'fsc_mass')),
      crc_mass: toNum(get(r, 'crc_mass')),
      aup_mass: toNum(get(r, 'aup_mass')),
      fsc_val: toNum(get(r, 'fsc_val')),
      crc_val: toNum(get(r, 'crc_val')),
      aup_val: toNum(get(r, 'aup_val')),
    }))
  }, [rows, mapping])

  const existing = useMemo(() => new Set(experiments.map((e) => e.en)), [experiments])
  const analysis = useMemo(() => {
    const seen = new Set<number>()
    const newOnes: typeof parsed = []
    let noEn = 0, dup = 0
    for (const p of parsed) {
      if (p.en == null) { noEn++; continue }
      if (existing.has(p.en) || seen.has(p.en)) { dup++; continue }
      seen.add(p.en); newOnes.push(p)
    }
    return { newOnes, noEn, dup }
  }, [parsed, existing])

  const doImport = async () => {
    setBusy(true)
    try {
      const valOf = METRICS.reduce((m, d) => ({ ...m, [d.key]: d.full }), {} as Record<string, string>)
      const payloads = analysis.newOnes.map((p) => ({
        en: p.en, date: p.date, owner: p.owner, experiment_type: p.experiment_type, project: p.project,
        description: p.description, repeat: p.repeat, method: p.method,
        is_two_step: false, discontinued: false, extra_cost: null,
        fsc_mass: p.fsc_mass, crc_mass: p.crc_mass, aup_mass: p.aup_mass,
        created_by: profile?.id ?? null,
      }))
      const { data: inserted, error } = await supabase.from('experiments').insert(payloads).select('id,en')
      if (error) throw error
      const idByEn = new Map<number, string>((inserted as any[]).map((x) => [x.en, x.id]))
      // optional final-value result rows
      const resRows: any[] = []
      for (const p of analysis.newOnes) {
        const id = p.en != null ? idByEn.get(p.en) : undefined
        if (!id) continue
        ;[['FSC', p.fsc_val], ['CRC', p.crc_val], ['AUP', p.aup_val]].forEach(([k, v], i) => {
          if (v != null) resRows.push({ experiment_id: id, position: i + 1, result_type: valOf[k as string], value: String(v), value_num: v })
        })
      }
      if (resRows.length) { const { error: re } = await supabase.from('experiment_results').insert(resRows); if (re) throw re }
      await refetchExperiments()
      setResult({ added: payloads.length, skipped: analysis.dup + analysis.noEn, ens: analysis.newOnes.map((p) => p.en!).filter(Boolean) })
      setStep('done')
    } catch (e: any) {
      toast(e?.message ?? 'Import failed', 'err')
    } finally {
      setBusy(false)
    }
  }

  const enMapped = (mapping['en'] ?? -1) >= 0
  const groups = [...new Set(FIELDS.map((f) => f.group))]

  return (
    <Modal open={open} onClose={close} size="xl" title="Import experiments from Excel"
      footer={
        step === 'upload' ? <button className="btn-ghost" onClick={close}>Cancel</button>
          : step === 'map' ? <>
            <button className="btn-ghost mr-auto" onClick={() => setStep('upload')}><ArrowLeft size={15} /> Back</button>
            <button className="btn-ghost" onClick={close}>Cancel</button>
            <button className="btn-primary" onClick={() => setStep('preview')} disabled={!enMapped}>Preview <ArrowRight size={15} /></button>
          </>
            : step === 'preview' ? <>
              <button className="btn-ghost mr-auto" onClick={() => setStep('map')}><ArrowLeft size={15} /> Back</button>
              <button className="btn-ghost" onClick={close}>Cancel</button>
              <button className="btn-primary" onClick={doImport} disabled={busy || analysis.newOnes.length === 0}>{busy ? <Spinner className="h-4 w-4" /> : `Import ${analysis.newOnes.length} experiment${analysis.newOnes.length === 1 ? '' : 's'}`}</button>
            </>
              : <button className="btn-primary" onClick={close}>Done</button>
      }>
      {/* steps indicator */}
      <div className="mb-4 flex items-center gap-2 text-2xs font-medium text-subtle">
        {(['upload', 'map', 'preview'] as Step[]).map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <span className={cx('rounded-full px-2 py-0.5', step === s ? 'bg-brand text-white' : 'bg-black/[0.05]')}>{i + 1}. {s === 'upload' ? 'File' : s === 'map' ? 'Match columns' : 'Preview'}</span>
            {i < 2 && <ArrowRight size={11} />}
          </span>
        ))}
      </div>

      {step === 'upload' && (
        <div>
          <p className="mb-4 text-sm text-muted">Choose the spreadsheet exported from your SharePoint file (.xlsx, .xls or .csv). It reads on your device — nothing is uploaded until you confirm.</p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-ring/60 bg-brand-tint/30 px-6 py-12 text-center transition hover:bg-brand-tint/50">
            {parsing ? <Spinner className="h-7 w-7" /> : <UploadCloud size={34} className="text-brand" />}
            <span className="text-sm font-semibold text-ink">{parsing ? 'Reading…' : 'Click to choose a file'}</span>
            <span className="text-2xs text-subtle">.xlsx · .xls · .csv</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
          </label>
        </div>
      )}

      {step === 'map' && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-muted"><FileSpreadsheet size={15} className="text-brand" /> <span className="font-medium text-ink">{fileName}</span> · {rows.length} rows</span>
            {sheetNames.length > 1 && (
              <label className="flex items-center gap-1.5 text-xs text-muted">Sheet
                <select className="field h-8 py-0 text-xs" value={sheet} onChange={(e) => { setSheet(e.target.value); loadSheet(e.target.value) }}>
                  {sheetNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            )}
          </div>
          <p className="mb-3 flex items-center gap-1.5 text-xs text-muted"><Sparkles size={13} className="text-brand" /> I matched what I could automatically — check each one, especially the EN column.</p>
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g}>
                <div className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle">{g}</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {FIELDS.filter((f) => f.group === g).map((f) => (
                    <div key={f.key} className="flex items-center gap-2">
                      <div className="w-1/2 shrink-0 text-sm">
                        <span className={cx(f.key === 'en' && 'font-semibold')}>{f.label}</span>
                        {f.key === 'en' && <span className="text-danger"> *</span>}
                        {f.hint && <div className="text-2xs text-subtle">{f.hint}</div>}
                      </div>
                      <select className="field h-9 flex-1 text-sm" value={mapping[f.key] ?? -1} onChange={(e) => setMapping({ ...mapping, [f.key]: parseInt(e.target.value) })}>
                        <option value={-1}>— ignore —</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {!enMapped && <p className="mt-3 flex items-center gap-1.5 text-xs text-orange-dark"><AlertTriangle size={14} /> Pick which column holds the EN number to continue.</p>}
        </div>
      )}

      {step === 'preview' && (
        <div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="New to import" value={analysis.newOnes.length} tone="brand" />
            <Stat label="Already in app" value={analysis.dup} tone="muted" />
            <Stat label="No EN (skipped)" value={analysis.noEn} tone="muted" />
          </div>
          {analysis.newOnes.length === 0 ? (
            <p className="mt-4 rounded-lg border border-line bg-paper px-3 py-3 text-sm text-muted">Nothing new to import — every row with an EN is already in the dataroom.</p>
          ) : (
            <>
              <p className="mt-4 mb-2 text-xs text-muted">Preview of what will be added (first 8 shown):</p>
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[560px] text-sm">
                  <thead><tr className="border-b border-line bg-paper text-left text-2xs uppercase tracking-wider text-muted">
                    <th className="px-3 py-2">EN</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Owner</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">FSC/CRC/AUP</th>
                  </tr></thead>
                  <tbody>
                    {analysis.newOnes.slice(0, 8).map((p) => (
                      <tr key={p.en} className="border-b border-line last:border-0">
                        <td className="px-3 py-1.5 data font-medium">EN{p.en}</td>
                        <td className="px-3 py-1.5 data text-muted">{p.date ?? '—'}</td>
                        <td className="px-3 py-1.5 text-muted">{p.owner ?? '—'}</td>
                        <td className="px-3 py-1.5 text-muted">{p.description ?? '—'}</td>
                        <td className="px-3 py-1.5 data text-2xs text-subtle">{[p.fsc_mass ?? p.fsc_val, p.crc_mass ?? p.crc_val, p.aup_mass ?? p.aup_val].map((x) => x ?? '·').join(' / ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {analysis.newOnes.length > 8 && <p className="mt-1.5 text-2xs text-subtle">+{analysis.newOnes.length - 8} more</p>}
            </>
          )}
        </div>
      )}

      {step === 'done' && result && (
        <div className="py-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-positive/15 text-positive"><Check size={28} /></div>
          <h3 className="text-lg font-semibold">Imported {result.added} experiment{result.added === 1 ? '' : 's'}</h3>
          <p className="mt-1 text-sm text-muted">{result.skipped > 0 ? `${result.skipped} row${result.skipped === 1 ? '' : 's'} skipped (already present or missing an EN).` : 'Everything new is now in the dataroom.'}</p>
          {result.ens.length > 0 && <p className="mt-2 data text-xs text-subtle">EN{Math.min(...result.ens)}–EN{Math.max(...result.ens)}</p>}
        </div>
      )}
    </Modal>
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
