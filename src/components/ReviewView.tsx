import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  FileText,
  Info,
} from 'lucide-react';
import type { FieldMeta, TivApplication } from '../types/nnsw';
import {
  COUNTRIES,
  CUSTOMS_OFFICES,
  PHONE_CODES,
  VEHICLE_BRANDS,
  VEHICLE_TYPES,
  VISIT_PURPOSES,
} from '../types/nnsw';
import {
  calculateStayDays,
  dmyToIso,
  getMissingRequiredFields,
  hasVehicleNumberMismatch,
  isoToDmy,
} from '../utils/storage';

interface ReviewViewProps {
  application: TivApplication;
  onUpdateApplication: (updater: (prev: TivApplication) => TivApplication) => void;
  onGoToScanner: () => void;
  onProceedToAutoFill: () => void;
}

type ReviewSection = 'all' | 'general' | 'driver' | 'vehicle' | 'documents';

function FieldConfidenceLine({ meta }: { meta?: FieldMeta }) {
  if (!meta) return null;
  if (meta.confidence === 'high') {
    return (
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-700">
        <CheckCircle2 className="h-3 w-3 shrink-0" />
        <span>
          High confidence · {meta.source === 'driving_license' ? 'Driving License' : 'Vehicle RC'}
          {meta.note ? ` · ${meta.note}` : ''}
        </span>
      </div>
    );
  }
  if (meta.confidence === 'medium' || meta.confidence === 'low') {
    return (
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-700">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        <span>
          {meta.confidence === 'medium' ? 'Verify value' : 'Low confidence — verify carefully'}
          {meta.note ? ` · ${meta.note}` : ''}
        </span>
      </div>
    );
  }
  if (meta.confidence === 'missing') {
    return (
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
        <Info className="h-3 w-3 shrink-0" />
        <span>Not visible on scan — enter manually if required</span>
      </div>
    );
  }
  return null;
}

