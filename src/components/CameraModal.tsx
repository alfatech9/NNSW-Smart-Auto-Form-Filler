import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X, AlertCircle, Upload } from 'lucide-react';

interface CameraModalProps {
  open: boolean;
  documentLabel: string;
  onCapture: (dataUrl: string, fileName: string) => void;
  onFallbackUpload: () => void;
  onClose: () => void;
}

export function CameraModal({
  open,
  documentLabel,
  onCapture,
  onFallbackUpload,
  onClose,
}: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);
    setIsReady(false);

    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera capture is not supported in this browser. Please upload a photo or PDF file instead.');
        return;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsReady(true);
        }
      } catch {
        if (!cancelled) {
          setError(
            'Unable to access the camera. Check browser camera permissions or upload an existing photo from your device.'
          );
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [open, facingMode]);

  if (!open) return null;

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const safeName = `${documentLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}.jpg`;
    onCapture(dataUrl, safeName);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Capture ${documentLabel}`}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Capture {documentLabel}</h2>
            <p className="text-xs text-slate-500">
              Place the document flat in good lighting with all corners visible.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close camera"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative aspect-[4/3] w-full bg-slate-900">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center text-white">
              <AlertCircle className="mb-3 h-10 w-10 text-amber-400" />
              <p className="max-w-md text-sm leading-relaxed text-slate-200">{error}</p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onFallbackUpload();
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <Upload className="h-4 w-4" />
                Upload Photo or PDF Instead
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {/* Framing overlay for ID / RC cards */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 sm:p-10">
                <div className="relative h-full max-h-[260px] w-full max-w-[440px] rounded-lg border-2 border-dashed border-white/85 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]">
                  <div className="absolute -top-7 left-0 right-0 text-center text-xs font-medium text-white">
                    Align {documentLabel} inside the frame
                  </div>
                </div>
              </div>
              {!isReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 text-sm text-white">
                  Starting camera...
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            type="button"
            onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap"
          >
            <RefreshCw className="h-4 w-4" />
            Switch Camera ({facingMode === 'environment' ? 'Rear' : 'Front'})
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCapture}
              disabled={!isReady || Boolean(error)}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
            >
              <Camera className="h-4 w-4" />
              Capture Photo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
