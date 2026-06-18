import type { FullExperiment, Chemical } from './types'
import { sampleMetrics, formulationCost } from './metrics'
import { projectByCode } from './projects'

const NAVY = '0B1F3A'
const TEAL = '0E8A94'
const INK = '15181E'
const MUTED = '6C7077'
const FSC_C = '0E8A94'
const CRC_C = '6C5CE0'
const AUP_C = 'FF4700'

const stageName = (s: any) => (s === 'bulk' ? 'Step 1 · Bulk' : s === 'surface' ? 'Step 2 · Surface' : '')

function nextStep(e: FullExperiment): string {
  if (e.discontinued) return 'Discontinued — no further work planned.'
  const m = sampleMetrics(e)
  const hasRes = m.FSC !== null || m.CRC !== null || m.AUP !== null
  if (!hasRes) return 'Complete characterisation (FSC / CRC / AUP) and record results.'
  return 'Validate and benchmark the result; consider a repeat and, if promising, scale-up.'
}
function doneSummary(e: FullExperiment): string {
  const mats = e.experiment_materials.map((mm) => `${mm.name ?? '?'}${mm.mass_g != null ? ` (${mm.mass_g} ${(mm as any).unit ?? 'g'})` : ''}`)
  const procs = e.experiment_processes.map((p) => `${p.process ?? ''}${p.value ? `: ${p.value}` : ''}`).filter(Boolean)
  const parts: string[] = []
  if (e.is_two_step) parts.push('Two-step preparation (bulk + surface crosslinking).')
  if (mats.length) parts.push(`Formulation: ${mats.slice(0, 8).join(', ')}${mats.length > 8 ? '…' : ''}.`)
  if (procs.length) parts.push(`Process: ${procs.slice(0, 6).join('; ')}${procs.length > 6 ? '…' : ''}.`)
  return parts.join(' ') || (e.description || 'Experiment performed.')
}
function resultsSummary(e: FullExperiment): string[] {
  const m = sampleMetrics(e)
  const out: string[] = []
  if (m.FSC !== null) out.push(`FSC: ${m.FSC} g/g`)
  if (m.CRC !== null) out.push(`CRC: ${m.CRC} g/g`)
  if (m.AUP !== null) out.push(`AUP: ${m.AUP} g/g`)
  e.experiment_results.forEach((r) => { if (r.result_type && !/^(FSC|CRC|AUP) in saline/i.test(r.result_type) && r.value) out.push(`${r.result_type}: ${r.value}`) })
  if (out.length === 0) out.push(e.discontinued ? 'No results (discontinued).' : 'No results recorded yet.')
  return out
}

