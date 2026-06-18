import { useMemo, useRef, useState } from 'react'
import { Sparkles, Settings2, FileText, Presentation, Search, Check, Copy, Download, Loader2, AlertTriangle, ShieldCheck, X } from 'lucide-react'
import { useData } from '../context/DataContext'
import type { FullExperiment } from '../lib/types'
import { Modal, Spinner, Segmented, Markdown, useToast } from '../components/ui'
import { AI_PRESETS, type AIProvider, type AISettings, loadAISettings, saveAISettings, aiConfigured, callLLM, buildReportPrompt, buildSlidesPrompt } from '../lib/ai'
import { sampleMetrics, metricValue } from '../lib/metrics'
import { cx } from '../lib/utils'

const DAY = 86400000

export function Reports() {
  const { experiments, chemicals } = useData()
  const toast = useToast()
  const [settings, setSettings] = useState<AISettings>(loadAISettings())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mode, setMode] = useState<'report' | 'slides'>('report')
  const [pickedId, setPickedId] = useState<string>('')
  const [output, setOutput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController>()

  const configured = aiConfigured(settings)
  const picked = experiments.find((e) => e.id === pickedId)

  const run = async (system: string, user: string) => {
    setError(''); setOutput(''); setBusy(true)
    abortRef.current = new AbortController()
    try {
      const text = await callLLM(settings, system, user, abortRef.current.signal)
      if (!text.trim()) throw new Error('The model returned an empty response.')
      setOutput(text)
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      const msg = String(e?.message || e)
      setError(/Failed to fetch|NetworkError|load failed/i.test(msg)
        ? "Couldn't reach the model. If you're using local Ollama, the browser may be blocked by CORS or mixed-content (an https site can't call http://localhost). See the setup note in Settings."
        : msg)
    } finally {
      setBusy(false)
    }
  }

  const genReport = () => { if (!picked) return; const { system, user } = buildReportPrompt(picked, chemicals); run(system, user) }
  const genSlides = () => {
    const today = new Date().setHours(0, 0, 0, 0)
    const weekExps = experiments.filter((e) => { if (!e.date) return false; const t = new Date(e.date).setHours(0, 0, 0, 0); return t >= today - 6 * DAY && t <= today })
    const top = (['FSC', 'CRC', 'AUP'] as const).map((metric) => ({
      metric,
      items: experiments.map((e) => ({ e, v: metricValue(e, metric) })).filter((x) => x.v !== null).sort((a, b) => (b.v as number) - (a.v as number)).slice(0, 3)
        .map((x) => ({ en: x.e.en, value: x.v as number, owner: x.e.owner || '', desc: x.e.description || '' })),
    }))
    const { system, user } = buildSlidesPrompt(weekExps, top, chemicals)
    run(system, user)
  }

  const download = () => {
    const name = mode === 'report' && picked ? `EN${picked.en}-report.md` : 'weekly-update.md'
    const blob = new Blob([output], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3 animate-fadeUp">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Sparkles size={22} className="text-brand" /> AI reports</h1>
          <p className="mt-1 text-sm text-muted">Generate lab reports and weekly slide content from your experiments, using your own model.</p>
        </div>
        <button className="btn-outline" onClick={() => setSettingsOpen(true)}><Settings2 size={15} /> Model settings {configured && <span className="ml-1 h-2 w-2 rounded-full bg-positive" />}</button>
      </div>

      {/* Privacy banner */}
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-brand-tint/40 px-4 py-3 animate-fadeUp">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-sm text-ink">Your API key stays in <span className="font-medium">this browser only</span> — it's never saved to the dataroom or shared with the team. These tools <span className="font-medium">read</span> your data to draft documents; they never change any experiment.</p>
      </div>

      {!configured && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-warn/30 bg-warn/5 px-4 py-3">
          <div className="flex items-center gap-2.5 text-sm text-ink"><AlertTriangle size={16} className="text-warn" /> Add your model details to start.</div>
          <button className="btn-primary h-9" onClick={() => setSettingsOpen(true)}>Set up model</button>
        </div>
      )}

      <div className="mt-5"><Segmented value={mode} onChange={(m) => { setMode(m); setOutput(''); setError('') }} options={[{ value: 'report', label: <span className="flex items-center gap-1.5"><FileText size={14} /> Lab report</span> }, { value: 'slides', label: <span className="flex items-center gap-1.5"><Presentation size={14} /> Weekly slides</span> }]} /></div>

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-3">
          {mode === 'report' ? (
            <div className="card p-3.5">
              <div className="mb-2 text-sm font-semibold">Choose an experiment</div>
              <SinglePicker all={experiments} pickedId={pickedId} onPick={setPickedId} />
              <button className="btn-primary mt-3 w-full" onClick={genReport} disabled={busy || !configured || !picked}>{busy ? <Spinner className="h-4 w-4" /> : <><Sparkles size={15} /> Generate report</>}</button>
            </div>
          ) : (
            <div className="card p-4">
              <div className="text-sm font-semibold">Weekly update</div>
              <p className="mt-1.5 text-sm text-muted">Compiles experiments from the last 7 days and the current top performers into ready-to-use slide content.</p>
              <button className="btn-primary mt-3 w-full" onClick={genSlides} disabled={busy || !configured}>{busy ? <Spinner className="h-4 w-4" /> : <><Sparkles size={15} /> Generate slide content</>}</button>
            </div>
          )}
          {busy && <button className="btn-ghost w-full text-sm text-muted" onClick={() => abortRef.current?.abort()}><X size={14} /> Stop</button>}
        </div>

        <div className="card min-h-[420px] p-5">
          {error ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/5 px-3.5 py-3 text-sm text-ink"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" /><span>{error}</span></div>
          ) : busy ? (
            <div className="grid h-full min-h-[380px] place-items-center text-center">
              <div className="space-y-3">
                <Loader2 size={26} className="mx-auto animate-spin text-brand" />
                <p className="text-sm text-muted">Drafting with {settings.model}…</p>
              </div>
            </div>
          ) : output ? (
            <div>
              <div className="mb-3 flex items-center justify-end gap-2">
                <button className="btn-ghost h-8 text-xs text-muted" onClick={() => { navigator.clipboard.writeText(output); toast('Copied to clipboard') }}><Copy size={13} /> Copy</button>
                <button className="btn-outline h-8 text-xs" onClick={download}><Download size={13} /> Download .md</button>
              </div>
              <Markdown text={output} />
            </div>
          ) : (
            <div className="grid h-full min-h-[380px] place-items-center text-center">
              <div className="max-w-xs space-y-2">
                <Sparkles size={26} className="mx-auto text-subtle" />
                <p className="text-sm text-muted">{mode === 'report' ? 'Pick an experiment and generate a professional lab report.' : 'Generate this week’s slide content in one click.'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <SettingsModal open={settingsOpen} settings={settings} onClose={() => setSettingsOpen(false)} onSave={(s) => { setSettings(s); saveAISettings(s); setSettingsOpen(false); toast('Model settings saved') }} />
    </div>
  )
}

function SinglePicker({ all, pickedId, onPick }: { all: FullExperiment[]; pickedId: string; onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    const base = s ? all.filter((e) => [`en${e.en}`, e.description, e.owner, e.experiment_type].join(' ').toLowerCase().includes(s)) : all
    return base.slice(0, 60)
  }, [all, q])
  return (
    <div>
      <div className="relative mb-2">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-2.5 text-subtle" />
        <input className="field pl-8 text-sm" placeholder="Search EN, description…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="max-h-[320px] space-y-0.5 overflow-y-auto">
        {list.map((e) => {
          const on = e.id === pickedId
          const m = sampleMetrics(e)
          return (
            <button key={e.id} onClick={() => onPick(e.id)} className={cx('flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition', on ? 'border-brand bg-brand-tint' : 'border-transparent hover:bg-black/[0.03]')}>
              <span className={cx('grid h-4 w-4 shrink-0 place-items-center rounded-full border', on ? 'border-brand bg-brand text-white' : 'border-line')}>{on && <Check size={11} />}</span>
              <span className="min-w-0 flex-1"><span className="data text-sm font-medium text-ink">EN{e.en}</span>{e.description && <span className="ml-1.5 truncate text-xs text-muted">{e.description}</span>}</span>
              <span className="flex shrink-0 gap-1">{(['FSC', 'CRC', 'AUP'] as const).map((k) => m[k] !== null && <span key={k} className="h-1.5 w-1.5 rounded-full" style={{ background: ({ FSC: '#0E8A94', CRC: '#6C5CE0', AUP: '#FF4700' })[k] }} />)}</span>
            </button>
          )
        })}
        {list.length === 0 && <p className="py-6 text-center text-sm text-subtle">No matches.</p>}
      </div>
    </div>
  )
}

function SettingsModal({ open, settings, onClose, onSave }: { open: boolean; settings: AISettings; onClose: () => void; onSave: (s: AISettings) => void }) {
  const [draft, setDraft] = useState<AISettings>(settings)
  const preset = AI_PRESETS[draft.provider]
  const setProvider = (p: AIProvider) => setDraft({ provider: p, baseUrl: AI_PRESETS[p].baseUrl, model: AI_PRESETS[p].model, apiKey: draft.apiKey })

  return (
    <Modal open={open} onClose={onClose} title="Model settings" footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={() => onSave(draft)} disabled={!aiConfigured(draft)}>Save</button></>}>
      <div className="space-y-4">
        <div>
          <label className="label">Provider</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(AI_PRESETS) as AIProvider[]).map((p) => (
              <button key={p} onClick={() => setProvider(p)} className={cx('rounded-lg border px-2 py-2 text-xs font-medium transition', draft.provider === p ? 'border-brand bg-brand-tint text-brand-dark' : 'border-line text-muted hover:bg-black/[0.03]')}>{AI_PRESETS[p].label}</button>
            ))}
          </div>
          <p className="mt-1.5 text-2xs text-subtle">{preset.hint}</p>
        </div>
        <div>
          <label className="label">Base URL</label>
          <input className="field data" value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} />
        </div>
        {preset.needsKey && (
          <div>
            <label className="label">API key</label>
            <input className="field data" type="password" placeholder="sk-… / xai-…" value={draft.apiKey} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} />
            <p className="mt-1.5 text-2xs text-subtle">Stored only in this browser (localStorage). Never sent to the dataroom.</p>
          </div>
        )}
        <div>
          <label className="label">Model</label>
          <input className="field data" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} placeholder="model name" />
        </div>
        {draft.provider === 'ollama' && (
          <div className="rounded-lg border border-line bg-paper px-3.5 py-3 text-2xs leading-relaxed text-muted">
            <span className="font-semibold text-ink">Using Ollama from this site:</span> browsers block calls from an https page to <span className="data">http://localhost</span>. Run the app locally, or start Ollama allowing this origin, e.g.<br />
            <span className="data mt-1 block rounded bg-black/[0.05] px-2 py-1 text-ink">OLLAMA_ORIGINS=* ollama serve</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
