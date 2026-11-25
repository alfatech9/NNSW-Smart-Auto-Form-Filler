import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  ScanLine,
  ClipboardEdit,
  Send,
  FileCheck2,
  Plus,
  CarFront,
  CheckCircle2,
} from 'lucide-react';
import type { AppPage, TivApplication } from './types/nnsw';
import {
  clearAllStoredApplications,
  createEmptyApplication,
  getApplicationStages,
  loadApplications,
  saveApplications,
} from './utils/storage';
import { DashboardView } from './components/DashboardView';
import { ScannerView } from './components/ScannerView';
import { ReviewView } from './components/ReviewView';
import { AutoFillView } from './components/AutoFillView';
import { SummaryView } from './components/SummaryView';

const NAV_ITEMS: Array<{
  id: AppPage;
  label: string;
  shortLabel: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard },
  { id: 'scanner', label: 'Document Scanner', shortLabel: 'Scanner', icon: ScanLine },
  { id: 'review', label: 'Extracted Information', shortLabel: 'Review', icon: ClipboardEdit },
  { id: 'autofill', label: 'NNSW Auto Fill', shortLabel: 'Auto Fill', icon: Send },
  { id: 'summary', label: 'Application Summary', shortLabel: 'Summary', icon: FileCheck2 },
];

