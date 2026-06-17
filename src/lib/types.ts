export type Role = 'admin' | 'member'
export type Status = 'approved' | 'pending'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  status: Status
  created_at: string
}

export interface Material {
  id?: string
  experiment_id?: string
  position: number | null
  name: string | null
  mass_g: number | null
  ratio: string | null
}

export interface ProcessStep {
  id?: string
  experiment_id?: string
  position: number | null
  process: string | null
  measure: string | null
  value: string | null
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
