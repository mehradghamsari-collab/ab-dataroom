import type { FullExperiment, Chemical, Benchmark } from './types'
import { sampleMetrics, formulationCost } from './metrics'
import { projectByCode } from './projects'

export function backupFilename(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `AB-Dataroom-Backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.xlsx`
}

// brand palette (ARGB for ExcelJS)
const NAVY = 'FF0B1F3A'
const TEAL = 'FF0E8A94'
const CYAN = 'FF2CC5CD'
const PAPER = 'FFF4F6F6'
const LINE = 'FFD9DEDE'
const INK = 'FF15181E'
const WHITE = 'FFFFFFFF'
const FSC_C = 'FF0E8A94'
const CRC_C = 'FF6C5CE0'
const AUP_C = 'FFFF4700'

interface Col { header: string; key: string; width: number; color?: string; numeric?: boolean }

function styleSheet(ws: any, ExcelJS: any, title: string, cols: Col[], rows: any[]) {
  const nCols = cols.length
  const lastColLetter = ws.getColumn(nCols).letter

  // Row 1 — title banner
  ws.mergeCells(`A1:${lastColLetter}1`)
  const t = ws.getCell('A1')
  t.value = title
  t.font = { name: 'Calibri', size: 14, bold: true, color: { argb: WHITE } }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(1).height = 28

  // Row 2 — subtitle
  ws.mergeCells(`A2:${lastColLetter}2`)
  const s = ws.getCell('A2')
  s.value = `A&B Smart Materials — Dataroom   ·   exported ${new Date().toLocaleString()}`
  s.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF6C7077' } }
  s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PAPER } }
  s.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(2).height = 16

  // Row 3 — header
  const headerRow = ws.getRow(3)
  cols.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = c.header
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.color ?? TEAL } }
    cell.alignment = { vertical: 'middle', horizontal: c.numeric ? 'center' : 'left', indent: c.numeric ? 0 : 1, wrapText: true }
    cell.border = { bottom: { style: 'thin', color: { argb: NAVY } } }
  })
  headerRow.height = 22

  // Data rows from row 4
  rows.forEach((r, ri) => {
    const row = ws.getRow(4 + ri)
    cols.forEach((c, ci) => {
      const cell = row.getCell(ci + 1)
      const v = r[c.key]
      cell.value = v === undefined || v === null || v === '' ? null : v
      cell.font = { name: 'Calibri', size: 10, color: { argb: INK } }
      cell.alignment = { vertical: 'middle', horizontal: c.numeric ? 'center' : 'left', indent: c.numeric ? 0 : 1, wrapText: c.key === 'Method' || c.key === 'Description' || c.key === 'Comment' || c.key === 'Notes' }
      if (ri % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PAPER } }
      cell.border = { bottom: { style: 'hair', color: { argb: LINE } } }
    })
  })

  // Column widths + autofilter + freeze
  cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.width })
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: nCols } }
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }]
}

