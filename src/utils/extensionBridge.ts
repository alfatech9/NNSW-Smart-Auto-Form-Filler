import type { TivApplication } from '../types/nnsw';

export interface ExtensionPayload {
  applicationId: string;
  targetPortal: string;
  exportedAt: string;
  general: TivApplication['general'];
  driver: TivApplication['driver'];
  vehicle: TivApplication['vehicle'];
  documents: {
    drivingLicenseFileName: string | null;
    drivingLicenseMimeType: string | null;
    vehicleRcFileName: string | null;
    vehicleRcMimeType: string | null;
  };
}

export function buildExtensionPayload(app: TivApplication): ExtensionPayload {
  return {
    applicationId: app.id,
    targetPortal: 'https://nnsw.gov.np/tiv/gen',
    exportedAt: new Date().toISOString(),
    general: { ...app.general },
    driver: { ...app.driver },
    vehicle: { ...app.vehicle },
    documents: {
      drivingLicenseFileName: app.drivingLicenseDoc?.fileName ?? null,
      drivingLicenseMimeType: app.drivingLicenseDoc?.mimeType ?? null,
      vehicleRcFileName: app.vehicleRcDoc?.fileName ?? null,
      vehicleRcMimeType: app.vehicleRcDoc?.mimeType ?? null,
    },
  };
}

export function pingCompanionExtension(timeoutMs = 700): Promise<{ connected: boolean; version?: string }> {
  return new Promise((resolve) => {
    let settled = false;
    const handler = (event: MessageEvent) => {
      if (event.source !== window || !event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'NNSW_EXTENSION_PONG') {
        settled = true;
        window.removeEventListener('message', handler);
        resolve({ connected: true, version: String(event.data.version || '1.0.0') });
      }
    };
    window.addEventListener('message', handler);
    window.postMessage({ type: 'NNSW_EXTENSION_PING' }, window.location.origin);
    window.setTimeout(() => {
      if (!settled) {
        window.removeEventListener('message', handler);
        resolve({ connected: false });
      }
    }, timeoutMs);
  });
}

export function sendPayloadToExtension(payload: ExtensionPayload, timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const handler = (event: MessageEvent) => {
      if (event.source !== window || !event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'NNSW_PAYLOAD_SAVED') {
        settled = true;
        window.removeEventListener('message', handler);
        resolve(Boolean(event.data.ok));
      }
    };
    window.addEventListener('message', handler);
    window.postMessage({ type: 'NNSW_AUTOFILL_PAYLOAD', payload }, window.location.origin);
    window.setTimeout(() => {
      if (!settled) {
        window.removeEventListener('message', handler);
        resolve(false);
      }
    }, timeoutMs);
  });
}
