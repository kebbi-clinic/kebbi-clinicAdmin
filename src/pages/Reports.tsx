import { useMemo, useState } from 'react'
import { Layout } from '../components/Layout'
import { Card, PageHead, Tabs, naira, StatCard, Icon } from '../components/ui'
import { useFetch } from '../api'
import { paths } from '../endpoints'

type Any = Record<string, any>
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

const REPORT_TABS = ['Patient', 'Financial', 'Pharmacy', 'Laboratory', 'Department Activity']

export default function Reports() {
  const [tab, setTab] = useState('Patient')
  const [q, setQ] = useState('')
  const { data: r, loading, error } = useFetch<Any>(paths.adminReports)

  /* Everything is optional-guarded: a partially-populated database or an older
     backend response renders zeros instead of crashing the page to a blank screen. */
  const patient = r?.patient ?? {}
  const financial = r?.financial ?? {}
  const pharmacy = r?.pharmacy ?? {}
  const laboratory = r?.laboratory ?? {}
  const deptActivity: { dept: string; actions: number }[] = Array.isArray(r?.deptActivity) ? r.deptActivity : []
  const byMethod: [string, number][] = Object.entries(
    (financial.byMethod && typeof financial.byMethod === 'object' && !Array.isArray(financial.byMethod)
      ? financial.byMethod : {}) as Record<string, number>,
  ).map(([m, v]) => [m, num(v)])

  const needle = q.trim().toLowerCase()
  const deptRows = useMemo(() => deptActivity.filter((d) => !needle || String(d.dept).toLowerCase().includes(needle)), [needle, JSON.stringify(r)])
  const methodRows = useMemo(() => byMethod.filter(([m]) => !needle || m.toLowerCase().includes(needle)), [needle, JSON.stringify(r)])

  return (
    <Layout title="Reports">
      <PageHead title="Reports" sub="Patient, financial, pharmacy, laboratory and department activity reports — computed live from the database." />
      {loading && <div className="muted">Loading reports…</div>}
      {error && !r && <div className="card-b" style={{ color: 'var(--red-600)' }}>Could not load reports: {error}</div>}
      {r && (<>
        <div className="grid cols-4 mb">
          <StatCard icon="money" value={naira(num(financial.daily))} label="Revenue Today" tone="green" />
          <StatCard icon="patients" value={num(patient.total)} label="Registered Patients" />
          <StatCard icon="pill" value={num(pharmacy.dispensed)} label="Prescriptions Dispensed" tone="blue" />
          <StatCard icon="lab" value={num(laboratory.completed)} label="Tests Completed" tone="amber" />
        </div>
        <Tabs tabs={REPORT_TABS} active={tab} onChange={setTab} />
        <div className="card-b" style={{ padding: '0 0 10px' }}>
          <div className="search"><Icon name="search" size={15} /><input className="input" placeholder={tab === 'Department Activity' ? 'Search departments…' : tab === 'Financial' ? 'Search payment methods…' : 'Search within this report…'} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        {tab === 'Patient' && (
          <Card title="Patient Report">
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Metric</th><th>Count</th></tr></thead>
              <tbody>
                {([['Registered Patients', patient.total], ['New This Month', patient.newMonth], ['Total Visits', patient.visits],
                   ['Returning Patients', patient.returning], ['Active Patients', patient.active], ['Inactive Patients', patient.inactive],
                   ['Admissions', patient.admissions], ['Discharges', patient.discharges]] as [string, unknown][])
                  .filter(([label]) => !needle || label.toLowerCase().includes(needle))
                  .map(([label, v]) => <tr key={label}><td>{label}</td><td><b>{num(v)}</b></td></tr>)}
              </tbody>
            </table></div>
          </Card>
        )}
        {tab === 'Financial' && (
          <Card title="Financial Report">
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Period / Method</th><th>Amount</th></tr></thead>
              <tbody>
                <tr><td>Total (paid) — Daily</td><td className="money"><b>{naira(num(financial.daily))}</b></td></tr>
                <tr><td>Total (paid) — Weekly</td><td className="money">{naira(num(financial.weekly))}</td></tr>
                <tr><td>Total (paid) — Monthly</td><td className="money">{naira(num(financial.monthly))}</td></tr>
                {methodRows.map(([m, v]) => <tr key={m}><td>— {m}</td><td className="money">{naira(v)}</td></tr>)}
              </tbody>
            </table></div>
          </Card>
        )}
        {tab === 'Pharmacy' && (
          <Card title="Pharmacy Report">
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Metric</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td>Prescriptions Dispensed</td><td><b>{num(pharmacy.dispensed)}</b></td></tr>
                <tr><td>Drug Sales</td><td className="money">{naira(num(pharmacy.sales))}</td></tr>
                <tr><td>Awaiting Dispensing</td><td><b>{num(pharmacy.pending)}</b></td></tr>
                <tr><td>Low Stock Items</td><td><b>{num(pharmacy.low)}</b></td></tr>
                <tr><td>Out of Stock Items</td><td><b>{num(pharmacy.out)}</b></td></tr>
              </tbody>
            </table></div>
          </Card>
        )}
        {tab === 'Laboratory' && (
          <Card title="Laboratory Report">
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Metric</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td>Tests Requested</td><td><b>{num(laboratory.requested)}</b></td></tr>
                <tr><td>Tests Completed</td><td><b>{num(laboratory.completed)}</b></td></tr>
                <tr><td>Pending Tests</td><td><b>{num(laboratory.pending)}</b></td></tr>
                <tr><td>Radiology — Requested</td><td><b>{num(r?.radiology?.requested)}</b></td></tr>
                <tr><td>Radiology — Completed</td><td><b>{num(r?.radiology?.completed)}</b></td></tr>
                <tr><td>Radiology — Pending</td><td><b>{num(r?.radiology?.pending)}</b></td></tr>
              </tbody>
            </table></div>
          </Card>
        )}
        {tab === 'Department Activity' && (
          <Card title="Department Activity (audit log)">
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Department</th><th>Actions Logged</th></tr></thead>
              <tbody>{deptRows.map((d) => (
                <tr key={d.dept}><td>{d.dept}</td><td><b>{d.actions}</b></td></tr>
              ))}</tbody>
            </table></div>
            {deptRows.length === 0 && <div className="muted" style={{ padding: 12 }}>No matching {needle ? 'results' : 'activity'}.</div>}
          </Card>
        )}
      </>)}
    </Layout>
  )
}
