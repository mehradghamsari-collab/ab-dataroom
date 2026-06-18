import type { FullExperiment, Chemical } from './types'
import { sampleMetrics, formulationCost } from './metrics'
import { projectByCode } from './projects'

export type AIProvider = 'ollama' | 'xai' | 'openai'
export interface AISettings {
  provider: AIProvider
  baseUrl: string
  apiKey: string
  model: string
}

export const AI_PRESETS: Record<AIProvider, { label: string; baseUrl: string; model: string; needsKey: boolean; hint: string }> = {
  ollama: { label: 'Ollama (local)', baseUrl: 'http://localhost:11434', model: 'llama3.1', needsKey: false, hint: 'Runs on your machine. Start Ollama with browser access enabled (see note below).' },
  xai: { label: 'Grok (xAI)', baseUrl: 'https://api.x.ai/v1', model: 'grok-2-latest', needsKey: true, hint: 'Uses your xAI API key. The key is stored only in this browser.' },
  openai: { label: 'OpenAI-compatible', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', needsKey: true, hint: 'Any OpenAI-compatible endpoint. Key stored only in this browser.' },
}

const LS_KEY = 'ab_ai_settings_v1'

export function loadAISettings(): AISettings {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { provider: 'ollama', baseUrl: AI_PRESETS.ollama.baseUrl, apiKey: '', model: AI_PRESETS.ollama.model }
}
export function saveAISettings(s: AISettings) {
  localStorage.setItem(LS_KEY, JSON.stringify(s))
}
export function clearAISettings() {
  localStorage.removeItem(LS_KEY)
}
export function aiConfigured(s: AISettings): boolean {
  if (!s.model?.trim() || !s.baseUrl?.trim()) return false
  if (AI_PRESETS[s.provider].needsKey && !s.apiKey?.trim()) return false
  return true
}

/** Call the user's configured model. Read-only — never touches the database. */
export async function callLLM(s: AISettings, system: string, user: string, signal?: AbortSignal): Promise<string> {
  const messages = [{ role: 'system', content: system }, { role: 'user', content: user }]
  const base = s.baseUrl.replace(/\/$/, '')

  if (s.provider === 'ollama') {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: s.model, messages, stream: false }),
      signal,
    })
    if (!res.ok) throw new Error(`Ollama returned ${res.status}. ${await safeText(res)}`)
    const data = await res.json()
    return data?.message?.content ?? data?.response ?? ''
  }

  // xAI (Grok) and OpenAI-compatible both use the /chat/completions shape
  const url = `${base}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.apiKey}` },
    body: JSON.stringify({ model: s.model, messages, temperature: 0.4, stream: false }),
    signal,
  })
  if (!res.ok) throw new Error(`Model API returned ${res.status}. ${await safeText(res)}`)
  const data = await res.json()
  return data?.choices?.[0]?.message?.content ?? ''
}

async function safeText(res: Response): Promise<string> {
  try { const t = await res.text(); return t.slice(0, 300) } catch { return '' }
}

