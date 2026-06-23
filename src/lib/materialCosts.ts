// Material cost reference — lab (catalog) and large-scale (bulk) prices.
// Source: material_cost_database.xlsx (indicative public/catalog estimates, 2026-06-23).
// Prices are USD per the listed unit (g for solids, mL for liquids/solutions).
// Verify with supplier quotes before procurement.

export interface MatCost {
  name: string
  unit: 'g' | 'mL'
  lab: number | null
  bulk: number | null
  conf: string
}

export const MATERIAL_COSTS: MatCost[] = [
  { name: 'Acetone', unit: 'mL', lab: 0.08, bulk: 0.0015, conf: 'Medium' },
  { name: 'Citric acid (MERCK)', unit: 'g', lab: 0.12, bulk: 0.0022, conf: 'Medium' },
  { name: 'CMC (Sigma, 2024, DS=0.9, Mw 250,000)', unit: 'g', lab: 0.45, bulk: 0.0025, conf: 'Low' },
  { name: 'CMS (old)- China, DS=0.19-0.26, Purity=87%-95%, pH=11, Hebei Yan Xing Chemical Co., Ltd', unit: 'g', lab: 0.6, bulk: 0.0035, conf: 'Low' },
  { name: 'DI water', unit: 'mL', lab: 0.015, bulk: 5e-05, conf: 'Low' },
  { name: 'NaOH', unit: 'g', lab: 0.09, bulk: 0.0012, conf: 'Medium' },
  { name: 'NaOH (1M)', unit: 'mL', lab: 0.055, bulk: 0.0018, conf: 'Medium' },
  { name: 'PEGdialcohol (thermoscient, 2025, d=1.12, Mw 300)', unit: 'mL', lab: 0.25, bulk: 0.0045, conf: 'Low' },
  { name: 'PEGdiglycidyl (Sigma, 04-26, Mw 500)', unit: 'g', lab: 1.6, bulk: 0.035, conf: 'Low' },
  { name: 'PEGdiglycidyl (Sigma, 2025, Mw 500)', unit: 'g', lab: 1.6, bulk: 0.035, conf: 'Low' },
  { name: 'PGA (MarkNature, 04-26, 1MDa)', unit: 'g', lab: 1.2, bulk: 0.03, conf: 'Low' },
  { name: 'PGA (MarkNature, AgriGrade, 30% purity, 2025)', unit: 'g', lab: 1.2, bulk: 0.03, conf: 'Low' },
  { name: 'Sorbitol (FISHER)', unit: 'g', lab: 0.21, bulk: 0.0015, conf: 'High' },
  { name: 'STMP', unit: 'g', lab: 0.65, bulk: 0.006, conf: 'Low' },
  { name: 'XN (5kg, Mar26, SpecialIngredients)', unit: 'g', lab: 0.22, bulk: 0.004, conf: 'Low' },
  { name: 'DL-Malic acid (Sigma)', unit: 'g', lab: 0.49, bulk: 0.0035, conf: 'High' },
  { name: 'L-Aspartic acid (ThermoScientific)', unit: 'g', lab: 0.3, bulk: 0.01, conf: 'Medium' },
  { name: 'Phosphoric acid (85%wt, Sigma)', unit: 'mL', lab: 0.264, bulk: 0.0012, conf: 'High' },
  { name: 'Methanol (FISHER)', unit: 'mL', lab: 0.07, bulk: 0.0012, conf: 'Medium' },
  { name: 'THF', unit: 'mL', lab: 0.2, bulk: 0.004, conf: 'Medium' },
  { name: 'DCM', unit: 'mL', lab: 0.16, bulk: 0.003, conf: 'Medium' },
  { name: 'XN (1kg, Apr26, SpecialIngredients)', unit: 'g', lab: 0.22, bulk: 0.004, conf: 'Low' },
  { name: 'XN (5kg, Nov25, SpecialIngredients)', unit: 'g', lab: 0.22, bulk: 0.004, conf: 'Low' },
  { name: 'Poly(ethylene glycol) bis(carboxymethyl) ether MN 600', unit: 'g', lab: 2.8, bulk: 0.12, conf: 'Low' },
  { name: 'Poly(ethylene glycol) bis(carboxymethyl) ether MN 250', unit: 'g', lab: 2.8, bulk: 0.12, conf: 'Low' },
  { name: 'NaOH (5M)', unit: 'mL', lab: 0.08, bulk: 0.0045, conf: 'Medium' },
  { name: 'PEGDAc (Merck, 250 g/mol)', unit: 'g', lab: null, bulk: null, conf: 'Quote required' },
  { name: 'Sodium metabisilphite (merck)', unit: 'g', lab: 0.1, bulk: 0.0008, conf: 'Medium' },
  { name: 'L-Glutamic acid (thermo scientific, 99%)', unit: 'g', lab: 0.18, bulk: 0.004, conf: 'Medium' },
  { name: 'Urea (Merck)', unit: 'g', lab: 0.08, bulk: 0.0004, conf: 'Medium' },
  { name: 'Tin (II) Chloride (Sigma)', unit: 'g', lab: 0.75, bulk: 0.015, conf: 'Medium' },
  { name: 'Poly Aspartic Acid (Mark Nature, 5-8kDa, industrial grade)', unit: 'g', lab: 1.2, bulk: 0.03, conf: 'Low' },
  { name: '1,4-Butanediol diglycidyl ether (Sigma)', unit: 'g', lab: 1.8, bulk: 0.02, conf: 'Low' },
  { name: 'ethylene carbonate (sigma)', unit: 'g', lab: 0.18, bulk: 0.002, conf: 'Medium' },
  { name: 'fumed silica (merck)', unit: 'g', lab: 0.35, bulk: 0.006, conf: 'Medium' },
  { name: 'zeolite Type A (HEILTR PFEN)', unit: 'g', lab: 0.25, bulk: 0.002, conf: 'Low' },
  { name: 'Glycerol (Sigma)', unit: 'mL', lab: 0.08, bulk: 0.001, conf: 'Medium' },
  { name: 'DMF', unit: 'mL', lab: 0.22, bulk: 0.004, conf: 'Medium' },
  { name: 'Hexamethylenediamine (Sigma)', unit: 'g', lab: 0.45, bulk: 0.004, conf: 'Medium' },
  { name: 'Sodium bicarbonate', unit: 'g', lab: 0.05, bulk: 0.0006, conf: 'Medium' },
  { name: 'tartaric acid ( SpecialIngredients)', unit: 'g', lab: 0.1, bulk: 0.0025, conf: 'Low' },
  { name: 'oxalic acid (merck)', unit: 'g', lab: 0.15, bulk: 0.0015, conf: 'Medium' },
  { name: 'Poly Acrylic Acid (Sigma, 323667)', unit: 'g', lab: 0.35, bulk: 0.006, conf: 'Medium' },
  { name: 'Bountigel sample (22/05/26)', unit: 'g', lab: 0.1, bulk: 0.004, conf: 'Low' },
  { name: 'CNF (Nanografi)', unit: 'g', lab: 8.0, bulk: 1.0, conf: 'Low' },
  { name: 'N-(1,3-Dimethylbutyl)-N′-phenyl-p-phenylenediamine (ABCR, Chaoying)', unit: 'g', lab: 2.5, bulk: 0.012, conf: 'Low' },
  { name: 'fumed silica (amazon sample, Origin:china)', unit: 'g', lab: 0.08, bulk: 0.004, conf: 'Low' },
  { name: 'DL-Aspartic acid (ThermoSci)', unit: 'g', lab: 0.35, bulk: 0.012, conf: 'Medium' },
  { name: 'Pentaerythritol tetrakis(3,5-di-tert-butyl-4-hydroxyhydrocinnamate)', unit: 'g', lab: 1.2, bulk: 0.006, conf: 'Low' },
  { name: 'PEGdialcohol (4000Da, Sigma)', unit: 'g', lab: 0.35, bulk: 0.006, conf: 'Medium' },
  { name: 'HCl (1%)', unit: 'mL', lab: 0.025, bulk: 0.0002, conf: 'Low' },
  { name: 'Aluminium L-lactate', unit: 'g', lab: 1.5, bulk: 0.02, conf: 'Low' },
  { name: 'Pentaerythritol tetrakis(3-mercaptopropionate) (Sigma)', unit: 'g', lab: 1.8, bulk: 0.035, conf: 'Low' },
  { name: 'Ethylenediaminetetraacetic acid disodium salt dihydrate (Acros)', unit: 'g', lab: 0.12, bulk: 0.003, conf: 'Medium' },
  { name: 'calcium chloride (fisher)', unit: 'g', lab: 0.06, bulk: 0.0007, conf: 'Medium' },
  { name: 'sodium chloride (fisher)', unit: 'g', lab: 0.05, bulk: 0.0004, conf: 'Medium' },
  { name: 'Poly(dimethylsiloxane) (100 cSt, Thermo)', unit: 'mL', lab: 0.22, bulk: 0.006, conf: 'Medium' },
  { name: 'DMSO', unit: 'mL', lab: 0.12, bulk: 0.003, conf: 'Medium' },
  { name: 'Gellan gum (LT)', unit: 'g', lab: 0.45, bulk: 0.02, conf: 'Low' },
  { name: 'APS', unit: 'g', lab: 0.18, bulk: 0.004, conf: 'Medium' },
  { name: 'AA', unit: 'mL', lab: 0.12, bulk: 0.0025, conf: 'Medium' },
  { name: 'AMPS', unit: 'g', lab: 0.65, bulk: 0.008, conf: 'Medium' },
  { name: 'PEG (Sigma, Mw 4000)', unit: 'g', lab: 0.35, bulk: 0.006, conf: 'Medium' },
  { name: 'Lignin Alkali Merck', unit: 'g', lab: 0.22, bulk: 0.0015, conf: 'Medium' },
  { name: 'Lignosulfonate Merck', unit: 'g', lab: 0.12, bulk: 0.001, conf: 'Low' },
  { name: 'Cellulose fibres (Borregaard)', unit: 'g', lab: 0.04, bulk: 0.0015, conf: 'Low' },
  { name: 'Poly(ethyleneimine)solution (60k Mn, 50%wt in H2O, 181978)', unit: 'g', lab: 0.75, bulk: 0.02, conf: 'Medium' },
  { name: 'Ethanol', unit: 'mL', lab: 0.07, bulk: 0.001, conf: 'Medium' },
  { name: 'Adipic acid', unit: 'g', lab: 0.08, bulk: 0.0016, conf: 'Medium' },
]

