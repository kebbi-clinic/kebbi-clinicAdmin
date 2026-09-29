import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Card, PageHead, Badge, statusTone, naira } from '../components/ui'
import { useFetch, useRealtime } from '../api'
import { paths } from '../endpoints'
import type { Patient } from '../data'

export default function Patients() {
  const [q, setQ] = useState('')
  const { data: list = [], loading, refetch } = useFetch<Patient[]>(paths.patients)
  useRealtime(() => refetch())
  const filtered = list.filter((p) => [p.id, p.firstName, p.surname, p.phone].join(' ').toLowerCase().includes(q.toLowerCase()))

  return (
    <Layout title="Patient Management">
      <PageHead title="Patient Management" sub="Broader read access than normal staff. Patient records are permanent — one ID per patient for life." />
      <Card className="mb">
        <div className="card-b"><div className="search-row">
          <input className="input" placeholder="Search by Patient ID, Name or Phone…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="muted">Patient ID is the primary identifier, e.g. <b>KBC-000245</b></span>
        </div></div>
      </Card>
      <Card title={`All Patients${loading ? ' (loading…)' : ` — ${filtered.length}`}`}>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Patient ID</th><th>Name</th><th>Gender</th><th>Phone</th><th>Registered</th><th>Wallet</th><th>Status</th><th></th></tr></thead>
          <tbody>{filtered.map((p) => (
            <tr key={p.id}>
              <td><b>{p.id}</b></td>
              <td><Link to={`/patients/${p.id}`}><b>{p.firstName} {p.surname}</b></Link></td><td>{p.gender}</td><td>{p.phone}</td>
              <td>{p.registered}</td><td className="money">{naira(p.wallet)}</td>
              <td><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
              <td className="right"><Link to={`/patients/${p.id}`} className="btn primary sm">Open Full Record</Link></td>
            </tr>
          ))}</tbody>
        </table></div>
      </Card>
    </Layout>
  )
}

