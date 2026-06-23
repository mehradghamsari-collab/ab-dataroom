import type { FullExperiment, Chemical } from './types'
import { metricValue } from './metrics'
import { projectByCode } from './projects'

/* ============================================================
   Template-driven weekly lab report.
   Fills the green-marked sections of tempelate_report.docx:
     {{REPORT_DATE}} {{PROJECT}} {{SECTION2}} {{SECTION4}}
   Everything else in the template is left untouched.
   Experiments are split into two industry classes:
     - Agricultural SAP : only FSC in DI water recorded
     - Hygiene SAP      : FSC in saline + CRC + AUP recorded
   Each class gets its own graph.
   ============================================================ */

const C = { fscDI: '#0A6E76', fsc: '#0E8A94', crc: '#6C5CE0', aup: '#FF4700' }

export type Industry = 'agri' | 'hygiene' | 'other'
function resultNum(e: FullExperiment, re: RegExp): number | null {
  const row = e.experiment_results.find((r) => r.result_type && re.test(r.result_type))
  if (!row) return null
  if (row.value_num != null) return row.value_num
  const m = String(row.value ?? '').replace(/,/g, '').match(/-?\d+\.?\d*/)
  return m ? parseFloat(m[0]) : null
}
export function metricsOf(e: FullExperiment) {
  return { fsc: metricValue(e, 'FSC'), crc: metricValue(e, 'CRC'), aup: metricValue(e, 'AUP'), fscDI: resultNum(e, /^fsc in di/i) }
}
export function classify(e: FullExperiment): Industry {
  const m = metricsOf(e)
  if (m.fsc != null && m.crc != null && m.aup != null) return 'hygiene'
  if (m.fscDI != null) return 'agri'
  return 'other'
}

