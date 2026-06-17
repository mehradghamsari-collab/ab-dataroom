import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Plus, Check } from 'lucide-react'
import { cx } from '../lib/utils'

interface Props {
  value: string | null
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  onCreate?: (v: string) => Promise<void> | void
  createLabel?: (v: string) => string
  allowFreeText?: boolean
  className?: string
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  onCreate,
  createLabel = (v) => `Add “${v}”`,
  allowFreeText = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [creating, setCreating] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options.slice(0, 60)
    return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 60)
  }, [options, query])

  const exact = options.some((o) => o.toLowerCase() === query.trim().toLowerCase())
  const showCreate = !!onCreate && query.trim().length > 0 && !exact

  const choose = async (v: string) => {
    onChange(v)
    setOpen(false)
    setQuery('')
  }
  const create = async () => {
    const v = query.trim()
    if (!v) return
    setCreating(true)
    try {
      await onCreate?.(v)
      onChange(v)
    } finally {
      setCreating(false)
      setOpen(false)
      setQuery('')
    }
  }

  const total = filtered.length + (showCreate ? 1 : 0)
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, total - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (active < filtered.length) choose(filtered[active])
      else if (showCreate) create()
      else if (allowFreeText && query.trim()) choose(query.trim())
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div ref={boxRef} className={cx('relative', className)}>
      <button
        type="button"
        className={cx('field flex items-center justify-between text-left', !value && 'text-subtle')}
        onClick={() => {
          setOpen((o) => !o)
          setActive(0)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown size={15} className="ml-2 shrink-0 text-subtle" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-pop">
          <div className="border-b border-line p-1.5">
            <input
              ref={inputRef}
              className="field py-1.5"
              placeholder="Type to search…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={onKey}
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.map((o, i) => (
              <button
                type="button"
                key={o}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
                className={cx(
                  'flex w-full items-center justify-between px-3 py-1.5 text-left text-sm',
                  i === active ? 'bg-brand-tint text-brand-dark' : 'hover:bg-black/[0.03]',
                )}
              >
                <span className="truncate">{o}</span>
                {value === o && <Check size={14} className="text-brand" />}
              </button>
            ))}
            {showCreate && (
              <button
                type="button"
                onMouseEnter={() => setActive(filtered.length)}
                onClick={create}
                disabled={creating}
                className={cx(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-medium text-brand-dark',
                  active === filtered.length ? 'bg-brand-tint' : 'hover:bg-black/[0.03]',
                )}
              >
                <Plus size={14} />
                {createLabel(query.trim())}
              </button>
            )}
            {filtered.length === 0 && !showCreate && (
              <div className="px-3 py-3 text-center text-sm text-subtle">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
