import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { hasPageCap } from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import PatientDetail from './pages/PatientDetail'
import Staff from './pages/Staff'
import AuditLog from './pages/AuditLog'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

/** Session guard; with `cap` also enforces the per-account page permission
 *  granted to scoped admin accounts (full admins pass everything). */
function Guard({ children, cap }: { children: React.ReactElement; cap?: string }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!hasPageCap(user, cap)) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Guard><Dashboard /></Guard>} />
          <Route path="/patients" element={<Guard cap="admin.patients"><Patients /></Guard>} />
          <Route path="/patients/:id" element={<Guard cap="admin.patients"><PatientDetail /></Guard>} />
          <Route path="/staff" element={<Guard cap="admin.staff"><Staff /></Guard>} />
          <Route path="/audit" element={<Guard cap="admin.audit"><AuditLog /></Guard>} />
          <Route path="/reports" element={<Guard cap="admin.reports"><Reports /></Guard>} />
          <Route path="/settings" element={<Guard cap="admin.settings"><Settings /></Guard>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

