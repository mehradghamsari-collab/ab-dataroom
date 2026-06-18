import { useEffect, useMemo, useRef, useState } from 'react'
import { FlaskConical, Gauge, Ban, Layers, TrendingUp, TrendingDown, Trophy, Calendar, ArrowRight, Beaker, Target, Download, DatabaseBackup, CheckCircle2 } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import type { FullExperiment } from '../lib/types'
import { FullLoader, OwnerAvatar, TypePill, MetricPill, Spinner } from '../components/ui'
import { ExperimentModal } from './ExperimentEditor'
import { METRIC_COLOR, sampleMetrics, metricValue, hasAnyMetric } from '../lib/metrics'
import { exportBackupXlsx } from '../lib/backup'
import { cx, fmtDate, colorFor } from '../lib/utils'

const DAY = 86400000
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

export function Overview() {
  const { experiments, loading, chemicals, benchmarks } = useData()
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<FullExperiment | null>(null)
  const openExp = (e: FullExperiment) => { setActive(e); setOpen(true) }

  const stats = useMemo(() => {
    const today = startOfDay(new Date()).getTime()
    const weekAgo = today - 6 * DAY
    const twoWeeks = today - 13 * DAY
    const inRange = (d: string | null, lo: number, hi: number) => { if (!d) return false; const t = startOfDay(new Date(d)).getTime(); return t >= lo && t <= hi }
    const thisWeek = experiments.filter((e) => inRange(e.date, weekAgo, today))
    const lastWeek = experiments.filter((e) => inRange(e.date, twoWeeks, weekAgo - DAY))
    const withResults = experiments.filter(hasAnyMetric).length
    const discontinued = experiments.filter((e) => e.discontinued).length
    const twoStep = experiments.filter((e) => e.is_two_step).length
    // by-day counts for last 7 days
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = today - (6 - i) * DAY
      return { d, label: new Date(d).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1), count: thisWeek.filter((e) => e.date && startOfDay(new Date(e.date)).getTime() === d).length }
    })
    const byOwner = Object.entries(thisWeek.reduce<Record<string, number>>((a, e) => { const o = e.owner || 'Unassigned'; a[o] = (a[o] || 0) + 1; return a }, {})).sort((a, b) => b[1] - a[1])
    return { total: experiments.length, withResults, discontinued, twoStep, thisWeek: thisWeek.length, lastWeek: lastWeek.length, days, byOwner, maxDay: Math.max(1, ...days.map((d) => d.count)) }
  }, [experiments])

  const recent = useMemo(() => [...experiments].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '') || (b.en ?? 0) - (a.en ?? 0)).slice(0, 6), [experiments])

  if (loading) return <FullLoader label="Loading overview" />

  const delta = stats.thisWeek - stats.lastWeek
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const name = profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] || ''

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="animate-fadeUp">
        <h1 className="text-2xl font-semibold tracking-tight">{greet}{name ? `, ${name}` : ''}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><Calendar size={14} /> Week of {new Date(Date.now() - 6 * DAY).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
      </div>

      {/* Stat cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard i={0} icon={<FlaskConical size={18} />} color="#0B1F3A" label="Total experiments" value={stats.total} />
        <StatCard i={1} icon={<Gauge size={18} />} color={METRIC_COLOR.FSC} label="With results" value={stats.withResults} sub={`${Math.round((stats.withResults / Math.max(1, stats.total)) * 100)}% of all`} />
        <StatCard i={2} icon={<TrendingUp size={18} />} color={METRIC_COLOR.CRC} label="Logged this week" value={stats.thisWeek} sub={delta === 0 ? 'same as last week' : `${delta > 0 ? '+' : ''}${delta} vs last week`} />
        <StatCard i={3} icon={<Ban size={18} />} color="#9AA0A6" label="Discontinued" value={stats.discontinued} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.1fr]">
        {/* Week summary */}
        <div className="card stagger p-5" style={{ ['--i' as any]: 1 }}>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Calendar size={16} className="text-brand" /> This week</h2>
            <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold', delta >= 0 ? 'bg-positive/10 text-positive' : 'bg-orange-tint text-orange-dark')}>
              {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {delta >= 0 ? '+' : ''}{delta}
            </span>
          </div>

          <div className="mt-4 flex items-end gap-2">
            {stats.days.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-24 w-full items-end">
                  <div className="w-full rounded-t-md bg-gradient-to-t from-brand to-brand-bright transition-all" style={{ height: `${(d.count / stats.maxDay) * 100}%`, minHeight: d.count > 0 ? 6 : 2, opacity: d.count > 0 ? 1 : 0.18, animation: 'barGrow 0.6s ease both', animationDelay: `${i * 60}ms`, transformOrigin: 'bottom' }} title={`${d.count}`} />
                </div>
                <span className="data text-2xs text-subtle">{d.count || ''}</span>
                <span className="text-2xs text-subtle">{d.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <div className="label mb-2">By owner this week</div>
            {stats.byOwner.length === 0 ? (
              <p className="text-sm text-subtle">No experiments dated in the last 7 days. New entries will appear here.</p>
            ) : (
              <div className="space-y-2">
                {stats.byOwner.map(([owner, n]) => (
                  <div key={owner} className="flex items-center gap-2.5">
                    <OwnerAvatar name={owner} size={22} />
                    <span className="w-20 shrink-0 truncate text-sm text-ink">{owner}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.05]">
                      <div className="h-full rounded-full" style={{ width: `${(n / stats.thisWeek) * 100}%`, background: colorFor(owner) }} />
                    </div>
                    <span className="data w-6 text-right text-sm font-semibold text-ink">{n}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <div className="label mb-2">Recently logged</div>
            <div className="space-y-1">
              {recent.map((e) => (
                <button key={e.id} onClick={() => openExp(e)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-paper">
                  <span className="data text-sm font-semibold text-ink">EN{e.en}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted">{e.description || e.experiment_type || '—'}</span>
                  <span className="hidden sm:block"><TypePill type={e.experiment_type} /></span>
                  <ArrowRight size={14} className="text-subtle" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Best performers */}
        <div className="card stagger p-5" style={{ ['--i' as any]: 2 }}>
          <Leaderboards onOpen={openExp} />
        </div>
      </div>

      <BackupCard />

      {/* Footer chips */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat icon={<Layers size={15} />} label="Two-step samples" value={stats.twoStep} />
        <MiniStat icon={<Beaker size={15} />} label="Chemicals" value={chemicals.length} />
        <MiniStat icon={<Target size={15} />} label="Benchmarks" value={benchmarks.length} />
        <MiniStat icon={<Gauge size={15} />} label="Result coverage" value={`${Math.round((stats.withResults / Math.max(1, stats.total)) * 100)}%`} />
      </div>

      <ExperimentModal open={open} experiment={active} initialMode="view" onClose={() => setOpen(false)} />
    </div>
  )
}

function Leaderboards({ onOpen }: { onOpen: (e: FullExperiment) => void }) {
  const { experiments } = useData()
  const [metric, setMetric] = useState<'FSC' | 'CRC' | 'AUP'>('FSC')
  const ranked = useMemo(() => {
    return experiments
      .map((e) => ({ e, v: metricValue(e, metric) }))
      .filter((x) => x.v !== null)
      .sort((a, b) => (b.v as number) - (a.v as number))
      .slice(0, 6)
  }, [experiments, metric])
  const color = METRIC_COLOR[metric]
  const medal = ['#E0A100', '#9AA0A6', '#C08457']

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Trophy size={16} style={{ color }} /> Best performers</h2>
        <div className="inline-flex rounded-xl bg-black/[0.04] p-1">
          {(['FSC', 'CRC', 'AUP'] as const).map((k) => (
            <button key={k} onClick={() => setMetric(k)} className={cx('rounded-lg px-3 py-1.5 text-xs font-semibold transition-all', metric === k ? 'text-white shadow-card' : 'text-muted hover:text-ink')} style={metric === k ? { background: METRIC_COLOR[k] } : undefined}>{k}</button>
          ))}
        </div>
      </div>
      <p className="mt-1.5 text-2xs text-subtle">Top samples ranked by {metric} (g/g).</p>

      {ranked.length === 0 ? (
        <div className="mt-6 grid place-items-center py-10 text-center text-sm text-subtle">No {metric} values recorded yet.</div>
      ) : (
        <div className="mt-3 space-y-1.5">
          {ranked.map(({ e, v }, i) => (
            <button key={e.id} onClick={() => onOpen(e)} className="stagger flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lift" style={{ ['--i' as any]: i }}>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: i < 3 ? medal[i] : '#C9CCD1' }}>{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="data text-sm font-semibold text-ink">EN{e.en}</span>
                  {e.is_two_step && <Layers size={12} className="text-brand" />}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted"><OwnerAvatar name={e.owner} size={14} /> {e.owner || '—'}{e.description ? ` · ${e.description}` : ''}</span>
              </span>
              <span className="shrink-0">
                <span className="data text-lg font-bold" style={{ color }}>{v}</span>
                <span className="ml-1 text-2xs text-subtle">g/g</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function BackupCard() {
  const { experiments, chemicals, benchmarks } = useData()
  const [last, setLast] = useState<string | null>(() => { try { return localStorage.getItem('ab_last_backup') } catch { return null } })
  const [busy, setBusy] = useState(false)
  const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / DAY) : null
  const due = days === null || days >= 7

  const run = async () => {
    setBusy(true)
    try {
      await exportBackupXlsx(experiments, chemicals, benchmarks)
      const now = new Date().toISOString()
      try { localStorage.setItem('ab_last_backup', now) } catch { /* ignore */ }
      setLast(now)
    } finally { setBusy(false) }
  }

  return (
    <div className="mt-5">
      <div className={cx('card flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center', due && 'border-brand-ring')}>
        <div className="flex items-start gap-3">
          <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl', due ? 'bg-brand-tint text-brand-dark' : 'bg-positive/10 text-positive')}>
            {due ? <DatabaseBackup size={20} /> : <CheckCircle2 size={20} />}
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">Weekly Excel backup</div>
            <p className="mt-0.5 text-2xs text-muted">
              {last ? <>Last backup {days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`} · {fmtDate(last.slice(0, 10))}</> : 'No backup downloaded yet from this browser.'}
              {due && <span className="ml-1 font-medium text-brand-dark">· a fresh backup is recommended.</span>}
            </p>
          </div>
        </div>
        <button className={due ? 'btn-primary' : 'btn-outline'} onClick={run} disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : <><Download size={15} /> Download backup</>}</button>
      </div>
    </div>
  )
}

function useCountUp(target: number, ms = 700) {
  const [val, setVal] = useState(0)
  const ref = useRef<number>()
  useEffect(() => {
    const start = performance.now()
    const from = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(from + (target - from) * eased))
      if (p < 1) ref.current = requestAnimationFrame(tick)
    }
    ref.current = requestAnimationFrame(tick)
    return () => { if (ref.current) cancelAnimationFrame(ref.current) }
  }, [target, ms])
  return val
}

function StatCard({ icon, color, label, value, sub, i }: { icon: React.ReactNode; color: string; label: string; value: number; sub?: string; i: number }) {
  const n = useCountUp(value)
  return (
    <div className="card-hover stagger overflow-hidden p-4" style={{ ['--i' as any]: i }}>
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: color + '18', color }}>{icon}</span>
        <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</span>
      </div>
      <div className="mt-2.5 data text-3xl font-bold tracking-tight text-ink">{n}</div>
      {sub && <div className="mt-0.5 text-2xs text-subtle">{sub}</div>}
    </div>
  )
}
function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="card flex items-center gap-3 p-3.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-paper text-muted">{icon}</span>
      <div>
        <div className="data text-lg font-bold text-ink">{value}</div>
        <div className="text-2xs text-subtle">{label}</div>
      </div>
    </div>
  )
}
