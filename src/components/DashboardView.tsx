import { useMemo, useState } from 'react';
import {
  Plus,
  Upload,
  Camera,
  ScanText,
  ClipboardCheck,
  Send,
  ShieldCheck,
  Search,
  Trash2,
  ArrowRight,
  ExternalLink,
  FileText,
} from 'lucide-react';
import type { TivApplication } from '../types/nnsw';
import { getApplicationStages, hasVehicleNumberMismatch } from '../utils/storage';

interface DashboardViewProps {
  applications: TivApplication[];
  activeApplicationId: string;
  onStartNew: () => void;
  onQuickUpload: () => void;
  onSelectApplication: (id: string) => void;
  onDeleteApplication: (id: string) => void;
  onClearAllData: () => void;
}

export function DashboardView({
  applications,
  activeApplicationId,
  onStartNew,
  onQuickUpload,
  onSelectApplication,
  onDeleteApplication,
  onClearAllData,
}: DashboardViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'in_progress' | 'ready'>('all');
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      const stages = getApplicationStages(app);
      const isReady = stages[stages.length - 1].completed;
      if (filterMode === 'ready' && !isReady) return false;
      if (filterMode === 'in_progress' && isReady) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const driverName = `${app.driver.firstName} ${app.driver.lastName}`.toLowerCase();
      const vehicleNo = (app.general.vehicleNo || app.vehicle.vehicleNo || '').toLowerCase();
      const licenseNo = (app.driver.drivingLicenseNumber || '').toLowerCase();
      return (
        app.id.toLowerCase().includes(q) ||
        driverName.includes(q) ||
        vehicleNo.includes(q) ||
        licenseNo.includes(q)
      );
    });
  }, [applications, searchQuery, filterMode]);

  const workflowSteps = [
    {
      num: '01',
      title: 'Capture Driving License',
      desc: 'Take a photo with your rear mobile camera or upload JPG, PNG, or PDF.',
      icon: Camera,
    },
    {
      num: '02',
      title: 'Capture Vehicle Bill Book / RC',
      desc: 'Scan the RC front page with built-in crop, rotation, and clarity enhancement.',
      icon: FileText,
    },
    {
      num: '03',
      title: 'AI + OCR Data Extraction',
      desc: 'Automatically detect document type and map visible driver and vehicle fields.',
      icon: ScanText,
    },
    {
      num: '04',
      title: 'Review & Verify Information',
      desc: 'Edit every extracted value, check confidence levels, and verify vehicle numbers.',
      icon: ClipboardCheck,
    },
    {
      num: '05',
      title: 'Auto Fill NNSW Portal',
      desc: 'Populate official NNSW TIV steps 1–4 via the companion extension; confirm taxes manually.',
      icon: Send,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <section className="rounded-xl border border-blue-200/80 bg-gradient-to-br from-[#1E3A8A] via-[#1D4ED8] to-[#1E40AF] p-6 text-white sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-center">
          <div className="space-y-4">
            <p className="text-xs font-medium tracking-wide text-blue-100">
              Smart Vehicle Registration Assistant · Official target: nnsw.gov.np/tiv/gen
            </p>
            <h1 className="max-w-2xl text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl [text-wrap:balance]">
              NNSW Smart Auto Form Filler
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-blue-100/95 sm:text-base">
              Take or upload two photos — your Driving License and Vehicle Bill Book / RC (Front Page) —
              to extract driver and vehicle details, verify every field, and auto-fill the Nepal National
              Single Window Temporary Import of Vehicle (TIV) form with minimal manual typing.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onStartNew}
                className="inline-flex min-h-[46px] items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-blue-900 transition-colors hover:bg-blue-50 whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                Start New Application
              </button>
              <button
                type="button"
                onClick={onQuickUpload}
                className="inline-flex min-h-[46px] items-center gap-2 rounded-lg border border-blue-300/60 bg-blue-800/40 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800/70 whitespace-nowrap"
              >
                <Upload className="h-4 w-4" />
                Upload Documents
              </button>
              <a
                href="https://nnsw.gov.np/tiv/gen"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[46px] items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-100 underline-offset-4 hover:text-white hover:underline whitespace-nowrap"
              >
                Official NNSW Portal
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="rounded-lg border border-white/15 bg-white/10 p-5 backdrop-blur-xs">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-blue-200" />
              Authorized & Privacy-First Workflow
            </div>
            <ul className="space-y-2.5 text-xs leading-relaxed text-blue-100">
              <li>Explicit consent is required before running AI OCR on personal documents.</li>
              <li>Unavailable fields are left blank — personal or vehicle data is never guessed.</li>
              <li>You sign in to nnsw.gov.np manually and personally confirm Taxes and final submission.</li>
              <li>No NNSW portal passwords are ever requested or stored.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 5-Step Workflow Guide */}
      <section aria-labelledby="workflow-heading">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="workflow-heading" className="text-lg font-semibold text-slate-900">
            How the Application Works
          </h2>
          <p className="text-xs text-slate-500">
            Take Two Photos → Scan Documents → Extract Data → Review → Auto Fill NNSW Form
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {workflowSteps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4"
              >
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-blue-700 tabular-nums">
                      Step {step.num}
                    </span>
                    <Icon className="h-4 w-4 text-slate-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Previous Applications */}
      <section
        aria-labelledby="previous-apps-heading"
        className="rounded-xl border border-slate-200 bg-white"
      >
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="previous-apps-heading" className="text-lg font-semibold text-slate-900">
              Previous Applications
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Saved locally in your browser so you can resume or delete records at any time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search vehicle, driver, or ID..."
                className="h-10 w-56 rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  ['all', 'All'],
                  ['in_progress', 'In Progress'],
                  ['ready', 'Ready'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilterMode(key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    filterMode === key
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredApps.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-900">
              {applications.length === 0
                ? 'No saved TIV applications yet'
                : 'No applications match your current filter'}
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
              {applications.length === 0
                ? 'Start a new application to scan a Driving License and Vehicle Bill Book / RC.'
                : 'Try clearing your search query or switching the status filter.'}
            </p>
            {applications.length === 0 && (
              <button
                type="button"
                onClick={onStartNew}
                className="mt-5 inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                Start First Application
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="px-5 py-3">Application ID</th>
                  <th className="px-5 py-3">Driver</th>
                  <th className="px-5 py-3">Vehicle Number</th>
                  <th className="px-5 py-3">Travel Window</th>
                  <th className="px-5 py-3">Progress</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredApps.map((app) => {
                  const stages = getApplicationStages(app);
                  const completedCount = stages.filter((s) => s.completed).length;
                  const mismatch = hasVehicleNumberMismatch(app);
                  const driverLabel =
                    `${app.driver.firstName} ${app.driver.lastName}`.trim() || 'Not extracted yet';
                  const vehicleNo = app.general.vehicleNo || app.vehicle.vehicleNo || '—';
                  const isActive = app.id === activeApplicationId;

                  return (
                    <tr
                      key={app.id}
                      className={`transition-colors hover:bg-slate-50 ${
                        isActive ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="px-5 py-3.5 align-middle">
                        <div className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                          {app.id}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
                          Updated {new Date(app.updatedAt).toLocaleDateString()}
                          {isActive ? ' · Current' : ''}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 align-middle">
                        <div className="font-medium text-slate-900">{driverLabel}</div>
                        <div className="font-mono text-xs text-slate-500">
                          {app.driver.drivingLicenseNumber || 'License pending'}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 align-middle">
                        <div className="font-mono text-xs font-semibold text-slate-900">
                          {vehicleNo}
                        </div>
                        {mismatch && (
                          <div className="mt-0.5 text-xs font-medium text-amber-700">
                            Mismatch requires review
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 align-middle text-xs text-slate-600 tabular-nums">
                        {app.general.entryDate && app.general.exitDate
                          ? `${app.general.entryDate} – ${app.general.exitDate}`
                          : 'Dates not set'}
                      </td>
                      <td className="px-5 py-3.5 align-middle">
                        <div className="flex items-center gap-2.5">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full bg-blue-700 transition-all"
                              style={{ width: `${(completedCount / stages.length) * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-slate-700 tabular-nums">
                            {completedCount}/{stages.length}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right align-middle">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectApplication(app.id)}
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 whitespace-nowrap"
                          >
                            Continue
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteApplication(app.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                            aria-label={`Delete application ${app.id}`}
                            title="Delete application and documents"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Data Retention & Privacy Footer Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3.5 text-xs text-slate-600">
          <span>
            Privacy & Retention Policy: Documents are processed transiently in memory during OCR and
            stored only on your device until deleted.
          </span>
          {applications.length > 0 && (
            <div className="flex items-center gap-2">
              {confirmClearAll ? (
                <>
                  <span className="font-medium text-red-700">Erase all local records?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClearAllData();
                      setConfirmClearAll(false);
                    }}
                    className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 whitespace-nowrap"
                  >
                    Confirm Delete All
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(false)}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(true)}
                  className="font-medium text-red-700 underline-offset-2 hover:underline whitespace-nowrap"
                >
                  Delete All Saved Data
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
