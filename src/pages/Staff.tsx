import { useState } from 'react'
import { Layout } from '../components/Layout'
import { Card, PageHead, Badge, Modal, Field, Tabs } from '../components/ui'
import { useFetch, useRealtime } from '../api'
import { useAuth } from '../auth'
import { paths, permissionsApi, staffApi } from '../endpoints'
import { ROLES, ADMIN_ROLES } from '../data'

interface StaffAcc { id: string; firstName: string; surname: string; phone: string; email?: string; username: string; role: string; status: 'Active' | 'Inactive'; lastActive: string; mustChangePassword?: boolean; caps?: string[] }
interface Perms { caps: Record<string, string>; matrix: Record<string, { can: string[]; cannot: string[] }>; counts: Record<string, number> }
interface PresenceUser { id: string; name: string; role: string; app: string; since: string }

const CAP_ORDER = ['patients.register', 'visits.start', 'patients.status', 'patients.activate', 'patients.inactive.view', 'consultation', 'vitals', 'discharge', 'services.record', 'lab.result', 'rad.result', 'rx.dispense', 'inventory.manage', 'wallet.fund', 'staff.manage', 'staff.delete', 'services.manage', 'reports.view', 'settings.manage']

/** The admin-console pages an admin account can be scoped to when it is created. */
const ADMIN_PAGE_CAPS: { cap: string; label: string; desc: string }[] = [
  { cap: 'admin.patients', label: 'Patients', desc: 'View the patient register and full patient records' },
  { cap: 'admin.staff', label: 'Staff & Roles', desc: 'Create staff & admin accounts, edit roles, see who is online' },
  { cap: 'admin.audit', label: 'Audit Log', desc: 'Read the full audit trail' },
  { cap: 'admin.reports', label: 'Dashboard & Reports', desc: 'Hospital-wide stats and reports' },
  { cap: 'admin.settings', label: 'Settings', desc: 'Hospital settings and the role-permission matrix' },
]

