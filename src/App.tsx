import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Clock, LogOut } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { ToastProvider, ConfirmProvider, FullLoader, OwnerAvatar } from './components/ui'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Experiments } from './pages/Experiments'

const Graphs = lazy(() => import('./pages/Graphs').then((m) => ({ default: m.Graphs })))
const Library = lazy(() => import('./pages/Library').then((m) => ({ default: m.Library })))
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })))
const lazyEl = (node: React.ReactNode) => <Suspense fallback={<FullLoader />}>{node}</Suspense>

function PendingScreen() {
  const { profile, signOut } = useAuth()
  const nav = useNavigate()
  return (
    <div className="grid min-h-full place-items-center px-5 py-10">
      <div className="card max-w-md p-8 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-brand-tint text-brand-dark">
          <Clock size={22} />
        </div>
        <h1 className="text-lg font-semibold">Access pending</h1>
        <p className="mt-2 text-sm text-muted">
          Your account is set up and waiting for an admin to approve access to the dataroom. You'll be able to sign in
          as soon as that's done.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2.5 rounded-lg border border-line bg-paper px-3 py-2">
          <OwnerAvatar name={profile?.full_name || profile?.email || '?'} size={28} />
          <span className="data text-sm text-muted">{profile?.email}</span>
        </div>
        <button
          className="btn-ghost mt-5 text-muted"
          onClick={async () => {
            await signOut()
            nav('/login')
          }}
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading, isApproved } = useAuth()
  if (loading) return <FullLoader label="Starting up" />
  if (!session) return <Navigate to="/login" replace />
  if (!isApproved) return <PendingScreen />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/experiments" replace />
  return <>{children}</>
}

function Shell() {
  const { session, loading, isApproved } = useAuth()
  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? <FullLoader /> : session && isApproved ? <Navigate to="/experiments" replace /> : <Login />}
      />
      <Route
        element={
          <RequireAuth>
            <DataProvider>
              <Layout />
            </DataProvider>
          </RequireAuth>
        }
      >
        <Route path="/experiments" element={<Experiments />} />
        <Route path="/graphs" element={lazyEl(<Graphs />)} />
        <Route path="/library" element={lazyEl(<Library />)} />
        <Route path="/admin" element={lazyEl(<RequireAdmin><Admin /></RequireAdmin>)} />
      </Route>
      <Route path="*" element={<Navigate to="/experiments" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <Shell />
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
