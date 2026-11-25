import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MAX_BASE64_LENGTH = 14_000_000; // ~10 MB raw binary ceiling

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildFieldSchema(description: string) {
  return {
    type: Type.OBJECT,
    description,
    properties: {
      value: {
        type: Type.STRING,
        description: 'Exact visible value extracted from document, or empty string if not visible.',
      },
      confidence: {
        type: Type.STRING,
        enum: ['high', 'medium', 'low', 'missing'],
        description: 'Confidence in the extracted text based on legibility.',
      },
      note: {
        type: Type.STRING,
        description: 'Short note if partially illegible, truncated, or requires user check. Empty string otherwise.',
      },
    },
    required: ['value', 'confidence', 'note'],
  };
}

const DRIVING_LICENSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    detectedDocumentType: {
      type: Type.STRING,
      enum: ['driving_license', 'vehicle_rc', 'other'],
      description: 'Detected type of the uploaded document.',
    },
    documentTypeReason: {
      type: Type.STRING,
      description: 'Brief explanation of why this document type was identified.',
    },
    warnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Any image quality issues, glare, blur, or missing sections noticed.',
    },
    fields: {
      type: Type.OBJECT,
      properties: {
        nationality: buildFieldSchema('Nationality or country code (e.g., IN for India, NP for Nepal) if explicitly visible or unambiguously indicated by issuing country.'),
        drivingLicenseNumber: buildFieldSchema('Driving License number exactly as printed.'),
        firstName: buildFieldSchema('Driver first and middle name(s) separated from surname.'),
        lastName: buildFieldSchema('Driver surname / last name.'),
        identityCardNumber: buildFieldSchema('Identity card number such as Aadhaar, PAN, Passport, or Citizenship number only if visibly printed on this document.'),
        birthDate: buildFieldSchema('Date of birth formatted as DD/MM/YYYY if visible.'),
        foreignAddress: buildFieldSchema('Full residential address printed on the license.'),
        email: buildFieldSchema('Email address only if visibly printed on the document.'),
        phoneNumber: buildFieldSchema('Phone or mobile number only if visibly printed on the document.'),
        localAddress: buildFieldSchema('Local address in Nepal only if visibly printed on the document.'),
      },
      required: [
        'nationality',
        'drivingLicenseNumber',
        'firstName',
        'lastName',
        'identityCardNumber',
        'birthDate',
        'foreignAddress',
        'email',
        'phoneNumber',
        'localAddress',
      ],
    },
  },
  required: ['detectedDocumentType', 'documentTypeReason', 'warnings', 'fields'],
};

const VEHICLE_RC_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    detectedDocumentType: {
      type: Type.STRING,
      enum: ['driving_license', 'vehicle_rc', 'other'],
      description: 'Detected type of the uploaded document.',
    },
    documentTypeReason: {
      type: Type.STRING,
      description: 'Brief explanation of why this document type was identified.',
    },
    warnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Any image quality issues, glare, blur, or missing sections noticed.',
    },
    fields: {
      type: Type.OBJECT,
      properties: {
        vehicleNumber: buildFieldSchema('Vehicle registration number / plate number exactly as printed.'),
        vehicleCountry: buildFieldSchema('Country code of registration (e.g., IN for India, NP for Nepal) if visibly indicated by issuing authority.'),
        vehicleType: buildFieldSchema('Vehicle class/type as printed (e.g., Motorcycle or Scooter, Motor Car, LMV, Jeep, Bus, Truck).'),
        vehicleBrand: buildFieldSchema('Vehicle manufacturer / maker name (e.g., Hero, Honda, Maruti Suzuki, Hyundai, Tata, Royal Enfield, Bajaj, TVS).'),
        chassisNumber: buildFieldSchema('Full Chassis / VIN number exactly as printed.'),
        engineNumber: buildFieldSchema('Full Engine / Motor number exactly as printed.'),
        vehicleColor: buildFieldSchema('Vehicle color as printed.'),
        numberOfPassengers: buildFieldSchema('Seating capacity / number of passengers as a numeric string ONLY if printed on the RC.'),
        ownerName: buildFieldSchema('Registered vehicle owner full name.'),
        ownerAddress: buildFieldSchema('Registered vehicle owner address.'),
        otherDetails: buildFieldSchema('Other useful visible registration details such as fuel type, model name, or registration validity date.'),
      },
      required: [
        'vehicleNumber',
        'vehicleCountry',
        'vehicleType',
        'vehicleBrand',
        'chassisNumber',
        'engineNumber',
        'vehicleColor',
        'numberOfPassengers',
        'ownerName',
        'ownerAddress',
        'otherDetails',
      ],
    },
  },
  required: ['detectedDocumentType', 'documentTypeReason', 'warnings', 'fields'],
};

