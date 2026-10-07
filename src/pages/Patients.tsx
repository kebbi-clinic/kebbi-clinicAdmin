import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Card, PageHead, Badge, statusTone, naira } from '../components/ui'
import { api, useRealtime } from '../api'
import { paths } from '../endpoints'
import type { Patient } from '../data'

/** Pull a Patient[] out of whatever the endpoint returns. */
function toPatientArray(raw: unknown): Patient[] {
  if (Array.isArray(raw)) return raw as Patient[]
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    for (const key of ['data', 'list', 'patients', 'rows', 'items', 'results']) {
      if (Array.isArray(obj[key])) return obj[key] as Patient[]
    }
  }
  return []
}

export default function Patients() {
  const [q, setQ] = useState('')
  const [list, setList] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')

  const load = async () => {
    setLoading(true)
    setLoadErr('')
    try {
      const raw = await api.get(paths.patients)
      // If your api.get returns a raw Response, replace the line above with:
      // const raw = await (await api.get(paths.patients)).json()
      console.log('[Patients] raw payload →', raw)
      setList(toPatientArray(raw))
    } catch (e) {
      console.error('[Patients] load failed →', e)
      setLoadErr((e as Error).message || 'Failed to load patients')
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useRealtime(() => load())

  const filtered = useMemo(
    () =>
      list.filter((p) =>
        [p.id, p.firstName, p.surname, p.phone]
          .join(' ')
          .toLowerCase()
          .includes(q.toLowerCase()),
      ),
    [list, q],
  )

  return (
    <Layout title="Patient Management">
      <PageHead
        title="Patient Management"
        sub="Broader read access than normal staff. Patient records are permanent — one ID per patient for life."
      />

      {loadErr && (
        <div
          className="demo-note mb"
          style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}
        >
          Could not load patients: {loadErr}{' '}
          <button className="btn ghost sm" onClick={load}>Retry</button>
        </div>
      )}

      <Card className="mb">
        <div className="card-b">
          <div className="search-row">
            <input
              className="input"
              placeholder="Search by Patient ID, Name or Phone…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <span className="muted">
              Patient ID is the primary identifier, e.g. <b>KBC-000245</b>
            </span>
          </div>
        </div>
      </Card>

      <Card title={`All Patients${loading ? ' (loading…)' : ` — ${filtered.length}`}`}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Name</th>
                <th>Gender</th>
                <th>Phone</th>
                <th>Registered</th>
                <th>Wallet</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="muted"
                    style={{ textAlign: 'center', padding: '22px 14px' }}
                  >
                    Loading patients…
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.id}</b></td>
                    <td>
                      <Link to={`/patients/${p.id}`}>
                        <b>{p.firstName} {p.surname}</b>
                      </Link>
                    </td>
                    <td>{p.gender}</td>
                    <td>{p.phone}</td>
                    <td>{p.registered}</td>
                    <td className="money">{naira(p.wallet)}</td>
                    <td><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
                    <td className="right">
                      <Link to={`/patients/${p.id}`} className="btn primary sm">
                        Open Full Record
                      </Link>
                    </td>
                  </tr>
                ))}
              {!loading && filtered.length === 0 && !loadErr && (
                <tr>
                  <td
                    colSpan={8}
                    className="muted"
                    style={{ textAlign: 'center', padding: '22px 14px' }}
                  >
                    {q.trim()
                      ? <>No patient matches <b>{q}</b>.</>
                      : 'No patients here yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </Layout>
  )
}