export function ReviewView({
  application,
  onUpdateApplication,
  onGoToScanner,
  onProceedToAutoFill,
}: ReviewViewProps) {
  const [activeTab, setActiveTab] = useState<ReviewSection>('all');

  const missingFields = useMemo(() => getMissingRequiredFields(application), [application]);
  const vehicleMismatch = useMemo(() => hasVehicleNumberMismatch(application), [application]);

  const updateGeneral = (patch: Partial<TivApplication['general']>) => {
    onUpdateApplication((prev) => {
      const nextGeneral = { ...prev.general, ...patch };
      // Auto-calculate inclusive stay days whenever Entry Date or Exit Date changes
      if ('entryDate' in patch || 'exitDate' in patch) {
        const calc = calculateStayDays(nextGeneral.entryDate, nextGeneral.exitDate);
        if (calc !== null) {
          nextGeneral.daysToStay = calc;
        }
      }
      return {
        ...prev,
        updatedAt: new Date().toISOString(),
        general: nextGeneral,
      };
    });
  };

  const updateDriver = (patch: Partial<TivApplication['driver']>) => {
    onUpdateApplication((prev) => {
      const nextDriver = { ...prev.driver, ...patch };
      if (nextDriver.ownerSameAsDriver) {
        nextDriver.ownerName = `${nextDriver.firstName} ${nextDriver.lastName}`.trim();
        nextDriver.ownerAddress = nextDriver.foreignAddress;
        nextDriver.ownerNationality = nextDriver.nationality;
        nextDriver.ownerIdentityCard = nextDriver.identityCardNumber;
        nextDriver.ownerPhone = nextDriver.phoneNumber;
      }
      return {
        ...prev,
        updatedAt: new Date().toISOString(),
        driver: nextDriver,
      };
    });
  };

  const updateVehicle = (patch: Partial<TivApplication['vehicle']>) => {
    onUpdateApplication((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      vehicle: { ...prev.vehicle, ...patch },
    }));
  };

  const handleToggleOwnerSame = () => {
    const nextVal = !application.driver.ownerSameAsDriver;
    updateDriver({ ownerSameAsDriver: nextVal });
  };

  const handleSyncVehicleNumber = (source: 'rc' | 'general') => {
    onUpdateApplication((prev) => {
      const chosen = source === 'rc' ? prev.vehicle.vehicleNo : prev.general.vehicleNo;
      return {
        ...prev,
        updatedAt: new Date().toISOString(),
        general: { ...prev.general, vehicleNo: chosen },
        vehicle: { ...prev.vehicle, vehicleNo: chosen },
      };
    });
  };

  const handleVerifyAndContinue = () => {
    onUpdateApplication((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      infoVerified: true,
    }));
    onProceedToAutoFill();
  };

  const showSection = (sec: Exclude<ReviewSection, 'all'>) =>
    activeTab === 'all' || activeTab === sec;

  const mappingRows = [
    {
      source: 'Driving License',
      mapping: 'License Number → Driving License Number',
      value: application.driver.drivingLicenseNumber,
      meta: application.fieldMeta.drivingLicenseNumber,
    },
    {
      source: 'Driving License',
      mapping: 'First Name → First Name',
      value: application.driver.firstName,
      meta: application.fieldMeta.firstName,
    },
    {
      source: 'Driving License',
      mapping: 'Last Name → Last Name',
      value: application.driver.lastName,
      meta: application.fieldMeta.lastName,
    },
    {
      source: 'Driving License',
      mapping: 'Date of Birth → Birth Date',
      value: application.driver.birthDate,
      meta: application.fieldMeta.birthDate,
    },
    {
      source: 'Driving License',
      mapping: 'Nationality → Nationality',
      value: application.driver.nationality,
      meta: application.fieldMeta.nationality,
    },
    {
      source: 'Vehicle RC',
      mapping: 'Registration Number → Vehicle Number',
      value: application.vehicle.vehicleNo,
      meta: application.fieldMeta.vehicleNo_rc,
    },
    {
      source: 'Vehicle RC',
      mapping: 'Chassis Number → Chassis Number',
      value: application.vehicle.chassisNumber,
      meta: application.fieldMeta.chassisNumber,
    },
    {
      source: 'Vehicle RC',
      mapping: 'Engine Number → Engine Number',
      value: application.vehicle.engineNumber,
      meta: application.fieldMeta.engineNumber,
    },
    {
      source: 'Vehicle RC',
      mapping: 'Manufacturer → Vehicle Brand',
      value: application.vehicle.vehicleBrand,
      meta: application.fieldMeta.vehicleBrand,
    },
    {
      source: 'Vehicle RC',
      mapping: 'Vehicle Type → Vehicle Type',
      value: application.vehicle.vehicleType,
      meta: application.fieldMeta.vehicleType,
    },
    {
      source: 'Vehicle RC',
      mapping: 'Color → Vehicle Color',
      value: application.vehicle.vehicleColor,
      meta: application.fieldMeta.vehicleColor,
    },
  ];

  const inputClass =
    'mt-1.5 block h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Review & Edit Extracted Information
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Verify every field against your physical Driving License and Vehicle Bill Book / RC before
            filling the official NNSW TIV portal.
          </p>
        </div>

        <div className="flex items-center gap-1 self-start rounded-lg bg-slate-200/70 p-1">
          {(
            [
              ['all', 'All Steps'],
              ['general', '1. General'],
              ['driver', '2. Driver'],
              ['vehicle', '3. Vehicle'],
              ['documents', '4. Docs'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Vehicle Number Mismatch Warning */}
      {vehicleMismatch && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <h2 className="font-semibold text-red-950">
                  Vehicle Number Mismatch Requires Review
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-red-800">
                  General Information Vehicle No (
                  <strong className="font-mono">{application.general.vehicleNo}</strong>) does not
                  match Vehicle RC Registration Number (
                  <strong className="font-mono">{application.vehicle.vehicleNo}</strong>). Resolve
                  this before auto-filling the official NNSW portal.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleSyncVehicleNumber('rc')}
                className="min-h-[38px] rounded-lg bg-red-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-800 whitespace-nowrap"
              >
                Use RC Number ({application.vehicle.vehicleNo})
              </button>
              <button
                type="button"
                onClick={() => handleSyncVehicleNumber('general')}
                className="min-h-[38px] rounded-lg border border-red-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 whitespace-nowrap"
              >
                Use General Number ({application.general.vehicleNo})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Missing Required Fields Alert */}
      {missingFields.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">
                {missingFields.length} mandatory NNSW field{missingFields.length === 1 ? '' : 's'}{' '}
                still need input before submission:
              </p>
              <p className="mt-1 leading-relaxed text-amber-900">
                {missingFields.map((m) => m.label).join(' · ')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          All required General, Driver, Vehicle, and Document fields are populated. Please verify
          accuracy before proceeding.
        </div>
      )}

      {/* STEP 1 — GENERAL INFORMATION */}
      {showSection('general') && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-5 border-b border-slate-200 pb-3">
            <h2 className="text-base font-semibold text-slate-900">Step 1 — General Information</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Select entry/exit customs offices, travel dates, purpose, destination, and hotel/location.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Entry Customs Office <span className="text-red-600">*</span>
              </label>
              <select
                value={application.general.entryCustomsOffice}
                onChange={(e) => updateGeneral({ entryCustomsOffice: e.target.value })}
                className={inputClass}
              >
                <option value="">Select Entry Customs Office</option>
                {CUSTOMS_OFFICES.map((office) => (
                  <option key={office.code} value={office.code}>
                    {office.code} — {office.secondary}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Exit Customs Office <span className="text-red-600">*</span>
              </label>
              <select
                value={application.general.exitCustomsOffice}
                onChange={(e) => updateGeneral({ exitCustomsOffice: e.target.value })}
                className={inputClass}
              >
                <option value="">Select Exit Customs Office</option>
                {CUSTOMS_OFFICES.map((office) => (
                  <option key={office.code} value={office.code}>
                    {office.code} — {office.secondary}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Vehicle No <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={application.general.vehicleNo}
                onChange={(e) => updateGeneral({ vehicleNo: e.target.value })}
                placeholder="e.g., BR32AB8251 or 8251"
                className={`${inputClass} font-mono ${
                  vehicleMismatch ? 'border-red-400 bg-red-50/40' : ''
                }`}
              />
              {vehicleMismatch && (
                <p className="mt-1 text-[11px] font-medium text-red-700">
                  Does not match Vehicle RC number ({application.vehicle.vehicleNo})
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Purpose</label>
              <select
                value={application.general.purpose}
                onChange={(e) => updateGeneral({ purpose: e.target.value })}
                className={inputClass}
              >
                <option value="">Select Purpose of Visit</option>
                {VISIT_PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Entry Date (DD/MM/YYYY) <span className="text-red-600">*</span>
              </label>
              <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="text"
                  value={application.general.entryDate}
                  onChange={(e) => updateGeneral({ entryDate: e.target.value })}
                  placeholder="DD/MM/YYYY"
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none tabular-nums"
                />
                <input
                  type="date"
                  aria-label="Pick Entry Date"
                  value={dmyToIso(application.general.entryDate)}
                  onChange={(e) => updateGeneral({ entryDate: isoToDmy(e.target.value) })}
                  className="h-10 rounded-lg border border-slate-300 bg-slate-50 px-2 text-xs text-slate-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Exit Date (DD/MM/YYYY) <span className="text-red-600">*</span>
              </label>
              <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="text"
                  value={application.general.exitDate}
                  onChange={(e) => updateGeneral({ exitDate: e.target.value })}
                  placeholder="DD/MM/YYYY"
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none tabular-nums"
                />
                <input
                  type="date"
                  aria-label="Pick Exit Date"
                  value={dmyToIso(application.general.exitDate)}
                  onChange={(e) => updateGeneral({ exitDate: isoToDmy(e.target.value) })}
                  className="h-10 rounded-lg border border-slate-300 bg-slate-50 px-2 text-xs text-slate-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Number of Days to Stay <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                min={1}
                value={application.general.daysToStay}
                onChange={(e) => updateGeneral({ daysToStay: e.target.value })}
                placeholder="Calculated from Entry & Exit dates"
                className={`${inputClass} font-mono tabular-nums`}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Automatically calculated inclusively from selected Entry and Exit dates; edit if portal
                rules require a different count.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Destination Place <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={application.general.destinationPlace}
                onChange={(e) => updateGeneral({ destinationPlace: e.target.value })}
                placeholder="e.g., Janakpurdham, Kathmandu, Pokhara"
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Hotel / Location
              </label>
              <input
                type="text"
                value={application.general.hotelLocation}
                onChange={(e) => updateGeneral({ hotelLocation: e.target.value })}
                placeholder="Hotel name or stay location"
                className={inputClass}
              />
            </div>
          </div>
        </section>
      )}

      {/* STEP 2 — DRIVER & VEHICLE OWNER INFORMATION */}
      {showSection('driver') && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-5 border-b border-slate-200 pb-3">
            <h2 className="text-base font-semibold text-slate-900">Step 2 — Driver Information</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Populated from your Driving License scan. Complete any missing contact or ID details.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Nationality <span className="text-red-600">*</span>
              </label>
              <select
                value={application.driver.nationality}
                onChange={(e) => updateDriver({ nationality: e.target.value })}
                className={inputClass}
              >
                <option value="">Select Nationality</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.secondary}
                  </option>
                ))}
              </select>
              <FieldConfidenceLine meta={application.fieldMeta.nationality} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Driving License Number <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={application.driver.drivingLicenseNumber}
                onChange={(e) => updateDriver({ drivingLicenseNumber: e.target.value })}
                placeholder="License number as printed"
                className={`${inputClass} font-mono`}
              />
              <FieldConfidenceLine meta={application.fieldMeta.drivingLicenseNumber} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                First Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={application.driver.firstName}
                onChange={(e) => updateDriver({ firstName: e.target.value })}
                placeholder="First / given name"
                className={inputClass}
              />
              <FieldConfidenceLine meta={application.fieldMeta.firstName} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Last Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={application.driver.lastName}
                onChange={(e) => updateDriver({ lastName: e.target.value })}
                placeholder="Surname / family name"
                className={inputClass}
              />
              <FieldConfidenceLine meta={application.fieldMeta.lastName} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Identity Card Number (Aadhaar, PAN, etc.) <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={application.driver.identityCardNumber}
                onChange={(e) => updateDriver({ identityCardNumber: e.target.value })}
                placeholder="Aadhaar / PAN / Passport / ID No"
                className={`${inputClass} font-mono`}
              />
              <FieldConfidenceLine meta={application.fieldMeta.identityCardNumber} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Birth Date (DD/MM/YYYY) <span className="text-red-600">*</span>
              </label>
              <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="text"
                  value={application.driver.birthDate}
                  onChange={(e) => updateDriver({ birthDate: e.target.value })}
                  placeholder="DD/MM/YYYY"
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none tabular-nums"
                />
                <input
                  type="date"
                  aria-label="Pick Birth Date"
                  value={dmyToIso(application.driver.birthDate)}
                  onChange={(e) => updateDriver({ birthDate: isoToDmy(e.target.value) })}
                  className="h-10 rounded-lg border border-slate-300 bg-slate-50 px-2 text-xs text-slate-700"
                />
              </div>
              <FieldConfidenceLine meta={application.fieldMeta.birthDate} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Foreign Address <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={application.driver.foreignAddress}
                onChange={(e) => updateDriver({ foreignAddress: e.target.value })}
                placeholder="Home / foreign address"
                className={inputClass}
              />
              <FieldConfidenceLine meta={application.fieldMeta.foreignAddress} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Email</label>
              <input
                type="email"
                value={application.driver.email}
                onChange={(e) => updateDriver({ email: e.target.value })}
                placeholder="Optional email address"
                className={inputClass}
              />
              <FieldConfidenceLine meta={application.fieldMeta.email} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Local Address</label>
              <input
                type="text"
                value={application.driver.localAddress}
                onChange={(e) => updateDriver({ localAddress: e.target.value })}
                placeholder="Address while in Nepal (optional)"
                className={inputClass}
              />
              <FieldConfidenceLine meta={application.fieldMeta.localAddress} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Phone Number</label>
              <div className="mt-1.5 grid grid-cols-[120px_1fr] gap-2">
                <select
                  value={application.driver.phoneCountryCode}
                  onChange={(e) => updateDriver({ phoneCountryCode: e.target.value })}
                  aria-label="Phone country code"
                  className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  {PHONE_CODES.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code} {p.secondary}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={application.driver.phoneNumber}
                  onChange={(e) => updateDriver({ phoneNumber: e.target.value })}
                  placeholder="Mobile or phone number"
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <FieldConfidenceLine meta={application.fieldMeta.phoneNumber} />
            </div>
          </div>

          {/* Vehicle Owner Sub-Section */}
          <div className="mt-7 border-t border-slate-200 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Vehicle Owner Information</h3>
                <p className="text-xs text-slate-500">
                  Vehicle Owner is the same person as the driver.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={application.driver.ownerSameAsDriver}
                onClick={handleToggleOwnerSame}
                className={`inline-flex items-center gap-2.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
                  application.driver.ownerSameAsDriver
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    application.driver.ownerSameAsDriver ? 'bg-blue-700' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      application.driver.ownerSameAsDriver ? 'translate-x-4.5' : 'translate-x-0.5'
                    }`}
                  />
                </span>
                {application.driver.ownerSameAsDriver ? 'Same as Driver (Enabled)' : 'Different Owner'}
              </button>
            </div>

            {application.driver.ownerSameAsDriver ? (
              <p className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
                Driver details (
                <strong className="text-slate-900">
                  {`${application.driver.firstName} ${application.driver.lastName}`.trim() ||
                    'Driver Name'}
                </strong>
                , {application.driver.foreignAddress || 'Foreign Address'}) are automatically mirrored
                into the Vehicle Owner section.
              </p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Vehicle Owner Full Name
                  </label>
                  <input
                    type="text"
                    value={application.driver.ownerName}
                    onChange={(e) => updateDriver({ ownerName: e.target.value })}
                    placeholder="Owner name as printed on RC"
                    className={inputClass}
                  />
                  <FieldConfidenceLine meta={application.fieldMeta.ownerName} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Vehicle Owner Address
                  </label>
                  <input
                    type="text"
                    value={application.driver.ownerAddress}
                    onChange={(e) => updateDriver({ ownerAddress: e.target.value })}
                    placeholder="Owner address as printed on RC"
                    className={inputClass}
                  />
                  <FieldConfidenceLine meta={application.fieldMeta.ownerAddress} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Owner Nationality
                  </label>
                  <select
                    value={application.driver.ownerNationality}
                    onChange={(e) => updateDriver({ ownerNationality: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Select Owner Nationality</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.secondary}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Owner Phone / ID Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={application.driver.ownerPhone}
                    onChange={(e) => updateDriver({ ownerPhone: e.target.value })}
                    placeholder="Owner contact or ID number"
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* STEP 3 — VEHICLE INFORMATION */}
      {showSection('vehicle') && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-5 border-b border-slate-200 pb-3">
            <h2 className="text-base font-semibold text-slate-900">Step 3 — Vehicle Information</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Populated from your Vehicle Bill Book / RC (Front Page). Dropdown options match the
              official NNSW portal.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Vehicle Type <span className="text-red-600">*</span>
              </label>
              <select
                value={application.vehicle.vehicleType}
                onChange={(e) => updateVehicle({ vehicleType: e.target.value })}
                className={inputClass}
              >
                <option value="">Select Official Vehicle Type</option>
                {VEHICLE_TYPES.map((vt) => (
                  <option key={vt} value={vt}>
                    {vt}
                  </option>
                ))}
              </select>
              <FieldConfidenceLine meta={application.fieldMeta.vehicleType} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Vehicle Brand</label>
              <select
                value={application.vehicle.vehicleBrand}
                onChange={(e) => updateVehicle({ vehicleBrand: e.target.value })}
                className={inputClass}
              >
                <option value="">Select Official Vehicle Brand</option>
                {VEHICLE_BRANDS.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.code} — {b.secondary}
                  </option>
                ))}
              </select>
              <FieldConfidenceLine meta={application.fieldMeta.vehicleBrand} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Vehicle Country <span className="text-red-600">*</span>
              </label>
              <select
                value={application.vehicle.vehicleCountry}
                onChange={(e) => updateVehicle({ vehicleCountry: e.target.value })}
                className={inputClass}
              >
                <option value="">Select Registration Country</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.secondary}
                  </option>
                ))}
              </select>
              <FieldConfidenceLine meta={application.fieldMeta.vehicleCountry} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Vehicle No <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={application.vehicle.vehicleNo}
                onChange={(e) => updateVehicle({ vehicleNo: e.target.value })}
                placeholder="Registration number from RC"
                className={`${inputClass} font-mono ${
                  vehicleMismatch ? 'border-red-400 bg-red-50/40' : ''
                }`}
              />
              <FieldConfidenceLine meta={application.fieldMeta.vehicleNo_rc} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Chassis Number <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={application.vehicle.chassisNumber}
                onChange={(e) => updateVehicle({ chassisNumber: e.target.value })}
                placeholder="Full chassis / VIN number"
                className={`${inputClass} font-mono`}
              />
              <FieldConfidenceLine meta={application.fieldMeta.chassisNumber} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Engine Number <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={application.vehicle.engineNumber}
                onChange={(e) => updateVehicle({ engineNumber: e.target.value })}
                placeholder="Engine / motor number"
                className={`${inputClass} font-mono`}
              />
              <FieldConfidenceLine meta={application.fieldMeta.engineNumber} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Number of Passengers <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={80}
                value={application.vehicle.numberOfPassengers}
                onChange={(e) => updateVehicle({ numberOfPassengers: e.target.value })}
                placeholder="Seating capacity"
                className={`${inputClass} font-mono tabular-nums`}
              />
              <FieldConfidenceLine meta={application.fieldMeta.numberOfPassengers} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Vehicle Color</label>
              <input
                type="text"
                value={application.vehicle.vehicleColor}
                onChange={(e) => updateVehicle({ vehicleColor: e.target.value })}
                placeholder="e.g., Black, White, Silver"
                className={inputClass}
              />
              <FieldConfidenceLine meta={application.fieldMeta.vehicleColor} />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Other Visible Registration Details (Reference Only)
              </label>
              <input
                type="text"
                value={application.vehicle.otherDetails}
                onChange={(e) => updateVehicle({ otherDetails: e.target.value })}
                placeholder="Fuel type, model name, or registration validity noted from RC"
                className={inputClass}
              />
            </div>
          </div>
        </section>
      )}

      {/* STEP 4 — DOCUMENTS */}
      {showSection('documents') && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Step 4 — Documents</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Files preserved at full capture quality for upload to the official NNSW portal.
              </p>
            </div>
            <button
              type="button"
              onClick={onGoToScanner}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Replace or Edit Files
            </button>
          </div>

          <div className="divide-y divide-slate-200">
            {[
              { label: 'Driving License', doc: application.drivingLicenseDoc },
              { label: 'Bill Book / RC (Front Page)', doc: application.vehicleRcDoc },
            ].map((item) => (
              <div
                key={item.label}
                className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50">
                    {item.doc ? (
                      item.doc.mimeType === 'application/pdf' ? (
                        <FileText className="h-5 w-5 text-blue-700" />
                      ) : (
                        <img
                          src={item.doc.dataUrl}
                          alt={item.label}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      )
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="text-xs text-slate-500">
                      {item.doc
                        ? `${item.doc.fileName} · ${item.doc.enhanced ? 'Enhanced' : 'Original quality'}`
                        : 'A required document is missing.'}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium ${
                    item.doc ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {item.doc ? 'Attached & Ready' : 'Not uploaded'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Smart Data Mapping Audit Table */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Smart Data Mapping & Validation</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Trace how each extracted document field maps to the official NNSW TIV portal.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <th className="px-6 py-2.5">Source</th>
                <th className="px-6 py-2.5">Official Field Mapping</th>
                <th className="px-6 py-2.5">Current Value</th>
                <th className="px-6 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {mappingRows.map((row) => (
                <tr key={row.mapping}>
                  <td className="px-6 py-2.5 font-medium text-slate-700">{row.source}</td>
                  <td className="px-6 py-2.5 text-slate-600">{row.mapping}</td>
                  <td className="px-6 py-2.5 font-mono text-slate-900">
                    {row.value || <span className="text-slate-400">Blank</span>}
                  </td>
                  <td className="px-6 py-2.5">
                    {row.value ? (
                      row.meta?.confidence === 'low' || row.meta?.confidence === 'medium' ? (
                        <span className="text-amber-700">Verify value</span>
                      ) : (
                        <span className="text-emerald-700">Populated</span>
                      )
                    ) : (
                      <span className="text-slate-500">Pending input</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bottom Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <button
          type="button"
          onClick={onGoToScanner}
          className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
        >
          Back to Scanner
        </button>

        <div className="flex flex-wrap items-center gap-3">
          {vehicleMismatch && (
            <span className="text-xs font-medium text-red-700">
              Resolve Vehicle Number mismatch first
            </span>
          )}
          <button
            type="button"
            disabled={vehicleMismatch}
            onClick={handleVerifyAndContinue}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
          >
            Confirm Verified & Open Auto Fill
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
