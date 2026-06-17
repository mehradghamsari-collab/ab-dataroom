import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, User, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabaseConfigured } from '../lib/supabase'
import { Spinner } from '../components/ui'

function BrandPanel() {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-ink px-10 py-12 text-white lg:flex">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />
      <div className="relative flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand">
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <path d="M16 5c3.8 4.7 6.4 8.1 6.4 11.4a6.4 6.4 0 1 1-12.8 0C9.6 13.1 12.2 9.7 16 5z" fill="#fff" />
          </svg>
        </span>
        <div className="text-sm font-semibold tracking-tight">AB Smart Materials</div>
      </div>

      <div className="relative">
        <p className="text-2xs font-semibold uppercase tracking-[0.25em] text-brand-ring">Research dataroom</p>
        <h1 className="mt-3 max-w-md text-3xl font-semibold leading-tight tracking-tight">
          Every experiment, every result — one shared record.
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">
          Log syntheses and processing runs, capture absorbency results, and plot comparisons across the whole team in
          real time.
        </p>
      </div>

      <div className="relative grid grid-cols-3 gap-3 text-center">
        {[
          ['522', 'experiments'],
          ['75', 'chemicals'],
          ['4', 'researchers'],
        ].map(([n, l]) => (
          <div key={l} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-3">
            <div className="data text-xl font-semibold text-brand-ring">{n}</div>
            <div className="mt-0.5 text-2xs uppercase tracking-wider text-white/50">{l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Login() {
  const { signIn, signUp } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (mode === 'in') {
        const { error } = await signIn(email, password)
        if (error) setError(error)
        else nav('/experiments')
      } else {
        const { error, needsConfirm } = await signUp(email, password, fullName)
        if (error) setError(error)
        else if (needsConfirm) setNotice('Check your inbox to confirm your email, then sign in.')
        else nav('/experiments')
      }
    } finally {
      setBusy(false)
    }
  }

  if (!supabaseConfigured) {
    return (
      <div className="grid min-h-full place-items-center p-6">
        <div className="card max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold">Connect your database</h1>
          <p className="mt-2 text-sm text-muted">
            This app needs its Supabase keys before it can run. Add{' '}
            <code className="data rounded bg-paper px-1 py-0.5 text-xs">VITE_SUPABASE_URL</code> and{' '}
            <code className="data rounded bg-paper px-1 py-0.5 text-xs">VITE_SUPABASE_ANON_KEY</code> to your
            environment, then reload. See the README for step-by-step setup.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-full grid-cols-1 lg:grid-cols-2">
      <BrandPanel />
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-7 lg:hidden">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
                <svg width="17" height="17" viewBox="0 0 32 32" fill="none">
                  <path d="M16 5c3.8 4.7 6.4 8.1 6.4 11.4a6.4 6.4 0 1 1-12.8 0C9.6 13.1 12.2 9.7 16 5z" fill="#fff" />
                </svg>
              </span>
              <div className="text-sm font-semibold">AB Smart Materials</div>
            </div>
          </div>

          <h2 className="text-xl font-semibold tracking-tight">
            {mode === 'in' ? 'Sign in to the dataroom' : 'Request access'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {mode === 'in'
              ? 'Use your AB Smart Materials account.'
              : 'Create your account — an admin approves access before you can view data.'}
          </p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-3.5">
            {mode === 'up' && (
              <div>
                <label className="label">Full name</label>
                <div className="relative">
                  <User size={16} className="pointer-events-none absolute left-3 top-2.5 text-subtle" />
                  <input
                    className="field pl-9"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Researcher"
                    required
                  />
                </div>
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-2.5 text-subtle" />
                <input
                  type="email"
                  className="field pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@absmartmaterials.com"
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3 top-2.5 text-subtle" />
                <input
                  type="password"
                  className="field pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
            </div>

            {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}
            {notice && <div className="rounded-lg bg-brand-tint px-3 py-2 text-sm text-brand-dark">{notice}</div>}

            <button type="submit" className="btn-primary mt-1 w-full" disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : <>{mode === 'in' ? 'Sign in' : 'Create account'}<ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            {mode === 'in' ? "Don't have an account? " : 'Already have access? '}
            <button
              className="font-medium text-brand-dark hover:underline"
              onClick={() => {
                setMode((m) => (m === 'in' ? 'up' : 'in'))
                setError('')
                setNotice('')
              }}
            >
              {mode === 'in' ? 'Request access' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