export default function App() {
  const [applications, setApplications] = useState<TivApplication[]>(() => {
    const existing = loadApplications();
    if (existing.length > 0) return existing;
    return [createEmptyApplication()];
  });

  const [activeId, setActiveId] = useState<string>(() => {
    const existing = loadApplications();
    return existing.length > 0 ? existing[0].id : '';
  });

  const [currentPage, setCurrentPage] = useState<AppPage>('dashboard');
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // Ensure activeId always resolves to an existing application
  const activeApplication = useMemo(() => {
    const found = applications.find((a) => a.id === activeId);
    return found ?? applications[0];
  }, [applications, activeId]);

  useEffect(() => {
    if (activeApplication && activeId !== activeApplication.id) {
      setActiveId(activeApplication.id);
    }
  }, [activeApplication, activeId]);

  useEffect(() => {
    const result = saveApplications(applications);
    if (!result.ok && result.quotaExceeded) {
      setStorageWarning(
        'Browser storage is nearly full due to high-resolution scans. Delete older applications after submitting.'
      );
    } else {
      setStorageWarning(null);
    }
  }, [applications]);

  const updateActiveApplication = (updater: (prev: TivApplication) => TivApplication) => {
    setApplications((prev) =>
      prev.map((app) => (app.id === activeApplication.id ? updater(app) : app))
    );
  };

  const handleStartNewApplication = () => {
    const fresh = createEmptyApplication();
    setApplications((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    setCurrentPage('scanner');
  };

  const handleSelectApplication = (id: string) => {
    setActiveId(id);
    setCurrentPage('scanner');
  };

  const handleDeleteApplication = (id: string) => {
    setApplications((prev) => {
      const remaining = prev.filter((a) => a.id !== id);
      if (remaining.length === 0) {
        const fresh = createEmptyApplication();
        setActiveId(fresh.id);
        setCurrentPage('dashboard');
        return [fresh];
      }
      if (id === activeApplication.id) {
        setActiveId(remaining[0].id);
        setCurrentPage('dashboard');
      }
      return remaining;
    });
  };

  const handleClearAllData = () => {
    clearAllStoredApplications();
    const fresh = createEmptyApplication();
    setApplications([fresh]);
    setActiveId(fresh.id);
    setCurrentPage('dashboard');
  };

  const handleDeleteActiveDocuments = () => {
    updateActiveApplication((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      drivingLicenseDoc: null,
      vehicleRcDoc: null,
      documentsUploadedInPortal: false,
    }));
  };

  const stages = useMemo(() => getApplicationStages(activeApplication), [activeApplication]);
  const completedStages = stages.filter((s) => s.completed).length;
  const activeNavMeta = NAV_ITEMS.find((item) => item.id === currentPage) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <div className="flex min-h-screen">
        {/* Desktop Left Sidebar */}
        <aside className="no-print hidden w-[260px] shrink-0 flex-col justify-between border-r border-slate-200 bg-white lg:flex">
          <div>
            <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white">
                <CarFront className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-bold tracking-tight text-slate-900">
                  NNSW Auto Filler
                </p>
                <p className="truncate text-[11px] text-slate-500">TIV Vehicle Assistant</p>
              </div>
            </div>

            <nav aria-label="Primary navigation" className="space-y-1 p-3">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCurrentPage(item.id)}
                    className={`flex min-h-[42px] w-full items-center gap-3 rounded-lg px-3.5 py-2 text-left text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-blue-50 text-blue-800'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-blue-700' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Active Application Progress Widget */}
            <div className="mx-3 mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">Active Application</span>
                <span className="font-mono font-semibold text-blue-700 tabular-nums">
                  {completedStages}/{stages.length}
                </span>
              </div>
              <p className="mt-1 truncate font-mono text-[11px] text-slate-500">
                {activeApplication.general.vehicleNo ||
                  activeApplication.vehicle.vehicleNo ||
                  activeApplication.id}
              </p>

              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-blue-700 transition-all"
                  style={{ width: `${(completedStages / stages.length) * 100}%` }}
                />
              </div>

              <ul className="mt-3 space-y-1.5 text-[11px]">
                {stages.map((s) => (
                  <li
                    key={s.id}
                    className={`flex items-center gap-1.5 ${
                      s.completed ? 'text-slate-800' : 'text-slate-400'
                    }`}
                  >
                    <CheckCircle2
                      className={`h-3.5 w-3.5 shrink-0 ${
                        s.completed ? 'text-emerald-600' : 'text-slate-300'
                      }`}
                    />
                    <span className="truncate">{s.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-200 p-4 text-[11px] leading-relaxed text-slate-500">
            Target portal:{' '}
            <a
              href="https://nnsw.gov.np/tiv/gen"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-700 hover:underline"
            >
              nnsw.gov.np/tiv/gen
            </a>
          </div>
        </aside>

        {/* Main Viewport */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top Header Bar (Strict SaaS Breadcrumb + Single Primary Action) */}
          <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="font-display font-bold text-blue-900 whitespace-nowrap lg:hidden">
                NNSW Auto Filler
              </span>
              <span className="text-slate-300 lg:hidden" aria-hidden="true">
                /
              </span>
              <span className="hidden text-slate-500 lg:inline whitespace-nowrap">
                NNSW Smart Auto Form Filler
              </span>
              <span className="hidden text-slate-300 lg:inline" aria-hidden="true">
                /
              </span>
              <span className="truncate font-semibold text-slate-900">{activeNavMeta.label}</span>
            </div>

            <button
              type="button"
              onClick={handleStartNewApplication}
              className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              New Application
            </button>
          </header>

          {storageWarning && (
            <div className="no-print border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-xs text-amber-900">
              {storageWarning}
            </div>
          )}

          {/* Main Page Content */}
          <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">
            {currentPage === 'dashboard' && (
              <DashboardView
                applications={applications}
                activeApplicationId={activeApplication.id}
                onStartNew={handleStartNewApplication}
                onQuickUpload={() => setCurrentPage('scanner')}
                onSelectApplication={handleSelectApplication}
                onDeleteApplication={handleDeleteApplication}
                onClearAllData={handleClearAllData}
              />
            )}

            {currentPage === 'scanner' && (
              <ScannerView
                application={activeApplication}
                onUpdateApplication={updateActiveApplication}
                onGoToReview={() => setCurrentPage('review')}
              />
            )}

            {currentPage === 'review' && (
              <ReviewView
                application={activeApplication}
                onUpdateApplication={updateActiveApplication}
                onGoToScanner={() => setCurrentPage('scanner')}
                onProceedToAutoFill={() => setCurrentPage('autofill')}
              />
            )}

            {currentPage === 'autofill' && (
              <AutoFillView
                application={activeApplication}
                onUpdateApplication={updateActiveApplication}
                onGoToReview={() => setCurrentPage('review')}
                onGoToSummary={() => setCurrentPage('summary')}
              />
            )}

            {currentPage === 'summary' && (
              <SummaryView
                application={activeApplication}
                onUpdateApplication={updateActiveApplication}
                onDeleteDocuments={handleDeleteActiveDocuments}
                onDeleteApplication={() => handleDeleteApplication(activeApplication.id)}
                onGoToReview={() => setCurrentPage('review')}
              />
            )}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (Compact <= 60px, respects 15% mobile sticky cap) */}
      <nav
        aria-label="Mobile navigation"
        className="no-print fixed bottom-0 left-0 right-0 z-30 grid h-[60px] grid-cols-5 border-t border-slate-200 bg-white lg:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCurrentPage(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                active ? 'text-blue-700' : 'text-slate-500'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
