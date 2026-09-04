import React from 'react';
import { useFinance } from '../context/FinanceContext';

export const ReceiptLightboxModal: React.FC = () => {
  const { lightboxImageUrl, closeLightbox } = useFinance();

  if (!lightboxImageUrl) return null;

  return (
    <div
      id="receipt-lightbox-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 transition-opacity animate-in fade-in"
      onClick={closeLightbox}
    >
      <div
        className="relative max-w-lg w-full max-h-[90vh] bg-surface-container-lowest rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 bg-surface flex items-center justify-between border-b border-surface-container">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">receipt_long</span>
            <span className="font-headline-sm text-headline-sm text-on-surface">Lampiran Struk</span>
          </div>
          <button
            id="close-lightbox-btn"
            type="button"
            aria-label="Tutup"
            onClick={closeLightbox}
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-surface-container-lowest">
          <img
            src={lightboxImageUrl}
            alt="Struk Pembayaran"
            className="max-h-[70vh] w-auto object-contain rounded-lg shadow-sm"
          />
        </div>

        <div className="p-3 bg-surface flex items-center justify-between border-t border-surface-container">
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Tersimpan aman di data lokal
          </span>
          <button
            type="button"
            onClick={closeLightbox}
            className="px-4 py-1.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm font-semibold active:scale-95 transition-transform"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
