import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, Gauge, Ban, Layers, TrendingUp, TrendingDown, Trophy, Calendar, ArrowRight, Beaker, Target, Download, DatabaseBackup, CheckCircle2, Sun, Sunset, Sparkles, Plus, Trash2, BarChart3, Send, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import type { FullExperiment, Checkin, CheckinKind, WeeklyGoal } from '../lib/types'
import { FullLoader, OwnerAvatar, TypePill, MetricPill, Spinner, useToast, useConfirm } from '../components/ui'
import { ExperimentModal } from './ExperimentEditor'
import { METRIC_COLOR, sampleMetrics, metricValue, hasAnyMetric } from '../lib/metrics'
import { exportBackupXlsx } from '../lib/backup'
import { cx, fmtDate, colorFor } from '../lib/utils'
import { weekStartISO, fmtTime, personName, personById, detectSets } from '../lib/team'
import { projectShort } from '../lib/projects'

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

      <WeeklyGoalsBar />

      {/* Stat cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard i={0} icon={<FlaskConical size={18} />} color="#0B1F3A" label="Total experiments" value={stats.total} />
        <StatCard i={1} icon={<Gauge size={18} />} color={METRIC_COLOR.FSC} label="With results" value={stats.withResults} sub={`${Math.round((stats.withResults / Math.max(1, stats.total)) * 100)}% of all`} />
        <StatCard i={2} icon={<TrendingUp size={18} />} color={METRIC_COLOR.CRC} label="Logged this week" value={stats.thisWeek} sub={delta === 0 ? 'same as last week' : `${delta > 0 ? '+' : ''}${delta} vs last week`} />
        <StatCard i={3} icon={<Ban size={18} />} color="#9AA0A6" label="Discontinued" value={stats.discontinued} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_1fr]">
        <TeamToday />
        <SuggestedPlots openExp={openExp} />
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

/* ===================== Weekly goals (managers set each Monday) ===================== */
function WeeklyGoalsBar() {
  const { weeklyGoals, people, refetchTeam } = useData()
  const { profile, isAdmin } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const canManage = isAdmin || !!profile?.is_manager
  const wk = weekStartISO()
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const goals = useMemo(() => weeklyGoals.filter((g) => g.week_start === wk), [weeklyGoals, wk])

  const add = async () => {
    if (!text.trim()) return
    setBusy(true)
    const { error } = await supabase.from('weekly_goals').insert({ week_start: wk, body: text.trim(), created_by: profile?.id ?? null })
    setBusy(false)
    if (error) return toast(error.message, 'err')
    setText(''); setAdding(false); await refetchTeam(); toast('Goal added for the week')
  }
  const remove = async (g: WeeklyGoal) => {
    if (!(await confirm({ title: 'Remove this goal?', message: 'It will disappear for everyone.', confirmLabel: 'Remove', danger: true }))) return
    await supabase.from('weekly_goals').delete().eq('id', g.id); await refetchTeam()
  }

  if (goals.length === 0 && !canManage) return null
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-tint/70 to-[#EAF1FB] p-4 animate-fadeUp sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy"><Target size={16} className="text-brand" /> Goals for this week</h2>
        {canManage && !adding && <button className="btn-soft-teal h-8 px-2.5 text-xs" onClick={() => setAdding(true)}><Plus size={14} /> Add goal</button>}
      </div>
      {goals.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{canManage ? 'Set this week’s goals so the whole team sees them.' : 'No goals set yet.'}</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {goals.map((g) => (
            <li key={g.id} className="flex items-start gap-2.5 rounded-lg bg-surface/70 px-3 py-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              <span className="flex-1 text-sm text-ink">{g.body}</span>
              <span className="hidden text-2xs text-subtle sm:block">{personName(people, g.created_by)}</span>
              {canManage && <button onClick={() => remove(g)} className="text-subtle transition hover:text-danger"><Trash2 size={13} /></button>}
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input autoFocus className="field flex-1" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="e.g. Finish polycondensation scale-up trials" />
          <div className="flex gap-2">
            <button className="btn-primary" onClick={add} disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Add'}</button>
            <button className="btn-ghost" onClick={() => { setAdding(false); setText('') }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ===================== Daily check-ins (morning goal / day update) ===================== */
function TeamToday() {
  const { checkins, people, refetchTeam } = useData()
  const { profile } = useAuth()
  const toast = useToast()
  const [kind, setKind] = useState<CheckinKind>('morning')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const todayStr = new Date().toDateString()
  const today = useMemo(() => checkins.filter((c) => new Date(c.created_at).toDateString() === todayStr), [checkins, todayStr])
  // group by user → { morning, update }
  const byUser = useMemo(() => {
    const m = new Map<string, { morning?: Checkin; update?: Checkin; latest: string }>()
    for (const c of today) {
      const cur = m.get(c.user_id) ?? { latest: c.created_at }
      if (c.kind === 'morning' && (!cur.morning || c.created_at > cur.morning.created_at)) cur.morning = c
      if (c.kind === 'update' && (!cur.update || c.created_at > cur.update.created_at)) cur.update = c
      if (c.created_at > cur.latest) cur.latest = c.created_at
      m.set(c.user_id, cur)
    }
    return [...m.entries()].sort((a, b) => (a[1].latest < b[1].latest ? 1 : -1))
  }, [today])

  const post = async () => {
    if (!text.trim() || !profile) return
    setBusy(true)
    const { error } = await supabase.from('checkins').insert({ user_id: profile.id, kind, body: text.trim() })
    setBusy(false)
    if (error) return toast(error.message, 'err')
    setText(''); await refetchTeam(); toast(kind === 'morning' ? 'Morning goal posted' : 'Update posted')
  }

  const hour = new Date().getHours()
  // suggest the relevant kind by time of day
  useEffect(() => { setKind(hour < 12 ? 'morning' : 'update') }, []) // eslint-disable-line

  return (
    <div className="card stagger p-5" style={{ ['--i' as any]: 1 }}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Sun size={16} className="text-orange" /> Team today</h2>
        <span className="text-2xs text-subtle">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
      </div>

      {/* composer */}
      <div className="mt-3 rounded-xl border border-line bg-paper/60 p-3">
        <div className="mb-2 inline-flex rounded-lg bg-black/[0.04] p-0.5">
          <button onClick={() => setKind('morning')} className={cx('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition', kind === 'morning' ? 'bg-surface text-orange-dark shadow-card' : 'text-muted')}><Sun size={13} /> Morning goal</button>
          <button onClick={() => setKind('update')} className={cx('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition', kind === 'update' ? 'bg-surface text-brand-dark shadow-card' : 'text-muted')}><Sunset size={13} /> Day update</button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="field flex-1" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && post()} placeholder={kind === 'morning' ? 'What are you focusing on today?' : 'What did you get done / where are you at?'} />
          <button className="btn-primary" onClick={post} disabled={busy || !text.trim()}>{busy ? <Spinner className="h-4 w-4" /> : 'Post'}</button>
        </div>
      </div>

      {/* feed */}
      <div className="mt-4 space-y-3">
        {byUser.length === 0 ? (
          <p className="text-sm text-subtle">No check-ins yet today. Be the first to share your morning goal.</p>
        ) : (
          byUser.map(([uid, v]) => (
            <div key={uid} className="flex gap-2.5">
              <OwnerAvatar name={personName(people, uid)} size={30} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink">{personName(people, uid)}{uid === profile?.id && <span className="ml-1 text-2xs font-normal text-subtle">(you)</span>}</div>
                {v.morning && <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted"><Sun size={12} className="mt-1 shrink-0 text-orange" /> <span className="flex-1">{v.morning.body}</span> <span className="data shrink-0 text-2xs text-subtle">{fmtTime(v.morning.created_at)}</span></p>}
                {v.update && <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted"><Sunset size={12} className="mt-1 shrink-0 text-brand" /> <span className="flex-1">{v.update.body}</span> <span className="data shrink-0 text-2xs text-subtle">{fmtTime(v.update.created_at)}</span></p>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/* ===================== Suggested comparisons (auto-detected sets) ===================== */
function SuggestedPlots({ openExp }: { openExp: (e: FullExperiment) => void }) {
  const { experiments } = useData()
  const nav = useNavigate()
  const sets = useMemo(() => detectSets(experiments, { minSize: 2, max: 5 }).filter((s) => s.withResults >= 1), [experiments])

  return (
    <div className="card stagger p-5" style={{ ['--i' as any]: 2 }}>
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-brand" /> Suggested comparisons</h2>
      <p className="mt-1 text-xs text-muted">Experiment sets logged together — plot them in one click.</p>
      <div className="mt-3 space-y-2">
        {sets.length === 0 ? (
          <p className="text-sm text-subtle">Log a few experiments on the same day and they’ll show up here, ready to compare.</p>
        ) : (
          sets.map((s) => {
            const enLabel = s.ens.length > 3 ? `EN${s.ens[0]}–EN${s.ens[s.ens.length - 1]}` : s.ens.map((n) => `EN${n}`).join(', ')
            return (
              <div key={s.key} className="flex items-center gap-3 rounded-xl border border-line bg-paper/60 px-3 py-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-tint text-brand-dark"><BarChart3 size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{enLabel}</div>
                  <div className="text-2xs text-muted">{s.owner} · {fmtDate(s.date)} · {s.ids.length} samples{s.project ? ` · ${projectShort(s.project)}` : ''}</div>
                </div>
                <button className="btn-soft-teal h-8 px-3 text-xs" onClick={() => nav('/graphs', { state: { compareIds: s.ids } })}>Plot</button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
