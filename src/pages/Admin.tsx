import { useEffect, useState, useCallback } from 'react'
import { Check, Shield, ShieldCheck, UserCheck, Mail, Trash2, Plus, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Profile } from '../lib/types'
import { OwnerAvatar, Spinner, useToast, useConfirm, FullLoader } from '../components/ui'
import { cx, fmtDate } from '../lib/utils'

interface AllowedEmail { email: string; created_at: string }

export function Admin() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [allowed, setAllowed] = useState<AllowedEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    const [{ data: p }, { data: a }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('allowed_emails').select('*').order('created_at', { ascending: false }),
    ])
    setProfiles((p as Profile[]) ?? [])
    setAllowed((a as AllowedEmail[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const patch = async (id: string, fields: Partial<Profile>, msg: string) => {
    const { error } = await supabase.from('profiles').update(fields).eq('id', id)
    if (error) toast(error.message, 'err')
    else { await load(); toast(msg) }
  }

  const addEmail = async () => {
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    setAdding(true)
    const { error } = await supabase.from('allowed_emails').insert({ email, added_by: me?.id ?? null })
    setAdding(false)
    if (error) toast(error.message.includes('duplicate') ? 'Already on the list' : error.message, 'err')
    else { setNewEmail(''); await load(); toast('Email pre-authorized') }
  }
  const removeEmail = async (email: string) => {
    const { error } = await supabase.from('allowed_emails').delete().eq('email', email)
    if (error) toast(error.message, 'err')
    else { await load(); toast('Removed') }
  }

  if (loading) return <FullLoader label="Loading team" />

  const pending = profiles.filter((p) => p.status === 'pending')
  const members = profiles.filter((p) => p.status === 'approved')

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Team & access</h1>
      <p className="mt-1 text-sm text-muted">Approve who can see the dataroom and manage admin rights.</p>

      {/* Pending */}
      {pending.length > 0 && (
        <section className="mt-6">
          <SectionHead icon={<Clock size={15} />} title={`Awaiting approval · ${pending.length}`} />
          <div className="space-y-2">
            {pending.map((p) => (
              <div key={p.id} className="card flex items-center justify-between gap-3 p-3">
                <PersonCell p={p} />
                <button className="btn-primary h-9" onClick={() => patch(p.id, { status: 'approved' }, `${p.full_name || p.email} approved`)}>
                  <UserCheck size={15} /> Approve
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Members */}
      <section className="mt-6">
        <SectionHead icon={<ShieldCheck size={15} />} title={`Members · ${members.length}`} />
        <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          {members.map((p) => {
            const isMe = p.id === me?.id
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
                <PersonCell p={p} isMe={isMe} />
                <div className="flex items-center gap-2">
                  <span className={cx('pill', p.role === 'admin' ? 'bg-brand-tint text-brand-dark' : 'bg-black/[0.05] text-muted')}>
                    {p.role === 'admin' ? <><Shield size={11} className="mr-1" />admin</> : 'member'}
                  </span>
                  {!isMe && (
                    <select
                      className="field h-9 w-auto cursor-pointer py-1 text-xs"
                      value={p.role}
                      onChange={(e) => patch(p.id, { role: e.target.value as Profile['role'] }, 'Role updated')}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                  {!isMe && (
                    <button
                      className="btn-ghost h-9 text-xs text-muted hover:text-danger"
                      onClick={async () => {
                        if (await confirm({ title: `Revoke access for ${p.full_name || p.email}?`, message: 'They will need approval again to sign back in.', confirmLabel: 'Revoke', danger: true }))
                          patch(p.id, { status: 'pending' }, 'Access revoked')
                      }}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Allow-list */}
      <section className="mt-6">
        <SectionHead icon={<Mail size={15} />} title="Pre-authorized emails" />
        <p className="-mt-2 mb-3 text-sm text-muted">Add a teammate's email here and they're approved automatically the moment they sign up — no manual approval needed.</p>
        <div className="flex gap-2">
          <input
            type="email"
            className="field"
            placeholder="teammate@absmartmaterials.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEmail()}
          />
          <button className="btn-primary shrink-0" onClick={addEmail} disabled={adding || !newEmail.trim()}>{adding ? <Spinner className="h-4 w-4" /> : <><Plus size={16} /> Add</>}</button>
        </div>
        {allowed.length > 0 && (
          <div className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            {allowed.map((a) => (
              <div key={a.email} className="group flex items-center justify-between px-4 py-2.5 hover:bg-paper">
                <span className="data text-sm text-ink">{a.email}</span>
                <button className="btn-ghost h-8 w-8 p-0 text-subtle opacity-0 transition hover:text-danger group-hover:opacity-100" onClick={() => removeEmail(a.email)} aria-label="Remove">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function SectionHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-brand">{icon}</span>
      <h2 className="text-sm font-semibold">{title}</h2>
    </div>
  )
}
function PersonCell({ p, isMe }: { p: Profile; isMe?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <OwnerAvatar name={p.full_name || p.email} size={34} />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-ink">
          {p.full_name || p.email.split('@')[0]} {isMe && <span className="text-2xs font-normal text-subtle">(you)</span>}
        </div>
        <div className="data truncate text-xs text-subtle">{p.title ? <span className="not-italic">{p.title} · </span> : ''}{p.email}</div>
      </div>
    </div>
  )
}
