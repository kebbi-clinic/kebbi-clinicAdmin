import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

/* Last line of defence: without this, any uncaught render error unmounts the
 * whole tree and the user just sees a blank white page with no explanation. */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[app] render error:', error, info.componentStack)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#1e2a38' }}>
        <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Something went wrong loading the app</h1>
        <p style={{ margin: '0 0 12px', color: '#64748b' }}>
          Reload the page. If it keeps happening, clear this site's data in your browser.
        </p>
        <pre style={{ background: '#fee2e2', color: '#dc2626', padding: 12, borderRadius: 8, overflow: 'auto', fontSize: 12 }}>
          {this.state.error.message}
        </pre>
        <button onClick={() => window.location.reload()} style={{ marginTop: 12, padding: '8px 14px', borderRadius: 8, border: 'none', background: '#1b7fe0', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          Reload
        </button>
      </div>
    )
  }
}

/* A previously registered /sw.js (from a local `vite preview` or a push-enabled
 * browser) keeps serving cached JS after a deploy, which shows up as a blank or
 * "crashed" page on reload. Dev never needs push, so drop any stale worker and
 * its caches there. */
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void (async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      if (!regs.length) return
      await Promise.all(regs.map((r) => r.unregister()))
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch (e) {
      console.warn('[sw] cleanup failed:', e)
    }
  })()
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

/* Blank-page recovery. If a previously cached index.html (or a proxy) left #root
 * empty, or the module bundle failed to load, clear the stale worker/caches and
 * reload once from the network. Guarded by sessionStorage so it cannot loop. */
;(function recoverFromBlankPage() {
  const KEY = 'kc_recovered'
  if (sessionStorage.getItem(KEY)) return
  const root = document.getElementById('root')
  /* Let React mount first; only act if it produced nothing. */
  setTimeout(() => {
    if (root && root.childElementCount > 0) return
    sessionStorage.setItem(KEY, '1')
    const clear = async () => {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations()
          await Promise.all(regs.map((r) => r.unregister()))
        }
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map((k) => caches.delete(k)))
        }
      } catch (e) {
        console.warn('[recover] cleanup failed:', e)
      }
      window.location.reload()
    }
    void clear()
  }, 2500)
})()