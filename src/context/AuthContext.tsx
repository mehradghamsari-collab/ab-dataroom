import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { PASSWORDLESS } from '../config'

// Deterministic per-email password used only in passwordless mode, so the user
// never types or sees a password. This is a convenience, not strong security.
function derivePassword(email: string): string {
  const s = email.trim().toLowerCase() + '::ab-smart-materials::pwless::v1'
  const fnv = (str: string, seed: number) => {
    let h = seed >>> 0
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return (h >>> 0).toString(36)
  }
  return `Ab1!${fnv(s, 0x811c9dc5)}${fnv(s + '|x', 0x12345678)}`
}

interface AuthValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  isApproved: boolean
  passwordless: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string; needsConfirm?: boolean }>
  enterWithEmail: (email: string, fullName?: string) => Promise<{ error?: string; needsConfirm?: boolean }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const Ctx = createContext<AuthValue>(null as unknown as AuthValue)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile((data as Profile) ?? null)
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, sess) => {
      setSession(sess)
      if (sess) await loadProfile(sess.user.id)
      else setProfile(null)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn: AuthValue['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    return { error: error?.message }
  }

  const signUp: AuthValue['signUp'] = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    })
    if (error) return { error: error.message }
    return { needsConfirm: !data.session }
  }

  // Email-only entry: try to sign in with the derived password; if no account
  // exists yet, create one. New accounts land "pending" until an admin approves.
  const enterWithEmail: AuthValue['enterWithEmail'] = async (email, fullName) => {
    const addr = email.trim()
    const pw = derivePassword(addr)
    const { error: inErr } = await supabase.auth.signInWithPassword({ email: addr, password: pw })
    if (!inErr) return {}
    const msg = inErr.message.toLowerCase()
    if (msg.includes('not confirmed') || msg.includes('confirm')) return { needsConfirm: true }
    if (msg.includes('invalid') || msg.includes('credentials')) {
      const { data, error: upErr } = await supabase.auth.signUp({
        email: addr,
        password: pw,
        options: { data: { full_name: fullName?.trim() || undefined } },
      })
      if (upErr) {
        if (upErr.message.toLowerCase().includes('already'))
          return { error: 'This email already has a password set. Ask an admin to reset it, or turn passwordless mode off.' }
        return { error: upErr.message }
      }
      if (!data.session) return { needsConfirm: true }
      return {}
    }
    return { error: inErr.message }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  const value: AuthValue = {
    session,
    profile,
    loading,
    isAdmin: profile?.role === 'admin' && profile?.status === 'approved',
    isApproved: profile?.status === 'approved',
    passwordless: PASSWORDLESS,
    signIn,
    signUp,
    enterWithEmail,
    signOut,
    refreshProfile: async () => session && loadProfile(session.user.id),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
