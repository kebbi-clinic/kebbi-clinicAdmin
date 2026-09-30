import { useState } from 'react'
import { Layout } from '../components/Layout'
import { Card, PageHead, Field, Badge } from '../components/ui'
import { useFetch } from '../api'
import { paths, settingsApi } from '../endpoints'

interface Settings { hospital: Record<string, string>; investigationTypes: string[]; drugCategories: string[]; paymentMethods: string[] }

export default function SettingsPage() {
  const { data: s, refetch } = useFetch<Settings>(paths.settings)
  const [newTest, setNewTest] = useState('')
  const [newCat, setNewCat] = useState('')
  const [newMethod, setNewMethod] = useState('')
  const [ok, setOk] = useState('')
  const [err, setErr] = useState('')
  if (!s || !s.hospital) return <Layout title="System Settings"><div className="muted">Loading…</div></Layout>
  /* These lists are optional: guard each one so a partial/older backend payload
     renders an empty group instead of throwing and blanking the whole app. */
  const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : [])
  const investigationTypes = arr(s.investigationTypes)
  const drugCategories = arr(s.drugCategories)
  const paymentMethods = arr(s.paymentMethods)

  const save = async (next: Partial<Settings>) => {
    try { await settingsApi.update(next); setOk('Settings saved.'); refetch() }
    catch (e) { setErr((e as Error).message) }
  }
  const addToList = (key: 'investigationTypes' | 'drugCategories' | 'paymentMethods', value: string, clear: () => void) => {
    if (!value.trim()) return
    save({ [key]: [...arr(s[key]), value.trim()] } as Partial<Settings>)
    clear()
  }

  return (
    <Layout title="System Settings">
      <PageHead title="System Settings" sub="Everything the hospital may want to change later is configurable here — no developer needed.">
        {ok && <Badge tone="green">{ok}</Badge>}
        {err && <Badge tone="red">{err}</Badge>}
      </PageHead>
      <div className="grid cols-2">
        <Card title="Hospital Information">
          <div className="form-grid">
            <Field label="Hospital Name" full><input className="input" defaultValue={s.hospital.name} onBlur={(e) => save({ hospital: { name: e.target.value } })} /></Field>
            <Field label="Address" full><input className="input" defaultValue={s.hospital.address} onBlur={(e) => save({ hospital: { address: e.target.value } })} /></Field>
            <Field label="Phone"><input className="input" defaultValue={s.hospital.phone} onBlur={(e) => save({ hospital: { phone: e.target.value } })} /></Field>
            <Field label="Email"><input className="input" defaultValue={s.hospital.email} onBlur={(e) => save({ hospital: { email: e.target.value } })} /></Field>
          </div>
          <div className="muted">Changes save when a field loses focus. All apps read these settings live.</div>
        </Card>
        <Card title="Investigation Types (Laboratory)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {investigationTypes.map((t) => <Badge key={t} tone="blue">{t}</Badge>)}
          </div>
          <div className="search-row">
            <input className="input" placeholder="Add new test e.g. Malaria Test" value={newTest} onChange={(e) => setNewTest(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addToList('investigationTypes', newTest, () => setNewTest(''))} />
            <button className="btn green sm" onClick={() => addToList('investigationTypes', newTest, () => setNewTest(''))}>Add</button>
          </div>
        </Card>
        <Card title="Drug Categories">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {drugCategories.map((t) => <Badge key={t} tone="green">{t}</Badge>)}
          </div>
          <div className="search-row">
            <input className="input" placeholder="Add new category" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addToList('drugCategories', newCat, () => setNewCat(''))} />
            <button className="btn green sm" onClick={() => addToList('drugCategories', newCat, () => setNewCat(''))}>Add</button>
          </div>
        </Card>
        <Card title="Payment Methods">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {paymentMethods.map((t) => <Badge key={t} tone="blue">{t}</Badge>)}
          </div>
          <div className="search-row">
            <input className="input" placeholder="Add new payment method" value={newMethod} onChange={(e) => setNewMethod(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addToList('paymentMethods', newMethod, () => setNewMethod(''))} />
            <button className="btn green sm" onClick={() => addToList('paymentMethods', newMethod, () => setNewMethod(''))}>Add</button>
          </div>
        </Card>
        <Card title="Staff Roles & Permissions">
          <div className="muted mb">Roles: Doctor · Nurse · Records Officer · Pharmacist · Accountant · Laboratory Scientist · Radiologist — managed on the Staff & Roles page. Permissions are enforced server-side.</div>
        </Card>
        <Card title="Security & System">
          <div className="muted mb">
            · Passwords are bcrypt-hashed in the database.<br />
            · Sessions use signed JWTs (12-hour expiry).<br />
            · Every department action is written to the audit log.<br />
            · Uploaded lab/radiology images are validated (PNG/JPG/WebP/PDF, max 10&nbsp;MB).<br />
            · The JSON file store is swappable for PostgreSQL/MongoDB without changing the API.
          </div>
        </Card>
      </div>
    </Layout>
  )
}