// ----- name normalisation + alias matching -----
const stripAccents = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
// normName drops bracketed supplier/date qualifiers (for broad exact/prefix matching)
export function normName(s: string): string {
  return stripAccents(String(s || ''))
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
// normFull KEEPS bracket text so concentration / MW (5M, 1M, 4000Da, 300) survive
const normFull = (s: string) => stripAccents(String(s || '')).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()

const NORMED = MATERIAL_COSTS.map((e) => ({ e, n: normName(e.name) }))
const FULL = MATERIAL_COSTS.map((e) => ({ e, f: normFull(e.name) }))
const byPrefix = (sub: string): MatCost | null => NORMED.find((x) => x.n.startsWith(sub))?.e ?? null
const findFull = (sub: string): MatCost | null => FULL.find((x) => x.f.includes(sub))?.e ?? null

// alias rules: regex on the FULL (bracket-keeping) normalised name → a substring that
// uniquely identifies the right cost entry's full name.
const ALIASES: [RegExp, string][] = [
  [/xanthan|\bxg\b|\bxn\b/, 'xn '],
  [/\bcmc\b|carboxymethyl ?cellulose/, 'cmc '],
  [/\bcms\b|carboxymethyl ?starch/, 'cms '],
  [/dl[- ]?aspartic/, 'dl aspartic'],
  [/\bl[- ]?aspartic/, 'l aspartic'],
  [/poly ?aspartic|\bpga\b/, 'poly aspartic'],
  [/pegdiglycidyl/, 'pegdiglycidyl'],
  [/pegdialcohol.*(4000|sigma)/, 'pegdialcohol 4000'],
  [/pegdialcohol/, 'pegdialcohol thermoscient'],
  [/\bpeg\b.*4000|polyethylene glycol.*4000|peg sigma/, 'peg sigma'],
  [/citric/, 'citric acid'],
  [/phosphoric/, 'phosphoric acid'],
  [/malic/, 'dl malic acid'],
  [/glutamic/, 'l glutamic acid'],
  [/sorbitol/, 'sorbitol'],
  [/naoh.*5 ?m/, 'naoh 5m'],
  [/naoh.*1 ?m/, 'naoh 1m'],
  [/\bnaoh\b/, 'naoh'],
  [/fumed silica.*amazon/, 'fumed silica amazon'],
  [/fumed silica/, 'fumed silica merck'],
  [/metabisil|metabisul/, 'metabis'],
  [/alumini?um l[- ]?lacta/, 'aluminium l lactate'],
  [/\bstmp\b|trimetaphosphate/, 'stmp'],
  [/\bdmf\b/, 'dmf'], [/\bdmso\b/, 'dmso'], [/\bthf\b/, 'thf'],
  [/\bdcm\b|dichloromethane/, 'dcm'], [/methanol/, 'methanol'],
  [/\baa\b|acrylic acid/, 'aa'], [/\bamps\b/, 'amps'],
  [/\baps\b|ammonium persulfate/, 'aps'],
  [/acetone/, 'acetone'], [/di water|deionized|^water$/, 'di water'],
  [/urea/, 'urea'], [/glycerol/, 'glycerol'],
  [/ethylene carbonate/, 'ethylene carbonate'],
  [/hexamethylenediamine/, 'hexamethylenediamine'],
  [/tartaric/, 'tartaric acid'], [/oxalic/, 'oxalic acid'],
  [/sodium bicarbonate/, 'sodium bicarbonate'],
  [/zeolite/, 'zeolite'],
  [/cnf|cellulose nanofiber/, 'cnf'],
  [/butanediol diglycidyl/, 'butanediol diglycidyl'],
  [/poly acrylic|polyacrylic/, 'poly acrylic acid'],
  [/lignosulfonate/, 'lignosulfonate'], [/lignin/, 'lignin alkali'],
  [/calcium chloride/, 'calcium chloride'], [/sodium chloride/, 'sodium chloride'],
  [/tin.*chloride|stannous/, 'tin'], [/\bhcl\b/, 'hcl'], [/bountigel/, 'bountigel'],
]

const isBatchRef = (raw: string) => /^en\s*\d+$/.test(normName(raw))

// Find the cost entry for a logged material name (handles aliases, qualifiers, concentrations).
export function lookupCost(raw: string | null | undefined): MatCost | null {
  if (!raw || !raw.trim()) return null
  if (isBatchRef(raw)) return null // references another experiment's batch, not a raw chemical
  const full = normFull(raw)
  for (const [re, key] of ALIASES) { if (re.test(full)) { const e = findFull(key); if (e) return e } }
  const n = normName(raw)
  const exact = NORMED.find((x) => x.n === n)
  if (exact) return exact.e
  let best: { e: MatCost; n: string } | null = null
  for (const x of NORMED) {
    if (!x.n) continue
    if (n.startsWith(x.n) || x.n.startsWith(n)) { if (!best || x.n.length > best.n.length) best = x }
  }
  return best?.e ?? null
}

export const materialIsBatch = (raw: string | null | undefined) => !!raw && isBatchRef(raw)
