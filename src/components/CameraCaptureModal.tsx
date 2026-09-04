import React, { useEffect, useRef, useState } from 'react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  useEffect(() => {
    if (!isOpen) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      setError(null);
      return;
    }

    let currentStream: MediaStream | null = null;

    async function startCamera() {
      try {
        setError(null);
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Kamera tidak didukung oleh browser Anda.');
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        currentStream = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        console.warn('Camera error:', err);
        setError(
          err.message || 'Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan.'
        );
      }
    }

    startCamera();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, facingMode]);

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    // Stop tracks
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    onCapture(dataUrl);
    onClose();
  };

  const toggleFacingMode = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  return (
    <div
      id="camera-capture-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 transition-opacity animate-in fade-in"
    >
      <div className="relative w-full max-w-md bg-surface-container-lowest rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-3 bg-surface flex items-center justify-between border-b border-surface-container">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">photo_camera</span>
            <span className="font-headline-sm text-headline-sm text-on-surface">Ambil Foto Struk</span>
          </div>
          <button
            id="close-camera-btn"
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Viewfinder Preview */}
        <div className="relative w-full h-72 bg-black flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-6 text-center flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-[36px] text-error">no_photography</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-xs">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm"
              >
                Gunakan Unggah File
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Corner brackets frame */}
              <div className="absolute inset-6 border border-white/30 rounded-xl pointer-events-none">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-secondary-fixed rounded-tl" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-secondary-fixed rounded-tr" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-secondary-fixed rounded-bl" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-secondary-fixed rounded-br" />
                <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-secondary/70 shadow-[0_0_8px_#4edea3] animate-pulse" />
              </div>
            </>
          )}
        </div>

        {/* Action Controls */}
        <div className="p-4 bg-surface flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={toggleFacingMode}
            className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface active:scale-95 transition-transform"
            title="Ganti kamera depan/belakang"
          >
            <span className="material-symbols-outlined text-[20px]">flip_camera_ios</span>
          </button>

          <button
            id="capture-photo-now-btn"
            type="button"
            disabled={Boolean(error)}
            onClick={handleCapture}
            className="flex-1 h-12 rounded-full bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-md"
          >
            <span className="material-symbols-outlined text-[20px]">camera</span>
            <span>Jepret Foto</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-full font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};
