/* Role + capability reference shown in the Admin App.
 * The backend (backend/src/auth.js + types.js) is the source of truth and enforces
 * every capability on every request — editing here changes what the server allows. */
export interface Patient {
  id: string; firstName: string; surname: string; otherName?: string;
  dob: string; gender: 'Male' | 'Female'; phone: string; address: string;
  status: 'Active' | 'Inactive'; registered: string; registeredAt: string; wallet: number
}

/** Every role in the system (staff roles + the two administrator roles). */
export const ROLES = [
  'Doctor', 'Nurse', 'Records Officer', 'Pharmacist', 'Accountant',
  'Laboratory Scientist', 'Radiologist', 'Super Admin', 'Hospital Administrator',
]

/** These two bypass capability checks entirely — they can do everything. */
export const ADMIN_ROLES = ['Super Admin', 'Hospital Administrator']

/** All capabilities the server understands, in display order. */
export const CAP_ORDER = [
  'patients.register', 'visits.start', 'patients.status', 'patients.activate',
  'patients.inactive.view', 'consultation', 'vitals', 'discharge', 'services.record',
  'lab.result', 'rad.result', 'rx.dispense', 'inventory.manage',
  'wallet.fund', 'staff.manage', 'staff.delete', 'services.manage',
  'reports.view', 'settings.manage',
]

export const CAP_LABELS: Record<string, string> = {
  'patients.register': 'Register new patient',
  'visits.start': 'Start new visit (returning patient)',
  'patients.status': 'Mark patient Active / Inactive',
  'patients.activate': 'Activate a patient (records only)',
  'patients.inactive.view': 'View inactive patients',
  'consultation': 'Perform consultation, request labs, prescribe',
  'vitals': 'Record vitals',
  'discharge': 'Discharge admitted patient',
  'services.record': 'Record a procedure / service performed',
  'lab.result': 'Upload laboratory results',
  'rad.result': 'Upload radiology reports',
  'rx.dispense': 'Dispense prescriptions',
  'inventory.manage': 'Manage pharmacy inventory & prices',
  'wallet.fund': 'Fund patient wallets / record payments',
  'staff.manage': 'Create / edit / deactivate staff',
  'staff.delete': 'Permanently delete a staff record',
  'services.manage': 'Create / edit procedures & services and their prices',
  'reports.view': 'View reports & audit trail',
  'settings.manage': 'Configure system settings',
}

/* Human-readable reference of what each role is allowed to do by default. */
export const ROLE_PERMISSIONS: Record<string, { can: string[]; cannot: string[] }> = {
  Doctor: {
    can: ['View patient', 'Consult patient', 'Add diagnosis', 'Request lab', 'Request radiology', 'Prescribe drugs', 'View permitted results', 'Admit patient'],
    cannot: ['Manage staff', 'Change pharmacy stock', 'Edit accountant transactions'],
  },
  Nurse: {
    can: ['View patient', 'Record vitals', 'Ward rounds', 'Administer medication', 'Record procedures', 'Discharge workflow'],
    cannot: ['Change diagnosis', 'Dispense drugs', 'Manage payments'],
  },
  Pharmacist: {
    can: ['View prescriptions', 'Dispense drugs', 'Manage inventory', 'Update drug price', 'View pharmacy transactions'],
    cannot: ['Change diagnosis', 'Change nurse vitals'],
  },
  Accountant: {
    can: ['Receive payment', 'Fund wallet', 'View transactions', 'Generate financial reports'],
    cannot: ['Edit diagnosis', 'Dispense drugs', 'Upload lab results'],
  },
  'Laboratory Scientist': {
    can: ['View investigation requests', 'Perform tests', 'Upload result images'],
    cannot: ['Prescribe drugs', 'Edit patient demographics'],
  },
  Radiologist: {
    can: ['View radiology requests', 'Upload reports/images'],
    cannot: ['Prescribe drugs', 'Edit diagnosis'],
  },
  'Records Officer': {
    can: ['Register patient', 'Search patients', 'Start new visit', 'Mark patient inactive', 'View patient activity'],
    cannot: ['Edit clinical notes', 'Manage payments'],
  },
  'Super Admin': {
    can: ['Everything — unrestricted access to all modules and data'],
    cannot: [],
  },
  'Hospital Administrator': {
    can: ['Everything — unrestricted access to all modules and data'],
    cannot: [],
  },
}

/** Live notification pushed from the backend (real-time). */
export interface Notification { role: string; text: string; at: string; read?: boolean }