function buildExtensionFiles(): Record<string, string> {
  const manifest = {
    manifest_version: 3,
    name: 'NNSW Smart Auto Form Filler Companion',
    version: '1.0.0',
    description:
      'Authorized companion extension that populates verified Driving License and Vehicle RC fields into the official Nepal National Single Window TIV portal after user login.',
    permissions: ['storage', 'activeTab'],
    host_permissions: ['https://nnsw.gov.np/*'],
    background: {
      service_worker: 'background.js',
    },
    action: {
      default_popup: 'popup.html',
      default_title: 'NNSW Smart Auto Form Filler',
    },
    content_scripts: [
      {
        matches: ['https://nnsw.gov.np/tiv/*'],
        js: ['content-portal.js'],
        run_at: 'document_idle',
      },
      {
        matches: ['http://localhost:3000/*', 'https://*.run.app/*'],
        js: ['content-bridge.js'],
        run_at: 'document_idle',
      },
    ],
  };

  const backgroundJs = `chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'NNSW_SAVE_PAYLOAD') {
    chrome.storage.local.set({ nnswStagedPayload: message.payload, updatedAt: Date.now() }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }
  if (message?.type === 'NNSW_GET_PAYLOAD') {
    chrome.storage.local.get(['nnswStagedPayload', 'updatedAt'], (result) => {
      sendResponse({ ok: true, payload: result.nnswStagedPayload || null, updatedAt: result.updatedAt || null });
    });
    return true;
  }
  if (message?.type === 'NNSW_CLEAR_PAYLOAD') {
    chrome.storage.local.remove(['nnswStagedPayload', 'updatedAt'], () => {
      sendResponse({ ok: true });
    });
    return true;
  }
  return false;
});
`;

  const contentBridgeJs = `// Connects the NNSW Smart Auto Form Filler web app to the companion extension.
window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || typeof event.data !== 'object') return;
  if (event.data.type === 'NNSW_EXTENSION_PING') {
    window.postMessage({ type: 'NNSW_EXTENSION_PONG', version: '1.0.0' }, window.location.origin);
  }
  if (event.data.type === 'NNSW_AUTOFILL_PAYLOAD' && event.data.payload) {
    chrome.runtime.sendMessage(
      { type: 'NNSW_SAVE_PAYLOAD', payload: event.data.payload },
      (response) => {
        window.postMessage(
          { type: 'NNSW_PAYLOAD_SAVED', ok: Boolean(response && response.ok) },
          window.location.origin
        );
      }
    );
  }
});
`;

  const contentPortalJs = `// Authorized NNSW TIV Portal Auto-Fill Helper
// Security boundary: Never bypasses login, CAPTCHA, reCAPTCHA, or official validation.
// Never submits the form or initiates payment automatically.

(function () {
  function setNativeInputValue(el, value) {
    if (!el || value === undefined || value === null || value === '') return false;
    const tag = el.tagName.toLowerCase();
    const proto = tag === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(el, String(value));
    } else {
      el.value = String(value);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }

  function findFieldByLabel(labelKeywords) {
    const labels = Array.from(document.querySelectorAll('label, .form-label, span, div'));
    for (const kw of labelKeywords) {
      const target = kw.toLowerCase();
      for (const el of labels) {
        const txt = (el.textContent || '').trim().toLowerCase();
        if (!txt || txt.length > 80) continue;
        if (txt === target || txt.startsWith(target + ' ') || txt.startsWith(target + '*')) {
          if (el.tagName.toLowerCase() === 'label' && el.htmlFor) {
            const linked = document.getElementById(el.htmlFor);
            if (linked) return linked;
          }
          const container = el.closest('.form-group, .field, .col, [class*="col-"], div');
          if (container) {
            const input = container.querySelector('input:not([type="hidden"]):not([type="file"]), select, textarea');
            if (input) return input;
          }
        }
      }
    }
    return null;
  }

  function fillStepFields(payload) {
    const filled = [];
    const skipped = [];
    if (!payload) return { filled, skipped };

    const fieldMap = [
      { labels: ['Vehicle No', 'Vehicle Number'], value: payload.general?.vehicleNo || payload.vehicle?.vehicleNo },
      { labels: ['Entry Date'], value: payload.general?.entryDate },
      { labels: ['Exit Date'], value: payload.general?.exitDate },
      { labels: ['Number of Days to Stay'], value: payload.general?.daysToStay },
      { labels: ['Destination Place'], value: payload.general?.destinationPlace },
      { labels: ['Hotel / Location', 'Hotel'], value: payload.general?.hotelLocation },
      { labels: ['Driving License Number'], value: payload.driver?.drivingLicenseNumber },
      { labels: ['First Name'], value: payload.driver?.firstName },
      { labels: ['Last Name'], value: payload.driver?.lastName },
      { labels: ['Identity Card Number'], value: payload.driver?.identityCardNumber },
      { labels: ['Birth Date'], value: payload.driver?.birthDate },
      { labels: ['Foreign Address'], value: payload.driver?.foreignAddress },
      { labels: ['Email'], value: payload.driver?.email },
      { labels: ['Local Address'], value: payload.driver?.localAddress },
      { labels: ['Phone Number'], value: payload.driver?.phoneNumber },
      { labels: ['Chassis Number'], value: payload.vehicle?.chassisNumber },
      { labels: ['Engine Number'], value: payload.vehicle?.engineNumber },
      { labels: ['Number of Passengers'], value: payload.vehicle?.numberOfPassengers },
      { labels: ['Vehicle Color'], value: payload.vehicle?.vehicleColor },
    ];

    for (const item of fieldMap) {
      if (!item.value) continue;
      const el = findFieldByLabel(item.labels);
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        if (setNativeInputValue(el, item.value)) {
          filled.push(item.labels[0]);
        }
      } else {
        skipped.push(item.labels[0]);
      }
    }

    return { filled, skipped };
  }

  function mountAssistantBar() {
    if (document.getElementById('nnsw-autofill-bar')) return;
    chrome.runtime.sendMessage({ type: 'NNSW_GET_PAYLOAD' }, (res) => {
      if (!res || !res.payload) return;
      const bar = document.createElement('div');
      bar.id = 'nnsw-autofill-bar';
      Object.assign(bar.style, {
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        zIndex: '99999',
        background: '#0F172A',
        color: '#FFFFFF',
        padding: '12px 16px',
        borderRadius: '10px',
        boxShadow: '0 8px 24px rgba(15,23,42,0.28)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      });

      const title = document.createElement('span');
      title.textContent = 'NNSW Auto Fill Ready (' + (res.payload.vehicle?.vehicleNo || res.payload.general?.vehicleNo || 'Draft') + ')';
      title.style.fontWeight = '600';

      const fillBtn = document.createElement('button');
      fillBtn.textContent = 'Fill Current Step';
      Object.assign(fillBtn.style, {
        background: '#2563EB',
        color: '#FFFFFF',
        border: 'none',
        padding: '6px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: '600',
      });

      const status = document.createElement('span');
      status.style.color = '#CBD5E1';
      status.style.fontSize = '12px';

      fillBtn.addEventListener('click', () => {
        const result = fillStepFields(res.payload);
        status.textContent = 'Filled ' + result.filled.length + ' field(s). Please verify dropdowns & dates manually.';
      });

      bar.appendChild(title);
      bar.appendChild(fillBtn);
      bar.appendChild(status);
      document.body.appendChild(bar);
    });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'NNSW_TRIGGER_FILL') {
      chrome.runtime.sendMessage({ type: 'NNSW_GET_PAYLOAD' }, (res) => {
        if (!res || !res.payload) {
          sendResponse({ ok: false, error: 'No staged application payload found.' });
          return;
        }
        const result = fillStepFields(res.payload);
        sendResponse({ ok: true, result });
      });
      return true;
    }
    return false;
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    mountAssistantBar();
  } else {
    window.addEventListener('DOMContentLoaded', mountAssistantBar);
  }
})();
`;

  const popupHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>NNSW Smart Auto Form Filler</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; width: 320px; margin: 0; padding: 16px; color: #0F172A; background: #F8FAFC; }
      h1 { font-size: 15px; margin: 0 0 4px; color: #1E3A8A; }
      p { font-size: 12px; color: #475569; margin: 0 0 12px; line-height: 1.45; }
      .box { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; margin-bottom: 12px; font-size: 12px; }
      .row { display: flex; justify-content: space-between; margin-bottom: 6px; }
      .label { color: #64748B; }
      .val { font-weight: 600; color: #0F172A; }
      button { width: 100%; padding: 9px 12px; border-radius: 7px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 8px; }
      .primary { background: #1D4ED8; color: #FFFFFF; }
      .secondary { background: #FFFFFF; color: #1E293B; border: 1px solid #CBD5E1; }
      .danger { background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA; }
      textarea { width: 100%; box-sizing: border-box; height: 72px; font-family: monospace; font-size: 11px; padding: 8px; border: 1px solid #CBD5E1; border-radius: 6px; margin-bottom: 8px; }
      #status { font-size: 12px; color: #1E40AF; min-height: 16px; }
    </style>
  </head>
  <body>
    <h1>NNSW Smart Auto Form Filler</h1>
    <p>Open nnsw.gov.np/tiv/gen, sign in manually, and fill each step. Final verification and payment remain manual.</p>
    <div id="summary" class="box">Loading staged application...</div>
    <button id="fillBtn" class="primary">Fill Active NNSW Portal Tab</button>
    <button id="openPortalBtn" class="secondary">Open Official NNSW Portal</button>
    <textarea id="jsonInput" placeholder="Optional: Paste JSON payload copied from the web app"></textarea>
    <button id="importBtn" class="secondary">Load Pasted JSON Payload</button>
    <button id="clearBtn" class="danger">Clear Stored Data</button>
    <div id="status"></div>
    <script src="popup.js"></script>
  </body>
</html>
`;

  const popupJs = `function setStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
}

function renderSummary(payload) {
  const box = document.getElementById('summary');
  if (!box) return;
  box.textContent = '';
  if (!payload) {
    box.textContent = 'No application staged yet. Click "Send to Extension" in the NNSW Smart Auto Form Filler web app, or paste the JSON payload below.';
    return;
  }
  const rows = [
    ['Driver', ((payload.driver?.firstName || '') + ' ' + (payload.driver?.lastName || '')).trim() || '—'],
    ['License No', payload.driver?.drivingLicenseNumber || '—'],
    ['Vehicle No', payload.general?.vehicleNo || payload.vehicle?.vehicleNo || '—'],
    ['Entry / Exit', (payload.general?.entryDate || '—') + ' to ' + (payload.general?.exitDate || '—')],
  ];
  for (const [k, v] of rows) {
    const row = document.createElement('div');
    row.className = 'row';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = k;
    const val = document.createElement('span');
    val.className = 'val';
    val.textContent = v;
    row.appendChild(label);
    row.appendChild(val);
    box.appendChild(row);
  }
}

chrome.runtime.sendMessage({ type: 'NNSW_GET_PAYLOAD' }, (res) => {
  renderSummary(res?.payload || null);
});

document.getElementById('openPortalBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://nnsw.gov.np/tiv/gen' });
});

document.getElementById('fillBtn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.id || !String(tab.url || '').startsWith('https://nnsw.gov.np/')) {
      setStatus('Please switch to an open nnsw.gov.np/tiv/gen tab first.');
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: 'NNSW_TRIGGER_FILL' }, (res) => {
      if (chrome.runtime.lastError || !res?.ok) {
        setStatus('Refresh the NNSW portal tab and ensure you are signed in.');
        return;
      }
      setStatus('Filled ' + res.result.filled.length + ' field(s). Check dropdowns before proceeding.');
    });
  });
});

