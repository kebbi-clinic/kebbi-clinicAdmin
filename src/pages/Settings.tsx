import { useState } from 'react'
import { Layout } from '../components/Layout'
import { Card, PageHead, Field, Badge, Tabs, Modal, naira } from '../components/ui'
import { useFetch } from '../api'
import { paths, serviceApi, settingsApi } from '../endpoints'

interface Settings {
  hospital: Record<string, string>
  investigationTypes: string[]; drugCategories: string[]; paymentMethods: string[]
  activationFee?: number
  defaultNightlyRate?: number
}
interface Service { id: string; name: string; category: string; department: string; amount: number; active: boolean; notes?: string }

export default function SettingsPage() {
  const { data: s, refetch } = useFetch<Settings>(paths.settings)
  const { data: services = [], refetch: refetchServices } = useFetch<Service[]>(paths.services)
  const [newTest, setNewTest] = useState('')
  const [newCat, setNewCat] = useState('')
  const [newMethod, setNewMethod] = useState('')
  const [ok, setOk] = useState('')
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('General')
  /* Procedures & services */
  const [showAdd, setShowAdd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sv, setSv] = useState<Record<string, string>>({ category: 'Procedure', department: 'General' })
  const [editingService, setEditingService] = useState<Service | null>(null)
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

  /* ---- Procedures & services ---- */
  const resetService = () => { setSv({ category: 'Procedure', department: 'General' }); setErr(''); setOk('') }
  const createService = async () => {
    if (!sv.name?.trim()) { setErr('Give the procedure or service a name.'); return }
    if (sv.amount === undefined || sv.amount === '' || Number.isNaN(Number(sv.amount))) {
      setErr('Enter the amount charged for it.'); return
    }
    setBusy(true); setErr(''); setOk('')
    try {
      await serviceApi.create({
        name: sv.name.trim(), amount: Number(sv.amount),
        category: sv.category || 'Procedure', department: sv.department || 'General',
        notes: sv.notes || '',
      })
      setOk(`Procedure/service "${sv.name.trim()}" created at ${naira(Number(sv.amount))}.`)
      setShowAdd(false); resetService(); refetchServices()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const saveService = async () => {
    if (!editingService) return
    setBusy(true); setErr(''); setOk('')
    try {
      await serviceApi.update(editingService.id, {
        name: sv.name, amount: Number(sv.amount),
        category: sv.category, department: sv.department,
        notes: sv.notes ?? '', active: sv.active !== 'false',
      })
      setOk(`"${sv.name}" updated.`)
      setEditingService(null); refetchServices()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const openEdit = (sv2: Service) => {
    setEditingService(sv2)
    setSv({
      name: sv2.name, amount: String(sv2.amount), category: sv2.category || 'Procedure',
      department: sv2.department || 'General', notes: sv2.notes || '',
      active: sv2.active ? 'true' : 'false',
    })
    setErr(''); setOk('')
  }

  return (
    <Layout title="System Settings">
      <PageHead title="System Settings" sub="Everything the hospital may want to change later is configurable here — no developer needed.">
        {ok && <Badge tone="green">{ok}</Badge>}
        {err && !showAdd && !editingService && <Badge tone="red">{err}</Badge>}
      </PageHead>
      <Tabs tabs={['General', 'Fees & Charges', 'Procedures & Services']} active={tab} onChange={setTab} />

      {tab === 'General' && (
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
      )}

      {tab === 'Fees & Charges' && (
        <div className="grid cols-2">
          <Card title="Patient Activation Fee">
            <div className="form-grid">
              <Field label="Fee charged when a Records Officer activates a patient (₦)" full>
                <input className="input" type="number" min={0} defaultValue={s.activationFee ?? 0}
                  onBlur={(e) => save({ activationFee: Number(e.target.value) || 0 })} />
              </Field>
            </div>
            <div className="muted">
              Deducted from the patient's wallet the moment they are activated, with a matching wallet-ledger
              entry and a paid payment record. Activation is blocked when the wallet cannot cover it.
              Set to <b>0</b> to activate without a charge.
            </div>
          </Card>
          <Card title="Default Bed Rate (per night)">
            <div className="form-grid">
              <Field label="Default cost per night for an admission (₦)" full>
                <input className="input" type="number" min={0} defaultValue={s.defaultNightlyRate ?? 0}
                  onBlur={(e) => save({ defaultNightlyRate: Number(e.target.value) || 0 })} />
              </Field>
            </div>
            <div className="muted">
              Pre-fills the "cost per night" box on the doctor's consultation screen. The doctor sets the number of
              nights per admission; the total is <b>days × cost per night</b> and is billed to the patient's wallet.
            </div>
          </Card>
          <Card title="How automatic charges work">
            <div className="muted mb">
              · <b>Activation</b> — the fee above is taken from the wallet when the Records Officer activates a patient.<br />
              · <b>Drugs</b> — the prescription cost is taken from the wallet when the pharmacist dispenses it; any
                shortfall is raised as a pending payment for the accountant.<br />
              · <b>Admissions</b> — days × cost per night is charged on admission; a short balance becomes a pending payment.<br />
              · <b>Procedures &amp; services</b> — the catalogue price is charged to the wallet when a nurse or doctor records it.
            </div>
            <div className="muted">Every one of these writes a payment record, a wallet-ledger row and an activity entry.</div>
          </Card>
        </div>
      )}

      {tab === 'Procedures & Services' && (
        <Card title="Procedures & Services" actions={<button className="btn primary" onClick={() => { setShowAdd(true); resetService() }}>+ New Procedure / Service</button>}>
          <div className="muted mb">
            Nurses and doctors record these from the "Procedures &amp; Services" page in the hospital app. The amount you
            set here is what gets billed to the patient's wallet when it is performed.
          </div>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Department</th><th>Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {services.length === 0 && <tr><td colSpan={7} className="muted">No procedures or services yet — create the first one.</td></tr>}
              {services.map((sv2) => (
                <tr key={sv2.id}>
                  <td>{sv2.id}</td>
                  <td><b>{sv2.name}</b>{sv2.notes ? <div className="muted">{sv2.notes}</div> : null}</td>
                  <td>{sv2.category}</td>
                  <td>{sv2.department}</td>
                  <td className="money">{naira(sv2.amount)}</td>
                  <td>{sv2.active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Retired</Badge>}</td>
                  <td className="right"><button className="btn ghost sm" onClick={() => openEdit(sv2)}>Edit / Price</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
      )}
    </Layout>
  )

      {showAdd && (
        <Modal title="New Procedure / Service" onClose={() => setShowAdd(false)}
          footer={<><button className="btn ghost" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn green" disabled={busy} onClick={createService}>{busy ? 'Creating…' : 'Create'}</button></>}>
          {err && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
          <div className="form-grid">
            <Field label="Name" full><input className="input" value={sv.name || ''} onChange={(e) => setSv({ ...sv, name: e.target.value })} placeholder="e.g. Wound dressing" /></Field>
            <Field label="Amount (₦)" full><input className="input" type="number" min={0} value={sv.amount || ''} onChange={(e) => setSv({ ...sv, amount: e.target.value })} placeholder="0" /></Field>
            <Field label="Category"><select className="input" value={sv.category} onChange={(e) => setSv({ ...sv, category: e.target.value })}>
              <option>Procedure</option><option>Service</option><option>Diagnostic</option><option>Surgical</option><option>Nursing</option>
            </select></Field>
            <Field label="Department"><select className="input" value={sv.department} onChange={(e) => setSv({ ...sv, department: e.target.value })}>
              <option>General</option><option>Ward</option><option>Theatre</option><option>Laboratory</option><option>Radiology</option><option>Outpatient</option>
            </select></Field>
            <Field label="Notes" full><textarea className="input" rows={2} value={sv.notes || ''} onChange={(e) => setSv({ ...sv, notes: e.target.value })} /></Field>
          </div>
        </Modal>
      )}

      {editingService && (
        <Modal title={`Edit — ${editingService?.name ?? 'procedure'}`} onClose={() => setEditingService(null)}
          footer={<><button className="btn ghost" onClick={() => setEditingService(null)}>Cancel</button>
            <button className="btn green" disabled={busy} onClick={saveService}>{busy ? 'Saving…' : 'Save Changes'}</button></>}>
          {err && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
          <div className="form-grid">
            <Field label="Name" full><input className="input" value={sv.name || ''} onChange={(e) => setSv({ ...sv, name: e.target.value })} /></Field>
            <Field label="Amount (₦)" full><input className="input" type="number" min={0} value={sv.amount || ''} onChange={(e) => setSv({ ...sv, amount: e.target.value })} /></Field>
            <Field label="Status" full><select className="input" value={sv.active || 'true'} onChange={(e) => setSv({ ...sv, active: e.target.value })}>
              <option value="true">Active — can be performed</option>
              <option value="false">Retired — hidden from staff</option>
            </select></Field>
            <Field label="Notes" full><textarea className="input" rows={2} value={sv.notes || ''} onChange={(e) => setSv({ ...sv, notes: e.target.value })} /></Field>
          </div>
        </Modal>
      )}

}

