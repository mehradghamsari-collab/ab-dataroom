import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { FlaskConical, LineChart, Library as LibraryIcon, ShieldCheck, Menu, X, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { OwnerAvatar } from './ui'
import { cx } from '../lib/utils'

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
        <svg width="17" height="17" viewBox="0 0 32 32" fill="none">
          <path
            d="M16 5c3.8 4.7 6.4 8.1 6.4 11.4a6.4 6.4 0 1 1-12.8 0C9.6 13.1 12.2 9.7 16 5z"
            fill="currentColor"
            opacity="0.95"
          />
        </svg>
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight">AB Smart Materials</div>
        <div className="text-2xs font-medium uppercase tracking-widest text-subtle">Dataroom</div>
      </div>
    </div>
  )
}

const NAV = [
  { to: '/experiments', label: 'Experiments', icon: FlaskConical },
  { to: '/graphs', label: 'Graphs', icon: LineChart },
  { to: '/library', label: 'Library', icon: LibraryIcon },
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
              isActive ? 'bg-brand-tint text-brand-dark' : 'text-muted hover:bg-black/[0.04] hover:text-ink',
            )
          }
        >
          <it.icon size={18} strokeWidth={2} />
          {it.label}
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
    <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-paper px-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <OwnerAvatar name={profile?.full_name || profile?.email || '?'} size={30} />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-medium">{profile?.full_name || profile?.email}</div>
          <div className="truncate text-2xs capitalize text-subtle">{profile?.role}</div>
        </div>
      </div>
      <button
        className="btn-ghost h-8 w-8 p-0 text-muted"
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
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface px-3 py-4 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <div className="mt-7 px-1">
          <NavItems isAdmin={isAdmin} />
        </div>
        <div className="mt-auto px-1">{UserCard}</div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
          <Logo />
          <button className="btn-ghost h-9 w-9 p-0" onClick={() => setDrawer(true)} aria-label="Menu">
            <Menu size={20} />
          </button>
        </header>

        {/* Mobile drawer */}
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-ink/35" onClick={() => setDrawer(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[82vw] flex-col bg-surface px-3 py-4 shadow-pop">
              <div className="flex items-center justify-between px-2">
                <Logo />
                <button className="btn-ghost h-8 w-8 p-0" onClick={() => setDrawer(false)}>
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