document.getElementById('importBtn').addEventListener('click', () => {
  const raw = document.getElementById('jsonInput').value.trim();
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    chrome.runtime.sendMessage({ type: 'NNSW_SAVE_PAYLOAD', payload: parsed }, () => {
      renderSummary(parsed);
      setStatus('Payload loaded and ready for NNSW portal.');
    });
  } catch {
    setStatus('Invalid JSON format. Copy the payload directly from the web app.');
  }
});

document.getElementById('clearBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'NNSW_CLEAR_PAYLOAD' }, () => {
    renderSummary(null);
    setStatus('Cleared all staged personal and vehicle data.');
  });
});
`;

  const readmeTxt = `NNSW SMART AUTO FORM FILLER — COMPANION CHROME EXTENSION
========================================================

How to install in Google Chrome or Microsoft Edge:
1. Unzip this folder onto your computer.
2. Open chrome://extensions in your browser and enable "Developer mode" (top right).
3. Click "Load unpacked" and select the unzipped folder.

How to use securely:
1. Scan and verify your Driving License and Vehicle Bill Book / RC in the NNSW Smart Auto Form Filler web app.
2. Click "Send to Extension" (or copy the JSON payload into the extension popup).
3. Open https://nnsw.gov.np/tiv/gen, log in manually, and complete any CAPTCHA or security check.
4. Click "Fill Current Step" on Steps 1 through 4.
5. Verify all dropdown options, attached documents, and Step 5 (Taxes) personally before submitting.

