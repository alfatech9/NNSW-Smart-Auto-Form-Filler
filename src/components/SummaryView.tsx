import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Printer,
  Download,
  Trash2,
  ExternalLink,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import type { TivApplication, VerificationChecklist } from '../types/nnsw';
import { COUNTRIES, CUSTOMS_OFFICES, VEHICLE_BRANDS } from '../types/nnsw';
import { buildExtensionPayload } from '../utils/extensionBridge';
import {
  getApplicationStages,
  getMissingRequiredFields,
  hasVehicleNumberMismatch,
} from '../utils/storage';

interface SummaryViewProps {
  application: TivApplication;
  onUpdateApplication: (updater: (prev: TivApplication) => TivApplication) => void;
  onDeleteDocuments: () => void;
  onDeleteApplication: () => void;
  onGoToReview: () => void;
}

export function SummaryView({
  application,
  onUpdateApplication,
  onDeleteDocuments,
  onDeleteApplication,
  onGoToReview,
}: SummaryViewProps) {
  const [confirmDeleteApp, setConfirmDeleteApp] = useState(false);

  const stages = useMemo(() => getApplicationStages(application), [application]);
  const missingFields = useMemo(() => getMissingRequiredFields(application), [application]);
  const vehicleMismatch = useMemo(() => hasVehicleNumberMismatch(application), [application]);
  const completedStages = stages.filter((s) => s.completed).length;

  const toggleCheck = (key: keyof VerificationChecklist) => {
    onUpdateApplication((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      checklist: {
        ...prev.checklist,
        [key]: !prev.checklist[key],
      },
    }));
  };

  const handleDownloadSummaryJson = () => {
    const payload = buildExtensionPayload(application);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nnsw-tiv-${application.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatOffice = (code: string) => {
    const match = CUSTOMS_OFFICES.find((c) => c.code === code);
    return match ? `${match.code} — ${match.secondary}` : code || '—';
  };

  const formatCountry = (code: string) => {
    const match = COUNTRIES.find((c) => c.code === code);
    return match ? `${match.code} (${match.secondary})` : code || '—';
  };

  const formatBrand = (code: string) => {
    const match = VEHICLE_BRANDS.find((b) => b.code === code);
    return match ? `${match.code} (${match.secondary})` : code || '—';
  };

  const checklistItems: Array<{ key: keyof VerificationChecklist; label: string }> = [
    {
      key: 'vehicleNumberMatches',
      label:
        'I verified that the Vehicle Number in General Information matches the Vehicle Bill Book / RC.',
    },
    {
      key: 'driverDetailsVerified',
      label:
        'I verified all Driver Information fields (name, license number, DOB, ID number, address) against the original Driving License.',
    },
    {
      key: 'chassisEngineVerified',
      label:
        'I verified the Chassis Number, Engine Number, Vehicle Type, Brand, and Passenger Count against the physical RC.',
    },
    {
      key: 'documentsLegible',
      label:
        'Both Driving License and Bill Book / RC (Front Page) scans are clear, upright, and ready for upload.',
    },
    {
      key: 'manualTaxAndSubmitUnderstood',
      label:
        'I understand that official NNSW Taxes, payment, and final submission must be personally confirmed by me on nnsw.gov.np/tiv/gen.',
    },
  ];

  const renderDetailGrid = (rows: Array<[string, string]>) => (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map(([label, val]) => (
        <div key={label} className="border-b border-slate-100 pb-2">
          <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
          <dd className="mt-0.5 text-sm font-medium text-slate-900">{val || '—'}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-slate-500 tabular-nums">
            Application ID: {application.id} · Last updated{' '}
            {new Date(application.updatedAt).toLocaleString()}
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
            Application Summary & Final Verification
          </h1>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Printer className="h-4 w-4" />
            Print Summary
          </button>
          <button
            type="button"
            onClick={handleDownloadSummaryJson}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            Export JSON
          </button>
          <a
            href="https://nnsw.gov.np/tiv/gen"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
          >
            Open Official Portal
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* 7-Stage Workflow Progress */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Application Progress Stages</h2>
          <span className="font-mono text-xs font-semibold text-blue-700 tabular-nums">
            {completedStages} / {stages.length} Completed
          </span>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {stages.map((stage, idx) => (
            <div
              key={stage.id}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs ${
                stage.completed
                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              {stage.completed ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-slate-400" />
              )}
              <span className="font-medium">
                {idx + 1}. {stage.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {(vehicleMismatch || missingFields.length > 0) && (
        <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              {vehicleMismatch
                ? 'Vehicle Number mismatch between General Information and Vehicle RC must be resolved.'
                : `${missingFields.length} mandatory field(s) remain blank: ${missingFields
                    .map((m) => m.label)
                    .join(', ')}.`}
            </span>
          </div>
          <button
            type="button"
            onClick={onGoToReview}
            className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 font-semibold text-amber-950 hover:bg-amber-100 whitespace-nowrap"
          >
            Fix in Review
          </button>
        </div>
      )}

      {/* Structured Data Summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-blue-900">1. General Information</h2>
          {renderDetailGrid([
            ['Entry Customs Office', formatOffice(application.general.entryCustomsOffice)],
            ['Exit Customs Office', formatOffice(application.general.exitCustomsOffice)],
            ['Vehicle No', application.general.vehicleNo],
            ['Purpose', application.general.purpose],
            ['Entry Date', application.general.entryDate],
            ['Exit Date', application.general.exitDate],
            ['Number of Days to Stay', application.general.daysToStay],
            ['Destination Place', application.general.destinationPlace],
            ['Hotel / Location', application.general.hotelLocation],
          ])}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-blue-900">2. Driver & Owner Information</h2>
          {renderDetailGrid([
            ['Nationality', formatCountry(application.driver.nationality)],
            ['Driving License Number', application.driver.drivingLicenseNumber],
            ['First Name', application.driver.firstName],
            ['Last Name', application.driver.lastName],
            ['Identity Card Number', application.driver.identityCardNumber],
            ['Birth Date', application.driver.birthDate],
            ['Foreign Address', application.driver.foreignAddress],
            ['Email', application.driver.email],
            ['Local Address', application.driver.localAddress],
            [
              'Phone Number',
              application.driver.phoneNumber
                ? `${application.driver.phoneCountryCode} ${application.driver.phoneNumber}`
                : '—',
            ],
            [
              'Vehicle Owner',
              application.driver.ownerSameAsDriver
                ? 'Same person as driver'
                : application.driver.ownerName || 'Separate owner (blank)',
            ],
            ['Owner Address', application.driver.ownerAddress],
          ])}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-blue-900">3. Vehicle Information</h2>
          {renderDetailGrid([
            ['Vehicle Type', application.vehicle.vehicleType],
            ['Vehicle Brand', formatBrand(application.vehicle.vehicleBrand)],
            ['Vehicle Country', formatCountry(application.vehicle.vehicleCountry)],
            ['Vehicle No (RC)', application.vehicle.vehicleNo],
            ['Chassis Number', application.vehicle.chassisNumber],
            ['Engine Number', application.vehicle.engineNumber],
            ['Number of Passengers', application.vehicle.numberOfPassengers],
            ['Vehicle Color', application.vehicle.vehicleColor],
          ])}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-blue-900">4. Attached Documents</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Driving License', doc: application.drivingLicenseDoc },
              { label: 'Bill Book / RC (Front Page)', doc: application.vehicleRcDoc },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-900">{item.label}</p>
                <div className="mt-2 flex h-32 items-center justify-center overflow-hidden rounded bg-slate-100">
                  {item.doc ? (
                    item.doc.mimeType === 'application/pdf' ? (
                      <div className="flex flex-col items-center text-xs text-slate-600">
                        <FileText className="h-8 w-8 text-blue-700" />
                        <span className="mt-1 max-w-[140px] truncate">{item.doc.fileName}</span>
                      </div>
                    ) : (
                      <img
                        src={item.doc.dataUrl}
                        alt={item.label}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-contain"
                      />
                    )
                  ) : (
                    <span className="text-xs text-slate-400">Not uploaded</span>
                  )}
                </div>
                <p className="mt-2 truncate text-[11px] text-slate-500">
                  {item.doc ? item.doc.fileName : 'Missing required document'}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Final Verification Checklist */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Final Verification Checklist</h2>
        <p className="mt-1 text-xs text-slate-500">
          Confirm every item before completing your final submission and tax payment on the official
          NNSW portal.
        </p>

        <div className="mt-4 space-y-3">
          {checklistItems.map((item) => (
            <label
              key={item.key}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 text-xs leading-relaxed text-slate-700 transition-colors hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={application.checklist[item.key]}
                onChange={() => toggleCheck(item.key)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-700"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Privacy & Deletion Controls */}
      <section className="no-print flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Data Privacy & Record Cleanup</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Once your TIV permit is submitted on nnsw.gov.np, delete uploaded document scans or remove
            this application record from your device.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onDeleteDocuments}
            disabled={!application.drivingLicenseDoc && !application.vehicleRcDoc}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Uploaded Documents
          </button>

          {confirmDeleteApp ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDeleteApplication}
                className="min-h-[38px] rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 whitespace-nowrap"
              >
                Confirm Delete Record
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteApp(false)}
                className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDeleteApp(true)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Application Record
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
