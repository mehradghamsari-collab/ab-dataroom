import { useMemo, useState } from 'react'
import { CalendarDays, Plus, ChevronLeft, ChevronRight, Check, X, Trash2, Plane, Stethoscope, Home, Clock3 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import type { LeaveRequest, LeaveType, Person } from '../lib/types'
import { Modal, Spinner, EmptyState, OwnerAvatar, useToast, useConfirm, FullLoader } from '../components/ui'
import { cx, fmtDate } from '../lib/utils'
import { isoDate, eachDate, fmtRange, countWeekdays, holidayWeekdaysUsed, personName } from '../lib/team'

const LEAVE: Record<LeaveType, { label: string; cls: string; dot: string; icon: any }> = {
  holiday: { label: 'Holiday', cls: 'bg-brand-tint text-brand-dark', dot: '#0E8A94', icon: Plane },
  remote: { label: 'Remote', cls: 'bg-[#ECEAFB] text-[#5A4BD0]', dot: '#6C5CE0', icon: Home },
  sick: { label: 'Sick', cls: 'bg-[#FDECEC] text-danger', dot: '#E5484D', icon: Stethoscope },
}
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function Calendar() {
  const { leaveRequests, people, loading, refetchTeam } = useData()
  const { profile, isAdmin } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d })
  const [requesting, setRequesting] = useState(false)
  const canApprove = isAdmin || !!profile?.is_manager
  const year = new Date().getFullYear()

  const approved = useMemo(() => leaveRequests.filter((r) => r.status === 'approved'), [leaveRequests])
  const pending = useMemo(() => leaveRequests.filter((r) => r.status === 'pending'), [leaveRequests])
  const myPending = pending.filter((r) => r.user_id === profile?.id)
  const pendingForManager = canApprove ? pending : myPending

  // approved leave indexed by day
  const byDay = useMemo(() => {
    const map = new Map<string, { r: LeaveRequest }[]>()
    approved.forEach((r) => eachDate(r.start_date, r.end_date).forEach((iso) => { if (!map.has(iso)) map.set(iso, []); map.get(iso)!.push({ r }) }))
    return map
  }, [approved])

  // month grid
  const cells = useMemo(() => {
    const first = new Date(cursor)
    const lead = (first.getDay() + 6) % 7
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
    const arr: (Date | null)[] = []
    for (let i = 0; i < lead; i++) arr.push(null)
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(cursor.getFullYear(), cursor.getMonth(), d))
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [cursor])

  const decide = async (r: LeaveRequest, status: 'approved' | 'declined') => {
    const { error } = await supabase.from('leave_requests').update({ status, decided_by: profile?.id ?? null, decided_at: new Date().toISOString() }).eq('id', r.id)
    if (error) return toast(error.message, 'err')
    await refetchTeam(); toast(status === 'approved' ? 'Approved' : 'Declined')
  }
  const cancel = async (r: LeaveRequest) => {
    if (!(await confirm({ title: 'Cancel this request?', message: 'It will be removed from the calendar.', confirmLabel: 'Cancel request', danger: true }))) return
    await supabase.from('leave_requests').delete().eq('id', r.id)
    await refetchTeam(); toast('Removed')
  }

  if (loading) return <FullLoader label="Loading" />
  const monthLabel = cursor.toLocaleDateString([], { month: 'long', year: 'numeric' })
  const todayISO = isoDate(new Date())

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3 animate-fadeUp">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><CalendarDays size={20} className="text-brand" /> Team calendar</h1>
          <p className="mt-1 text-sm text-muted">Request holiday, remote days, or sick leave. {canApprove ? 'Approve requests for the team.' : 'Ben or Amaury will approve it.'}</p>
        </div>
        <button className="btn-primary" onClick={() => setRequesting(true)}><Plus size={16} /> Request time off</button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        {/* calendar */}
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button className="btn-ghost h-8 w-8 p-0" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft size={17} /></button>
              <span className="min-w-[150px] text-center text-sm font-semibold">{monthLabel}</span>
              <button className="btn-ghost h-8 w-8 p-0" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight size={17} /></button>
            </div>
            <button className="btn-ghost h-8 text-xs text-muted" onClick={() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); setCursor(d) }}>Today</button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-1">
            {WD.map((d) => <div key={d} className="py-1 text-center text-2xs font-semibold uppercase tracking-wide text-subtle">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="min-h-[64px] rounded-lg bg-paper/40" />
              const iso = isoDate(d)
              const items = byDay.get(iso) ?? []
              const isToday = iso === todayISO
              const isWeekend = d.getDay() === 0 || d.getDay() === 6
              return (
                <div key={i} className={cx('min-h-[64px] rounded-lg border p-1.5', isToday ? 'border-brand bg-brand-tint/30' : isWeekend ? 'border-line/60 bg-paper/40' : 'border-line bg-surface')}>
                  <div className={cx('data text-2xs font-semibold', isToday ? 'text-brand-dark' : 'text-subtle')}>{d.getDate()}</div>
                  <div className="mt-1 space-y-0.5">
                    {items.slice(0, 3).map(({ r }, k) => (
                      <div key={k} className={cx('truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight', LEAVE[r.type].cls)} title={`${personName(people, r.user_id)} · ${LEAVE[r.type].label}`}>
                        {personName(people, r.user_id).split(' ')[0]}
                      </div>
                    ))}
                    {items.length > 3 && <div className="px-1 text-[10px] text-subtle">+{items.length - 3}</div>}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {(Object.keys(LEAVE) as LeaveType[]).map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-xs text-muted"><span className="h-2.5 w-2.5 rounded-full" style={{ background: LEAVE[t].dot }} /> {LEAVE[t].label}</span>
            ))}
          </div>
        </div>

        {/* side: pending + usage */}
        <div className="space-y-4">
          <div className="card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Clock3 size={15} className="text-brand" /> {canApprove ? 'Pending approvals' : 'My requests'}</div>
            {pendingForManager.length === 0 ? (
              <p className="text-sm text-subtle">Nothing pending.</p>
            ) : (
              <div className="space-y-2">
                {pendingForManager.map((r) => (
                  <div key={r.id} className="rounded-lg border border-line bg-paper px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <OwnerAvatar name={personName(people, r.user_id)} size={24} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink">{personName(people, r.user_id)}</div>
                        <div className="text-2xs text-muted"><span className={cx('mr-1 rounded px-1.5 py-0.5 font-medium', LEAVE[r.type].cls)}>{LEAVE[r.type].label}</span>{fmtRange(r.start_date, r.end_date)} · {countWeekdays(r.start_date, r.end_date)}d</div>
                      </div>
                    </div>
                    {r.note && <p className="mt-1.5 text-xs text-muted">{r.note}</p>}
                    <div className="mt-2 flex gap-1.5">
                      {canApprove && <>
                        <button className="btn-soft-teal h-7 flex-1 text-xs" onClick={() => decide(r, 'approved')}><Check size={13} /> Approve</button>
                        <button className="btn-ghost h-7 flex-1 text-xs text-danger" onClick={() => decide(r, 'declined')}><X size={13} /> Decline</button>
                      </>}
                      {r.user_id === profile?.id && <button className="btn-ghost h-7 text-xs text-muted" onClick={() => cancel(r)}><Trash2 size={13} /></button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Plane size={15} className="text-brand" /> Holiday used · {year}</div>
            <div className="space-y-1.5">
              {people.length === 0 && <p className="text-sm text-subtle">No team members yet.</p>}
              {people.map((p) => {
                const used = holidayWeekdaysUsed(leaveRequests, p.id, year)
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 truncate text-sm text-ink"><OwnerAvatar name={p.full_name || p.email} size={22} /> <span className="truncate">{p.full_name || p.email.split('@')[0]}</span></span>
                    <span className="data text-sm font-semibold text-muted">{used} <span className="text-2xs font-normal text-subtle">days</span></span>
                  </div>
                )
              })}
            </div>
            <p className="mt-2 text-2xs text-subtle">Counts approved holiday weekdays this year.</p>
          </div>
        </div>
      </div>

      {requesting && <RequestModal people={people} onClose={() => setRequesting(false)} onSaved={() => { setRequesting(false); toast('Request submitted') }} />}
    </div>
  )
}

function RequestModal({ people, onClose, onSaved }: { people: Person[]; onClose: () => void; onSaved: () => void }) {
  const { profile, isAdmin } = useAuth()
  const { refetchTeam } = useData()
  const toast = useToast()
  const canApprove = isAdmin || !!profile?.is_manager
  const [type, setType] = useState<LeaveType>('holiday')
  const [start, setStart] = useState(isoDate(new Date()))
  const [end, setEnd] = useState(isoDate(new Date()))
  const [note, setNote] = useState('')
  const [forUser, setForUser] = useState(profile?.id ?? '')
  const [busy, setBusy] = useState(false)

  const days = end >= start ? countWeekdays(start, end) : 0
  const save = async () => {
    if (end < start) return toast('End date is before the start date', 'err')
    setBusy(true)
    // managers logging their own/team leave can have it auto-approved
    const selfManaged = canApprove && forUser === profile?.id
    const { error } = await supabase.from('leave_requests').insert({
      user_id: forUser || profile?.id, type, start_date: start, end_date: end, note: note || null,
      status: selfManaged ? 'approved' : 'pending',
      decided_by: selfManaged ? profile?.id : null, decided_at: selfManaged ? new Date().toISOString() : null,
    })
    if (error) { toast(error.message, 'err'); setBusy(false); return }
    await refetchTeam(); onSaved()
  }

  return (
    <Modal open onClose={onClose} title="Request time off" footer={<>
      <button className="btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn-primary" onClick={save} disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Submit'}</button>
    </>}>
      <div className="space-y-4">
        <div>
          <label className="label">Type</label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(LEAVE) as LeaveType[]).map((t) => {
              const Ico = LEAVE[t].icon
              return <button key={t} type="button" onClick={() => setType(t)} className={cx('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition', type === t ? LEAVE[t].cls + ' border-transparent ring-2 ring-offset-1 ring-current' : 'border-line bg-paper text-muted hover:bg-black/[0.03]')}><Ico size={13} /> {LEAVE[t].label}</button>
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">From</label><input className="field data" type="date" value={start} onChange={(e) => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value) }} /></div>
          <div><label className="label">To</label><input className="field data" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        {canApprove && (
          <div><label className="label">On behalf of</label>
            <select className="field cursor-pointer" value={forUser} onChange={(e) => setForUser(e.target.value)}>
              {people.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}{p.id === profile?.id ? ' (you)' : ''}</option>)}
            </select>
          </div>
        )}
        <div><label className="label">Note <span className="font-normal text-subtle">· optional</span></label><input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. annual leave" /></div>
        <div className="rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-muted">
          {days > 0 ? <><span className="font-semibold text-ink">{days}</span> working day{days === 1 ? '' : 's'} · {fmtRange(start, end)}</> : 'Pick a valid date range.'}
          {canApprove && forUser === profile?.id && <span className="ml-1 text-2xs text-positive"> · auto-approved (manager)</span>}
        </div>
      </div>
    </Modal>
  )
}
