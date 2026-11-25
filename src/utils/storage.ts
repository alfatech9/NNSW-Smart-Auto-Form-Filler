import type { TivApplication } from '../types/nnsw';

const STORAGE_KEY = 'nnsw_smart_autofill_applications_v1';

export function createEmptyApplication(): TivApplication {
  const now = new Date().toISOString();
  return {
    id: `TIV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    createdAt: now,
    updatedAt: now,
    consentGiven: false,
    drivingLicenseDoc: null,
    vehicleRcDoc: null,
    general: {
      entryCustomsOffice: '',
      exitCustomsOffice: '',
      vehicleNo: '',
      entryDate: '',
      exitDate: '',
      purpose: '',
      daysToStay: '',
      destinationPlace: '',
      hotelLocation: '',
    },
    driver: {
      nationality: '',
      drivingLicenseNumber: '',
      firstName: '',
      lastName: '',
      identityCardNumber: '',
      birthDate: '',
      foreignAddress: '',
      email: '',
      localAddress: '',
      phoneCountryCode: '+91',
      phoneNumber: '',
      ownerSameAsDriver: false,
      ownerName: '',
      ownerAddress: '',
      ownerNationality: '',
      ownerIdentityCard: '',
      ownerPhone: '',
    },
    vehicle: {
      vehicleType: '',
      vehicleBrand: '',
      vehicleCountry: '',
      vehicleNo: '',
      chassisNumber: '',
      engineNumber: '',
      numberOfPassengers: '',
      vehicleColor: '',
      otherDetails: '',
    },
    fieldMeta: {},
    infoVerified: false,
    formFilledInPortal: false,
    documentsUploadedInPortal: false,
    checklist: {
      vehicleNumberMatches: false,
      driverDetailsVerified: false,
      chassisEngineVerified: false,
      documentsLegible: false,
      manualTaxAndSubmitUnderstood: false,
    },
  };
}

export function loadApplications(): TivApplication[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveApplications(apps: TivApplication[]): { ok: boolean; quotaExceeded?: boolean } {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
    return { ok: true };
  } catch {
    // If large base64 images exceed localStorage quota, store stripped thumbnails while keeping active app in memory
    try {
      const compact = apps.map((app) => ({
        ...app,
        drivingLicenseDoc: app.drivingLicenseDoc
          ? { ...app.drivingLicenseDoc, originalDataUrl: app.drivingLicenseDoc.dataUrl }
          : null,
        vehicleRcDoc: app.vehicleRcDoc
          ? { ...app.vehicleRcDoc, originalDataUrl: app.vehicleRcDoc.dataUrl }
          : null,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
      return { ok: true };
    } catch {
      return { ok: false, quotaExceeded: true };
    }
  }
}

export function clearAllStoredApplications(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function normalizeVehicleNumber(val: string): string {
  return val.replace(/[\s\-_/]/g, '').toUpperCase();
}

export function hasVehicleNumberMismatch(app: TivApplication): boolean {
  const gen = normalizeVehicleNumber(app.general.vehicleNo);
  const rc = normalizeVehicleNumber(app.vehicle.vehicleNo);
  if (!gen || !rc) return false;
  return gen !== rc;
}

/**
 * Convert HTML input[type="date"] YYYY-MM-DD to NNSW DD/MM/YYYY
 */
export function isoToDmy(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Convert NNSW DD/MM/YYYY to HTML input[type="date"] YYYY-MM-DD
 */
export function dmyToIso(dmy: string): string {
  if (!dmy) return '';
  const m = dmy.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!m) return '';
  const day = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  const year = m[3];
  return `${year}-${month}-${day}`;
}

/**
 * Calculates inclusive stay duration in days when both Entry and Exit dates are valid DD/MM/YYYY
 * Example from official NNSW screenshot: Entry 25/11/2026, Exit 26/11/2026 => 2 days
 */
export function calculateStayDays(entryDmy: string, exitDmy: string): string | null {
  const entryIso = dmyToIso(entryDmy);
  const exitIso = dmyToIso(exitDmy);
  if (!entryIso || !exitIso) return null;
  const start = new Date(`${entryIso}T00:00:00Z`);
  const end = new Date(`${exitIso}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return null;
  return String(diffDays + 1);
}

export interface MissingFieldItem {
  section: 'General Information' | 'Driver Information' | 'Vehicle Information' | 'Documents';
  fieldKey: string;
  label: string;
}

export function getMissingRequiredFields(app: TivApplication): MissingFieldItem[] {
  const missing: MissingFieldItem[] = [];
  const check = (
    section: MissingFieldItem['section'],
    fieldKey: string,
    label: string,
    val: string | boolean | null
  ) => {
    if (!val || (typeof val === 'string' && !val.trim())) {
      missing.push({ section, fieldKey, label });
    }
  };

  check('General Information', 'entryCustomsOffice', 'Entry Customs Office', app.general.entryCustomsOffice);
  check('General Information', 'exitCustomsOffice', 'Exit Customs Office', app.general.exitCustomsOffice);
  check('General Information', 'vehicleNo', 'Vehicle No (General)', app.general.vehicleNo);
  check('General Information', 'entryDate', 'Entry Date', app.general.entryDate);
  check('General Information', 'exitDate', 'Exit Date', app.general.exitDate);
  check('General Information', 'daysToStay', 'Number of Days to Stay', app.general.daysToStay);
  check('General Information', 'destinationPlace', 'Destination Place', app.general.destinationPlace);

  check('Driver Information', 'nationality', 'Nationality', app.driver.nationality);
  check('Driver Information', 'drivingLicenseNumber', 'Driving License Number', app.driver.drivingLicenseNumber);
  check('Driver Information', 'firstName', 'First Name', app.driver.firstName);
  check('Driver Information', 'lastName', 'Last Name', app.driver.lastName);
  check('Driver Information', 'identityCardNumber', 'Identity Card Number', app.driver.identityCardNumber);
  check('Driver Information', 'birthDate', 'Birth Date', app.driver.birthDate);
  check('Driver Information', 'foreignAddress', 'Foreign Address', app.driver.foreignAddress);

  check('Vehicle Information', 'vehicleType', 'Vehicle Type', app.vehicle.vehicleType);
  check('Vehicle Information', 'vehicleCountry', 'Vehicle Country', app.vehicle.vehicleCountry);
  check('Vehicle Information', 'vehicleNo_rc', 'Vehicle No (RC)', app.vehicle.vehicleNo);
  check('Vehicle Information', 'chassisNumber', 'Chassis Number', app.vehicle.chassisNumber);
  check('Vehicle Information', 'engineNumber', 'Engine Number', app.vehicle.engineNumber);
  check('Vehicle Information', 'numberOfPassengers', 'Number of Passengers', app.vehicle.numberOfPassengers);

  if (!app.drivingLicenseDoc) {
    missing.push({ section: 'Documents', fieldKey: 'drivingLicenseDoc', label: 'Driving License Document' });
  }
  if (!app.vehicleRcDoc) {
    missing.push({ section: 'Documents', fieldKey: 'vehicleRcDoc', label: 'Bill Book / RC (Front Page)' });
  }

  return missing;
}

export interface ProgressStage {
  id: string;
  label: string;
  completed: boolean;
}

export function getApplicationStages(app: TivApplication): ProgressStage[] {
  const dlScanned = Boolean(app.drivingLicenseDoc && app.drivingLicenseDoc.scanStatus === 'scanned');
  const rcScanned = Boolean(app.vehicleRcDoc && app.vehicleRcDoc.scanStatus === 'scanned');
  const infoExtracted =
    dlScanned ||
    rcScanned ||
    Boolean(app.driver.drivingLicenseNumber || app.vehicle.chassisNumber || app.vehicle.vehicleNo);
  const missingCount = getMissingRequiredFields(app).length;
  const mismatch = hasVehicleNumberMismatch(app);
  const infoVerified = app.infoVerified && !mismatch;
  const formFilled = app.formFilledInPortal;
  const docsUploaded = app.documentsUploadedInPortal;
  const checklistComplete = Object.values(app.checklist).every(Boolean);
  const readyForSubmission =
    missingCount === 0 && !mismatch && infoVerified && formFilled && docsUploaded && checklistComplete;

  return [
    { id: 'dl_scanned', label: 'Driving License Scanned', completed: dlScanned },
    { id: 'rc_scanned', label: 'Vehicle RC Scanned', completed: rcScanned },
    { id: 'info_extracted', label: 'Information Extracted', completed: infoExtracted },
    { id: 'info_verified', label: 'Information Verified', completed: infoVerified },
    { id: 'form_filled', label: 'NNSW Form Filled', completed: formFilled },
    { id: 'docs_uploaded', label: 'Documents Uploaded', completed: docsUploaded },
    { id: 'ready_submit', label: 'Ready for Final Submission', completed: readyForSubmission },
  ];
}
