// Company work packages. `code` is stored on the experiment; `label` is shown.
export interface Project {
  code: string
  label: string
  color: string
}

export const PROJECTS: Project[] = [
  { code: 'P1', label: 'Project 1 · Network refinement', color: '#0E8A94' },
  { code: 'P1b', label: 'Project 1b · Synthetic biopolymer', color: '#2CC5CD' },
  { code: 'P2', label: 'Project 2 · Biopolymer modification & linking', color: '#6C5CE0' },
  { code: 'P3', label: 'Project 3 · Surface linking', color: '#FF4700' },
  { code: 'P4', label: 'Project 4 · Scale up', color: '#B7791F' },
  { code: 'P5', label: 'Project 5 · IP', color: '#0B1F3A' },
]

export const projectByCode = (code: string | null | undefined): Project | undefined =>
  code ? PROJECTS.find((p) => p.code === code) : undefined

// short label without the "Project N · " prefix, for compact chips
export const projectShort = (code: string | null | undefined): string => {
  const p = projectByCode(code)
  if (!p) return ''
  const i = p.label.indexOf('·')
  return i >= 0 ? p.label.slice(i + 1).trim() : p.label
}
