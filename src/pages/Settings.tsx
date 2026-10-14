import { useState } from 'react'
import { Layout } from '../components/Layout'
import { Card, PageHead, Field, Badge, Tabs, Modal, naira } from '../components/ui'
import { useFetch } from '../api'
import { paths, serviceApi, settingsApi, testApi } from '../endpoints'
import type { TestItem } from '../data'

interface Settings {
  hospital: Record<string, string>
  investigationTypes: string[]; drugCategories: string[]; paymentMethods: string[]
  activationFee?: number
  defaultNightlyRate?: number
}
interface Service { id: string; name: string; amount: number; quantity: number }

type ListKey = 'investigationTypes' | 'drugCategories' | 'paymentMethods'
type EditChip = { key: ListKey; value: string; index: number } | null

export default function SettingsPage() {
  const { data: s, refetch } = useFetch<Settings>(paths.settings)
  const { data: servicesRaw, refetch: refetchServices } = useFetch<unknown>(paths.services)
  const services: Service[] = Array.isArray(servicesRaw)
    ? (servicesRaw as Service[])
    : Array.isArray((servicesRaw as any)?.data) ? ((servicesRaw as any).data as Service[])
    : Array.isArray((servicesRaw as any)?.list) ? ((servicesRaw as any).list as Service[])
    : []
  /* Laboratory & radiology test catalogue — the editable investigation prices
     (e.g. PCV = ₦2,000) that get billed from the wallet at result upload. */
  const { data: testsRaw, refetch: refetchTests } = useFetch<unknown>(paths.tests())
  const tests: TestItem[] = Array.isArray(testsRaw)
    ? (testsRaw as TestItem[])
    : Array.isArray((testsRaw as any)?.data) ? ((testsRaw as any).data as TestItem[])
    : Array.isArray((testsRaw as any)?.list) ? ((testsRaw as any).list as TestItem[])
    : []

  const [newTest, setNewTest] = useState('')
  const [newCat, setNewCat] = useState('')
  const [newMethod, setNewMethod] = useState('')
  const [ok, setOk] = useState('')
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('General')

  /* Hospital info — editable copies with a per-field Save */
  const [hospital, setHospital] = useState<Record<string, string> | null>(null)

  /* Chip-list edit modal */
  const [editChip, setEditChip] = useState<EditChip>(null)
  const [chipDraft, setChipDraft] = useState('')

  /* Fees — editable copies with a per-field Save */
  const [activationFee, setActivationFee] = useState<string | null>(null)
  const [nightlyRate, setNightlyRate] = useState<string | null>(null)

  /* Procedures — add & edit share one form; delete uses a confirm modal */
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [deleting, setDeleting] = useState<Service | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', amount: '', quantity: '1' })

  /* Lab & radiology tests — add & edit share one form (the investigation
     price list, e.g. PCV = ₦2,000). */
  const [showTest, setShowTest] = useState(false)
  const [editingTest, setEditingTest] = useState<TestItem | null>(null)
  const [deletingTest, setDeletingTest] = useState<TestItem | null>(null)
  const [testForm, setTestForm] = useState({ name: '', dept: 'Lab', category: 'General', price: '', stock: '0', minStock: '0' })

  if (!s || !s.hospital) return <Layout title="System Settings"><div className="muted">Loading…</div></Layout>

  const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : [])
  const investigationTypes = arr(s.investigationTypes)
  const drugCategories = arr(s.drugCategories)
  const paymentMethods = arr(s.paymentMethods)

  const listFor = (key: ListKey): string[] =>
    key === 'investigationTypes' ? investigationTypes :
    key === 'drugCategories' ? drugCategories : paymentMethods

  const save = async (next: Partial<Settings>, success = 'Settings saved.') => {
    try { await settingsApi.update(next); setOk(success); setErr(''); refetch() }
    catch (e) { setErr((e as Error).message) }
  }

  /* ---- Hospital info ---- */
  const h = hospital ?? s.hospital
  const setH = (k: string, v: string) => setHospital({ ...h, [k]: v })
  const saveHospital = async () => {
    await save({ hospital: h }, 'Hospital information saved.')
    setHospital(null)
  }

  /* ---- Chip lists ---- */
  const addToList = (key: ListKey, value: string, clear: () => void) => {
    if (!value.trim()) return
    save({ [key]: [...listFor(key), value.trim()] } as Partial<Settings>, 'Item added.')
    clear()
  }
  const removeFromList = (key: ListKey, value: string) =>
    save({ [key]: listFor(key).filter((x) => x !== value) } as Partial<Settings>, 'Item removed.')

  const openChipEdit = (key: ListKey, value: string, index: number) => {
    setEditChip({ key, value, index }); setChipDraft(value); setErr(''); setOk('')
  }
  const saveChipEdit = async () => {
    if (!editChip) return
    const next = chipDraft.trim()
    if (!next) { setErr('Enter a value.'); return }
    const list = [...listFor(editChip.key)]
    list[editChip.index] = next
    await save({ [editChip.key]: list } as Partial<Settings>, 'Item updated.')
    setEditChip(null)
  }

  /* ---- Fees ---- */
  const saveActivationFee = async () => {
    await save({ activationFee: Number(activationFee ?? s.activationFee) || 0 }, 'Activation fee saved.')
    setActivationFee(null)
  }
  const saveNightlyRate = async () => {
    await save({ defaultNightlyRate: Number(nightlyRate ?? s.defaultNightlyRate) || 0 }, 'Bed rate saved.')
    setNightlyRate(null)
  }

  /* ---- Procedures ---- */
  const resetProcedure = () => { setForm({ name: '', amount: '', quantity: '1' }); setErr(''); setOk('') }
  const openAdd = () => { resetProcedure(); setEditing(null); setShowAdd(true) }
  const openEdit = (sv: Service) => {
    setEditing(sv)
    setForm({ name: sv.name, amount: String(sv.amount), quantity: String(sv.quantity) })
    setErr(''); setOk(''); setShowAdd(true)
  }
  const validate = (): string | null => {
    if (!form.name.trim()) return 'Enter the procedure name.'
    if (form.amount === '' || Number.isNaN(Number(form.amount))) return 'Enter the amount.'
    if (form.quantity === '' || Number(form.quantity) < 1 || Number.isNaN(Number(form.quantity)))
      return 'Enter a quantity of at least 1.'
    return null
  }
  const saveProcedure = async () => {
    const v = validate()
    if (v) { setErr(v); return }
    setBusy(true); setErr(''); setOk('')
    try {
      if (editing) {
        await serviceApi.update(editing.id, {
          name: form.name.trim(), amount: Number(form.amount), quantity: Number(form.quantity),
        })
        setOk(`Procedure "${form.name.trim()}" updated.`)
      } else {
        await serviceApi.create({
          name: form.name.trim(), amount: Number(form.amount), quantity: Number(form.quantity),
        })
        setOk(`Procedure "${form.name.trim()}" added — ${form.quantity} × ${naira(Number(form.amount))}.`)
      }
      setShowAdd(false); setEditing(null); resetProcedure(); refetchServices()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true); setErr('')
    try {
      await serviceApi.remove(deleting.id)
      setOk(`Procedure "${deleting.name}" deleted.`)
      setDeleting(null); refetchServices()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const procedureTotal = (Number(form.amount) || 0) * (Number(form.quantity) || 0)

  /* ---- Laboratory & radiology test prices ---- */
  const resetTest = () => { setTestForm({ name: '', dept: 'Lab', category: 'General', price: '', stock: '0', minStock: '0' }); setErr(''); setOk('') }
  const openAddTest = () => { resetTest(); setEditingTest(null); setShowTest(true) }
  const openEditTest = (t: TestItem) => {
    setEditingTest(t)
    setTestForm({ name: t.name, dept: t.dept, category: t.category || 'General', price: String(t.price), stock: String(t.stock || 0), minStock: String(t.minStock || 0) })
    setErr(''); setOk(''); setShowTest(true)
  }
  const saveTest = async () => {
    if (!testForm.name.trim()) { setErr('Enter the test name.'); return }
    if (testForm.price === '' || Number.isNaN(Number(testForm.price))) { setErr('Enter the price.'); return }
    setBusy(true); setErr(''); setOk('')
    try {
      const body = {
        name: testForm.name.trim(), dept: testForm.dept, category: testForm.category || 'General',
        price: Number(testForm.price), stock: Number(testForm.stock) || 0, minStock: Number(testForm.minStock) || 0,
      }
      if (editingTest) {
        await testApi.update(editingTest.id, body)
        setOk(`"${body.name}" updated to ${naira(body.price)} — applied on the next result upload.`)
      } else {
        await testApi.create(body)
        setOk(`"${body.name}" added at ${naira(body.price)}.`)
      }
      setShowTest(false); setEditingTest(null); resetTest(); refetchTests()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const confirmDeleteTest = async () => {
    if (!deletingTest) return
    setBusy(true); setErr('')
    try {
      await testApi.remove(deletingTest.id)
      setOk(`"${deletingTest.name}" deleted from the inventory.`)
      setDeletingTest(null); refetchTests()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const labTests = tests.filter((t) => t.dept !== 'Radiology')
  const radTests = tests.filter((t) => t.dept === 'Radiology')

  const chipCard = (key: ListKey, title: string, tone: 'blue' | 'green', newVal: string, setNewVal: (v: string) => void, placeholder: string) => (
    <Card title={title}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {listFor(key).map((t, i) => (
          <span key={`${t}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Badge tone={tone}>{t}</Badge>
            <button className="btn ghost sm" title="Edit" onClick={() => openChipEdit(key, t, i)}>Edit</button>
            <button className="btn ghost sm" title="Remove" style={{ color: 'var(--red-600)' }} onClick={() => removeFromList(key, t)}>×</button>
          </span>
        ))}
        {listFor(key).length === 0 && <span className="muted">None yet.</span>}
      </div>
      <div className="search-row">
        <input className="input" placeholder={placeholder} value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addToList(key, newVal, () => setNewVal(''))} />
        <button className="btn green sm" onClick={() => addToList(key, newVal, () => setNewVal(''))}>Add</button>
      </div>
    </Card>
  )

  return (
    <Layout title="System Settings">
      <PageHead title="System Settings" sub="Everything the hospital may want to change later is configurable here — no developer needed.">
        {ok && <Badge tone="green">{ok}</Badge>}
        {err && !showAdd && !deleting && !editChip && !showTest && !deletingTest && <Badge tone="red">{err}</Badge>}
      </PageHead>
      <Tabs tabs={['General', 'Fees & Charges', 'Procedures', 'Lab & Radiology']} active={tab} onChange={setTab} />

      {tab === 'General' && (
      <div className="grid cols-2">
        <Card title="Hospital Information" actions={<button className="btn primary sm" onClick={saveHospital}>Save</button>}>
          <div className="form-grid">
            <Field label="Hospital Name" full><input className="input" value={h.name || ''} onChange={(e) => setH('name', e.target.value)} /></Field>
            <Field label="Address" full><input className="input" value={h.address || ''} onChange={(e) => setH('address', e.target.value)} /></Field>
            <Field label="Phone"><input className="input" value={h.phone || ''} onChange={(e) => setH('phone', e.target.value)} /></Field>
            <Field label="Email"><input className="input" value={h.email || ''} onChange={(e) => setH('email', e.target.value)} /></Field>
          </div>
          <div className="muted">Edit any field, then press <b>Save</b>. All apps read these settings live.</div>
        </Card>

        {chipCard('investigationTypes', 'Investigation Types (Laboratory)', 'blue', newTest, setNewTest, 'Add new test e.g. Malaria Test')}
        {chipCard('drugCategories', 'Drug Categories', 'green', newCat, setNewCat, 'Add new category')}
        {chipCard('paymentMethods', 'Payment Methods', 'blue', newMethod, setNewMethod, 'Add new payment method')}

        <Card title="Staff Roles & Permissions">
          <div className="muted mb">Roles: Doctor · Nurse · Records Officer · Pharmacist · Accountant · Laboratory Scientist · Radiologist — managed on the Staff &amp; Roles page. Permissions are enforced server-side.</div>
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
          <Card title="Patient Activation Fee" actions={<button className="btn primary sm" onClick={saveActivationFee}>Save</button>}>
            <div className="form-grid">
              <Field label="Fee charged when a Records Officer activates a patient (₦)" full>
                <input className="input" type="number" min={0}
                  value={activationFee ?? String(s.activationFee ?? 0)}
                  onChange={(e) => setActivationFee(e.target.value)} />
              </Field>
            </div>
            <div className="muted">
              Deducted from the patient's wallet the moment they are activated, with a matching wallet-ledger
              entry and a paid payment record. Activation is blocked when the wallet cannot cover it.
              Set to <b>0</b> to activate without a charge.
            </div>
          </Card>
          <Card title="Default Bed Rate (per night)" actions={<button className="btn primary sm" onClick={saveNightlyRate}>Save</button>}>
            <div className="form-grid">
              <Field label="Default cost per night for an admission (₦)" full>
                <input className="input" type="number" min={0}
                  value={nightlyRate ?? String(s.defaultNightlyRate ?? 0)}
                  onChange={(e) => setNightlyRate(e.target.value)} />
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
              · <b>Procedures</b> — the catalogue price × quantity is charged to the wallet when a nurse or doctor records it.
            </div>
            <div className="muted">Every one of these writes a payment record, a wallet-ledger row and an activity entry.</div>
          </Card>
        </div>
      )}

      {tab === 'Procedures' && (
        <Card title="Procedures" actions={<button className="btn primary" onClick={openAdd}>+ Add Procedure</button>}>
          <div className="muted mb">
            Nurses and doctors record these from the "Procedures" page in the hospital app. The amount is the unit price;
            the recorder multiplies it by the quantity performed.
          </div>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>ID</th><th>Procedure</th><th>Amount</th><th>Quantity</th><th>Total</th><th></th></tr></thead>
            <tbody>
              {services.length === 0 && <tr><td colSpan={6} className="muted">No procedures yet — add the first one.</td></tr>}
              {services.map((sv2) => (
                <tr key={sv2.id}>
                  <td>{sv2.id}</td>
                  <td><b>{sv2.name}</b></td>
                  <td className="money">{naira(sv2.amount)}</td>
                  <td>{sv2.quantity}</td>
                  <td className="money">{naira(Number(sv2.amount) * Number(sv2.quantity))}</td>
                  <td className="right">
                    <button className="btn ghost sm" onClick={() => openEdit(sv2)}>Edit</button>{' '}
                    <button className="btn ghost sm" style={{ color: 'var(--red-600)' }} onClick={() => { setDeleting(sv2); setErr(''); setOk('') }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
      )}

      {tab === 'Lab & Radiology' && (
        <>
          <div className="grid cols-2 mb">
            <Card title="How it works">
              <div className="muted">
                These are the laboratory &amp; radiology tests doctors can request — the investigation inventory, just like the
                pharmacy drug list. The <b>price</b> you set here (e.g. PCV = ₦2,000) is what the department is paid from the
                patient's <b>wallet when the result is uploaded</b>. Editing a price applies to every request that has not been
                billed yet; results already uploaded keep their historical charge.
              </div>
            </Card>
            <Card title="Add a test" actions={<button className="btn primary" onClick={openAddTest}>+ Add Test</button>}>
              <div className="muted">
                Add any test your laboratory or radiology department offers. Doctors pick it on the Consultation screen with
                its price, and the laboratory/radiology queue receives the request instantly.
              </div>
            </Card>
          </div>
          {[
            { key: 'lab', title: 'Laboratory Tests', rows: labTests, tone: 'blue' as const },
            { key: 'rad', title: 'Radiology Tests', rows: radTests, tone: 'amber' as const },
          ].map((sec) => (
            <Card key={sec.key} title={`${sec.title} — ${sec.rows.length}`}>
              <div className="tbl-wrap"><table className="tbl">
                <thead><tr><th>ID</th><th>Test</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {sec.rows.length === 0 && <tr><td colSpan={7} className="muted">No tests yet — add one with the button above.</td></tr>}
                  {sec.rows.map((t) => (
                    <tr key={t.id}>
                      <td>{t.id}</td>
                      <td><b>{t.name}</b></td>
                      <td>{t.category || '—'}</td>
                      <td className="money">{naira(t.price)}</td>
                      <td>{t.stock || '—'}</td>
                      <td><Badge tone={t.active === false ? 'gray' : 'green'}>{t.active === false ? 'Inactive' : 'Active'}</Badge></td>
                      <td className="right">
                        <button className="btn ghost sm" onClick={() => openEditTest(t)}>Edit price</button>{' '}
                        <button className="btn ghost sm" style={{ color: 'var(--red-600)' }} onClick={() => { setDeletingTest(t); setErr(''); setOk('') }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </Card>
          ))}
        </>
      )}

      {showAdd && (
        <Modal title={editing ? `Edit Procedure — ${editing.name}` : 'Add Procedure'} onClose={() => { setShowAdd(false); setEditing(null) }}
          footer={<><button className="btn ghost" onClick={() => { setShowAdd(false); setEditing(null) }}>Cancel</button>
            <button className="btn green" disabled={busy} onClick={saveProcedure}>{busy ? 'Saving…' : editing ? 'Save Changes' : 'Add'}</button></>}>
          {err && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
          <div className="form-grid">
            <Field label="Procedure" full>
              <input className="input" placeholder="e.g. Wound dressing" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Amount (₦)">
              <input className="input" type="number" min={0} placeholder="0" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label="Quantity">
              <input className="input" type="number" min={1} step={1} value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </Field>
            <Field label="Total (₦)" full>
              <input className="input" value={naira(procedureTotal)} readOnly tabIndex={-1}
                style={{ background: '#f1f5f9', fontWeight: 600 }} />
            </Field>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal title={`Delete Procedure — ${deleting.name}`} onClose={() => setDeleting(null)}
          footer={<><button className="btn ghost" onClick={() => setDeleting(null)}>Cancel</button>
            <button className="btn green" style={{ background: 'var(--red-600)' }} disabled={busy} onClick={confirmDelete}>{busy ? 'Deleting…' : 'Delete'}</button></>}>
          {err && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
          <p>Delete <b>{deleting.name}</b> from the catalogue?</p>
          <div className="kv">
            <div className="k">Amount</div><div className="v money">{naira(deleting.amount)}</div>
            <div className="k">Quantity</div><div className="v money">{deleting.quantity}</div>
            <div className="k">Total</div><div className="v money">{naira(Number(deleting.amount) * Number(deleting.quantity))}</div>
          </div>
          <div className="muted">This removes it from the catalogue. Existing patient records that already reference it are not changed.</div>
        </Modal>
      )}

      {showTest && (
        <Modal title={editingTest ? `Edit — ${editingTest.name}` : 'Add Test (Laboratory / Radiology)'} onClose={() => { setShowTest(false); setEditingTest(null) }}
          footer={<><button className="btn ghost" onClick={() => { setShowTest(false); setEditingTest(null) }}>Cancel</button>
            <button className="btn green" disabled={busy} onClick={saveTest}>{busy ? 'Saving…' : editingTest ? 'Save Changes' : 'Add Test'}</button></>}>
          {err && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
          <div className="form-grid">
            <Field label="Test name" full>
              <input className="input" value={testForm.name} onChange={(e) => setTestForm({ ...testForm, name: e.target.value })} placeholder="e.g. PCV" />
            </Field>
            <Field label="Department">
              <select className="input" value={testForm.dept} onChange={(e) => setTestForm({ ...testForm, dept: e.target.value })}>
                <option value="Lab">Laboratory</option><option value="Radiology">Radiology</option>
              </select>
            </Field>
            <Field label="Category">
              <input className="input" value={testForm.category} onChange={(e) => setTestForm({ ...testForm, category: e.target.value })} placeholder="e.g. Haematology" />
            </Field>
            <Field label="Price (₦)">
              <input className="input" type="number" min={0} value={testForm.price} onChange={(e) => setTestForm({ ...testForm, price: e.target.value })} placeholder="e.g. 2000" />
            </Field>
            <Field label="Consumable stock">
              <input className="input" type="number" min={0} value={testForm.stock} onChange={(e) => setTestForm({ ...testForm, stock: e.target.value })} />
            </Field>
            <Field label="Minimum stock level">
              <input className="input" type="number" min={0} value={testForm.minStock} onChange={(e) => setTestForm({ ...testForm, minStock: e.target.value })} />
            </Field>
          </div>
          <div className="muted mt">The price is charged to the patient's wallet when a result for this test is uploaded.</div>
        </Modal>
      )}

      {deletingTest && (
        <Modal title={`Delete Test — ${deletingTest.name}`} onClose={() => setDeletingTest(null)}
          footer={<><button className="btn ghost" onClick={() => setDeletingTest(null)}>Cancel</button>
            <button className="btn green" style={{ background: 'var(--red-600)' }} disabled={busy} onClick={confirmDeleteTest}>{busy ? 'Deleting…' : 'Delete'}</button></>}>
          {err && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
          <p>Delete <b>{deletingTest.name}</b> ({deletingTest.dept === 'Radiology' ? 'Radiology' : 'Laboratory'}) from the inventory?</p>
          <div className="kv">
            <div className="k">Price</div><div className="v money">{naira(deletingTest.price)}</div>
            <div className="k">Category</div><div className="v">{deletingTest.category || '—'}</div>
          </div>
          <div className="muted">Doctors can no longer request it. Requests already made and results already uploaded keep their historical price.</div>
        </Modal>
      )}

      {editChip && (
        <Modal title={`Edit — ${editChip.value}`} onClose={() => setEditChip(null)}
          footer={<><button className="btn ghost" onClick={() => setEditChip(null)}>Cancel</button>
            <button className="btn green" disabled={busy} onClick={saveChipEdit}>{busy ? 'Saving…' : 'Save Changes'}</button></>}>
          {err && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
          <div className="form-grid">
            <Field label="Value" full>
              <input className="input" value={chipDraft} onChange={(e) => setChipDraft(e.target.value)} autoFocus />
            </Field>
          </div>
        </Modal>
      )}
    </Layout>
  )
}