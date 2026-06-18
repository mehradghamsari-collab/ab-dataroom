import type { FullExperiment, Chemical, Benchmark } from './types'
import { sampleMetrics } from './metrics'
import { projectByCode } from './projects'

export function backupFilename(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `AB-Dataroom-Backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.xlsx`
}

// Build and download a full Excel backup of all dataroom content.
// xlsx is imported on demand so it never weighs down the initial page load.
export async function exportBackupXlsx(experiments: FullExperiment[], chemicals: Chemical[], benchmarks: Benchmark[]) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const expRows = experiments.map((e) => {
    const m = sampleMetrics(e)
    return {
      EN: e.en,
      Date: e.date ?? '',
      Owner: e.owner ?? '',
      Type: e.experiment_type ?? '',
      'Work package': projectByCode(e.project)?.label ?? '',
      'Two-step': e.is_two_step ? 'Yes' : '',
      Discontinued: e.discontinued ? 'Yes' : '',
      FSC: m.FSC ?? '',
      CRC: m.CRC ?? '',
      AUP: m.AUP ?? '',
      'Extra cost': e.extra_cost ?? '',
      Repeat: e.repeat ?? '',
      Description: e.description ?? '',
      Method: e.method ?? '',
      Created: e.created_at ?? '',
    }
  })

  const matRows = experiments.flatMap((e) =>
    [...e.experiment_materials]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((mm) => ({ EN: e.en, Stage: (mm as any).stage ?? '', '#': mm.position ?? '', Material: mm.name ?? '', Amount: mm.mass_g ?? '', Unit: (mm as any).unit ?? 'g', Ratio: mm.ratio ?? '' })),
  )

  const procRows = experiments.flatMap((e) =>
    [...e.experiment_processes]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((p) => ({ EN: e.en, Stage: (p as any).stage ?? '', '#': p.position ?? '', Process: p.process ?? '', Measure: p.measure ?? '', Value: p.value ?? '' })),
  )

  const resRows = experiments.flatMap((e) =>
    [...e.experiment_results]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((r) => ({ EN: e.en, '#': r.position ?? '', 'Result type': r.result_type ?? '', Value: r.value ?? '', Comment: r.comment ?? '' })),
  )

  const chemRows = chemicals.map((c) => ({ Name: c.name, Supplier: c.supplier ?? '', 'CAS no.': c.cas_no ?? '', 'Full name': c.full_name ?? '', Price: c.price ?? '', 'Price unit': c.price_unit ?? '', Currency: c.currency ?? '', Comments: c.comments ?? '' }))
  const bmRows = benchmarks.map((b) => ({ Name: b.name, FSC: b.fsc ?? '', CRC: b.crc ?? '', AUP: b.aup ?? '', 'Price /kg': b.price ?? '', Notes: b.notes ?? '' }))

  const meta = [
    { Field: 'Backup created', Value: new Date().toISOString() },
    { Field: 'Experiments', Value: experiments.length },
    { Field: 'Chemicals', Value: chemicals.length },
    { Field: 'Benchmarks', Value: benchmarks.length },
    { Field: 'App', Value: 'A&B Smart Materials — Dataroom' },
  ]

  const add = (rows: any[], name: string, cols?: { wch: number }[]) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}])
    if (cols) ws['!cols'] = cols
    XLSX.utils.book_append_sheet(wb, ws, name)
  }

  add(expRows, 'Experiments', [{ wch: 7 }, { wch: 11 }, { wch: 12 }, { wch: 18 }, { wch: 28 }, { wch: 9 }, { wch: 11 }, { wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 9 }, { wch: 7 }, { wch: 30 }, { wch: 40 }, { wch: 20 }])
  add(matRows, 'Materials', [{ wch: 7 }, { wch: 9 }, { wch: 4 }, { wch: 32 }, { wch: 9 }, { wch: 6 }, { wch: 12 }])
  add(procRows, 'Processes', [{ wch: 7 }, { wch: 9 }, { wch: 4 }, { wch: 24 }, { wch: 18 }, { wch: 14 }])
  add(resRows, 'Results', [{ wch: 7 }, { wch: 4 }, { wch: 30 }, { wch: 14 }, { wch: 30 }])
  add(chemRows, 'Chemicals', [{ wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 26 }, { wch: 8 }, { wch: 9 }, { wch: 8 }, { wch: 30 }])
  add(bmRows, 'Benchmarks', [{ wch: 26 }, { wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 10 }, { wch: 30 }])
  add(meta, 'About', [{ wch: 18 }, { wch: 40 }])

  XLSX.writeFile(wb, backupFilename())
}
