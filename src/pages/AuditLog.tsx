import { useMemo, useState } from 'react'
import { Layout } from '../components/Layout'
import { Card, PageHead, Badge, Tabs, StatCard } from '../components/ui'
import { useFetch } from '../api'
import { paths } from '../endpoints'

interface AuditEntry { who: string; action: string; target: string; extra?: string; when: string; dept: string }

const deptTone = (d: string): 'green' | 'blue' | 'red' | 'amber' | 'gray' =>
  d === 'System' || d === 'Admin' || d === 'Administration' ? 'gray'
    : d === 'Accounting' ? 'green'
    : d === 'Doctor' || d === 'Pharmacy' || d === 'Radiology' ? 'blue'
    : 'amber'

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || '?'

/** Audit `when` looks like "2026-09-28 · 10:15" — split it for day grouping. */
const dateOf = (when: string) => String(when || '').split(' · ')[0] || when
const timeOf = (when: string) => String(when || '').split(' · ')[1] || when

interface Person { who: string; entries: AuditEntry[]; depts: string[]; last: string }

export default function AuditLog() {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('People')
  const [selected, setSelected] = useState<string | null>(null)
  const { data, loading, error } = useFetch<AuditEntry[]>(paths.adminAudit(''), [])
  const all = Array.isArray(data) ? data : []

  /* One fetch, filtered client-side: typing in the box never re-hits the API. */
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return all
    return all.filter((a) => [a.who, a.action, a.target, a.extra, a.dept].some((v) => String(v || '').toLowerCase().includes(needle)))
  }, [all, q])

  const people: Person[] = useMemo(() => {
    const map = new Map<string, AuditEntry[]>()
    for (const a of filtered) {
      const key = a.who || 'Unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    return Array.from(map, ([who, entries]) => ({
      who, entries,
      depts: Array.from(new Set(entries.map((e) => e.dept).filter(Boolean))),
      last: entries[0]?.when || '',
    })).sort((a, b) => b.entries.length - a.entries.length)
  }, [filtered])

  const person = selected ? people.find((p) => p.who === selected) : null
  const today = new Date().toISOString().slice(0, 10)
  const todayCount = all.filter((a) => dateOf(a.when) === today).length

  return (
    <Layout title="Audit Trail">
      <PageHead title="Audit Trail" sub="Who did what, to which patient or record, and when — click any person to open their complete activity history." />
      {loading && <div className="muted">Loading audit trail…</div>}
      {error && !data && <div className="card-b" style={{ color: 'var(--red-600)' }}>Could not load the audit trail: {error}</div>}
      {!loading && data && (<>
        <div className="grid cols-4 mb">
          <StatCard icon="clock" value={all.length} label="Events Logged" />
          <StatCard icon="patients" value={people.length} label="People With Activity" tone="blue" />
          <StatCard icon="bell" value={todayCount} label="Events Today" tone="green" />
          <StatCard icon="shield" value={new Set(all.map((a) => a.dept).filter(Boolean)).size} label="Departments" tone="amber" />
        </div>

        {person ? (<>
          <div className="person-head">
            <button className="btn ghost sm" onClick={() => setSelected(null)}>← Back</button>
            <div className="avatar" style={{ width: 44, height: 44, fontSize: 15 }}>{initials(person.who)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{person.who}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                {person.entries.length} action{person.entries.length === 1 ? '' : 's'} · {person.depts.length} department{person.depts.length === 1 ? '' : 's'} · last seen {person.last}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {person.depts.map((d) => <Badge key={d} tone={deptTone(d)}>{d}</Badge>)}
            </div>
          </div>
          <PersonTimeline entries={person.entries} />
        </>) : (<>
          <Tabs tabs={['People', 'All Activity']} active={tab} onChange={setTab} />
          <div className="card-b" style={{ padding: '0 0 10px' }}>
            <input className="input" style={{ maxWidth: 420 }} placeholder="Search staff, action, patient ID or department…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          {tab === 'People' && (filtered.length === 0
            ? <Card><div className="muted" style={{ padding: 10 }}>No matching activity.</div></Card>
            : <div className="person-grid">
              {people.map((p) => (
                <button key={p.who} className="person-card" onClick={() => setSelected(p.who)}>
                  <div className="avatar">{initials(p.who)}</div>
                  <div className="pc-body">
                    <div className="pc-name">{p.who}</div>
                    <div className="pc-sub">{p.entries[0]?.action} · {p.entries[0]?.when}</div>
                    <div className="pc-depts">{p.depts.slice(0, 3).map((d) => <Badge key={d} tone={deptTone(d)}>{d}</Badge>)}</div>
                  </div>
                  <div className="pc-count">{p.entries.length}</div>
                </button>
              ))}
            </div>)}

          {tab === 'All Activity' && (
            <Card>
              <div className="tbl-wrap"><table className="tbl">
                <thead><tr><th>Who</th><th>Did What</th><th>Patient / Record</th><th>Details</th><th>Department</th><th>When</th></tr></thead>
                <tbody>{filtered.map((a, i) => (
                  <tr key={i}>
                    <td><button className="link-btn" onClick={() => { setSelected(a.who); setTab('People') }}><b>{a.who}</b></button></td>
                    <td>{a.action}</td><td>{a.target}</td><td className="muted">{a.extra || '—'}</td>
                    <td><Badge tone={deptTone(a.dept)}>{a.dept}</Badge></td><td>{a.when}</td>
                  </tr>
                ))}</tbody>
              </table></div>
              {filtered.length === 0 && <div className="muted" style={{ padding: 10 }}>No matching activity.</div>}
            </Card>
          )}
        </>)}
      </>)}
    </Layout>
  )
}

/** One person's full history, grouped by day, newest first. */
function PersonTimeline({ entries }: { entries: AuditEntry[] }) {
  const days = useMemo(() => {
    const map = new Map<string, AuditEntry[]>()
    for (const a of entries) {
      const d = dateOf(a.when)
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(a)
    }
    return Array.from(map)
  }, [entries])
  return (
    <Card title="Complete Activity History">
      <div className="card-b">
        {days.map(([day, rows]) => (
          <div key={day} className="audit-day">
            <div className="audit-day-h">{day}{day === new Date().toISOString().slice(0, 10) ? ' · today' : ''}</div>
            <div className="timeline">
              {rows.map((a, i) => (
                <div key={i} className="tl-item">
                  <div className="t">{timeOf(a.when)} · <Badge tone={deptTone(a.dept)}>{a.dept}</Badge></div>
                  <div className="what">{a.action}</div>
                  <div className="meta">
                    <b>{a.target}</b>{a.extra ? ` — ${a.extra}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

