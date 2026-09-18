"use client";

import { useEffect, useRef, useState } from "react";
import type QrScannerLib from "qr-scanner";

interface Props {
  /** Called for every decoded QR; return true to stop scanning. */
  onDecode: (text: string) => boolean;
  onClose: () => void;
}

export default function QrScanner({ onDecode, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDecodeRef = useRef(onDecode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onDecodeRef.current = onDecode;
  }, [onDecode]);

  useEffect(() => {
    let scanner: QrScannerLib | undefined;
    let cancelled = false;

    (async () => {
      const { default: Scanner } = await import("qr-scanner");
      if (cancelled || !videoRef.current) return;

      scanner = new Scanner(
        videoRef.current,
        (result) => {
          if (onDecodeRef.current(result.data)) scanner?.stop();
        },
        {
          preferredCamera: "environment",
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 8,
        },
      );

      try {
        await scanner.start();
      } catch {
        if (!cancelled) {
          setError("Couldn't access the camera. Allow camera permission or upload a QR image instead.");
        }
      }
    })();

    return () => {
      cancelled = true;
      scanner?.destroy();
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/90">
            {error}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Cancel
      </button>
    </div>
  );
}

/** Decodes a QR from an uploaded image file. */
export async function scanQrImage(file: File): Promise<string | null> {
  const { default: Scanner } = await import("qr-scanner");
  try {
    const result = await Scanner.scanImage(file, { returnDetailedScanResult: true });
    return result.data;
  } catch {
    return null;
  }
}
