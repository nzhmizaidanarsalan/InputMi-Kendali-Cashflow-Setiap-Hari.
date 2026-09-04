import React from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatIDR } from '../utils/formatters';

interface NotificationSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationSheet: React.FC<NotificationSheetProps> = ({ isOpen, onClose }) => {
  const { liabilities, savingsRate, netCashflow } = useFinance();

  if (!isOpen) return null;

  return (
    <div
      id="notification-sheet"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 transition-opacity animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-6 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-10 h-1.5 rounded-full bg-surface-container-highest" />
        </div>

        <div className="px-5 py-3.5 flex items-center justify-between border-b border-surface-container">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">notifications</span>
            <h2 className="font-headline-md text-headline-md text-on-surface">Pemberitahuan</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="p-5 space-y-3.5 overflow-y-auto">
          {/* Bill due reminder */}
          {liabilities.map((liab) => (
            <div
              key={liab.id}
              className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-error-container text-on-error-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">calendar_today</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-label-md text-label-md text-on-surface font-semibold truncate">
                    Pengingat Tagihan: {liab.name}
                  </h3>
                  <span className="font-label-sm text-label-sm text-error font-semibold">
                    {liab.dueDate}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Sisa kewajiban {formatIDR(liab.totalRemaining)}
                  {liab.monthlyPayment ? ` (estimasi cicilan ${formatIDR(liab.monthlyPayment)})` : ''}.
                </p>
              </div>
            </div>
          ))}

          {/* Cashflow milestone */}
          <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">trending_up</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-label-md text-label-md text-on-surface font-semibold">
                Retensi Tabungan Sangat Sehat
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Surplus kas bersih Anda bulan ini mencapai {formatIDR(netCashflow)} ({savingsRate}% dari total pemasukan berhasil diamankan).
              </p>
            </div>
          </div>

          {/* OCR AI Scanner Ready */}
          <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">document_scanner</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-label-md text-label-md text-on-surface font-semibold">
                AI Vision Receipt Scanner Aktif
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Pindai struk thermal, bukti transfer m-banking, atau invoice untuk pencatatan otomatis tanpa repot mengetik.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-surface border-t border-surface-container">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl bg-surface-container text-on-surface font-label-md text-label-md font-semibold hover:bg-surface-container-high transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
