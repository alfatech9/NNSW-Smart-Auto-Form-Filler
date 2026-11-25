import { useEffect, useMemo, useState } from 'react';
import {
  ExternalLink,
  Download,
  Send,
  Copy,
  Check,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ArrowRight,
  Lock,
} from 'lucide-react';
import type { TivApplication } from '../types/nnsw';
import { COUNTRIES, CUSTOMS_OFFICES, VEHICLE_BRANDS } from '../types/nnsw';
import {
  buildExtensionPayload,
  pingCompanionExtension,
  sendPayloadToExtension,
} from '../utils/extensionBridge';
import { getMissingRequiredFields, hasVehicleNumberMismatch } from '../utils/storage';

interface AutoFillViewProps {
  application: TivApplication;
  onUpdateApplication: (updater: (prev: TivApplication) => TivApplication) => void;
  onGoToReview: () => void;
  onGoToSummary: () => void;
}

export function AutoFillView({
  application,
  onUpdateApplication,
  onGoToReview,
  onGoToSummary,
}: AutoFillViewProps) {
  const [extensionState, setExtensionState] = useState<'checking' | 'connected' | 'not_detected'>(
    'checking'
  );
  const [extensionVersion, setExtensionVersion] = useState<string>('');
  const [dispatchMessage, setDispatchMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [portalStep, setPortalStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [dryRunFilledSteps, setDryRunFilledSteps] = useState<number[]>([]);

  const payload = useMemo(() => buildExtensionPayload(application), [application]);
  const missingFields = useMemo(() => getMissingRequiredFields(application), [application]);
  const vehicleMismatch = useMemo(() => hasVehicleNumberMismatch(application), [application]);

  const checkExtension = async () => {
    setExtensionState('checking');
    const res = await pingCompanionExtension();
    if (res.connected) {
      setExtensionState('connected');
      setExtensionVersion(res.version || '1.0.0');
    } else {
      setExtensionState('not_detected');
    }
  };

  useEffect(() => {
    checkExtension();
  }, []);

  const copyValue = async (key: string, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Clipboard fallback ignored silently
    }
  };

  const handleDispatchAutoFill = async () => {
    if (vehicleMismatch) {
      setDispatchMessage(
        'Blocked: Resolve the Vehicle Number mismatch on the Review page before auto-filling.'
      );
      return;
    }

    setDispatchMessage(null);
    const sent = await sendPayloadToExtension(payload);
    if (sent) {
      setDispatchMessage(
        'Verified application payload sent to the Companion Extension. Open nnsw.gov.np/tiv/gen, sign in manually, and click "Fill Current Step".'
      );
      onUpdateApplication((prev) => ({
        ...prev,
        updatedAt: new Date().toISOString(),
        formFilledInPortal: true,
      }));
    } else {
      await copyValue('full_json', JSON.stringify(payload, null, 2));
      setDispatchMessage(
        'Companion Chrome Extension was not detected in this tab. The structured JSON payload has been copied to your clipboard — install the extension bundle below or use the 1-click field copy preview.'
      );
    }
  };

  const handleDryRunFillCurrentStep = () => {
    if (portalStep === 5) return;
    setDryRunFilledSteps((prev) => (prev.includes(portalStep) ? prev : [...prev, portalStep]));
    if (portalStep === 1 || portalStep === 2 || portalStep === 3) {
      onUpdateApplication((prev) => ({
        ...prev,
        updatedAt: new Date().toISOString(),
        formFilledInPortal: true,
      }));
    }
    if (portalStep === 4 && application.drivingLicenseDoc && application.vehicleRcDoc) {
      onUpdateApplication((prev) => ({
        ...prev,
        updatedAt: new Date().toISOString(),
        documentsUploadedInPortal: true,
      }));
    }
  };

  const lookupOffice = (code: string) => {
    const found = CUSTOMS_OFFICES.find((c) => c.code === code);
    return found ? `${found.code} — ${found.secondary}` : code || 'Not selected';
  };

  const lookupCountry = (code: string) => {
    const found = COUNTRIES.find((c) => c.code === code);
    return found ? `${found.code} (${found.secondary})` : code || 'Not selected';
  };

  const lookupBrand = (code: string) => {
    const found = VEHICLE_BRANDS.find((b) => b.code === code);
    return found ? `${found.code} (${found.secondary})` : code || 'Not selected';
  };

  const renderCopyRow = (label: string, value: string, keyId: string, required = false) => {
    const isEmpty = !value || !value.trim();
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-slate-500">
            {label} {required && <span className="text-red-600">*</span>}
          </div>
          <div
            className={`mt-0.5 truncate text-sm font-medium ${
              isEmpty ? 'text-amber-700' : 'text-slate-900'
            }`}
          >
            {isEmpty ? 'Missing — edit in Review' : value}
          </div>
        </div>
        {!isEmpty && (
          <button
            type="button"
            onClick={() => copyValue(keyId, value)}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
          >
            {copiedKey === keyId ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  const portalSteps = [
    { num: 1 as const, label: 'General' },
    { num: 2 as const, label: 'Driver Information' },
    { num: 3 as const, label: 'Vehicle Information' },
    { num: 4 as const, label: 'Documents' },
    { num: 5 as const, label: 'Taxes' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">NNSW Official Form Auto Fill</h1>
        <p className="mt-1 text-sm text-slate-600">
          Connect with the authorized Companion Chrome Extension to populate your verified data into{' '}
          <a
            href="https://nnsw.gov.np/tiv/gen"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
          >
            https://nnsw.gov.np/tiv/gen
          </a>
          .
        </p>
      </div>

      {/* Blockers Banner */}
      {(vehicleMismatch || missingFields.length > 0) && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">
                  {vehicleMismatch
                    ? 'Vehicle Number Mismatch Detected'
                    : `${missingFields.length} required NNSW fields are currently empty`}
                </p>
                <p className="mt-0.5 text-amber-900">
                  {vehicleMismatch
                    ? 'General Information Vehicle No does not match the Vehicle RC Registration Number. Fix this on the Review screen before filling.'
                    : 'You can still stage partial data, or return to Review to complete all mandatory fields first.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onGoToReview}
              className="min-h-[38px] shrink-0 rounded-lg border border-amber-400 bg-white px-3.5 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 whitespace-nowrap"
            >
              Return to Review
            </button>
          </div>
        </div>
      )}

      {/* Companion Extension Connection & Actions */}
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Authorized Browser Automation Bridge
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Web browsers block direct cross-origin form control for security. Use the Companion
                Chrome Extension to auto-fill NNSW fields after you log in.
              </p>
            </div>
            <button
              type="button"
              onClick={checkExtension}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Check Extension
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 text-xs">
            <span className="font-medium text-slate-700">Companion Extension Status</span>
            {extensionState === 'checking' && (
              <span className="font-mono text-slate-600">Checking browser bridge...</span>
            )}
            {extensionState === 'connected' && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Connected (v{extensionVersion})
              </span>
            )}
            {extensionState === 'not_detected' && (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                Not detected in this browser — download bundle below
              </span>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDispatchAutoFill}
              disabled={vehicleMismatch}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
            >
              <Send className="h-4 w-4" />
              Auto Fill NNSW Form
            </button>

            <a
              href="/api/extension-bundle"
              download="nnsw-smart-autofill-extension.zip"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              Download Chrome Extension (.zip)
            </a>

            <button
              type="button"
              onClick={() => copyValue('full_json', JSON.stringify(payload, null, 2))}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              {copiedKey === 'full_json' ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  Payload Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy JSON Payload
                </>
              )}
            </button>
          </div>

          {dispatchMessage && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3.5 text-xs leading-relaxed text-blue-950">
              {dispatchMessage}
            </div>
          )}

          {/* Portal Completion Checkboxes */}
          <div className="mt-5 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2.5 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={application.formFilledInPortal}
                onChange={(e) =>
                  onUpdateApplication((prev) => ({
                    ...prev,
                    updatedAt: new Date().toISOString(),
                    formFilledInPortal: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 accent-blue-700"
              />
              <span>Steps 1–3 filled on nnsw.gov.np</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={application.documentsUploadedInPortal}
                onChange={(e) =>
                  onUpdateApplication((prev) => ({
                    ...prev,
                    updatedAt: new Date().toISOString(),
                    documentsUploadedInPortal: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 accent-blue-700"
              />
              <span>Step 4 documents uploaded on nnsw.gov.np</span>
            </label>
          </div>
        </section>

        {/* Login & Security Compliance Instructions */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ShieldAlert className="h-4 w-4 text-blue-700" />
            Official Portal Login & Security Steps
          </div>
          <ol className="space-y-3 text-xs leading-relaxed text-slate-600">
            <li>
              <strong className="text-slate-900">1. Install Extension (One-Time):</strong> Download
              the Chrome Extension zip, unzip it, open <span className="font-mono">chrome://extensions</span>,
              enable Developer Mode, and click <em>Load unpacked</em>.
            </li>
            <li>
              <strong className="text-slate-900">2. Open & Log In Manually:</strong> Launch{' '}
              <a
                href="https://nnsw.gov.np/tiv/gen"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-700 underline underline-offset-2"
              >
                nnsw.gov.np/tiv/gen
              </a>{' '}
              and sign in yourself. Complete any CAPTCHA or reCAPTCHA check directly on the portal.
            </li>
            <li>
              <strong className="text-slate-900">3. Populate Steps 1–4:</strong> Click{' '}
              <em>Fill Current Step</em> in the extension bar on each step, verify dropdown selections,
              and attach your Driving License and Bill Book / RC files.
            </li>
            <li>
              <strong className="text-slate-900">4. Manual Tax Review & Submission:</strong> Review
              official government fees on Step 5 (Taxes) and personally confirm payment and final
              submission.
            </li>
          </ol>

          <div className="mt-4 pt-3 border-t border-slate-200">
            <a
              href="https://nnsw.gov.np/tiv/gen"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 whitespace-nowrap"
            >
              Open Official NNSW TIV Portal
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </section>
      </div>

      {/* Interactive 5-Step Official Portal Preview & Field Copy Assistant */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Register Temporary Import of Vehicle (TIV) — Step-by-Step Field Preview
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Mirrors the 5 official NNSW portal steps so you can test auto-fill mapping or copy any
                value in one click.
              </p>
            </div>
            {portalStep !== 5 && (
              <button
                type="button"
                onClick={handleDryRunFillCurrentStep}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
              >
                <Check className="h-3.5 w-3.5" />
                {dryRunFilledSteps.includes(portalStep)
                  ? `Step ${portalStep} Verified Ready`
                  : `Verify Step ${portalStep} Mapping`}
              </button>
            )}
          </div>

          {/* Official-style 5-Step Stepper */}
          <div className="mt-5 flex items-center justify-between overflow-x-auto pb-1">
            {portalSteps.map((s, idx) => {
              const isCurrent = portalStep === s.num;
              const isDone = dryRunFilledSteps.includes(s.num);
              return (
                <div key={s.num} className="flex flex-1 items-center">
                  <button
                    type="button"
                    onClick={() => setPortalStep(s.num)}
                    className="group flex flex-col items-center gap-1.5 px-2 text-center focus:outline-none"
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors ${
                        isDone
                          ? 'border-blue-700 bg-blue-700 text-white'
                          : isCurrent
                            ? 'border-blue-700 bg-blue-50 text-blue-800'
                            : 'border-slate-300 bg-slate-100 text-slate-600 group-hover:border-slate-400'
                      }`}
                    >
                      {isDone ? <Check className="h-4 w-4" /> : s.num}
                    </span>
                    <span
                      className={`text-xs whitespace-nowrap ${
                        isCurrent ? 'font-semibold text-blue-800' : 'text-slate-600'
                      }`}
                    >
                      {s.label}
                    </span>
                  </button>
                  {idx < portalSteps.length - 1 && (
                    <div
                      className={`mx-1 h-px flex-1 ${
                        isDone ? 'bg-blue-600' : 'border-t border-dashed border-slate-300'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Body */}
        <div className="p-6">
          {portalStep === 1 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {renderCopyRow(
                'Entry Customs Office',
                lookupOffice(application.general.entryCustomsOffice),
                's1_entry_office',
                true
              )}
              {renderCopyRow(
                'Exit Customs Office',
                lookupOffice(application.general.exitCustomsOffice),
                's1_exit_office',
                true
              )}
              {renderCopyRow('Vehicle No', application.general.vehicleNo, 's1_vehicle_no', true)}
              {renderCopyRow('Purpose', application.general.purpose, 's1_purpose')}
              {renderCopyRow('Entry Date', application.general.entryDate, 's1_entry_date', true)}
              {renderCopyRow('Exit Date', application.general.exitDate, 's1_exit_date', true)}
              {renderCopyRow(
                'Number of Days to Stay',
                application.general.daysToStay,
                's1_days',
                true
              )}
              {renderCopyRow(
                'Destination Place',
                application.general.destinationPlace,
                's1_dest',
                true
              )}
              <div className="sm:col-span-2">
                {renderCopyRow('Hotel / Location', application.general.hotelLocation, 's1_hotel')}
              </div>
            </div>
          )}

          {portalStep === 2 && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {renderCopyRow(
                  'Nationality',
                  lookupCountry(application.driver.nationality),
                  's2_nat',
                  true
                )}
                {renderCopyRow(
                  'Driving License Number',
                  application.driver.drivingLicenseNumber,
                  's2_dl',
                  true
                )}
                {renderCopyRow('First Name', application.driver.firstName, 's2_fn', true)}
                {renderCopyRow('Last Name', application.driver.lastName, 's2_ln', true)}
                {renderCopyRow(
                  'Identity Card Number (Aadhaar, PAN, etc.)',
                  application.driver.identityCardNumber,
                  's2_id',
                  true
                )}
                {renderCopyRow('Birth Date', application.driver.birthDate, 's2_dob', true)}
                {renderCopyRow(
                  'Foreign Address',
                  application.driver.foreignAddress,
                  's2_faddr',
                  true
                )}
                {renderCopyRow('Email', application.driver.email, 's2_email')}
                {renderCopyRow('Local Address', application.driver.localAddress, 's2_laddr')}
                {renderCopyRow(
                  'Phone Number',
                  application.driver.phoneNumber
                    ? `${application.driver.phoneCountryCode} ${application.driver.phoneNumber}`
                    : '',
                  's2_phone'
                )}
              </div>

              <div className="border-t border-slate-200 pt-4">
                <p className="mb-3 text-xs font-semibold text-slate-700">
                  Vehicle Owner Information ·{' '}
                  {application.driver.ownerSameAsDriver
                    ? 'Same person as driver (Toggle ON)'
                    : 'Separate Vehicle Owner (Toggle OFF)'}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {renderCopyRow('Vehicle Owner Name', application.driver.ownerName, 's2_own_name')}
                  {renderCopyRow(
                    'Vehicle Owner Address',
                    application.driver.ownerAddress,
                    's2_own_addr'
                  )}
                </div>
              </div>
            </div>
          )}

          {portalStep === 3 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {renderCopyRow('Vehicle Type', application.vehicle.vehicleType, 's3_type', true)}
              {renderCopyRow(
                'Vehicle Brand',
                lookupBrand(application.vehicle.vehicleBrand),
                's3_brand'
              )}
              {renderCopyRow(
                'Vehicle Country',
                lookupCountry(application.vehicle.vehicleCountry),
                's3_country',
                true
              )}
              {renderCopyRow('Vehicle No', application.vehicle.vehicleNo, 's3_veh_no', true)}
              {renderCopyRow(
                'Chassis Number',
                application.vehicle.chassisNumber,
                's3_chassis',
                true
              )}
              {renderCopyRow('Engine Number', application.vehicle.engineNumber, 's3_engine', true)}
              {renderCopyRow(
                'Number of Passengers',
                application.vehicle.numberOfPassengers,
                's3_pass',
                true
              )}
              {renderCopyRow('Vehicle Color', application.vehicle.vehicleColor, 's3_color')}
            </div>
          )}

          {portalStep === 4 && (
            <div className="space-y-3">
              {[
                { label: 'Driving License', doc: application.drivingLicenseDoc },
                { label: 'Bill Book / RC (Front Page)', doc: application.vehicleRcDoc },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border px-4 py-3.5 ${
                    item.doc ? 'border-slate-200 bg-white' : 'border-red-300 bg-red-50/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-14 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50">
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
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500">
                        {item.doc ? item.doc.fileName : 'A required document is missing.'}
                      </p>
                    </div>
                  </div>
                  {item.doc && (
                    <a
                      href={item.doc.dataUrl}
                      download={item.doc.fileName}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 whitespace-nowrap"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Preserved File
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {portalStep === 5 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-6">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-blue-800" />
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Step 5 — Official Taxes & Final Confirmation (Manual Portal Step)
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-700">
                    Temporary Import of Vehicle (TIV) customs taxes and service charges are computed
                    exclusively by the official Nepal National Single Window portal (
                    <span className="font-mono">nnsw.gov.np/tiv/gen</span>) based on vehicle category,
                    customs office, and stay duration.
                  </p>
                  <p className="text-xs font-medium text-slate-800">
                    By policy, this assistant never invents tax figures, initiates payment, bypasses
                    CAPTCHA, or submits the official form automatically. Proceed to the portal to review
                    official tax amounts and complete submission yourself.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={portalStep === 1}
              onClick={() => setPortalStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4 | 5) : s))}
              className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 whitespace-nowrap"
            >
              Previous Step
            </button>
            <button
              type="button"
              disabled={portalStep === 5}
              onClick={() => setPortalStep((s) => (s < 5 ? ((s + 1) as 1 | 2 | 3 | 4 | 5) : s))}
              className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 whitespace-nowrap"
            >
              Next Step
            </button>
          </div>

          <button
            type="button"
            onClick={onGoToSummary}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
          >
            Continue to Application Summary
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
}
