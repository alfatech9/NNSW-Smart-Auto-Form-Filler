import { useRef, useState } from 'react';
import {
  Camera,
  Upload,
  SlidersHorizontal,
  RefreshCw,
  Trash2,
  ScanText,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Shield,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import type {
  ConfidenceLevel,
  FieldMeta,
  ScannedDocument,
  TivApplication,
} from '../types/nnsw';
import {
  matchCountryCode,
  matchVehicleBrand,
  matchVehicleType,
} from '../types/nnsw';
import { CameraModal } from './CameraModal';
import { ImageEditorModal } from './ImageEditorModal';

interface ScannerViewProps {
  application: TivApplication;
  onUpdateApplication: (updater: (prev: TivApplication) => TivApplication) => void;
  onGoToReview: () => void;
}

interface ExtractedFieldPayload {
  value: string;
  confidence: ConfidenceLevel;
  note: string;
}

interface ExtractionApiResponse {
  ok: boolean;
  documentSlot: 'driving_license' | 'vehicle_rc';
  extraction: {
    detectedDocumentType: 'driving_license' | 'vehicle_rc' | 'other';
    documentTypeReason: string;
    warnings: string[];
    fields: Record<string, ExtractedFieldPayload>;
  };
  error?: string;
}

const ACCEPTED_FILE_TYPES = 'image/jpeg,image/jpg,image/png,image/webp,application/pdf';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ScannerView({
  application,
  onUpdateApplication,
  onGoToReview,
}: ScannerViewProps) {
  const dlInputRef = useRef<HTMLInputElement | null>(null);
  const rcInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraSlot, setCameraSlot] = useState<'driving_license' | 'vehicle_rc' | null>(null);
  const [editorSlot, setEditorSlot] = useState<'driving_license' | 'vehicle_rc' | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [scanningAll, setScanningAll] = useState(false);

  const setDocumentForSlot = (
    slot: 'driving_license' | 'vehicle_rc',
    doc: ScannedDocument | null
  ) => {
    onUpdateApplication((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      drivingLicenseDoc: slot === 'driving_license' ? doc : prev.drivingLicenseDoc,
      vehicleRcDoc: slot === 'vehicle_rc' ? doc : prev.vehicleRcDoc,
    }));
  };

  const handleFileChosen = (slot: 'driving_license' | 'vehicle_rc', file: File | null) => {
    if (!file) return;
    setGlobalError(null);

    if (file.size > 10 * 1024 * 1024) {
      setGlobalError('File exceeds the 10 MB limit. Please upload a smaller image or PDF.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      const doc: ScannedDocument = {
        id: `${slot}_${Date.now()}`,
        slot,
        fileName: file.name,
        mimeType: file.type || 'image/jpeg',
        sizeBytes: file.size,
        dataUrl,
        originalDataUrl: dataUrl,
        uploadedAt: new Date().toISOString(),
        enhanced: false,
        rotation: 0,
        scanStatus: 'idle',
        warnings: [],
      };
      setDocumentForSlot(slot, doc);
    };
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = (dataUrl: string, fileName: string) => {
    if (!cameraSlot) return;
    const approxBytes = Math.round((dataUrl.length * 3) / 4);
    const doc: ScannedDocument = {
      id: `${cameraSlot}_${Date.now()}`,
      slot: cameraSlot,
      fileName,
      mimeType: 'image/jpeg',
      sizeBytes: approxBytes,
      dataUrl,
      originalDataUrl: dataUrl,
      uploadedAt: new Date().toISOString(),
      enhanced: false,
      rotation: 0,
      scanStatus: 'idle',
      warnings: [],
    };
    setDocumentForSlot(cameraSlot, doc);
    setCameraSlot(null);
  };

  const handleEditorSave = (processedDataUrl: string, rotation: number, enhanced: boolean) => {
    if (!editorSlot) return;
    onUpdateApplication((prev) => {
      const current = editorSlot === 'driving_license' ? prev.drivingLicenseDoc : prev.vehicleRcDoc;
      if (!current) return prev;
      const updated: ScannedDocument = {
        ...current,
        dataUrl: processedDataUrl,
        mimeType: 'image/jpeg',
        rotation,
        enhanced,
        scanStatus: 'idle',
      };
      return {
        ...prev,
        updatedAt: new Date().toISOString(),
        drivingLicenseDoc: editorSlot === 'driving_license' ? updated : prev.drivingLicenseDoc,
        vehicleRcDoc: editorSlot === 'vehicle_rc' ? updated : prev.vehicleRcDoc,
      };
    });
    setEditorSlot(null);
  };

  const optimizeImageForOcr = async (
    dataUrl: string,
    mimeType: string
  ): Promise<{ dataUrl: string; mimeType: string }> => {
    if (mimeType === 'application/pdf' || !dataUrl.startsWith('data:image/')) {
      return { dataUrl, mimeType };
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1600;
        let { naturalWidth: w, naturalHeight: h } = img;
        if (w <= maxDim && h <= maxDim && dataUrl.length < 900_000) {
          resolve({ dataUrl, mimeType });
          return;
        }
        const scale = Math.min(1, maxDim / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl, mimeType });
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve({
          dataUrl: canvas.toDataURL('image/jpeg', 0.88),
          mimeType: 'image/jpeg',
        });
      };
      img.onerror = () => resolve({ dataUrl, mimeType });
      img.src = dataUrl;
    });
  };

  const runExtractionForSlot = async (slot: 'driving_license' | 'vehicle_rc') => {
    const doc = slot === 'driving_license' ? application.drivingLicenseDoc : application.vehicleRcDoc;
    if (!doc) return false;

    if (!application.consentGiven) {
      setGlobalError(
        'Please confirm your privacy consent below before sending personal documents to the AI OCR service.'
      );
      return false;
    }

    setGlobalError(null);

    onUpdateApplication((prev) => {
      const target = slot === 'driving_license' ? prev.drivingLicenseDoc : prev.vehicleRcDoc;
      if (!target) return prev;
      const nextDoc: ScannedDocument = { ...target, scanStatus: 'scanning', errorMessage: undefined };
      return {
        ...prev,
        drivingLicenseDoc: slot === 'driving_license' ? nextDoc : prev.drivingLicenseDoc,
        vehicleRcDoc: slot === 'vehicle_rc' ? nextDoc : prev.vehicleRcDoc,
      };
    });

    try {
      const prepared = await optimizeImageForOcr(doc.dataUrl, doc.mimeType);
      let payload: ExtractionApiResponse | null = null;
      let lastFetchError = 'Document OCR extraction failed.';

      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch('/api/extract-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentSlot: slot,
            mimeType: prepared.mimeType,
            base64Data: prepared.dataUrl,
            consentGiven: true,
          }),
        });

        const rawText = await res.text();
        let parsed: ExtractionApiResponse | null = null;
        try {
          parsed = JSON.parse(rawText) as ExtractionApiResponse;
        } catch {
          parsed = null;
        }

        if (res.ok && parsed && parsed.ok) {
          payload = parsed;
          break;
        }

        if (parsed && parsed.error) {
          lastFetchError = parsed.error;
        } else if (res.status === 502 || res.status === 503 || res.status === 504) {
          lastFetchError =
            'The OCR service timed out or was temporarily busy. Please click "Scan Now" to retry.';
        } else if (res.status === 413) {
          lastFetchError = 'The document file is too large. Please crop or upload a smaller image.';
        } else if (res.status === 404) {
          lastFetchError =
            'The OCR backend route is restarting or unavailable. Please wait a moment and retry.';
        } else {
          lastFetchError = `Unexpected server response (HTTP ${res.status}). Please retry scanning.`;
        }

        const shouldRetry =
          attempt === 0 && (res.status >= 500 || res.status === 404 || parsed === null);
        if (shouldRetry) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        break;
      }

      if (!payload || !payload.ok) {
        throw new Error(lastFetchError);
      }

      const { detectedDocumentType, documentTypeReason, warnings, fields } = payload.extraction;
      const mergedWarnings = [...(warnings || [])];
      if (slot === 'driving_license' && detectedDocumentType !== 'driving_license') {
        mergedWarnings.unshift(
          `Document type check: This file looks like "${detectedDocumentType.replace('_', ' ')}" rather than a Driving License (${documentTypeReason}). Please verify you uploaded it in the right slot.`
        );
      }
      if (slot === 'vehicle_rc' && detectedDocumentType !== 'vehicle_rc') {
        mergedWarnings.unshift(
          `Document type check: This file looks like "${detectedDocumentType.replace('_', ' ')}" rather than a Vehicle Bill Book / RC (${documentTypeReason}). Please verify you uploaded it in the right slot.`
        );
      }

      onUpdateApplication((prev) => {
        const nextMeta: Record<string, FieldMeta> = { ...prev.fieldMeta };
        const recordField = (
          key: string,
          fieldObj: ExtractedFieldPayload | undefined,
          source: 'driving_license' | 'vehicle_rc',
          noteOverride?: string
        ) => {
          if (!fieldObj) return '';
          const val = (fieldObj.value || '').trim();
          nextMeta[key] = {
            confidence: val ? fieldObj.confidence : 'missing',
            note: noteOverride || fieldObj.note || '',
            source,
            rawExtractedValue: val,
          };
          return val;
        };

        if (slot === 'driving_license') {
          const rawNat = recordField('nationality', fields.nationality, 'driving_license');
          const matchedNat = matchCountryCode(rawNat);
          const dlNo = recordField('drivingLicenseNumber', fields.drivingLicenseNumber, 'driving_license');
          const firstName = recordField('firstName', fields.firstName, 'driving_license');
          const lastName = recordField('lastName', fields.lastName, 'driving_license');
          const idCard = recordField('identityCardNumber', fields.identityCardNumber, 'driving_license');
          const birthDate = recordField('birthDate', fields.birthDate, 'driving_license');
          const foreignAddress = recordField('foreignAddress', fields.foreignAddress, 'driving_license');
          const email = recordField('email', fields.email, 'driving_license');
          const phoneNumber = recordField('phoneNumber', fields.phoneNumber, 'driving_license');
          const localAddress = recordField('localAddress', fields.localAddress, 'driving_license');

          const updatedDriver = {
            ...prev.driver,
            nationality: matchedNat || prev.driver.nationality,
            drivingLicenseNumber: dlNo || prev.driver.drivingLicenseNumber,
            firstName: firstName || prev.driver.firstName,
            lastName: lastName || prev.driver.lastName,
            identityCardNumber: idCard || prev.driver.identityCardNumber,
            birthDate: birthDate || prev.driver.birthDate,
            foreignAddress: foreignAddress || prev.driver.foreignAddress,
            email: email || prev.driver.email,
            phoneNumber: phoneNumber || prev.driver.phoneNumber,
            localAddress: localAddress || prev.driver.localAddress,
          };

          const updatedDoc: ScannedDocument | null = prev.drivingLicenseDoc
            ? {
                ...prev.drivingLicenseDoc,
                scanStatus: 'scanned',
                detectedType: detectedDocumentType,
                detectedTypeReason: documentTypeReason,
                warnings: mergedWarnings,
                errorMessage: undefined,
              }
            : null;

          return {
            ...prev,
            updatedAt: new Date().toISOString(),
            drivingLicenseDoc: updatedDoc,
            driver: updatedDriver,
            fieldMeta: nextMeta,
            infoVerified: false,
          };
        } else {
          const vehicleNo = recordField('vehicleNo_rc', fields.vehicleNumber, 'vehicle_rc');
          const rawCountry = recordField('vehicleCountry', fields.vehicleCountry, 'vehicle_rc');
          const matchedCountry = matchCountryCode(rawCountry);

          const rawType = (fields.vehicleType?.value || '').trim();
          const typeMatch = matchVehicleType(rawType);
          recordField(
            'vehicleType',
            fields.vehicleType,
            'vehicle_rc',
            rawType && !typeMatch.exact
              ? `Extracted "${rawType}" does not exactly match an official NNSW dropdown option. Please choose manually.`
              : fields.vehicleType?.note
          );

          const rawBrand = (fields.vehicleBrand?.value || '').trim();
          const brandMatch = matchVehicleBrand(rawBrand);
          recordField(
            'vehicleBrand',
            fields.vehicleBrand,
            'vehicle_rc',
            rawBrand && !brandMatch.exact
              ? `Extracted "${rawBrand}" — select closest official NNSW brand code or "OTH (Other)".`
              : fields.vehicleBrand?.note
          );

          const chassisNumber = recordField('chassisNumber', fields.chassisNumber, 'vehicle_rc');
          const engineNumber = recordField('engineNumber', fields.engineNumber, 'vehicle_rc');
          const vehicleColor = recordField('vehicleColor', fields.vehicleColor, 'vehicle_rc');
          const numberOfPassengers = recordField(
            'numberOfPassengers',
            fields.numberOfPassengers,
            'vehicle_rc'
          );
          const ownerName = recordField('ownerName', fields.ownerName, 'vehicle_rc');
          const ownerAddress = recordField('ownerAddress', fields.ownerAddress, 'vehicle_rc');
          const otherDetails = recordField('otherDetails', fields.otherDetails, 'vehicle_rc');

          const updatedVehicle = {
            ...prev.vehicle,
            vehicleNo: vehicleNo || prev.vehicle.vehicleNo,
            vehicleCountry: matchedCountry || prev.vehicle.vehicleCountry,
            vehicleType: typeMatch.matched || prev.vehicle.vehicleType,
            vehicleBrand: brandMatch.matched || prev.vehicle.vehicleBrand,
            chassisNumber: chassisNumber || prev.vehicle.chassisNumber,
            engineNumber: engineNumber || prev.vehicle.engineNumber,
            vehicleColor: vehicleColor || prev.vehicle.vehicleColor,
            numberOfPassengers: numberOfPassengers || prev.vehicle.numberOfPassengers,
            otherDetails: otherDetails || prev.vehicle.otherDetails,
          };

          const updatedGeneral = {
            ...prev.general,
            // Only populate General Vehicle No automatically if user hasn't entered one yet
            vehicleNo: prev.general.vehicleNo || vehicleNo,
          };

          const updatedDriver = {
            ...prev.driver,
            ownerName: prev.driver.ownerSameAsDriver
              ? prev.driver.ownerName
              : ownerName || prev.driver.ownerName,
            ownerAddress: prev.driver.ownerSameAsDriver
              ? prev.driver.ownerAddress
              : ownerAddress || prev.driver.ownerAddress,
          };

          const updatedDoc: ScannedDocument | null = prev.vehicleRcDoc
            ? {
                ...prev.vehicleRcDoc,
                scanStatus: 'scanned',
                detectedType: detectedDocumentType,
                detectedTypeReason: documentTypeReason,
                warnings: mergedWarnings,
                errorMessage: undefined,
              }
            : null;

          return {
            ...prev,
            updatedAt: new Date().toISOString(),
            vehicleRcDoc: updatedDoc,
            vehicle: updatedVehicle,
            general: updatedGeneral,
            driver: updatedDriver,
            fieldMeta: nextMeta,
            infoVerified: false,
          };
        }
      });

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OCR extraction error.';
      onUpdateApplication((prev) => {
        const target = slot === 'driving_license' ? prev.drivingLicenseDoc : prev.vehicleRcDoc;
        if (!target) return prev;
        const nextDoc: ScannedDocument = {
          ...target,
          scanStatus: 'error',
          errorMessage: msg,
        };
        return {
          ...prev,
          drivingLicenseDoc: slot === 'driving_license' ? nextDoc : prev.drivingLicenseDoc,
          vehicleRcDoc: slot === 'vehicle_rc' ? nextDoc : prev.vehicleRcDoc,
        };
      });
      return false;
    }
  };

  const handleScanAll = async () => {
    if (!application.consentGiven) {
      setGlobalError(
        'Please check the consent box below before running AI OCR extraction on your documents.'
      );
      return;
    }
    setScanningAll(true);
    setGlobalError(null);
    if (application.drivingLicenseDoc) {
      await runExtractionForSlot('driving_license');
    }
    if (application.vehicleRcDoc) {
      await runExtractionForSlot('vehicle_rc');
    }
    setScanningAll(false);
  };

  const hasAnyDocument = Boolean(application.drivingLicenseDoc || application.vehicleRcDoc);
  const anyScanned =
    application.drivingLicenseDoc?.scanStatus === 'scanned' ||
    application.vehicleRcDoc?.scanStatus === 'scanned';
  const anyScanning =
    scanningAll ||
    application.drivingLicenseDoc?.scanStatus === 'scanning' ||
    application.vehicleRcDoc?.scanStatus === 'scanning';

  const renderSlotCard = (
    slot: 'driving_license' | 'vehicle_rc',
    stepLabel: string,
    title: string,
    subtitle: string,
    extractedList: string,
    doc: ScannedDocument | null,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => {
    const isPdf = doc?.mimeType === 'application/pdf';

    return (
      <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs font-semibold text-blue-700">{stepLabel}</p>
              <h2 className="mt-1 text-base font-semibold text-slate-900">{title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{subtitle}</p>
            </div>
            {doc && (
              <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                {doc.scanStatus === 'scanned' && (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Scanned
                  </span>
                )}
                {doc.scanStatus === 'scanning' && (
                  <span className="inline-flex items-center gap-1 text-blue-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Extracting...
                  </span>
                )}
                {doc.scanStatus === 'error' && (
                  <span className="inline-flex items-center gap-1 text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                    Scan error
                  </span>
                )}
                {doc.scanStatus === 'idle' && <span>Ready to scan</span>}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 p-5">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              handleFileChosen(slot, file);
              e.target.value = '';
            }}
            className="hidden"
          />

          {!doc ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                <Camera className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-900">Capture or upload {title}</p>
              <p className="mt-1 max-w-xs text-xs text-slate-500">
                Supports JPG, JPEG, PNG, WEBP, or PDF up to 10 MB.
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setCameraSlot(slot)}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap"
                >
                  <Camera className="h-4 w-4" />
                  Use Camera
                </button>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 whitespace-nowrap"
                >
                  <Upload className="h-4 w-4" />
                  Upload File
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                {isPdf ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <FileText className="h-12 w-12 text-blue-700" />
                    <p className="mt-2 max-w-xs truncate text-sm font-semibold text-slate-900">
                      {doc.fileName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                      PDF Document · {formatFileSize(doc.sizeBytes)}
                    </p>
                  </div>
                ) : (
                  <img
                    src={doc.dataUrl}
                    alt={`${title} preview`}
                    referrerPolicy="no-referrer"
                    className="max-h-[260px] w-full object-contain"
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <span className="truncate font-medium text-slate-800">
                  {doc.fileName} · {formatFileSize(doc.sizeBytes)}
                  {doc.enhanced ? ' · Enhanced' : ''}
                </span>
                {doc.detectedType && (
                  <span className="font-mono text-slate-600">
                    Detected: {doc.detectedType.replace('_', ' ')}
                  </span>
                )}
              </div>

              {doc.errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <span>{doc.errorMessage}</span>
                  </div>
                </div>
              )}

              {doc.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <ul className="space-y-1">
                      {doc.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!isPdf && (
                  <button
                    type="button"
                    onClick={() => setEditorSlot(slot)}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Crop / Rotate / Enhance
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCameraSlot(slot)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Retake
                </button>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => runExtractionForSlot(slot)}
                  disabled={doc.scanStatus === 'scanning'}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap"
                >
                  <ScanText className="h-3.5 w-3.5" />
                  {doc.scanStatus === 'scanned' ? 'Re-scan' : 'Scan Now'}
                </button>
                <button
                  type="button"
                  onClick={() => setDocumentForSlot(slot, null)}
                  className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                  aria-label={`Remove ${title}`}
                  title="Delete document"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Fields extracted when visible: </span>
          {extractedList}
        </div>
      </div>
    );
  };

  const editorDoc =
    editorSlot === 'driving_license'
      ? application.drivingLicenseDoc
      : editorSlot === 'vehicle_rc'
        ? application.vehicleRcDoc
        : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Document Scanner</h1>
        <p className="mt-1 text-sm text-slate-600">
          Capture or upload your Driving License and Vehicle Bill Book / RC (Front Page). Crop, rotate,
          or enhance clarity before running AI OCR extraction.
        </p>
      </div>

      {/* Dual Scanner Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {renderSlotCard(
          'driving_license',
          'Document 01',
          'Driving License',
          'Front side showing full name, license number, date of birth, and address.',
          'Nationality, License Number, First & Last Name, ID Number (if shown), Date of Birth, Foreign Address, Email/Phone (if shown).',
          application.drivingLicenseDoc,
          dlInputRef
        )}

        {renderSlotCard(
          'vehicle_rc',
          'Document 02',
          'Vehicle Bill Book / RC (Front Page)',
          'Front page showing registration number, chassis number, engine number, and owner.',
          'Registration Number, Country, Vehicle Type, Brand/Manufacturer, Chassis Number, Engine Number, Color, Passengers, Owner Name & Address.',
          application.vehicleRcDoc,
          rcInputRef
        )}
      </div>

      {/* Explicit Consent & Primary Scan Bar */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="flex max-w-2xl cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={application.consentGiven}
              onChange={(e) => {
                setGlobalError(null);
                onUpdateApplication((prev) => ({
                  ...prev,
                  consentGiven: e.target.checked,
                  updatedAt: new Date().toISOString(),
                }));
              }}
              className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-700"
            />
            <span className="text-xs leading-relaxed text-slate-700">
              <strong className="font-semibold text-slate-900">
                Explicit OCR Processing Consent:
              </strong>{' '}
              I consent to send the selected document image(s) or PDF to the server-side AI OCR service
              solely to extract visible fields for my NNSW TIV registration. Temporary files are
              processed in memory and never retained on the server.
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleScanAll}
              disabled={!hasAnyDocument || anyScanning}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
            >
              {anyScanning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scanning Documents...
                </>
              ) : (
                <>
                  <ScanText className="h-4 w-4" />
                  Scan Documents & Extract Data
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onGoToReview}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              {anyScanned ? 'Review Extracted Info' : 'Enter Info Manually'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {globalError && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <span>{globalError}</span>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <Shield className="h-3.5 w-3.5 text-blue-700 shrink-0" />
          <span>
            Missing fields are always left blank so you can complete them accurately on the Review screen.
          </span>
        </div>
      </section>

      <CameraModal
        open={cameraSlot !== null}
        documentLabel={
          cameraSlot === 'driving_license'
            ? 'Driving License'
            : 'Vehicle Bill Book / RC (Front Page)'
        }
        onCapture={handleCameraCapture}
        onFallbackUpload={() => {
          if (cameraSlot === 'driving_license') dlInputRef.current?.click();
          else if (cameraSlot === 'vehicle_rc') rcInputRef.current?.click();
        }}
        onClose={() => setCameraSlot(null)}
      />

      <ImageEditorModal
        open={editorSlot !== null && Boolean(editorDoc)}
        title={
          editorSlot === 'driving_license'
            ? 'Driving License'
            : 'Vehicle Bill Book / RC (Front Page)'
        }
        sourceDataUrl={editorDoc?.originalDataUrl || ''}
        initialRotation={editorDoc?.rotation || 0}
        initialEnhanced={editorDoc?.enhanced || false}
        onSave={handleEditorSave}
        onClose={() => setEditorSlot(null)}
      />
    </div>
  );
}