export async function exportBackupXlsx(experiments: FullExperiment[], chemicals: Chemical[], benchmarks: Benchmark[]) {
  const mod: any = await import('exceljs')
  const ExcelJS = mod.default ?? mod
  const wb = new ExcelJS.Workbook()
  wb.creator = 'A&B Smart Materials — Dataroom'
  wb.created = new Date()

  // ---- Experiments ----
  const expCols: Col[] = [
    { header: 'EN', key: 'EN', width: 8, numeric: true },
    { header: 'Date', key: 'Date', width: 12 },
    { header: 'Owner', key: 'Owner', width: 12 },
    { header: 'Type', key: 'Type', width: 18 },
    { header: 'Work package', key: 'Project', width: 26 },
    { header: 'Two-step', key: 'TwoStep', width: 9, numeric: true },
    { header: 'Status', key: 'Status', width: 12 },
    { header: 'FSC', key: 'FSC', width: 8, numeric: true, color: FSC_C },
    { header: 'CRC', key: 'CRC', width: 8, numeric: true, color: CRC_C },
    { header: 'AUP', key: 'AUP', width: 8, numeric: true, color: AUP_C },
    { header: 'Cost', key: 'Cost', width: 9, numeric: true },
    { header: 'Cost/kg', key: 'CostKg', width: 9, numeric: true },
    { header: 'Description', key: 'Description', width: 30 },
    { header: 'Method', key: 'Method', width: 46 },
  ]
  const expRows = [...experiments].sort((a, b) => (b.en ?? 0) - (a.en ?? 0)).map((e) => {
    const m = sampleMetrics(e); const cost = formulationCost(e, chemicals)
    return {
      EN: e.en, Date: e.date ?? '', Owner: e.owner ?? '', Type: e.experiment_type ?? '',
      Project: projectByCode(e.project)?.label ?? '', TwoStep: e.is_two_step ? 'Yes' : '',
      Status: e.discontinued ? 'Discontinued' : 'Active',
      FSC: m.FSC ?? '', CRC: m.CRC ?? '', AUP: m.AUP ?? '',
      Cost: cost.totalCost > 0 ? Number(cost.totalCost.toFixed(2)) : '', CostKg: cost.costPerKg != null ? Number(cost.costPerKg.toFixed(2)) : '',
      Description: e.description ?? '', Method: e.method ?? '',
    }
  })
  styleSheet(wb.addWorksheet('Experiments'), ExcelJS, 'Experiments', expCols, expRows)

  // ---- Formulations (materials) ----
  const matCols: Col[] = [
    { header: 'EN', key: 'EN', width: 8, numeric: true },
    { header: 'Step', key: 'Stage', width: 10 },
    { header: '#', key: 'Idx', width: 5, numeric: true },
    { header: 'Material', key: 'Material', width: 34 },
    { header: 'Amount', key: 'Amount', width: 10, numeric: true },
    { header: 'Unit', key: 'Unit', width: 7, numeric: true },
    { header: 'Ratio', key: 'Ratio', width: 12 },
  ]
  const stageLabel = (s: any) => (s === 'bulk' ? 'Bulk' : s === 'surface' ? 'Surface' : '')
  const matRows = experiments.flatMap((e) => [...e.experiment_materials].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((mm) => ({
    EN: e.en, Stage: stageLabel((mm as any).stage), Idx: mm.position ?? '', Material: mm.name ?? '', Amount: mm.mass_g ?? '', Unit: (mm as any).unit ?? 'g', Ratio: mm.ratio ?? '',
  })))
  styleSheet(wb.addWorksheet('Formulations'), ExcelJS, 'Formulations  ·  materials per experiment', matCols, matRows)

  // ---- Processes ----
  const procCols: Col[] = [
    { header: 'EN', key: 'EN', width: 8, numeric: true },
    { header: 'Step', key: 'Stage', width: 10 },
    { header: '#', key: 'Idx', width: 5, numeric: true },
    { header: 'Process', key: 'Process', width: 26 },
    { header: 'Measure', key: 'Measure', width: 20 },
    { header: 'Value', key: 'Value', width: 16 },
  ]
  const procRows = experiments.flatMap((e) => [...e.experiment_processes].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((p) => ({
    EN: e.en, Stage: stageLabel((p as any).stage), Idx: p.position ?? '', Process: p.process ?? '', Measure: p.measure ?? '', Value: p.value ?? '',
  })))
  styleSheet(wb.addWorksheet('Processes'), ExcelJS, 'Process steps per experiment', procCols, procRows)

  // ---- Results ----
  const resCols: Col[] = [
    { header: 'EN', key: 'EN', width: 8, numeric: true },
    { header: '#', key: 'Idx', width: 5, numeric: true },
    { header: 'Result type', key: 'Result', width: 32 },
    { header: 'Value', key: 'Value', width: 14, numeric: true },
    { header: 'Comment', key: 'Comment', width: 34 },
  ]
  const resRows = experiments.flatMap((e) => {
    const m = sampleMetrics(e)
    const synth = (['FSC', 'CRC', 'AUP'] as const)
      .filter((mk) => m[mk] !== null && !e.experiment_results.some((r) => r.result_type && new RegExp(`^${mk} in saline`, 'i').test(r.result_type)))
      .map((mk) => ({ EN: e.en, Idx: '', Result: `${mk} in saline (g/g)`, Value: m[mk] as number, Comment: 'auto-calculated' }))
    const rows = [...e.experiment_results].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((r) => ({
      EN: e.en, Idx: r.position ?? '', Result: r.result_type ?? '', Value: r.value ?? '', Comment: r.comment ?? '',
    }))
    return [...synth, ...rows]
  })
  styleSheet(wb.addWorksheet('Results'), ExcelJS, 'Measured results', resCols, resRows)

  // ---- Chemicals ----
  const chemCols: Col[] = [
    { header: 'Name', key: 'Name', width: 32 },
    { header: 'Supplier', key: 'Supplier', width: 16 },
    { header: 'CAS no.', key: 'CAS', width: 14 },
    { header: 'Full name', key: 'Full', width: 28 },
    { header: 'Price', key: 'Price', width: 9, numeric: true },
    { header: 'Unit', key: 'Unit', width: 7, numeric: true },
    { header: 'Currency', key: 'Currency', width: 9, numeric: true },
    { header: 'Comments', key: 'Comments', width: 30 },
  ]
  const chemRows = chemicals.map((c) => ({ Name: c.name, Supplier: c.supplier ?? '', CAS: c.cas_no ?? '', Full: c.full_name ?? '', Price: c.price ?? '', Unit: c.price_unit ?? '', Currency: c.currency ?? '', Comments: c.comments ?? '' }))
  styleSheet(wb.addWorksheet('Chemicals'), ExcelJS, 'Chemical library', chemCols, chemRows)

  // ---- Benchmarks ----
  const bmCols: Col[] = [
    { header: 'Name', key: 'Name', width: 26 },
    { header: 'FSC', key: 'FSC', width: 8, numeric: true, color: FSC_C },
    { header: 'CRC', key: 'CRC', width: 8, numeric: true, color: CRC_C },
    { header: 'AUP', key: 'AUP', width: 8, numeric: true, color: AUP_C },
    { header: 'Price /kg', key: 'Price', width: 10, numeric: true },
    { header: 'Notes', key: 'Notes', width: 34 },
  ]
  const bmRows = benchmarks.map((b) => ({ Name: b.name, FSC: b.fsc ?? '', CRC: b.crc ?? '', AUP: b.aup ?? '', Price: b.price ?? '', Notes: b.notes ?? '' }))
  styleSheet(wb.addWorksheet('Benchmarks'), ExcelJS, 'Benchmark synthetic samples', bmCols, bmRows)

  // ---- About ----
  const about = wb.addWorksheet('About')
  styleSheet(about, ExcelJS, 'About this backup', [{ header: 'Field', key: 'Field', width: 24 }, { header: 'Value', key: 'Value', width: 50 }], [
    { Field: 'Created', Value: new Date().toLocaleString() },
    { Field: 'Experiments', Value: experiments.length },
    { Field: 'Chemicals', Value: chemicals.length },
    { Field: 'Benchmarks', Value: benchmarks.length },
    { Field: 'Source', Value: 'A&B Smart Materials — Dataroom' },
  ])

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = backupFilename(); a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