/* ============================ WORD ============================ */
export async function generateLabReportDocx(experiments: FullExperiment[], chemicals: Chemical[], title = 'Lab Report') {
  const d: any = await import('docx')
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ShadingType, PageBreak } = d

  const run = (text: string, opts: any = {}) => new TextRun({ text, font: 'Calibri', ...opts })
  const para = (children: any[], opts: any = {}) => new Paragraph({ children, ...opts })
  const heading = (text: string, color: string, size: number, opts: any = {}) => para([run(text, { bold: true, color, size })], { spacing: { before: 160, after: 80 }, ...opts })

  const cell = (text: string, o: { header?: boolean; w?: number; color?: string } = {}) =>
    new TableCell({
      width: o.w ? { size: o.w, type: WidthType.PERCENTAGE } : undefined,
      shading: o.header ? { type: ShadingType.CLEAR, color: 'auto', fill: o.color ?? TEAL } : undefined,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [para([run(text, { bold: !!o.header, color: o.header ? 'FFFFFF' : INK, size: 18 })])],
    })
  const noBorders = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } }
  const lightBorders = { top: { style: BorderStyle.SINGLE, size: 2, color: 'D9DEDE' }, bottom: { style: BorderStyle.SINGLE, size: 2, color: 'D9DEDE' }, left: { style: BorderStyle.SINGLE, size: 2, color: 'D9DEDE' }, right: { style: BorderStyle.SINGLE, size: 2, color: 'D9DEDE' }, insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'EDECE6' }, insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'EDECE6' } }
  const table = (header: string[], rows: string[][], widths: number[], headerColor = TEAL) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: lightBorders,
      rows: [
        new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, { header: true, w: widths[i], color: headerColor })) }),
        ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, { w: widths[i] })) })),
      ],
    })

  const children: any[] = []
  // cover
  children.push(para([run('A&B SMART MATERIALS', { bold: true, color: TEAL, size: 18, characterSpacing: 30 })], { spacing: { after: 40 } }))
  children.push(para([run(title, { bold: true, color: NAVY, size: 44 })]))
  children.push(para([run(`${experiments.length} experiment${experiments.length === 1 ? '' : 's'}  ·  generated ${new Date().toLocaleDateString()}`, { color: MUTED, size: 20 })], { spacing: { after: 120 } }))

  experiments.forEach((e, idx) => {
    if (idx > 0) children.push(para([new PageBreak()]))
    const m = sampleMetrics(e)
    const cost = formulationCost(e, chemicals)
    const proj = projectByCode(e.project)

    children.push(para([run(`EN${e.en}`, { bold: true, color: NAVY, size: 30 }), run(e.description ? `  —  ${e.description}` : '', { color: INK, size: 26 })], { spacing: { before: 80, after: 40 } }))
    const meta = [e.owner ? `Owner: ${e.owner}` : '', e.date ? `Date: ${e.date}` : '', e.experiment_type ? `Type: ${e.experiment_type}` : '', proj ? `Work package: ${proj.label}` : '', e.is_two_step ? 'Two-step' : '', e.discontinued ? 'DISCONTINUED' : ''].filter(Boolean).join('   ·   ')
    children.push(para([run(meta, { color: MUTED, size: 18 })], { spacing: { after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E8E6DF' } } }))

    // headline metrics
    if (m.FSC !== null || m.CRC !== null || m.AUP !== null) {
      children.push(new Paragraph({ spacing: { after: 100 }, children: [
        ...(m.FSC !== null ? [run('FSC ', { bold: true, color: FSC_C, size: 22 }), run(`${m.FSC} g/g    `, { color: INK, size: 22 })] : []),
        ...(m.CRC !== null ? [run('CRC ', { bold: true, color: CRC_C, size: 22 }), run(`${m.CRC} g/g    `, { color: INK, size: 22 })] : []),
        ...(m.AUP !== null ? [run('AUP ', { bold: true, color: AUP_C, size: 22 }), run(`${m.AUP} g/g`, { color: INK, size: 22 })] : []),
      ] }))
    }

    // Objective / summary
    children.push(heading('Summary', TEAL, 24))
    children.push(para([run(doneSummary(e), { color: INK, size: 20 })], { spacing: { after: 80 } }))

    // Materials table(s)
    const matStages = e.is_two_step ? ['bulk', 'surface'] : [null]
    children.push(heading('Materials & formulation', TEAL, 24))
    matStages.forEach((st) => {
      const rows = e.experiment_materials.filter((mm) => ((mm as any).stage ?? null) === st).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      if (!rows.length) return
      if (st) children.push(para([run(stageName(st), { bold: true, color: NAVY, size: 18 })], { spacing: { before: 60, after: 40 } }))
      children.push(table(['Material', 'Amount', 'Unit', 'Ratio'], rows.map((mm) => [mm.name ?? '', mm.mass_g != null ? String(mm.mass_g) : '', (mm as any).unit ?? 'g', mm.ratio ?? '']), [55, 17, 12, 16]))
      children.push(para([run('')], { spacing: { after: 40 } }))
    })

    // Process table(s)
    const anyProc = e.experiment_processes.length > 0
    if (anyProc) {
      children.push(heading('Procedure', TEAL, 24))
      matStages.forEach((st) => {
        const rows = e.experiment_processes.filter((p) => ((p as any).stage ?? null) === st).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        if (!rows.length) return
        if (st) children.push(para([run(stageName(st), { bold: true, color: NAVY, size: 18 })], { spacing: { before: 60, after: 40 } }))
        children.push(table(['Process', 'Measure', 'Value'], rows.map((p) => [p.process ?? '', p.measure ?? '', p.value ?? '']), [46, 30, 24]))
        children.push(para([run('')], { spacing: { after: 40 } }))
      })
    }

    // Results
    children.push(heading('Results & performance', TEAL, 24))
    const metricRows: string[][] = []
    ;(['FSC', 'CRC', 'AUP'] as const).forEach((mk) => {
      const already = e.experiment_results.some((r) => r.result_type && new RegExp(`^${mk} in saline`, 'i').test(r.result_type))
      if (m[mk] !== null && !already) metricRows.push([`${mk} in saline (g/g)`, String(m[mk]), 'auto-calculated'])
    })
    const otherRows = e.experiment_results.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((r) => [r.result_type ?? '', r.value ?? '', r.comment ?? ''])
    const allResRows = [...metricRows, ...otherRows]
    if (allResRows.length) children.push(table(['Result', 'Value', 'Comment'], allResRows, [40, 22, 38]))
    else children.push(para([run(e.discontinued ? 'No results — experiment discontinued.' : 'No results recorded yet.', { italics: true, color: MUTED, size: 20 })]))

    // Cost
    if (cost.totalCost > 0) {
      children.push(heading('Estimated cost', TEAL, 24))
      children.push(para([run(`Materials ${cost.materialCost.toFixed(2)}${e.extra_cost ? ` + overhead ${e.extra_cost}` : ''} = ${cost.totalCost.toFixed(2)}${cost.costPerKg != null ? `  (~${cost.costPerKg.toFixed(2)}/kg)` : ''}`, { color: INK, size: 20 }), run('   (raw-material cost; production cost not yet included)', { italics: true, color: MUTED, size: 16 })]))
    }

    // Method
    if (e.method) {
      children.push(heading('Method notes', TEAL, 24))
      children.push(para([run(e.method, { color: INK, size: 20 })]))
    }

    // Next steps
    children.push(heading('Next steps', AUP_C, 24))
    children.push(para([run(nextStep(e), { color: INK, size: 20 })]))
  })

  const doc = new Document({
    creator: 'A&B Smart Materials — Dataroom',
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children }],
  })
  const blob = await Packer.toBlob(doc)
  triggerDownload(blob, `${title.replace(/\s+/g, '-')}-${dateStamp()}.docx`)
}

/* ============================ POWERPOINT ============================ */
export async function generateSlidesPptx(experiments: FullExperiment[], _chemicals: Chemical[], title = 'Weekly R&D Update') {
  const mod: any = await import('pptxgenjs')
  const PptxGenJS = mod.default ?? mod
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 })
  pptx.layout = 'WIDE'
  pptx.author = 'A&B Smart Materials'

  const navy = NAVY, teal = TEAL, ink = INK, muted = MUTED

  // Title slide
  const t = pptx.addSlide()
  t.background = { color: 'FFFFFF' }
  t.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 2.4, fill: { color: navy } })
  t.addText('A&B SMART MATERIALS', { x: 0.6, y: 0.7, w: 12, h: 0.4, color: '2CC5CD', fontSize: 14, bold: true, charSpacing: 3, fontFace: 'Calibri' })
  t.addText(title, { x: 0.6, y: 1.1, w: 12, h: 1, color: 'FFFFFF', fontSize: 34, bold: true, fontFace: 'Calibri' })
  t.addText(`${new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}  ·  ${experiments.length} experiment${experiments.length === 1 ? '' : 's'}`, { x: 0.6, y: 2.7, w: 12, h: 0.5, color: muted, fontSize: 16, fontFace: 'Calibri' })

  experiments.forEach((e) => {
    const m = sampleMetrics(e)
    const s = pptx.addSlide()
    s.background = { color: 'FFFFFF' }
    // header bar
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 1.15, fill: { color: navy } })
    s.addText([{ text: `EN${e.en}`, options: { bold: true, color: 'FFFFFF' } }, { text: e.description ? `   ${e.description}` : '', options: { color: 'C9E9EC' } }], { x: 0.5, y: 0.18, w: 9.5, h: 0.8, fontSize: 24, fontFace: 'Calibri', valign: 'middle' })
    const proj = projectByCode(e.project)
    if (proj) s.addText(proj.label, { x: 9.9, y: 0.3, w: 3.0, h: 0.55, align: 'right', color: 'C9E9EC', fontSize: 12, fontFace: 'Calibri', valign: 'middle' })

    // metric chips row
    const chips = ([['FSC', m.FSC, FSC_C], ['CRC', m.CRC, CRC_C], ['AUP', m.AUP, AUP_C]] as const).filter(([, v]) => v !== null)
    chips.forEach(([k, v, c], i) => {
      const x = 0.5 + i * 2.5
      s.addShape(pptx.ShapeType.roundRect, { x, y: 1.45, w: 2.2, h: 0.95, rectRadius: 0.08, fill: { color: c as string }, line: { type: 'none' } })
      s.addText([{ text: `${k}\n`, options: { fontSize: 12, color: 'FFFFFF', bold: true } }, { text: `${v} g/g`, options: { fontSize: 20, color: 'FFFFFF', bold: true } }], { x, y: 1.45, w: 2.2, h: 0.95, align: 'center', valign: 'middle', fontFace: 'Calibri' })
    })
    const topY = chips.length ? 2.7 : 1.5

    const col = (titleText: string, body: string | string[], x: number, w: number, color: string) => {
      s.addText(titleText, { x, y: topY, w, h: 0.4, color, fontSize: 16, bold: true, fontFace: 'Calibri' })
      const items = Array.isArray(body) ? body : [body]
      s.addText(items.map((b) => ({ text: b, options: { bullet: items.length > 1 ? { code: '2022' } : false, color: ink, fontSize: 14, fontFace: 'Calibri', paraSpaceAfter: 6 } })), { x, y: topY + 0.45, w, h: 4.0, valign: 'top' })
    }
    col('What was done', doneSummary(e), 0.5, 6.2, teal)
    col('Results', resultsSummary(e), 6.9, 5.9, CRC_C)

    // next step strip
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 6.7, w: '100%', h: 0.8, fill: { color: 'FFF3EE' } })
    s.addText([{ text: 'Next step:  ', options: { bold: true, color: AUP_C } }, { text: nextStep(e), options: { color: ink } }], { x: 0.5, y: 6.7, w: 12.3, h: 0.8, fontSize: 14, fontFace: 'Calibri', valign: 'middle' })
  })

  const fileName = `${title.replace(/\s+/g, '-')}-${dateStamp()}.pptx`
  await pptx.writeFile({ fileName })
}

/* ---------------- helpers ---------------- */
function dateStamp() {
  const d = new Date(); const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
