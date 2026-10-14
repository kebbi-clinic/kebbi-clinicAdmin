import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UNAUTH_EVENT, useOnline } from '../api'
import { useAuth } from '../auth'
import { Icon } from './ui'

/* Global session enforcement: when any API call comes back 401 (expired token,
 * account deactivated), clear the local session and bounce to the login screen
 * with a "session expired" notice — instead of leaving a broken screen. */
export function useAuthRedirect() {
  const { logout } = useAuth()
  const nav = useNavigate()
  useEffect(() => {
    const onUnauth = () => {
      logout()
      nav('/login?expired=1', { replace: true })
    }
    window.addEventListener(UNAUTH_EVENT, onUnauth)
    return () => window.removeEventListener(UNAUTH_EVENT, onUnauth)
  }, [logout, nav])
}

/* Persistent "no internet" banner, shown on every screen (including the login
 * page) while the browser is offline, with a Retry button that re-checks. */
export function OfflineBanner() {
  const online = useOnline()
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => { if (online) setDismissed(false) }, [online])
  if (online || dismissed) return null
  return (
    <div className="offline-banner" role="alert">
      <Icon name="warn" size={18} />
      <div>
        <b>No internet connection</b>
        <div className="t">Check your network — this screen can&apos;t reach the server right now.</div>
      </div>
      <button className="btn ghost sm offline-retry" onClick={() => window.location.reload()}>Retry</button>
      <button className="x" aria-label="Dismiss" onClick={() => setDismissed(true)}>×</button>
    </div>
  )
}

/* Full-screen takeover shown when the browser is offline from app start (or
 * loses its connection while idle): no half-rendered pages, just a clear
 * "no internet" state with a retry action. */
export function OfflineScreen() {
  const online = useOnline()
  if (online) return null
  return (
    <div className="offline-screen" role="alert">
      <div className="offline-card">
        <div className="offline-ic"><Icon name="warn" size={40} /></div>
        <h1>No internet connection</h1>
        <div className="sub">Check your network connection and try again. Nothing was lost — your session is still here.</div>
        <button className="btn primary" onClick={() => window.location.reload()}>Retry connection</button>
        <Link to="/login" className="btn ghost">Go to Login</Link>
      </div>
    </div>
  )
}

/* Renders inside the Router. The banner + auth listener live above everything
 * so they are active on every route, including the 404 page. */
export function SystemChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OfflineBanner />
      <AuthListener />
      {children}
    </>
  )
}

function AuthListener() {
  useAuthRedirect()
  return null
}

/* 404 — unknown URL inside the app. Offers the safe ways back instead of a
 * blank screen, and keeps the offline banner visible on top. */
export function NotFound({ home = '/dashboard' }: { home?: string }) {
  return (
    <div className="notfound-page">
      <div className="notfound-card">
        <div className="notfound-code">404</div>
        <h1>Page not found</h1>
        <div className="sub">The page you are looking for does not exist or was moved.</div>
        <div className="notfound-actions">
          <Link to={home} className="btn primary">Go to Dashboard</Link>
          <Link to="/login" className="btn ghost">Go to Login</Link>
        </div>
      </div>
    </div>
  )
}