/* ----------------------- prompt construction ----------------------- */
function expToText(e: FullExperiment, chemicals: Chemical[]): string {
  const m = sampleMetrics(e)
  const cost = formulationCost(e, chemicals)
  const lines: string[] = []
  lines.push(`Experiment EN${e.en}`)
  if (e.description) lines.push(`Description: ${e.description}`)
  lines.push(`Date: ${e.date ?? 'n/a'} · Owner: ${e.owner ?? 'n/a'} · Type: ${e.experiment_type ?? 'n/a'}`)
  const proj = projectByCode(e.project)
  if (proj) lines.push(`Work package: ${proj.label}`)
  if (e.is_two_step) lines.push('Format: two-step (bulk preparation + surface crosslinking)')
  if (e.discontinued) lines.push('Status: DISCONTINUED (no results)')

  const matByStage = (stage: string | null) => e.experiment_materials.filter((x) => ((x as any).stage ?? null) === stage).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const procByStage = (stage: string | null) => e.experiment_processes.filter((x) => ((x as any).stage ?? null) === stage).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const fmtMat = (arr: typeof e.experiment_materials) => arr.map((x) => `  - ${x.name ?? '?'}${x.mass_g != null ? `: ${x.mass_g} ${(x as any).unit ?? 'g'}` : ''}${x.ratio ? ` (ratio ${x.ratio})` : ''}`).join('\n')
  const fmtProc = (arr: typeof e.experiment_processes) => arr.map((x) => `  - ${x.process ?? '?'}${x.measure ? ` — ${x.measure}` : ''}${x.value ? `: ${x.value}` : ''}`).join('\n')

  if (e.is_two_step) {
    lines.push('\nStep 1 · Bulk — Materials:'); lines.push(fmtMat(matByStage('bulk')) || '  (none)')
    lines.push('Step 1 · Bulk — Process:'); lines.push(fmtProc(procByStage('bulk')) || '  (none)')
    lines.push('\nStep 2 · Surface — Materials:'); lines.push(fmtMat(matByStage('surface')) || '  (none)')
    lines.push('Step 2 · Surface — Process:'); lines.push(fmtProc(procByStage('surface')) || '  (none)')
  } else {
    lines.push('\nMaterials:'); lines.push(fmtMat([...e.experiment_materials].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) || '  (none)')
    lines.push('Process:'); lines.push(fmtProc([...e.experiment_processes].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) || '  (none)')
  }

  lines.push('\nResults:')
  const res = [...e.experiment_results].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  lines.push(res.length ? res.map((r) => `  - ${r.result_type}: ${r.value ?? 'n/a'}${r.comment ? ` (${r.comment})` : ''}`).join('\n') : '  (none recorded)')
  lines.push(`\nKey metrics — FSC: ${m.FSC ?? 'n/a'} g/g · CRC: ${m.CRC ?? 'n/a'} g/g · AUP: ${m.AUP ?? 'n/a'} g/g`)
  if (cost.materialCost > 0 || e.extra_cost) lines.push(`Estimated formulation cost: materials ${cost.materialCost.toFixed(2)}${e.extra_cost ? ` + overhead ${e.extra_cost}` : ''} = ${cost.totalCost.toFixed(2)}${cost.costPerKg != null ? ` (~${cost.costPerKg.toFixed(2)}/kg)` : ''}`)
  if (e.method) lines.push(`\nMethod notes: ${e.method}`)
  return lines.join('\n')
}

export function buildReportPrompt(e: FullExperiment, chemicals: Chemical[]): { system: string; user: string } {
  const system = 'You are a senior R&D chemist at A&B Smart Materials, a company developing superabsorbent biopolymers and hydrogels. Write clear, accurate, professional lab reports. Use only the data provided — never invent values. If something is missing, say so plainly. Output clean Markdown.'
  const user = `Write a professional lab report for the experiment below.

Use this structure:
# Lab Report — EN${e.en}
**Summary** (2–3 sentences on what was done and the headline result)
## Objective
## Materials & Formulation
## Procedure
## Results & Performance (interpret FSC, CRC, AUP where present; note absorbency in g/g)
## Discussion (what the numbers suggest; strengths and limitations)
## Next Steps / Recommendations

Here is the experiment data:

${expToText(e, chemicals)}`
  return { system, user }
}

export function buildSlidesPrompt(weekExps: FullExperiment[], topByMetric: { metric: string; items: { en: number | null; value: number; owner: string; desc: string }[] }[], chemicals: Chemical[]): { system: string; user: string } {
  const system = 'You are preparing a weekly R&D update for A&B Smart Materials (superabsorbent biopolymers). Produce concise, presentation-ready slide content as Markdown. Each slide = a "##" title followed by 3–6 tight bullet points. Be factual; use only provided data. Absorbency is in g/g (FSC, CRC, AUP).'
  const weekText = weekExps.length
    ? weekExps.map((e) => `- EN${e.en} (${e.owner ?? '?'}, ${e.experiment_type ?? '?'}${projectByCode(e.project) ? `, ${projectByCode(e.project)!.label}` : ''}): ${e.description ?? ''} | ${(() => { const m = sampleMetrics(e); return `FSC ${m.FSC ?? '–'}, CRC ${m.CRC ?? '–'}, AUP ${m.AUP ?? '–'}` })()}`).join('\n')
    : '(no experiments dated in the last 7 days)'
  const topText = topByMetric.map((t) => `${t.metric}: ` + (t.items.map((i) => `EN${i.en} ${i.value}`).join(', ') || '–')).join('\n')

  const user = `Create a weekly progress slide deck outline. Suggested slides:
1. Title slide — "Weekly R&D Update" with the date range.
2. Highlights of the week (key experiments and outcomes).
3. Best performing samples (call out leaders by FSC, CRC, AUP).
4. Progress by work package.
5. Next steps / focus for next week.

This week's experiments:
${weekText}

Top performers:
${topText}`
  return { system, user }
}