export default function StaffPage() {
  const [tab, setTab] = useState('Staff Accounts')
  const [add, setAdd] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<string[]>([])
  const [form, setForm] = useState<Record<string, string>>({ role: ROLES[0], status: 'Active', mustChangePassword: 'true' })
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyRow, setBusyRow] = useState<string | null>(null)
  const [changing, setChanging] = useState<string | null>(null)
  /* Password-reset modal: the admin chooses the new password and whether the
     member must replace it with their own at next login. */
  const [pwTarget, setPwTarget] = useState<StaffAcc | null>(null)
  const [pw, setPw] = useState('')
  const [pwShow, setPwShow] = useState(false)
  const [pwMustChange, setPwMustChange] = useState(true)
  /* Permanent delete — a destructive, irreversible action, so it is confirmed
     with the username typed out and needs the `staff.delete` capability. */
  const [delTarget, setDelTarget] = useState<StaffAcc | null>(null)
  const [delConfirm, setDelConfirm] = useState('')
  /* The signed-in admin, so we can hide/disable Delete on their own row. */
  const { user } = useAuth()
  const { data: list = [], refetch } = useFetch<StaffAcc[]>(paths.adminStaff, [], 'list')
  const { data: permData, refetch: refetchPerms } = useFetch<Perms>(paths.adminPermissions)
  /* Live presence + auto-refresh when staff connect/disconnect or accounts change. */
  const { data: online = [], refetch: refetchPresence } = useFetch<PresenceUser[]>(paths.adminPresence, [], 'list')
  useRealtime((evt) => {
    if (evt === 'presence') refetchPresence()
    else { refetch(); refetchPresence() }
  }, ['presence', 'staff.updated', 'staff.created', 'staff.roleMoved'])
  /* Scoped admin account: pages selected in the Create modal, and the
     per-account "Admin Access" editor opened from a table row. */
  const [adminCaps, setAdminCaps] = useState<string[]>([])
  const [accessTarget, setAccessTarget] = useState<StaffAcc | null>(null)
  const [accessCaps, setAccessCaps] = useState<string[]>([])
  const onlineIds = new Set(online.map((o) => o.id))
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value })

  const create = async () => {
    setBusy(true); setErr(''); setOk('')
    try {
      if (!form.firstName || !form.surname || !form.phone || !form.username || !form.password || !form.role) {
        setErr('First name, surname, phone, username, password and role are all required.'); setBusy(false); return
      }
      const body: Record<string, unknown> = { ...form }
      if (ADMIN_ROLES.includes(form.role) && adminCaps.length) body.caps = adminCaps
      await staffApi.create(body)
      setAdd(false); setForm({ role: ROLES[0], status: 'Active', mustChangePassword: 'true' }); setAdminCaps([]); setOk('Staff account created.'); refetch()
    }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const update = async (id: string, body: Record<string, string | string[]>, msg: string) => {
    setBusyRow(id); setErr(''); setOk('')
    try { await staffApi.update(id, body as Record<string, string>); setOk(msg); refetch() }
    catch (e) { setErr((e as Error).message) } finally { setBusyRow(null) }
  }

  /** Open the per-account page-permission editor; unscoped admins start with all pages. */
  const openAccess = (s: StaffAcc) => {
    setAccessTarget(s)
    setAccessCaps(s.caps && s.caps.length ? s.caps.slice() : ADMIN_PAGE_CAPS.map((p) => p.cap))
    setErr(''); setOk('')
  }

  /** Save the page permissions of an admin account. Takes effect on their next login. */
  const saveAccess = async () => {
    if (!accessTarget) return
    await update(accessTarget.id, { caps: accessCaps }, accessCaps.length
      ? `${accessTarget.username} can now only see the ${accessCaps.length} selected page${accessCaps.length > 1 ? 's' : ''} (applies on their next login).`
      : `${accessTarget.username} restored to full ${accessTarget.role} access (applies on their next login).`)
    setAccessTarget(null)
  }

  /** Generate a random strong password for the reset modal. */
  const genPw = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%'
    const arr = new Uint32Array(12)
    crypto.getRandomValues(arr)
    setPw(Array.from(arr, (n) => chars[n % chars.length]).join(''))
    setPwShow(true)
  }

  const resetPassword = async () => {
    if (!pwTarget) return
    if (pw.length < 6) { setErr('New password must be at least 6 characters.'); return }
    setBusyRow(pwTarget.id); setErr(''); setOk('')
    try {
      await staffApi.update(pwTarget.id, { password: pw, mustChangePassword: pwMustChange ? 'true' : 'false' })
      setOk(`Password reset for ${pwTarget.username}${pwMustChange ? ' — they must choose a new one at next login.' : '.'}`)
      setPwTarget(null); setPw(''); refetch()
    } catch (e) { setErr((e as Error).message) } finally { setBusyRow(null) }
  }

  /** Change one staff member's role. The new role's capabilities apply immediately. */
  const changeRole = async (s: StaffAcc, role: string) => {
    if (role === s.role) return
    setChanging(s.id); setErr(''); setOk('')
    try {
      await staffApi.update(s.id, { role })
      setOk(`${s.firstName} ${s.surname} is now a ${role}. The ${role} capabilities apply on their next login.`)
      refetch()
    } catch (e) { setErr((e as Error).message) } finally { setChanging(null) }
  }

  /* Permanently delete a staff record. The username must be typed to confirm —
     this cannot be undone, so it is deliberately hard to do by accident. */
  const openDelete = (s: StaffAcc) => { setDelTarget(s); setDelConfirm(''); setErr(''); setOk('') }
  const removeStaff = async () => {
    if (!delTarget) return
    if (delConfirm.trim().toLowerCase() !== delTarget.username.toLowerCase()) {
      setErr(`Type the username "${delTarget.username}" exactly to confirm the deletion.`)
      return
    }
    setBusyRow(delTarget.id); setErr(''); setOk('')
    const who = `${delTarget.firstName} ${delTarget.surname} (${delTarget.username})`
    try {
      await staffApi.remove(delTarget.id)
      setOk(`${who} was permanently deleted. The action is recorded in the audit trail.`)
      setDelTarget(null); setDelConfirm(''); refetch()
    } catch (e) { setErr((e as Error).message) } finally { setBusyRow(null) }
  }

  const startEdit = (role: string) => {
    setEditing(role); setTab('Role Permissions'); setErr(''); setOk('')
    setDraft(permData?.matrix[role]?.can || [])
  }
  const toggleCap = (cap: string) => {
    setDraft((d) => (d.includes(cap) ? d.filter((c) => c !== cap) : [...d, cap]))
  }
  const savePerms = async () => {
    if (!editing || !permData) return
    setBusy(true); setErr(''); setOk('')
    try {
      const matrix = { ...permData.matrix, [editing]: { can: draft, cannot: [] } }
      await permissionsApi.update(matrix)
      setOk(`Permissions updated for ${editing} — backend now enforces this on every request.`)
      setEditing(null); refetchPerms()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const capLabel = (c: string) => permData?.caps[c] || c
  const roleCan = (role: string, c: string) => permData?.matrix[role]?.can.includes(c)

  return (
    <Layout title="Staff & Roles">
      <PageHead title="Staff & Role Management" sub="Create staff accounts, manage roles and control exactly what each role can do across the hospital.">
        <button className="btn primary" onClick={() => { setAdd(true); setForm({ role: ROLES[0], status: 'Active', mustChangePassword: 'true' }); setErr(''); setOk('') }}>+ Create Staff</button>
      </PageHead>
      {err && <div className="demo-note mb" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
      {ok && <div className="demo-note mb" style={{ background: 'var(--green-100)', color: 'var(--green-600)' }}>{ok}</div>}
      <Tabs tabs={['Staff Accounts', 'Role Permissions']} active={tab} onChange={setTab} />

      {tab === 'Staff Accounts' && (
        <Card title="Staff Accounts" actions={<span className="muted">Change a role with the dropdown — it takes effect on that staff member's very next action.</span>}>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>ID</th><th>Name</th><th>Username</th><th>Phone</th><th>Role (editable)</th><th>Last Active</th><th>Status</th><th></th></tr></thead>
            <tbody>{list.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>
                  <span className="live-dot" style={{ visibility: onlineIds.has(s.id) ? 'visible' : 'hidden', marginRight: 6 }} title={onlineIds.has(s.id) ? 'Online now' : 'Offline'} />
                  {s.firstName} {s.surname}
                </td>
                <td>{s.username}</td><td>{s.phone}</td>
                <td>
                  <select
                    className="input sm role-select"
                    value={s.role}
                    disabled={busyRow === s.id || changing === s.id}
                    title={`Change the role for ${s.firstName} ${s.surname}`}
                    onChange={(e) => changeRole(s, e.target.value)}
                  >
                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                  {ADMIN_ROLES.includes(s.role) && (
                    s.caps?.length
                      ? <Badge tone="blue">{s.caps.length} page{ s.caps.length > 1 ? 's' : ''} only</Badge>
                      : <Badge tone="green">Full access</Badge>
                  )}
                </td>
                <td className="muted">{s.lastActive}</td>
                <td><Badge tone={s.status === 'Active' ? 'green' : 'gray'}>{s.status}</Badge>{s.mustChangePassword ? <> <Badge tone="amber">must set own password</Badge></> : null}</td>
                <td className="right" style={{ whiteSpace: 'nowrap' }}>
                  {ADMIN_ROLES.includes(s.role) && <><button className="btn ghost sm" title="Choose which pages this admin account can see" onClick={() => openAccess(s)}>Admin Access</button>{' '}</>}
                  <button className="btn ghost sm" onClick={() => startEdit(s.role)}>Edit Permissions</button>{' '}
                  <button className="btn ghost sm" disabled={busyRow === s.id} onClick={() => { setPwTarget(s); setPw(''); setPwShow(false); setPwMustChange(true); setErr(''); setOk('') }}>Reset Password</button>{' '}
                  <button className={`btn sm ${s.status === 'Active' ? 'danger' : 'green'}`}
                    disabled={busyRow === s.id}
                    onClick={() => update(s.id, { status: s.status === 'Active' ? 'Inactive' : 'Active' }, `${s.firstName} ${s.status === 'Active' ? 'deactivated' : 'activated'}.`)}>
                    {s.status === 'Active' ? 'Deactivate' : 'Activate'}
                  </button>{' '}
                  <button className="btn danger sm" title="Permanently delete this staff record"
                    disabled={busyRow === s.id || s.id === user?.id}
                    onClick={() => openDelete(s)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}

      {tab === 'Role Permissions' && permData && (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))' }}>
          {ROLES.map((r) => {
            const editingThis = editing === r
            const canNow = permData?.matrix[r]?.can || []
            const canDraft = editingThis ? draft : canNow
            return (
              <Card key={r} title={`${r}  ·  ${permData?.counts[r] || 0} staff`} className={editingThis ? 'editing' : ''}>
                <div className="perm-head">
                  <div className="muted" style={{ fontWeight: 600, marginBottom: 4 }}>Capabilities — {editingThis ? 'Editing (click chips to toggle)' : 'Click "Edit" to change'}</div>
                  <div className="perm-count">{canDraft.length} of {CAP_ORDER.length} enabled</div>
                </div>
                <div className="chip-grid">
                  {CAP_ORDER.map((c) => {
                    const enabled = canDraft.includes(c)
                    return (
                      <button
                        key={c}
                        type="button"
                        className={`cap-chip ${enabled ? 'on' : 'off'}`}
                        disabled={busy && !editingThis}
                        onClick={() => { if (busy || !editingThis) return; toggleCap(c); setErr(''); setOk('') }}
                        title={enabled ? `Click to remove "${capLabel(c)}"` : `Click to enable "${capLabel(c)}"`}
                      >
                        <span className="cap-dot" />
                        <span className="cap-label">{capLabel(c)}</span>
                        <span className={`cap-check ${enabled ? 'show' : ''}`}>✓</span>
                      </button>
                    )
                  })}
                </div>
                <div className="perm-actions" style={{ marginTop: 14 }}>
                  {editingThis ? (
                    <>
                      <button className="btn ghost sm" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
                      <button className="btn green sm" disabled={busy} onClick={savePerms}>{busy ? 'Saving…' : 'Save Permissions'}</button>
                    </>
                  ) : (
                    <button className="btn primary sm" disabled={busy} onClick={() => { setEditing(r); setDraft([...canNow]); setErr(''); setOk('') }}>
                      Edit / Toggle Capabilities
                    </button>
                  )}
                </div>
                {ok && <div className="ok-msg mt">{ok}</div>}
              </Card>
            )
          })}
        </div>
      )}

      {add && (
        <Modal title="Create Staff Account" onClose={() => setAdd(false)}
          footer={<><button className="btn ghost" onClick={() => setAdd(false)}>Cancel</button><button className="btn green" disabled={busy} onClick={create}>{busy ? 'Creating…' : 'Create Staff'}</button></>}>
          {err && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
          <div className="form-grid">
            <Field label="First Name"><input className="input" value={form.firstName || ''} onChange={set('firstName')} /></Field>
            <Field label="Surname"><input className="input" value={form.surname || ''} onChange={set('surname')} /></Field>
            <Field label="Phone"><input className="input" value={form.phone || ''} onChange={set('phone')} /></Field>
            <Field label="Username"><input className="input" value={form.username || ''} onChange={set('username')} /></Field>
            <Field label="Password"><input className="input" type="password" value={form.password || ''} onChange={set('password')} /></Field>
            <Field label="Role"><select className="input" value={form.role || ''} onChange={set('role')}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></Field>
            <Field label="Status" full><select className="input" value={form.status || 'Active'} onChange={set('status')}><option>Active</option><option>Inactive</option></select></Field>
          </div>
          <label className="check-row">
            <input type="checkbox" checked={form.mustChangePassword === 'true'} onChange={(e) => setForm({ ...form, mustChangePassword: e.target.checked ? 'true' : 'false' })} />
            <span><b>Require password change at first login</b><div className="muted" style={{ fontSize: 12 }}>The staff member signs in with this temporary password, then must choose a new one of their own before the system lets them continue.</div></span>
          </label>
          {ADMIN_ROLES.includes(form.role) && (
            <div style={{ marginTop: 16 }}>
              <b style={{ fontSize: 13.5 }}>What may this admin see and do?</b>
              <div className="muted" style={{ fontSize: 12, margin: '4px 0 10px' }}>Tick the pages of the admin console this account may open. Leave everything unticked for unrestricted full access. These limits are enforced by the backend, not just hidden in the menu.</div>
              {ADMIN_PAGE_CAPS.map((p) => {
                const on = adminCaps.includes(p.cap)
                return (
                  <label className="check-row" key={p.cap} style={{ marginTop: 8 }}>
                    <input type="checkbox" checked={on} onChange={(e) => setAdminCaps((d) => e.target.checked ? [...d, p.cap] : d.filter((c) => c !== p.cap))} />
                    <span><b>{p.label}</b><div className="muted" style={{ fontSize: 12 }}>{p.desc}</div></span>
                  </label>
                )
              })}
            </div>
          )}
        </Modal>
      )}

      {pwTarget && (
        <Modal title={`Reset Password — ${pwTarget.firstName} ${pwTarget.surname}`} onClose={() => setPwTarget(null)}
          footer={<>
            <button className="btn ghost" onClick={() => setPwTarget(null)}>Cancel</button>
            <button className="btn green" disabled={busyRow === pwTarget.id} onClick={resetPassword}>{busyRow === pwTarget.id ? 'Saving…' : 'Reset Password'}</button>
          </>}>
          <div className="field">
            <label>New password for <b>{pwTarget.username}</b></label>
            <div className="pw-row">
              <input className="input" type={pwShow ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" autoFocus />
              <button type="button" className="btn ghost sm" onClick={() => setPwShow((v) => !v)} title={pwShow ? 'Hide password' : 'Show password'}>{pwShow ? 'Hide' : 'Show'}</button>
              <button type="button" className="btn ghost sm" onClick={genPw} title="Generate a strong random password">Generate</button>
            </div>
          </div>
          <label className="check-row">
            <input type="checkbox" checked={pwMustChange} onChange={(e) => setPwMustChange(e.target.checked)} />
            <span><b>Require them to change it at next login</b><div className="muted" style={{ fontSize: 12 }}>They log in with this password once, then must set their own before using the system.</div></span>
          </label>
          {pwTarget.email
            ? <div className="demo-note">The new password will be emailed to <b>{pwTarget.email}</b> (Mailtrap).</div>
            : <div className="demo-note">This account has no email on file — share the new password with them directly.</div>}
        </Modal>
      )}
      {delTarget && (
        <Modal title={`Delete ${delTarget.firstName} ${delTarget.surname}?`} onClose={() => { setDelTarget(null); setDelConfirm('') }}
          footer={<><button className="btn ghost" onClick={() => { setDelTarget(null); setDelConfirm('') }}>Cancel</button>
            <button className="btn danger" disabled={busyRow === delTarget.id || delConfirm.trim().toLowerCase() !== delTarget.username.toLowerCase()}
              onClick={removeStaff}>{busyRow === delTarget.id ? 'Deleting…' : 'Delete Permanently'}</button></>}>
          {err && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
          <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>
            <b>This removes the staff record completely — not a deactivation.</b>
            The account can no longer sign in, and the username becomes available again.
            The deletion itself is written to the audit trail.
          </div>
          <div className="kv">
            <div className="k">Name</div><div className="v">{delTarget.firstName} {delTarget.surname}</div>
            <div className="k">Username</div><div className="v"><b>{delTarget.username}</b></div>
            <div className="k">Role</div><div className="v">{delTarget.role}</div>
          </div>
          <div className="field">
            <label>Type <b>{delTarget.username}</b> to confirm</label>
            <input className="input" value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} placeholder={delTarget.username} autoFocus />
          </div>
        </Modal>
      )}
      {accessTarget && (
        <Modal title={`Admin Access — ${accessTarget.firstName} ${accessTarget.surname}`} onClose={() => setAccessTarget(null)}
          footer={<><button className="btn ghost" onClick={() => setAccessTarget(null)}>Cancel</button><button className="btn green" disabled={busyRow === accessTarget.id} onClick={saveAccess}>{busyRow === accessTarget.id ? 'Saving…' : 'Save Access'}</button></>}>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
            Choose which pages of the admin console <b>{accessTarget.username}</b> may open. Untick everything to restore full {accessTarget.role} access. Changes apply on their next login.
          </div>
          {ADMIN_PAGE_CAPS.map((p) => {
            const on = accessCaps.includes(p.cap)
            return (
              <label className="check-row" key={p.cap} style={{ marginTop: 8 }}>
                <input type="checkbox" checked={on} onChange={(e) => setAccessCaps((d) => e.target.checked ? [...d, p.cap] : d.filter((c) => c !== p.cap))} />
                <span><b>{p.label}</b><div className="muted" style={{ fontSize: 12 }}>{p.desc}</div></span>
              </label>
            )
          })}
        </Modal>
      )}
    </Layout>
  )
}