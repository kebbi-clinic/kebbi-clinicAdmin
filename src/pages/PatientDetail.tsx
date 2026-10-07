import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Card, PageHead, Badge, statusTone, Tabs, Timeline, naira } from '../components/ui'
import { useFetch, useRealtime, fileUrl } from '../api'
import { paths } from '../endpoints'

type Any = Record<string, any>

/** Coerce a possibly-missing/partial backend field into a real array. `x || []`
 *  only covers undefined, so a non-array value would still throw on .map() and
 *  blank the whole app via the error boundary. */
const list = (v: unknown): Any[] => (Array.isArray(v) ? (v as Any[]) : [])

const TABS = [
  'Overview', 'Care Team', 'Visits', 'Vitals', 'Investigations',
  'Prescriptions', 'Payments', 'Wallet', 'Admissions', 'Activity', 'Audit Trail',
]

export default function PatientDetail() {
  const { id } = useParams()
  const [tab, setTab] = useState('Overview')
  const { data: b, error, refetch } = useFetch<Any>(paths.adminPatient(id || ''))
  // Any change made anywhere in the hospital concerning this patient refreshes the page live.
  useRealtime(() => { void refetch() }, [`patient:${id}`, 'activity', 'payment', 'vitals', 'visit', 'investigation', 'prescription', 'admission'])

  const auditTimeline = useMemo(
    () => list(b?.audit).map((a: Any) => ({
      time: a.when,
      what: a.action,
      meta: `${a.who} · ${a.dept || ''}${a.extra ? ' · ' + a.extra : ''}`,
      green: false,
    })),
    [b],
  )

  if (!b && !error) return <Layout title="Patient 360°"><PageHead title="Patient 360°" sub="Loading the complete patient record…" /></Layout>
  if (error || !b) return <Layout title="Patient 360°"><PageHead title="Patient 360°" sub="Could not load this patient." /><div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{error || 'Patient not found.'} <Link to="/patients">← All Patients</Link></div></Layout>

  const p: Any = b.patient || b
  if (!p || !p.id) return <Layout title="Patient 360°"><PageHead title="Patient 360°" sub="Could not load this patient." /><div className="muted">Patient not found. <Link to="/patients">← All Patients</Link></div></Layout>
  const age = p.dob ? new Date().getFullYear() - Number(String(p.dob).slice(0, 4)) : '—'
  /* Tolerate missing/partial payloads so one bad record can't white-screen the app. */
  const summary = b.summary || {}
  const visits = list(b.visits)
  const careTeam = list(b.careTeam)
  const vitals = list(b.vitals)
  const investigations = list(b.investigations)
  const prescriptions = list(b.prescriptions)
  const payments = list(b.payments)
  const walletTxs = list(b.walletTxs)
  const admissions = list(b.admissions)
  const activity = list(b.activity)

  return (
    <Layout title="Patient 360°">
      <PageHead title={`${p.firstName} ${p.otherName || ''} ${p.surname}`.replace(/\s+/g, ' ')}
        sub={`Patient ID ${p.id} · complete cross-departmental record — every visit, every staff member, every transaction.`}>
        <Link to="/patients" className="btn ghost">← All Patients</Link>
      </PageHead>

      <Card className="mb">
        <div className="card-b" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="avatar" style={{ width: 54, height: 54, fontSize: 18, background: 'var(--blue-700)' }}>
            {String(p.firstName || '?')[0]}{String(p.surname || '?')[0]}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>
              {p.firstName} {p.otherName || ''} {p.surname} <Badge tone={statusTone(p.status)}>{p.status}</Badge>
            </div>
            <div className="muted">Patient ID: <b>{p.id}</b> · Registered {p.registered}</div>
          </div>
          <div className="kv" style={{ gridTemplateColumns: 'auto auto', gap: '4px 26px' }}>
            <div className="k">Age / Gender</div><div className="v">{age} · {p.gender}</div>
            <div className="k">Phone</div><div className="v">{p.phone}</div>
            <div className="k">Blood Group</div><div className="v">{p.bloodGroup || '—'}</div>
            <div className="k">Wallet Balance</div><div className="v money">{naira(p.wallet)}</div>
          </div>
        </div>
      </Card>

      <div className="grid cols-4 mb">
        <Card><div className="card-b"><div className="v" style={{ fontSize: 22, fontWeight: 800 }}>{summary.visits ?? 0}</div><div className="muted">Visits</div></div></Card>
        <Card><div className="card-b"><div className="v" style={{ fontSize: 22, fontWeight: 800 }}>{summary.investigations ?? 0}</div><div className="muted">Investigations</div></div></Card>
        <Card><div className="card-b"><div className="v" style={{ fontSize: 22, fontWeight: 800 }}>{summary.prescriptions ?? 0}</div><div className="muted">Prescriptions</div></div></Card>
        <Card><div className="card-b"><div className="v money" style={{ fontSize: 22, fontWeight: 800 }}>{naira(summary.totalPaid)}</div><div className="muted">Total Paid</div></div></Card>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'Overview' && (
        <div className="grid cols-2">
          <Card title="Demographics">
            <div className="kv">
              <div className="k">Full Name</div><div className="v">{p.firstName} {p.otherName || ''} {p.surname}</div>
              <div className="k">Date of Birth</div><div className="v">{p.dob}</div>
              <div className="k">Gender</div><div className="v">{p.gender}</div>
              <div className="k">Phone</div><div className="v">{p.phone}</div>
              <div className="k">Address</div><div className="v">{p.address}</div>
              <div className="k">Registered</div><div className="v">{p.registered}</div>
            </div>
          </Card>
          <Card title="Next of Kin">
            <div className="kv">
              <div className="k">Name</div><div className="v">{p.nextOfKin?.name || '—'}</div>
              <div className="k">Relationship</div><div className="v">{p.nextOfKin?.relationship || '—'}</div>
              <div className="k">Phone</div><div className="v">{p.nextOfKin?.phone || '—'}</div>
              <div className="k">Address</div><div className="v">{p.nextOfKin?.address || '—'}</div>
            </div>
          </Card>
          <Card title="Latest Diagnosis" className="span-2">
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Visit</th><th>Date</th><th>Doctor</th><th>Diagnosis</th></tr></thead>
              <tbody>{visits.filter((v: Any) => v.consultation).map((v: Any) => (
                <tr key={v.id}><td>{v.id}</td><td>{v.date}</td><td>{v.consultation?.doctor || String(v.doctor || "—")}</td><td>{v.consultation?.diagnosis || '—'}</td></tr>
              ))}</tbody>
            </table></div>
          </Card>
        </div>
      )}

      {tab === 'Care Team' && (
        <Card title={`Who attended to ${p.firstName} — ${careTeam.length} recorded actions`}>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Department / Role</th><th>Staff Member</th><th>Action</th><th>Date / Time</th></tr></thead>
            <tbody>{careTeam.map((c: Any, idx: number) => (
              <tr key={idx}>
                <td><Badge tone="blue">{c.role}</Badge></td>
                <td><b>{c.name}</b></td>
                <td>{c.action}</td>
                <td className="muted">{c.at}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}

      {tab === 'Visits' && (
        <Card title={`Visits — ${visits.length} (one permanent patient, many visits)`}>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Visit ID</th><th>Date</th><th>Type</th><th>Status</th><th>Diagnosis</th><th>Doctor</th></tr></thead>
            <tbody>{visits.map((v: Any) => (
              <tr key={v.id}>
                <td><b>{v.id}</b></td><td>{v.date}</td><td>{v.type}</td>
                <td><Badge tone={statusTone(v.status)}>{v.status}</Badge></td>
                <td>{v.consultation?.diagnosis || '—'}</td>
                <td>{v.consultation?.doctor || '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}

      {tab === 'Vitals' && (
        <Card title={`Vitals — ${vitals.length} entries recorded by nursing/medical staff`}>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Vital ID</th><th>Date / Time</th><th>Temp</th><th>BP</th><th>Pulse</th><th>Resp</th><th>SpO₂</th><th>Weight</th><th>Recorded By</th></tr></thead>
            <tbody>{vitals.map((v: Any) => (
              <tr key={v.id}>
                <td>{v.id}</td><td className="muted">{v.at}</td><td>{v.temp}</td><td>{v.bp}</td><td>{v.pulse}</td>
                <td>{v.resp}</td><td>{v.spo2}</td><td>{v.weight}</td><td><b>{v.staff}</b></td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}

      {tab === 'Investigations' && (
        <Card title={`Investigations — ${investigations.length} (laboratory & radiology)`}>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>ID</th><th>Dept</th><th>Test</th><th>Requested By</th><th>Date</th><th>Status</th><th>Result</th><th>Result By</th></tr></thead>
            <tbody>{investigations.map((i: Any) => (
              <tr key={i.id}>
                <td>{i.id}</td><td><Badge tone={i.dept === 'Lab' ? 'blue' : 'amber'}>{i.dept}</Badge></td>
                <td>{i.test}</td><td>{i.doctor}</td><td className="muted">{i.createdAt}</td>
                <td><Badge tone={statusTone(i.status)}>{i.status}</Badge></td>
                <td>{i.result ? <a href={fileUrl(i.result.image)} target="_blank" rel="noreferrer">View report</a> : '—'}</td>
                <td>{i.result?.by || '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}

      {tab === 'Prescriptions' && (
        <Card title={`Prescriptions — ${prescriptions.length}`}>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>RX</th><th>Date</th><th>Prescribed By</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>{prescriptions.map((r: Any) => (
              <tr key={r.id}>
                <td>{r.id}</td><td className="muted">{r.createdAt}</td><td>{r.doctor}</td>
                <td>{(r.items || []).map((i: Any) => `${i.drug} ×${i.qty}`).join(', ') || "—"}</td>
                <td className="money">{naira((r.items || []).reduce((s: number, i: Any) => s + i.qty * (i.price || 0), 0))}</td>
                <td><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}

      {tab === 'Payments' && (
        <Card title={`Payments — total ${naira(summary.totalPaid)}`}>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Reference</th><th>Service</th><th>Method</th><th>Amount</th><th>Received By</th><th>Date / Time</th><th>Status</th></tr></thead>
            <tbody>{payments.map((t: Any) => (
              <tr key={t.id}>
                <td>{t.ref}</td><td>{t.service}</td><td>{t.method}</td>
                <td className="money">{naira(t.amount)}</td><td>{t.staff}</td><td className="muted">{t.at}</td>
                <td><Badge tone={t.status === 'Paid' ? 'green' : 'amber'}>{t.status}</Badge></td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}

      {tab === 'Wallet' && (
        <Card title={`Wallet — balance ${naira(p.wallet)}`}>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>TX</th><th>Date / Time</th><th>Type</th><th>Amount</th><th>Reason</th><th>Staff</th><th>Method</th><th>Balance After</th></tr></thead>
            <tbody>{walletTxs.map((t: Any) => (
              <tr key={t.id}>
                <td>{t.id}</td><td className="muted">{t.at}</td>
                <td><Badge tone={t.type === 'Credit' ? 'green' : 'blue'}>{t.type}</Badge></td>
                <td className="money">{t.type === 'Credit' ? '+' : '−'}{naira(t.amount)}</td>
                <td>{t.reason}</td><td>{t.staff}</td><td>{t.method}</td><td className="money">{naira(t.balanceAfter)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}

      {tab === 'Admissions' && (
        <Card title={`Admissions — ${admissions.length}`}>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Admission</th><th>Ward</th><th>Bed</th><th>Doctor</th><th>Admitted</th><th>Reason</th><th>Status</th><th>Discharge Summary</th></tr></thead>
            <tbody>{admissions.map((a: Any) => (
              <tr key={a.id}>
                <td>{a.id}</td><td>{a.ward}</td><td>{a.bed}</td><td>{a.doctor}</td><td className="muted">{a.at}</td>
                <td>{a.reason}</td><td><Badge tone={statusTone(a.status)}>{a.status}</Badge></td>
                <td>{a.discharge ? `${a.discharge.diagnosis} — ${a.discharge.date} (${a.discharge.staff})` : '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}

      {tab === 'Activity' && (
        <Card title={`Activity — ${activity.length} recent events`}>
          {activity.length === 0
            ? <div className="muted" style={{ padding: '12px 14px' }}>No activity recorded yet.</div>
            : <Timeline items={activity.map((a: Any) => ({
                time: a.when || a.at,
                what: a.what || a.action,
                meta: `${a.who || a.staff || ''}${a.dept ? ' · ' + a.dept : ''}${a.extra ? ' · ' + a.extra : ''}`,
                green: Boolean(a.green),
              }))} />}
        </Card>
      )}

      {tab === 'Audit Trail' && (
        <Card title={`Audit Trail — ${auditTimeline.length} entries`}>
          {auditTimeline.length === 0
            ? <div className="muted" style={{ padding: '12px 14px' }}>No audit entries recorded yet.</div>
            : <Timeline items={auditTimeline} />}
        </Card>
      )}
    </Layout>
  )
}