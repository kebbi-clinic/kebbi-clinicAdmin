import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { useEffect, useRef, useState } from 'react'
import { io as ioClient, Socket } from 'socket.io-client'

/* Backend origin. Set VITE_API_URL per environment (Vercel → Settings →
 * Environment Variables, and .env.development locally). Normalised so both
 * "http://host" and "http://host/" work with the absolute path builders below. */
const RAW_BASE = import.meta.env.VITE_API_URL
const BASE = (RAW_BASE || '').replace(/\/+$/, '')
/* The backend must be reachable from the visitor's browser, so a localhost
 * value in a deployed build is always a misconfiguration — without this guard
 * the mistake only shows up as silent failed requests / crashed reloads. */
const LOCAL_HOST = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i
export const configError: string =
  !BASE ? 'VITE_API_URL is not set'
    : LOCAL_HOST.test(BASE) && typeof window !== 'undefined' && !LOCAL_HOST.test(window.location.origin)
      ? `VITE_API_URL points at ${BASE}, which only exists on your own machine`
      : ''

/** Turn a stored file path (e.g. /api/uploads/x.png) into a full URL the browser can load. */
export function fileUrl(u?: string): string {
  if (!u) return ''
  return u.startsWith('http') ? u : `${BASE}${u}`
}

export interface User { id: string; name: string; role: string; app: 'hospital' | 'admin'; mustChangePassword?: boolean; caps?: string[] }
export interface ApiError extends Error { status?: number; details?: { field: string; message: string }[] }

let token: string | null = localStorage.getItem('kc_admin_token')

/* One shared axios instance for the whole app. */
export const http: AxiosInstance = axios.create({
  baseURL: BASE,
  timeout: 20_000,
})

/* Attach the JWT to every request automatically. */
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/* Normalise every failure into `ApiError { message, status, details }`. */
http.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ error?: string; details?: { field: string; message: string }[] }>) => {
    const status = error.response?.status
    const data = error.response?.data
    const err = new Error(data?.error || error.message || 'Request failed') as ApiError
    err.status = status
    err.details = data?.details
    return Promise.reject(err)
  },
)

function setToken(t: string | null) {
  token = t
  if (t) localStorage.setItem('kc_admin_token', t)
  else {
    localStorage.removeItem('kc_admin_token')
    /* Drop the presence-tracked socket on logout so "online" reflects reality. */
    if (socket) { socket.disconnect(); socket = null }
  }
}

export const api = {
  get: <T = never>(url: string) => http.get<T>(url).then((r) => r.data),
  post: <T = never>(url: string, body?: unknown, isForm = false) =>
    http.post<T>(url, isForm ? (body as FormData) : body).then((r) => r.data),
  put: <T = never>(url: string, body?: unknown) => http.put<T>(url, body).then((r) => r.data),
  del: <T = never>(url: string) => http.delete<T>(url).then((r) => r.data),
  setToken,
  hasToken: () => !!token,
  BASE,
  configError,
}

export function useFetch<T>(url: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let live = true
    setLoading(true)
    api.get<T>(url)
      .then((d) => { if (live) { setData(d); setError('') } })
      .catch((e) => { if (live) setError(e.message) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, deps)
  return { data, error, loading, refetch: () => api.get<T>(url).then((d) => setData(d)) }
}

let socket: Socket | null = null

/* Realtime origin. Unset by default: the API is a Vercel /api function and
 * cannot host websocket upgrades, so connecting to it only produced endless
 * failed retries in the console. Set VITE_SOCKET_URL to a long-lived Socket.IO
 * host to re-enable live updates — no other code change required. */
const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || '').replace(/\/+$/, '')
export const REALTIME_ENABLED = !!SOCKET_URL

/** One shared Socket.IO connection for the whole app. The login JWT travels in
 *  the handshake so the backend can track this user's presence (online status).
 *  Returns null when realtime is off — either no VITE_SOCKET_URL is configured
 *  (the API is a Vercel /api function and cannot host websocket upgrades, so
 *  connecting produced endless failed retries) or no API origin is set. Callers
 *  already null-check, so live updates are simply skipped and screens fall back
 *  to fetching on mount/navigate. Set VITE_SOCKET_URL to a long-lived Socket.IO
 *  host to switch realtime back on. */
export function getSocket(): Socket | null {
  if (!BASE || !SOCKET_URL) return null
  if (!socket) socket = ioClient(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    auth: { token: token || undefined },
    /* Bounded, not Infinity: a host that cannot serve websockets should not
       keep retrying for the lifetime of the page. */
    reconnectionAttempts: 5,
  })
  return socket
}

/** Join this user's role-room so role-targeted events (notifications) arrive. */
export function subscribeRole(role: string) {
  const s = getSocket()
  if (!s) return
  if (s.connected) s.emit('subscribe', role)
  else s.on('connect', () => s.emit('subscribe', role))
}

/** Every server event the apps react to. */
export const REALTIME_EVENTS = [
  'data.changed', 'activity.new', 'notification', 'permissions.changed',
  'staff.updated', 'staff.created', 'staff.roleMoved', 'auth.userOnline', 'presence',
]

/** Live-update hook — re-run `onEvent` whenever the server emits any of `events`.
 *  Pass a smaller `events` list to react only to specific changes. */
export function useRealtime(onEvent: (evt?: string, payload?: unknown) => void, events: string[] = REALTIME_EVENTS, role?: string) {
  const cb = useRef(onEvent)
  cb.current = onEvent
  const key = events.join('|')
  useEffect(() => {
    const s = getSocket()
    if (!s) return
    if (role) s.emit('subscribe', role)
    const handlers = (key ? key.split('|') : REALTIME_EVENTS).map((e) => {
      const h = (payload?: unknown) => cb.current(e, payload)
      return [e, h] as const
    })
    handlers.forEach(([e, h]) => s.on(e, h))
    return () => { handlers.forEach(([e, h]) => s.off(e, h)) }
  }, [key, role])
}
