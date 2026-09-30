import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from './ui'
import { useAuth } from '../auth'
import { useFetch, useRealtime, subscribeRole, configError } from '../api'
import { playPing } from '../sound'
import { initPush } from '../push'
import { paths } from '../endpoints'

const NAV = [
  { section: 'Overview', items: [
    { to: '/dashboard', label: 'Dashboard', icon: 'dashboard', cap: undefined as string | undefined },
  ]},
  { section: 'Management', items: [
    { to: '/patients', label: 'Patients', icon: 'patients', cap: 'admin.patients' as string | undefined },
    { to: '/staff', label: 'Staff & Roles', icon: 'doctor', cap: 'admin.staff' as string | undefined },
    { to: '/audit', label: 'Audit Log', icon: 'shield', cap: 'admin.audit' as string | undefined },
  ]},
  { section: 'Insights', items: [
    { to: '/reports', label: 'Reports', icon: 'report', cap: 'admin.reports' as string | undefined },
    { to: '/settings', label: 'Settings', icon: 'settings', cap: 'admin.settings' as string | undefined },
  ]},
]

/** True when the signed-in account may open a page. Accounts without an
 *  explicit caps grant (full admins) see everything. */
export function hasPageCap(user: { caps?: string[] }, cap?: string): boolean {
  return !cap || !user.caps?.length ? true : user.caps.includes(cap)
}

interface PresenceUser { id: string; name: string; role: string; app: string; since: string }

export function Layout({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 900)
  const [showOnline, setShowOnline] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const loc = useLocation()
  const nav = useNavigate()
  const { user, logout } = useAuth()
  const initials = user?.name ? user.name.split(' ').slice(0, 2).map((w) => w[0]).join('') : ''
  /* Live presence — who has the app open right now (403 simply shows nothing
     for scoped admins without the staff capability). */
  const { data: onlineUsers = [], refetch: refetchPresence } = useFetch<PresenceUser[]>(paths.adminPresence)

  /* Admins listen in on activity across the whole hospital, live. Incoming
     notifications arrive as toast pop-ups (and Web Push when the tab is
     closed) — there is no notification dropdown panel by design. */
  useRealtime((evt, payload) => {
    if (evt === 'notification') {
      const n = payload as { text?: string } | undefined
      if (n?.text) { playPing(); setToast(n.text); setTimeout(() => setToast(null), 6000) }
    }
    if (evt === 'presence') refetchPresence()
  }, ['notification', 'activity.new', 'permissions.changed', 'staff.updated', 'presence'], user.role)

  React.useEffect(() => { subscribeRole(user.role) }, [user.role])

  /* Register this browser for Web Push so alerts (with OS sound) still arrive
     when the tab is closed — role is taken from the session server-side. */
  React.useEffect(() => { void initPush() }, [])

  /* Keep the sidebar open on desktop; only auto-close the drawer on mobile. */
  React.useEffect(() => {
    const onResize = () => { if (window.innerWidth > 900) setOpen(true) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const closeIfMobile = () => { if (window.innerWidth <= 900) setOpen(false) }

  return (
    <div className="shell">
      {configError && (
        <div className="live-toast" style={{ background: 'var(--red-600)' }}>
          <Icon name="shield" size={16} />
          <div><b>Backend not configured</b><div className="t">{configError}. Set VITE_API_URL for this deployment and rebuild.</div></div>
        </div>
      )}
      {toast && (
        <div className="live-toast">
          <Icon name="bell" size={16} />
          <div><b>Live hospital activity</b><div className="t">{toast}</div></div>
        </div>
      )}
      <div className={`backdrop ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? '' : 'collapsed'}`}>
        <div className="brand">
          <img src="/logo.png" alt="Kebbi Clinic" />
          <div>
            <div className="name">Kebbi Clinic</div>
            <div className="sub">Administrator App</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((s) => {
            const items = s.items.filter((it) => hasPageCap(user, it.cap))
            if (!items.length) return null
            return (
              <div key={s.section}>
                <div className="section">{s.section}</div>
                {items.map((it) => (
                  <Link key={it.to} to={it.to} className={loc.pathname === it.to ? 'active' : ''} onClick={closeIfMobile}>
                    <Icon name={it.icon} /> {it.label}
                  </Link>
                ))}
              </div>
            )
          })}
        </nav>
        <div className="user-box">
          <div className="avatar" style={{ background: 'var(--blue-500)' }}>{initials}</div>
          <div className="who">
            <div className="n">{user.name}</div>
            <div className="r">{user.role}</div>
          </div>
          <button title="Log out" onClick={() => { logout(); nav('/login') }} style={{ marginLeft: 'auto', color: '#9dc3ea', background: 'none', border: 'none', cursor: 'pointer' }}><Icon name="logout" /></button>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <button className="icon-btn hamburger" onClick={() => setOpen(!open)}><Icon name="menu" /></button>
          <div className="page-title">{title}</div>
          <div className="spacer" />
          <div style={{ position: 'relative' }}>
            <button className="online-pill" onClick={() => setShowOnline(!showOnline)} title="Staff online right now">
              <span className="live-dot" /> {onlineUsers.length} online
            </button>
            {showOnline && (
              <div className="dd-panel">
                <div className="n-panel-h">Staff online now <span className="muted">({onlineUsers.length})</span></div>
                {onlineUsers.length === 0 && <div className="n-item muted">Nobody is online right now.</div>}
                {onlineUsers.map((o) => (
                  <div className="n-item" key={o.id}>
                    <span className="live-dot" />
                    <div>{o.name}<div className="t">{o.role} · {o.app === 'admin' ? 'Admin console' : 'Hospital app'}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="avatar" style={{ background: 'var(--blue-700)' }}>{initials}</div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  )
}

