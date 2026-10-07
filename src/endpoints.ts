/* ============================================================================
 * API ENDPOINT CATALOGUE — Admin App
 * Every backend endpoint this app talks to, in one place:
 *   · `paths`  — URL builders for reads (use with useFetch)
 *   · `*Api`   — typed request functions for writes & auth
 * Mirror of backend/src/routes — keep the two in sync.
 * ========================================================================== */
import { api, type User } from './api'

/* ---------- READ PATHS (GET) ---------- */
export const paths = {
  /** POST /api/auth/login (called via authApi, listed for completeness) */
  login: '/api/auth/login',
  /** GET /api/settings — hospital info, lists, roles */
  settings: '/api/settings',
  /** GET /api/patients — all patients */
  patients: '/api/patients',
  /** GET /api/admin/stats — hospital-wide dashboard counters */
  adminStats: '/api/admin/stats',
  /** GET /api/admin/reports — patient / financial / pharmacy / lab reports */
  adminReports: '/api/admin/reports',
  /** GET /api/admin/permissions — role → capability matrix + staff counts */
  adminPermissions: '/api/admin/permissions',
  /** GET /api/admin/staff — all staff accounts */
  adminStaff: '/api/admin/staff',
  /** GET /api/admin/audit?q=… — audit trail */
  adminAudit: (q?: string) => `/api/admin/audit${q ? `?q=${encodeURIComponent(q)}` : ''}`,
  /** GET /api/admin/patients — patients enriched with visit counts */
  adminPatients: '/api/admin/patients',
  /** GET /api/admin/patients/:id — full 360° patient record */
  adminPatient: (id: string) => `/api/admin/patients/${id}`,
  /** GET /api/admin/notifications — clinic-wide notifications */
  adminNotifications: '/api/admin/notifications',
  /** GET /api/admin/presence — staff currently online (live presence) */
  adminPresence: '/api/admin/presence',
  /** GET /api/services — the priced procedure/service catalogue */
  services: '/api/services',
  /** GET /api/notifications — role-targeted notifications */
  notifications: '/api/notifications',
}

/* ---------- AUTH ---------- */
export const authApi = {
  login: (username: string, password: string, app: 'hospital' | 'admin') =>
    api.post<{ token: string; user: User }>(paths.login, { username, password, app }),
  /** Choose a new password (used when the account is flagged "must change at first login"). */
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ token: string; user: User }>('/api/auth/change-password', { currentPassword, newPassword }),
}

/* ---------- STAFF ADMINISTRATION ---------- */
export const staffApi = {
  /** body: { firstName, surname, username, role, password, phone?, email?, status? } */
  create: (body: Record<string, unknown>) => api.post(paths.adminStaff, body),
  update: (staffId: string, body: { role?: string; password?: string; status?: string; firstName?: string; surname?: string; phone?: string; mustChangePassword?: string; caps?: string[] }) =>
    api.put(`/api/admin/staff/${staffId}`, body),
  changeRole: (username: string, role: string) =>
    api.put(`/api/admin/staff/${username}/role`, { role }),
  /** Permanently delete a staff record. Requires the `staff.delete` capability,
      which is granted to administrator roles only. */
  remove: (staffId: string) =>
    api.del<{ id: string; username: string; deleted: boolean }>(`/api/admin/staff/${staffId}`),
}

/* ---------- PROCEDURES / SERVICES ---------- */
export const serviceApi = {
  /** body: { name, amount, quantity? } */
  create: (body: Record<string, unknown>) => api.post(paths.services, body),
  update: (serviceId: string, body: Record<string, unknown>) => api.put(`${paths.services}/${serviceId}`, body),
  /** Permanently delete a procedure from the catalogue. Existing patient records
      that already reference it are unaffected — only the catalogue entry goes. */
  remove: (serviceId: string) =>
    api.del<{ id: string; deleted: boolean }>(`${paths.services}/${serviceId}`),
}

/* ---------- PERMISSIONS ---------- */
export const permissionsApi = {
  update: (matrix: Record<string, { can: string[]; cannot: string[] }>) =>
    api.put('/api/admin/permissions', { matrix }),
}

/* ---------- SETTINGS ---------- */
export const settingsApi = {
  update: (body: Record<string, unknown>) => api.put('/api/admin/settings', body),
}

/* ---------- NOTIFICATIONS ---------- */
export const notificationApi = {
  markAllRead: () => api.post('/api/admin/notifications/read'),
}