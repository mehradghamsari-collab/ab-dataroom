import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, AlertTriangle, Info } from 'lucide-react'
import { cx, colorFor, initials } from '../lib/utils'

/* ---------------- Spinner ---------------- */
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={cx('animate-spin', className)} width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function FullLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 text-muted">
      <Spinner className="h-6 w-6 text-brand" />
      <span className="text-sm">{label}…</span>
    </div>
  )
}

/* ---------------- Modal ---------------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-5xl', '2xl': 'max-w-7xl' }
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cx(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-pop sm:rounded-2xl',
          widths[size],
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-base font-semibold">{title}</h2>
            <button onClick={onClose} className="btn-ghost -mr-2 h-8 w-8 p-0" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line bg-paper px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/* ---------------- Toasts ---------------- */
type Toast = { id: number; kind: 'ok' | 'err' | 'info'; msg: string }
const ToastCtx = createContext<(msg: string, kind?: Toast['kind']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((msg: string, kind: Toast['kind'] = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((s) => [...s, { id, kind, msg }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3600)
  }, [])
  const icon = { ok: <Check size={16} />, err: <AlertTriangle size={16} />, info: <Info size={16} /> }
  const tone = { ok: 'text-positive', err: 'text-danger', info: 'text-brand' }
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-3">
          {items.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm shadow-pop"
            >
              <span className={tone[t.kind]}>{icon[t.kind]}</span>
              <span className="text-ink">{t.msg}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}

/* ---------------- Confirm ---------------- */
type ConfirmOpts = { title: string; message?: string; confirmLabel?: string; danger?: boolean }
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false)
export const useConfirm = () => useContext(ConfirmCtx)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null)
  const resolver = useRef<(v: boolean) => void>()
  const ask = useCallback((o: ConfirmOpts) => {
    setOpts(o)
    return new Promise<boolean>((res) => (resolver.current = res))
  }, [])
  const finish = (v: boolean) => {
    resolver.current?.(v)
    setOpts(null)
  }
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <Modal
        open={!!opts}
        onClose={() => finish(false)}
        title={opts?.title}
        size="sm"
        footer={
          <>
            <button className="btn-ghost" onClick={() => finish(false)}>
              Cancel
            </button>
            <button className={opts?.danger ? 'btn-danger' : 'btn-primary'} onClick={() => finish(true)}>
              {opts?.confirmLabel ?? 'Confirm'}
            </button>
          </>
        }
      >
        <p className="text-sm text-muted">{opts?.message}</p>
      </Modal>
    </ConfirmCtx.Provider>
  )
}

/* ---------------- Misc ---------------- */
export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-paper px-6 py-14 text-center">
      {icon && <div className="mb-3 text-subtle">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

const TYPE_TONES: Record<string, string> = {
  'Polymer synthesis': 'bg-[#EAE7FB] text-[#5346C0]',
  'Bulk processing': 'bg-brand-tint text-brand-dark',
  'Surface processing': 'bg-[#FBEFE0] text-[#9A6212]',
  'Oven Poly-Condensation': 'bg-[#E6EFE9] text-positive',
}
export function TypePill({ type }: { type: string | null }) {
  if (!type) return <span className="text-subtle">—</span>
  return <span className={cx('pill', TYPE_TONES[type] ?? 'bg-black/[0.05] text-muted')}>{type}</span>
}

export function OwnerAvatar({ name, size = 26 }: { name: string | null; size?: number }) {
  const n = name ?? '?'
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full text-2xs font-semibold text-white"
      style={{ width: size, height: size, background: colorFor(n) }}
      title={n}
    >
      {initials(n).toUpperCase()}
    </span>
  )
}

/* ---------------- Tabs ---------------- */
export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)} className={cx('tab', active === t.key ? 'border-brand text-brand-dark' : 'border-transparent text-muted hover:text-ink')}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------- Segmented control ---------------- */
export function Segmented<T extends string>({ value, onChange, options, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: 'sm' | 'md' }) {
  return (
    <div className={cx('inline-flex rounded-xl bg-black/[0.04] p-1', size === 'sm' && 'p-0.5')}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx('seg', size === 'sm' && 'px-2.5 py-1 text-xs', value === o.value ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------- Chart watermark (subtle logo) ---------------- */
export function ChartWatermark() {
  return <img src="/logo-mark.png" alt="" className="pointer-events-none absolute bottom-1.5 right-1.5 z-10 h-5 w-5 rounded opacity-20" />
}

/* ---------------- Metric pill (coloured) ---------------- */
import { METRIC_COLOR } from '../lib/metrics'
export function MetricPill({ k, value, size = 'md' }: { k: 'FSC' | 'CRC' | 'AUP'; value: number | string | null; size?: 'sm' | 'md' }) {
  const c = METRIC_COLOR[k]
  return (
    <span
      className={cx('inline-flex items-center gap-1.5 rounded-md font-semibold', size === 'sm' ? 'px-1.5 py-0.5 text-2xs' : 'px-2 py-1 text-xs')}
      style={{ background: c + '18', color: c }}
    >
      <span className="opacity-70">{k}</span>
      <span className="data">{value ?? '—'}</span>
    </span>
  )
}

/* ---------------- Minimal Markdown renderer (safe, no deps) ---------------- */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g
  let last = 0, mtc: RegExpExecArray | null, key = 0
  while ((mtc = re.exec(text))) {
    if (mtc.index > last) out.push(text.slice(last, mtc.index))
    if (mtc[2]) out.push(<strong key={key++} className="font-semibold text-ink">{mtc[2]}</strong>)
    else if (mtc[3]) out.push(<em key={key++}>{mtc[3]}</em>)
    else if (mtc[4]) out.push(<code key={key++} className="data rounded bg-black/[0.05] px-1 py-0.5 text-[0.85em]">{mtc[4]}</code>)
    last = mtc.index + mtc[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n')
  const blocks: ReactNode[] = []
  let list: ReactNode[] = []
  let ordered = false
  const flush = () => {
    if (list.length) {
      blocks.push(ordered
        ? <ol key={blocks.length} className="my-2 ml-5 list-decimal space-y-1 text-sm text-ink/90">{list}</ol>
        : <ul key={blocks.length} className="my-2 ml-5 list-disc space-y-1 text-sm text-ink/90">{list}</ul>)
      list = []
    }
  }
  lines.forEach((raw, i) => {
    const line = raw.trimEnd()
    if (/^#{1,6}\s/.test(line)) {
      flush()
      const level = line.match(/^#+/)![0].length
      const content = inline(line.replace(/^#+\s/, ''))
      const cls = level === 1 ? 'mt-1 mb-2 text-lg font-bold text-ink' : level === 2 ? 'mt-4 mb-1.5 text-base font-semibold text-ink' : 'mt-3 mb-1 text-sm font-semibold text-ink'
      blocks.push(<div key={i} className={cls}>{content}</div>)
    } else if (/^\s*[-*]\s/.test(line)) {
      if (ordered) flush(); ordered = false
      list.push(<li key={i}>{inline(line.replace(/^\s*[-*]\s/, ''))}</li>)
    } else if (/^\s*\d+\.\s/.test(line)) {
      if (!ordered) flush(); ordered = true
      list.push(<li key={i}>{inline(line.replace(/^\s*\d+\.\s/, ''))}</li>)
    } else if (line.trim() === '') {
      flush()
    } else {
      flush()
      blocks.push(<p key={i} className="my-1.5 text-sm leading-relaxed text-ink/90">{inline(line)}</p>)
    }
  })
  flush()
  return <div className="space-y-0.5">{blocks}</div>
}
