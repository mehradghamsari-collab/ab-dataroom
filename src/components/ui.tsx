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
  size?: 'sm' | 'md' | 'lg' | 'xl'
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
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-5xl' }
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