Security & Privacy Policy:
- This extension NEVER stores NNSW passwords.
- This extension NEVER bypasses login, CAPTCHA, or portal validation.
- This extension NEVER submits the form or initiates payment automatically.
- Click "Clear Stored Data" inside the extension popup at any time to erase staged records.
`;

  return {
    'manifest.json': JSON.stringify(manifest, null, 2),
    'background.js': backgroundJs,
    'content-bridge.js': contentBridgeJs,
    'content-portal.js': contentPortalJs,
    'popup.html': popupHtml,
    'popup.js': popupJs,
    'README.txt': readmeTxt,
  };
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '16mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      ocrConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  app.post('/api/extract-document', async (req: Request, res: Response) => {
    try {
      const { documentSlot, mimeType, base64Data, consentGiven } = req.body ?? {};

      if (consentGiven !== true) {
        res.status(400).json({
          error: 'Explicit user consent is required before sending documents to the AI OCR service.',
        });
        return;
      }

      if (documentSlot !== 'driving_license' && documentSlot !== 'vehicle_rc') {
        res.status(400).json({ error: 'Invalid documentSlot. Expected driving_license or vehicle_rc.' });
        return;
      }

      if (typeof mimeType !== 'string' || !ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
        res.status(400).json({
          error: 'Unsupported file format. Please upload JPG, JPEG, PNG, WEBP, or PDF.',
        });
        return;
      }

      if (typeof base64Data !== 'string' || base64Data.length < 32 || base64Data.length > MAX_BASE64_LENGTH) {
        res.status(400).json({
          error: 'Document data is missing or exceeds the 10 MB upload limit.',
        });
        return;
      }

      const cleanedBase64 = base64Data.replace(/^data:[^;]+;base64,/, '').trim();
      if (!/^[A-Za-z0-9+/=\r\n]+$/.test(cleanedBase64)) {
        res.status(400).json({ error: 'Malformed base64 document payload.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'AI OCR service is not configured on the server. Please configure GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }

      const normalizedMime = mimeType.toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeType.toLowerCase();
      const isLicense = documentSlot === 'driving_license';

      const prompt = isLicense
        ? [
            'You are an exact OCR and document extraction engine for the Nepal National Single Window (NNSW) Temporary Import of Vehicle (TIV) form.',
            'Analyze the uploaded document image/PDF which the user placed in the Driving License slot.',
            '1. First identify whether this document is actually a driving_license, a vehicle_rc (Vehicle Registration Certificate / Bill Book), or other.',
            '2. Extract ONLY text that is visibly printed on the document. NEVER guess, invent, infer, or hallucinate personal details.',
            '3. If a field (such as email, phoneNumber, localAddress, or identityCardNumber) is not printed on the document, set value to "" and confidence to "missing".',
            '4. Format birthDate strictly as DD/MM/YYYY if a date of birth is visibly present (convert DD-MM-YYYY to DD/MM/YYYY).',
            '5. For nationality, use ISO 2-letter code like "IN" (India) or "NP" (Nepal) only when unambiguously indicated by the issuing country (e.g., Indian Union Driving Licence -> "IN", Government of Nepal -> "NP").',
            '6. Split full name into firstName (including middle name if any) and lastName accurately.',
            '7. Add a helpful warning in warnings[] if the photo is blurry, cropped, glare-obscured, or appears to be the wrong document type.',
          ].join('\n')
        : [
            'You are an exact OCR and document extraction engine for the Nepal National Single Window (NNSW) Temporary Import of Vehicle (TIV) form.',
            'Analyze the uploaded document image/PDF which the user placed in the Vehicle Bill Book / RC (Front Page) slot.',
            '1. First identify whether this document is actually a vehicle_rc (Vehicle Registration Certificate / Bill Book), a driving_license, or other.',
            '2. Extract ONLY text that is visibly printed on the document. NEVER guess, invent, infer, or hallucinate vehicle or owner details.',
            '3. If a field (such as numberOfPassengers, vehicleColor, vehicleBrand, or vehicleType) is not printed on the document, set value to "" and confidence to "missing".',
            '4. For vehicleCountry, use ISO 2-letter code like "IN" (India) or "NP" (Nepal) only when unambiguously indicated by the issuing authority (e.g., Indian Union Vehicle Registration Certificate -> "IN").',
            '5. For vehicleNumber, extract "Regn No" / "Registration Number" cleanly without stray spaces.',
            '6. For chassisNumber ("Chasis No" or "Chassis No") and engineNumber ("Engine No" or "Engine / Motor Number"), transcribe every character carefully and mark confidence "medium" or "low" if any digit/letter could be ambiguous.',
            '7. Put extra visible fields like Fuel, Emission Norms, Date of Regn, and Regn Validity into otherDetails.',
            '8. Add a helpful warning in warnings[] if the photo is blurry, cropped, glare-obscured, or appears to be the wrong document type.',
          ].join('\n');

      const modelAttempts = [
        { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
        { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
        { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
      ];

      let lastErr: unknown = null;
      let responseText: string | undefined;
      let usedModel = '';

      for (let i = 0; i < modelAttempts.length; i++) {
        const attemptCfg = modelAttempts[i];
        try {
          const response = await ai.models.generateContent({
            model: attemptCfg.model,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: normalizedMime,
                    data: cleanedBase64,
                  },
                },
                { text: prompt },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: isLicense ? DRIVING_LICENSE_SCHEMA : VEHICLE_RC_SCHEMA,
              thinkingConfig: { thinkingLevel: attemptCfg.thinkingLevel },
            },
          });
          if (response.text && response.text.trim()) {
            responseText = response.text;
            usedModel = attemptCfg.model;
            break;
          }
          lastErr = new Error('OCR model returned an empty response.');
        } catch (err) {
          lastErr = err;
          if (i < modelAttempts.length - 1) {
            await new Promise((r) => setTimeout(r, 450));
          }
        }
      }

      if (!responseText) {
        let friendlyMessage = 'Document extraction failed. Please retry in a moment.';
        if (lastErr instanceof Error) {
          const raw = lastErr.message;
          if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand')) {
            friendlyMessage =
              'The AI OCR service is temporarily busy. Please click "Scan Now" to retry in a few seconds.';
          } else if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
            friendlyMessage =
              'OCR quota limit reached temporarily. Please wait a few seconds and retry, or check your API key in Settings > Secrets.';
          } else if (
            raw.includes('403') ||
            raw.includes('API_KEY_INVALID') ||
            raw.includes('PERMISSION_DENIED')
          ) {
            friendlyMessage =
              'API key authentication failed. Please check your Gemini API key in Settings > Secrets.';
          } else {
            friendlyMessage = raw;
          }
        }
        res.status(502).json({ error: friendlyMessage });
        return;
      }

      const parsed = JSON.parse(responseText);
      res.json({
        ok: true,
        documentSlot,
        model: usedModel,
        extraction: parsed,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error while extracting document information.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/extension-bundle', async (_req: Request, res: Response) => {
    try {
      const zip = new JSZip();
      const folder = zip.folder('nnsw-smart-autofill-extension');
      if (!folder) {
        res.status(500).json({ error: 'Unable to initialize extension archive.' });
        return;
      }
      const files = buildExtensionFiles();
      for (const [filename, content] of Object.entries(files)) {
        folder.file(filename, content);
      }
      const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="nnsw-smart-autofill-extension.zip"');
      res.send(buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to build Chrome Extension bundle.';
      res.status(500).json({ error: message });
    }
  });

  // Ensure unknown /api/* routes and body-parser errors always return JSON
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/')) {
      const msg = err instanceof Error ? err.message : 'Invalid API request payload.';
      res.status(400).json({ error: msg });
      return;
    }
    next(err);
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(__dirname, 'dist');

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`NNSW Smart Auto Form Filler server running on http://0.0.0.0:${port}`);
  });
}

createServer();
