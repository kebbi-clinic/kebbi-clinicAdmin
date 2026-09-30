import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

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
    <App />
  </React.StrictMode>,
)