/* ---------------- XML helpers ---------------- */
const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
function runX(text: string, o: { b?: boolean; color?: string; size?: number; i?: boolean } = {}) {
  const rpr = `<w:rPr>${o.b ? '<w:b/><w:bCs/>' : ''}${o.i ? '<w:i/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}${o.size ? `<w:sz w:val="${o.size}"/>` : ''}<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr>`
  return `<w:r>${rpr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
}
function paraX(runs: string, o: { after?: number; before?: number } = {}) {
  return `<w:p><w:pPr><w:spacing w:after="${o.after ?? 80}"${o.before ? ` w:before="${o.before}"` : ''}/></w:pPr>${runs}</w:p>`
}
function heading(text: string, color = '0B1F3A', size = 26) { return paraX(runX(text, { b: true, color, size }), { before: 160, after: 80 }) }

const TBL_W = 9360
function cell(text: string, w: number, o: { header?: boolean; fill?: string; align?: string } = {}) {
  const shd = o.header ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill ?? '0E8A94'}"/>` : ''
  const rpr = `<w:rPr>${o.header ? '<w:b/><w:bCs/>' : ''}<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="${o.header ? 18 : 18}"/>${o.header ? '<w:color w:val="FFFFFF"/>' : ''}</w:rPr>`
  const jc = o.align ? `<w:jc w:val="${o.align}"/>` : ''
  return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${shd}<w:tcMar><w:top w:w="40" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:after="0"/>${jc}</w:pPr><w:r>${rpr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p></w:tc>`
}
function tableX(headers: string[], rows: string[][], widths: number[], headerFill = '0E8A94') {
  const b = '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9DEDE"/><w:left w:val="single" w:sz="4" w:color="D9DEDE"/><w:bottom w:val="single" w:sz="4" w:color="D9DEDE"/><w:right w:val="single" w:sz="4" w:color="D9DEDE"/><w:insideH w:val="single" w:sz="4" w:color="EDECE6"/><w:insideV w:val="single" w:sz="4" w:color="EDECE6"/></w:tblBorders>'
  const grid = `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`
  const hr = `<w:tr>${headers.map((h, i) => cell(h, widths[i], { header: true, fill: headerFill })).join('')}</w:tr>`
  const body = rows.map((r) => `<w:tr>${r.map((c, i) => cell(c, widths[i])).join('')}</w:tr>`).join('')
  return `<w:tbl><w:tblPr><w:tblW w:w="${TBL_W}" w:type="dxa"/>${b}<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>${grid}${hr}${body}</w:tbl>`
}
function imageParaX(rId: string, cxEmu: number, cyEmu: number, docId: number, name: string) {
  const draw = `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cxEmu}" cy="${cyEmu}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docId}" name="${esc(name)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docId}" name="${esc(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cxEmu}" cy="${cyEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`
  return `<w:p><w:pPr><w:spacing w:after="120"/><w:jc w:val="center"/></w:pPr><w:r>${draw}</w:r></w:p>`
}

/* ---------------- canvas charts → PNG bytes ---------------- */
function niceMax(v: number) { if (v <= 0) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))); const f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e }
function bytesFromCanvas(cv: HTMLCanvasElement): Uint8Array { const b64 = cv.toDataURL('image/png').split(',')[1] ?? ''; const bin = atob(b64); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a }
function baseChart(W: number, H: number) { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); return { cv, ctx } }

function groupedBar(items: { en: number; vals: (number | null)[] }[], series: { name: string; color: string }[], title: string): Uint8Array | null {
  if (!items.length) return null
  const W = 920, H = 470, { cv, ctx } = baseChart(W, H)
  const ml = 60, mr = 20, mt = 58, mb = 70, pw = W - ml - mr, ph = H - mt - mb
  const maxV = Math.max(1, ...items.flatMap((it) => it.vals.map((v) => v ?? 0))), yMax = niceMax(maxV)
  ctx.strokeStyle = '#E2E6E6'; ctx.fillStyle = '#6C7077'; ctx.font = '12px Arial'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
  for (let i = 0; i <= 5; i++) { const v = yMax * i / 5, y = mt + ph - (v / yMax) * ph; ctx.beginPath(); ctx.moveTo(ml, y); ctx.lineTo(W - mr, y); ctx.stroke(); ctx.fillText(String(Math.round(v)), ml - 8, y) }
  const n = items.length, gw = pw / n, pad = Math.min(gw * 0.18, 14), gap = 4, bw = Math.max(3, (gw - pad * 2 - gap * (series.length - 1)) / series.length)
  items.forEach((it, gi) => {
    const gx = ml + gi * gw + pad
    it.vals.forEach((v, si) => { if (v == null) return; const x = gx + si * (bw + gap), h = (v / yMax) * ph, y = mt + ph - h; ctx.fillStyle = series[si].color; ctx.fillRect(x, y, bw, h); if (n <= 14) { ctx.fillStyle = '#15181E'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(String(v), x + bw / 2, y - 2) } })
    const lx = ml + gi * gw + gw / 2, ly = mt + ph + 8; ctx.fillStyle = '#15181E'; ctx.font = 'bold 11px Arial'; ctx.textBaseline = 'top'
    if (n > 12) { ctx.save(); ctx.translate(lx, ly); ctx.rotate(-Math.PI / 4); ctx.textAlign = 'right'; ctx.fillText(`EN${it.en}`, 0, 0); ctx.restore() } else { ctx.textAlign = 'center'; ctx.fillText(`EN${it.en}`, lx, ly) }
  })
  ctx.strokeStyle = '#9AA0A6'; ctx.beginPath(); ctx.moveTo(ml, mt); ctx.lineTo(ml, mt + ph); ctx.lineTo(W - mr, mt + ph); ctx.stroke()
  ctx.fillStyle = '#0B1F3A'; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(title, ml, 24)
  let lxp = ml; const ly2 = 44
  series.forEach((s) => { ctx.fillStyle = s.color; ctx.fillRect(lxp, ly2 - 9, 12, 12); ctx.fillStyle = '#15181E'; ctx.font = '12px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s.name, lxp + 16, ly2 - 2); lxp += 16 + ctx.measureText(s.name).width + 20 })
  return bytesFromCanvas(cv)
}

/* ---------------- main ---------------- */
function fmtNum(v: number | null) { return v == null ? '—' : String(v) }
function matSummary(e: FullExperiment) { return e.experiment_materials.filter((m) => m.name).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).slice(0, 4).map((m) => `${m.name}${m.mass_g != null ? ` ${m.mass_g}${(m as any).unit ?? 'g'}` : ''}`).join(', ') }
function procSummary(e: FullExperiment) { return e.experiment_processes.filter((p) => p.process).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).slice(0, 4).map((p) => `${p.process}${p.value ? ` ${p.value}` : ''}`).join('; ') }
const INDUSTRY_LABEL: Record<Industry, string> = { agri: 'Agricultural', hygiene: 'Hygiene', other: 'Unclassified' }

export async function generateTemplateReport(experiments: FullExperiment[], _chemicals: Chemical[], opts: { project?: string } = {}) {
  const JSZipMod: any = await import('jszip')
  const JSZip = JSZipMod.default ?? JSZipMod
  const resp = await fetch('/report-template.docx')
  if (!resp.ok) throw new Error('Report template not found')
  const buf = await resp.arrayBuffer()
  const zip = await JSZip.loadAsync(buf)
  let docXml = await zip.file('word/document.xml')!.async('string')
  let relsXml = await zip.file('word/_rels/document.xml.rels')!.async('string')

  // next free rId
  let maxRid = 0
  for (const m of relsXml.matchAll(/Id="rId(\d+)"/g)) maxRid = Math.max(maxRid, parseInt(m[1]))
  let docId = 1000
  const addImage = (bytes: Uint8Array, name: string, cxEmu: number, cyEmu: number): string => {
    maxRid++; const rId = `rId${maxRid}`; const file = `report_${name}.png`
    zip.file(`word/media/${file}`, bytes)
    relsXml = relsXml.replace('</Relationships>', `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${file}"/></Relationships>`)
    return imageParaX(rId, cxEmu, cyEmu, ++docId, name)
  }
  const px = (p: number) => Math.round(p * 9525) // px → EMU

  const agri = experiments.filter((e) => classify(e) === 'agri')
  const hyg = experiments.filter((e) => classify(e) === 'hygiene')

  // ---- SECTION 2 : experiments done ----
  const s2rows = experiments.map((e) => [`EN${e.en}`, INDUSTRY_LABEL[classify(e)], e.experiment_type || '—', matSummary(e) || '—', procSummary(e) || '—'])
  let section2 = heading('Experiments performed', '0B1F3A', 26)
  section2 += paraX(runX(`${experiments.length} experiment${experiments.length === 1 ? '' : 's'} this period — ${hyg.length} hygiene-grade (FSC/CRC/AUP) and ${agri.length} agricultural (FSC in DI water).`, { size: 20 }))
  section2 += tableX(['EN', 'Industry', 'Type', 'Formulation', 'Process'], s2rows, [900, 1300, 1500, 3100, 2560])

  // ---- SECTION 4 : results & data ----
  let section4 = heading('Results summary', '0B1F3A', 26)
  const resRows = experiments.map((e) => { const m = metricsOf(e); return [`EN${e.en}`, INDUSTRY_LABEL[classify(e)], fmtNum(m.fscDI), fmtNum(m.fsc), fmtNum(m.crc), fmtNum(m.aup)] })
  section4 += tableX(['EN', 'Industry', 'FSC DI', 'FSC saline', 'CRC', 'AUP'], resRows, [1100, 1700, 1640, 1640, 1640, 1640])

  // hygiene graph
  if (hyg.length) {
    const items = hyg.map((e) => { const m = metricsOf(e); return { en: e.en, vals: [m.fsc, m.crc, m.aup] } })
    const png = groupedBar(items, [{ name: 'FSC', color: C.fsc }, { name: 'CRC', color: C.crc }, { name: 'AUP', color: C.aup }], 'Hygiene SAP samples — FSC / CRC / AUP (g/g)')
    section4 += heading('Hygiene-industry SAP samples', C.fsc, 22)
    section4 += paraX(runX('Absorbency in saline for samples characterised by free-swell, centrifuge retention and absorbency under pressure.', { size: 18, i: true, color: '6C7077' }))
    if (png) section4 += addImage(png, 'hygiene', px(620), px(620 * 470 / 920))
  }
  // agricultural graph
  if (agri.length) {
    const items = agri.map((e) => { const m = metricsOf(e); return { en: e.en, vals: [m.fscDI] } })
    const png = groupedBar(items, [{ name: 'FSC in DI water', color: C.fscDI }], 'Agricultural SAP samples — FSC in DI water (g/g)')
    section4 += heading('Agricultural SAP samples', C.fscDI, 22)
    section4 += paraX(runX('Free-swell capacity in deionised water for agricultural-grade samples.', { size: 18, i: true, color: '6C7077' }))
    if (png) section4 += addImage(png, 'agri', px(560), px(560 * 470 / 920))
  }
  if (!hyg.length && !agri.length) section4 += paraX(runX('No absorbency results recorded yet for the selected experiments.', { size: 20, i: true, color: '6C7077' }))

  // ---- token replacement ----
  const today = new Date()
  const dd = String(today.getDate()).padStart(2, '0'), mm = String(today.getMonth() + 1).padStart(2, '0')
  const projects = opts.project || [...new Set(experiments.map((e) => projectByCode(e.project)?.label).filter(Boolean))].join(', ')
  const tokenPara = (token: string, xml: string) => {
    const target = `<w:p><w:pPr><w:pStyle w:val="Normal13"/></w:pPr><w:r><w:t>${token}</w:t></w:r></w:p>`
    if (docXml.includes(target)) docXml = docXml.replace(target, xml)
    else docXml = docXml.replace(new RegExp(`<w:p\\b[^>]*>(?:(?!</w:p>)[\\s\\S])*?${token}(?:(?!</w:p>)[\\s\\S])*?</w:p>`), xml)
  }
  docXml = docXml.replace('{{REPORT_DATE}}', esc(`${dd}/${mm}/${today.getFullYear()}`))
  docXml = docXml.replace('{{PROJECT}}', esc(projects || ''))
  tokenPara('{{SECTION2}}', section2)
  tokenPara('{{SECTION4}}', section4)

  zip.file('word/document.xml', docXml)
  zip.file('word/_rels/document.xml.rels', relsXml)

  const out = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  const url = URL.createObjectURL(out)
  const a = document.createElement('a')
  a.href = url; a.download = `AB-weekly-report-${today.getFullYear()}-${mm}-${dd}.docx`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
