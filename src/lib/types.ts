export type Role = 'admin' | 'member'
export type Status = 'approved' | 'pending'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  title: string | null
  role: Role
  status: Status
  is_manager: boolean
  created_at: string
}

export type AmountUnit = 'g' | 'mL'
export type Stage = 'bulk' | 'surface'

export interface Material {
  id?: string
  experiment_id?: string
  position: number | null
  name: string | null
  mass_g: number | null // the amount value (grams when unit='g', millilitres when unit='mL')
  unit: AmountUnit
  ratio: string | null
  stage?: Stage | null
}

export interface ProcessStep {
  id?: string
  experiment_id?: string
  position: number | null
  process: string | null
  measure: string | null
  value: string | null
  stage?: Stage | null
}

export interface ResultEntry {
  id?: string
  experiment_id?: string
  position: number | null
  result_type: string | null
  value: string | null
  value_num: number | null
  comment: string | null
}

export interface Experiment {
  id: string
  en: number | null
  date: string | null
  owner: string | null
  repeat: string | null
  experiment_type: string | null
  description: string | null
  method: string | null
  is_two_step: boolean
  discontinued: boolean
  extra_cost: number | null
  project: string | null
  fsc_mass: number | null
  crc_mass: number | null
  aup_mass: number | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface FullExperiment extends Experiment {
  experiment_materials: Material[]
  experiment_processes: ProcessStep[]
  experiment_results: ResultEntry[]
}

export interface Chemical {
  id: string
  name: string
  supplier: string | null
  full_name: string | null
  comments: string | null
  cas_no: string | null
  price: number | null
  price_unit: AmountUnit | null
  currency: string | null
}

export interface Benchmark {
  id: string
  name: string
  fsc: number | null
  crc: number | null
  aup: number | null
  price: number | null
  notes: string | null
}

export interface NamedItem {
  id: string
  name: string
}

export type RefTable =
  | 'experiment_types'
  | 'process_names'
  | 'measure_types'
  | 'result_types'

// ---------- v3: team super-app entities ----------
export interface Person {
  id: string
  email: string
  full_name: string | null
  title: string | null
  role: Role
  is_manager: boolean
}

export type CheckinKind = 'morning' | 'update'
export interface Checkin {
  id: string
  user_id: string
  kind: CheckinKind
  body: string
  created_at: string
}

export type ExternalTestStatus = 'sent' | 'in_progress' | 'results_in' | 'cancelled'
export interface ExternalTest {
  id: string
  experiment_id: string | null
  sample_label: string | null
  destination: string | null
  delivery_company: string | null
  reference_code: string | null
  sent_date: string | null
  status: ExternalTestStatus
  result_summary: string | null
  result_date: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type LeaveType = 'holiday' | 'sick' | 'remote'
export type LeaveStatus = 'pending' | 'approved' | 'declined'
export interface LeaveRequest {
  id: string
  user_id: string
  type: LeaveType
  start_date: string
  end_date: string
  status: LeaveStatus
  note: string | null
  decided_by: string | null
  decided_at: string | null
  created_at: string
}

export interface WeeklyGoal {
  id: string
  week_start: string
  body: string
  created_by: string | null
  created_at: string
}

export interface SupplierSample {
  id: string
  name: string
  supplier: string | null
  code: string | null
  cost_per_ton: number | null
  degree_substitution: string | null
  purity: string | null
  viscosity: string | null
  colour: string | null
  experiment_ids: string[]
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
