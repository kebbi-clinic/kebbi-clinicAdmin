import { Layout } from '../components/Layout'
import { StatCard, Card, PageHead, Badge, naira } from '../components/ui'
import { useFetch, useRealtime } from '../api'
import { paths } from '../endpoints'

type Any = Record<string, any>
interface PresenceUser { id: string; name: string; role: string; app: string; since: string }

export default function Dashboard() {
  const { data: s, loading, error } = useFetch<Any>(paths.adminStats)
  const { data: online = [], refetch: refetchPresence } = useFetch<PresenceUser[]>(paths.adminPresence, [], 'list')
  useRealtime(() => { refetchPresence() }, ['presence'])
  /* A partially-populated or error-shaped payload must never reach .map(). */
  const roleCounts: [string, number][] = Array.isArray(s?.roleCounts) ? s.roleCounts : []
  return (
    <Layout title="Admin Dashboard">
      <PageHead title="Hospital Overview" sub="What is happening across the entire hospital — live from the shared backend." />
      {loading && <div className="muted">Loading…</div>}
      {error && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{error}</div>}
      <Card title={`Staff Online Now`} actions={<span><span className="live-dot" style={{ marginRight: 6 }} /><b>{online.length}</b> connected</span>} className="mb">
        {online.length === 0
          ? <div className="muted" style={{ padding: '6px 2px' }}>No staff have the app open right now.</div>
          : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {online.map((o) => (
                <Badge key={o.id} tone={o.app === 'admin' ? 'blue' : 'green'}>{o.name} · {o.role}</Badge>
              ))}
            </div>}
      </Card>
      {s && (<>
        <div className="grid cols-4 mb">
          <StatCard icon="patients" value={Number(s.totalPatients || 0).toLocaleString()} label="Total Patients" />
          <StatCard icon="heart" value={s.active ?? 0} label="Active Patients" tone="green" />
          <StatCard icon="clock" value={s.today ?? 0} label="Today's Patients" tone="blue" />
          <StatCard icon="doctor" value={s.totalStaff ?? 0} label="Total Staff" tone="amber" />
        </div>
        <div className="grid cols-2 mb">
          <Card title="Staff by Department">
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Role</th><th>Count</th></tr></thead>
              <tbody>{roleCounts.map(([role, count]: [string, number]) => (
                <tr key={role}><td>{role}s</td><td><b>{count}</b></td></tr>
              ))}</tbody>
            </table></div>
          </Card>
          <Card title="Financial Snapshot">
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Period</th><th>Revenue</th></tr></thead>
              <tbody>
                <tr><td>Today</td><td className="money">{naira(s.revenueToday)}</td></tr>
                <tr><td>This Week</td><td className="money">{naira(s.revenueWeek)}</td></tr>
                <tr><td>This Month</td><td className="money">{naira(s.revenueMonth)}</td></tr>
                <tr><td>Wallet Funding (to date)</td><td className="money">{naira(s.walletFunding)}</td></tr>
              </tbody>
            </table></div>
          </Card>
        </div>
        <div className="grid cols-4">
          <StatCard icon="lab" value={s.pendingInvestigations ?? 0} label="Pending Investigations" tone="amber" />
          <StatCard icon="clipboard" value={s.admitted ?? 0} label="Admitted Patients" tone="blue" />
          <StatCard icon="doctor" value={s.consultationsToday ?? 0} label="Consultations" />
          <StatCard icon="check" value={s.dischargesToday ?? 0} label="Discharges" tone="green" />
        </div>
        <Card title="Pharmacy Activity" className="mt">
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Badge tone="amber">{s.pendingRx ?? 0} pending prescriptions</Badge>
            <Badge tone="green">{s.dispensedToday ?? 0} dispensed</Badge>
            <Badge tone="amber">{s.lowStock ?? 0} low stock</Badge>
            <Badge tone="red">{s.outStock ?? 0} out of stock</Badge>
          </div>
        </Card>
      </>)}
    </Layout>
  )
}

