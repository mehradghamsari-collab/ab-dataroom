import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { FlaskConical, LineChart, Library as LibraryIcon, ShieldCheck, Menu, X, LogOut, LayoutDashboard, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { OwnerAvatar } from './ui'
import { cx } from '../lib/utils'

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/logo-mark.png" alt="A&B Smart Materials" className="h-9 w-9 rounded-lg" />
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight text-white">A&amp;B Smart Materials</div>
        <div className="text-2xs font-medium uppercase tracking-[0.22em] text-brand-bright">Dataroom</div>
      </div>
    </div>
  )
}

const NAV = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/experiments', label: 'Experiments', icon: FlaskConical },
  { to: '/graphs', label: 'Plot & analyse', icon: LineChart },
  { to: '/library', label: 'Library', icon: LibraryIcon },
  { to: '/reports', label: 'AI reports', icon: Sparkles },
]

function NavItems({ onNavigate, isAdmin }: { onNavigate?: () => void; isAdmin: boolean }) {
  const items = isAdmin ? [...NAV, { to: '/admin', label: 'Team & access', icon: ShieldCheck }] : NAV
  return (
    <nav className="flex flex-col gap-1">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-white/[0.12] text-white'
                : 'text-white/60 hover:bg-white/[0.07] hover:text-white',
            )
          }
        >
          {({ isActive }) => (
            <>
              <it.icon size={18} strokeWidth={2} className={isActive ? 'text-brand-bright' : ''} />
              {it.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export function Layout() {
  const { profile, isAdmin, signOut } = useAuth()
  const [drawer, setDrawer] = useState(false)
  const nav = useNavigate()

  const UserCard = (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <OwnerAvatar name={profile?.full_name || profile?.email || '?'} size={30} />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-medium text-white">{profile?.full_name || profile?.email}</div>
          <div className="truncate text-2xs text-white/45">{profile?.title || (profile?.role === 'admin' ? 'Admin' : 'Member')}</div>
        </div>
      </div>
      <button
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-white"
        title="Sign out"
        onClick={async () => {
          await signOut()
          nav('/login')
        }}
      >
        <LogOut size={17} />
      </button>
    </div>
  )

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-navy px-3 py-4 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <div className="mt-7 px-1">
          <NavItems isAdmin={isAdmin} />
        </div>
        <div className="mt-auto px-1">{UserCard}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between bg-navy px-4 py-3 lg:hidden">
          <Logo />
          <button className="grid h-9 w-9 place-items-center rounded-lg text-white/80 hover:bg-white/10" onClick={() => setDrawer(true)} aria-label="Menu">
            <Menu size={20} />
          </button>
        </header>

        {/* Mobile drawer */}
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-ink/45" onClick={() => setDrawer(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[82vw] flex-col bg-navy px-3 py-4 shadow-pop">
              <div className="flex items-center justify-between px-2">
                <Logo />
                <button className="grid h-8 w-8 place-items-center rounded-lg text-white/70 hover:bg-white/10" onClick={() => setDrawer(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="mt-6 px-1">
                <NavItems isAdmin={isAdmin} onNavigate={() => setDrawer(false)} />
              </div>
              <div className="mt-auto px-1">{UserCard}</div>
            </div>
          </div>
        )}

        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
