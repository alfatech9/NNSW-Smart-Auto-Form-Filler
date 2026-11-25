import { useEffect, useRef, useState } from 'react';
import { RotateCcw, RotateCw, Sparkles, Crop, Check, X, Undo2 } from 'lucide-react';

interface ImageEditorModalProps {
  open: boolean;
  title: string;
  sourceDataUrl: string;
  initialRotation?: number;
  initialEnhanced?: boolean;
  onSave: (processedDataUrl: string, rotation: number, enhanced: boolean) => void;
  onClose: () => void;
}

export function ImageEditorModal({
  open,
  title,
  sourceDataUrl,
  initialRotation = 0,
  initialEnhanced = false,
  onSave,
  onClose,
}: ImageEditorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotation, setRotation] = useState(initialRotation);
  const [enhanced, setEnhanced] = useState(initialEnhanced);
  const [brightness, setBrightness] = useState(105);
  const [contrast, setContrast] = useState(118);
  const [cropTop, setCropTop] = useState(0);
  const [cropBottom, setCropBottom] = useState(0);
  const [cropLeft, setCropLeft] = useState(0);
  const [cropRight, setCropRight] = useState(0);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!open || !sourceDataUrl) return;
    setRotation(initialRotation);
    setEnhanced(initialEnhanced);
    setCropTop(0);
    setCropBottom(0);
    setCropLeft(0);
    setCropRight(0);

    const img = new Image();
    img.onload = () => setLoadedImage(img);
    img.src = sourceDataUrl;
  }, [open, sourceDataUrl, initialRotation, initialEnhanced]);

  useEffect(() => {
    if (!loadedImage || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const normalizedRot = ((rotation % 360) + 360) % 360;
    const isSwapped = normalizedRot === 90 || normalizedRot === 270;
    const rotatedW = isSwapped ? loadedImage.naturalHeight : loadedImage.naturalWidth;
    const rotatedH = isSwapped ? loadedImage.naturalWidth : loadedImage.naturalHeight;

    // Render rotated full image onto an offscreen canvas first
    const off = document.createElement('canvas');
    off.width = rotatedW;
    off.height = rotatedH;
    const offCtx = off.getContext('2d');
    if (!offCtx) return;

    offCtx.save();
    offCtx.translate(rotatedW / 2, rotatedH / 2);
    offCtx.rotate((normalizedRot * Math.PI) / 180);
    if (enhanced) {
      offCtx.filter = `contrast(${contrast}%) brightness(${brightness}%) saturate(110%)`;
    } else {
      offCtx.filter = 'none';
    }
    offCtx.drawImage(
      loadedImage,
      -loadedImage.naturalWidth / 2,
      -loadedImage.naturalHeight / 2
    );
    offCtx.restore();

    // Calculate crop rectangle on rotated dimensions
    const sx = Math.round((cropLeft / 100) * rotatedW);
    const sy = Math.round((cropTop / 100) * rotatedH);
    const sw = Math.max(40, Math.round(rotatedW * (1 - (cropLeft + cropRight) / 100)));
    const sh = Math.max(40, Math.round(rotatedH * (1 - (cropTop + cropBottom) / 100)));

    canvas.width = sw;
    canvas.height = sh;
    ctx.clearRect(0, 0, sw, sh);
    ctx.drawImage(off, sx, sy, sw, sh, 0, 0, sw, sh);
  }, [loadedImage, rotation, enhanced, brightness, contrast, cropTop, cropBottom, cropLeft, cropRight]);

  if (!open) return null;

  const handleReset = () => {
    setRotation(0);
    setEnhanced(false);
    setBrightness(105);
    setContrast(118);
    setCropTop(0);
    setCropBottom(0);
    setCropLeft(0);
    setCropRight(0);
  };

  const applyPresetCrop = (preset: 'full' | 'trim' | 'center') => {
    if (preset === 'full') {
      setCropTop(0);
      setCropBottom(0);
      setCropLeft(0);
      setCropRight(0);
    } else if (preset === 'trim') {
      setCropTop(6);
      setCropBottom(6);
      setCropLeft(6);
      setCropRight(6);
    } else {
      setCropTop(12);
      setCropBottom(12);
      setCropLeft(10);
      setCropRight(10);
    }
  };

  const handleApply = () => {
    if (!canvasRef.current) return;
    const outputUrl = canvasRef.current.toDataURL('image/jpeg', 0.92);
    onSave(outputUrl, rotation, enhanced);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${title}`}
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Prepare & Enhance: {title}</h2>
            <p className="text-xs text-slate-500">
              Rotate upright, trim margins, and boost clarity before running AI OCR extraction.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close editor"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid flex-1 gap-0 overflow-y-auto md:grid-cols-[1fr_290px]">
          <div className="flex min-h-[280px] items-center justify-center bg-slate-100 p-5">
            <canvas
              ref={canvasRef}
              className="max-h-[460px] max-w-full rounded border border-slate-300 bg-white shadow-sm"
            />
          </div>

          <div className="space-y-5 border-t border-slate-200 bg-white p-5 md:border-l md:border-t-0">
            <div>
              <h3 className="mb-2.5 text-xs font-semibold text-slate-700">Orientation</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Rotate Left
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Rotate Right
                </button>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Sparkles className="h-3.5 w-3.5 text-blue-700" />
                  Document Clarity Enhance
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enhanced}
                  onClick={() => setEnhanced((e) => !e)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    enhanced ? 'bg-blue-700' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      enhanced ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {enhanced && (
                <div className="space-y-3 pt-1">
                  <label className="block text-xs text-slate-600">
                    <div className="mb-1 flex justify-between">
                      <span>Contrast</span>
                      <span className="font-mono tabular-nums">{contrast}%</span>
                    </div>
                    <input
                      type="range"
                      min={90}
                      max={160}
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                      className="w-full accent-blue-700"
                    />
                  </label>
                  <label className="block text-xs text-slate-600">
                    <div className="mb-1 flex justify-between">
                      <span>Brightness</span>
                      <span className="font-mono tabular-nums">{brightness}%</span>
                    </div>
                    <input
                      type="range"
                      min={85}
                      max={135}
                      value={brightness}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      className="w-full accent-blue-700"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Crop className="h-3.5 w-3.5 text-blue-700" />
                  Crop Edges
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => applyPresetCrop('full')}
                    className="rounded px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Full
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetCrop('trim')}
                    className="rounded px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Trim 6%
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetCrop('center')}
                    className="rounded px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Card Focus
                  </button>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600">
                <label className="block">
                  <div className="mb-0.5 flex justify-between">
                    <span>Top Trim</span>
                    <span className="font-mono tabular-nums">{cropTop}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={cropTop}
                    onChange={(e) => setCropTop(Number(e.target.value))}
                    className="w-full accent-blue-700"
                  />
                </label>
                <label className="block">
                  <div className="mb-0.5 flex justify-between">
                    <span>Bottom Trim</span>
                    <span className="font-mono tabular-nums">{cropBottom}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={cropBottom}
                    onChange={(e) => setCropBottom(Number(e.target.value))}
                    className="w-full accent-blue-700"
                  />
                </label>
                <label className="block">
                  <div className="mb-0.5 flex justify-between">
                    <span>Left Trim</span>
                    <span className="font-mono tabular-nums">{cropLeft}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={cropLeft}
                    onChange={(e) => setCropLeft(Number(e.target.value))}
                    className="w-full accent-blue-700"
                  />
                </label>
                <label className="block">
                  <div className="mb-0.5 flex justify-between">
                    <span>Right Trim</span>
                    <span className="font-mono tabular-nums">{cropRight}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={cropRight}
                    onChange={(e) => setCropRight(Number(e.target.value))}
                    className="w-full accent-blue-700"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Reset Original
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
            >
              <Check className="h-4 w-4" />
              Save Image Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
