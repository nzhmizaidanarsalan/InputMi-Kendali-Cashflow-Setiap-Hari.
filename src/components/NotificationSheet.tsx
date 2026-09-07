import React from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatIDR } from '../utils/formatters';

interface NotificationSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationSheet: React.FC<NotificationSheetProps> = ({ isOpen, onClose }) => {
  const {
    liabilities,
    savingsRate,
    netCashflow,
    pushPermission,
    isPushSubscribed,
    enableWebPushReminders,
    disableWebPushReminders,
    testSendWebPushReminder,
  } = useFinance();

  const [isProcessing, setIsProcessing] = React.useState(false);

  if (!isOpen) return null;

  const handleTogglePush = async () => {
    setIsProcessing(true);
    try {
      if (isPushSubscribed) {
        await disableWebPushReminders();
      } else {
        await enableWebPushReminders();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTestNotification = async () => {
    setIsProcessing(true);
    try {
      await testSendWebPushReminder();
    } finally {
      setIsProcessing(false);
    }
  };

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
          {/* Web Push Configuration Card */}
          <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isPushSubscribed ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'
                }`}>
                  <span className="material-symbols-outlined text-[20px]">
                    {isPushSubscribed ? 'notifications_active' : 'notifications_off'}
                  </span>
                </div>
                <div>
                  <h3 className="font-label-md text-label-md text-on-surface font-semibold">
                    Pengingat Jatuh Tempo Web Push
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Pengingat privasi otomatis di H-3, H-1, &amp; Hari H
                  </p>
                </div>
              </div>

              {isPushSubscribed && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[11px] font-semibold shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  Aktif
                </span>
              )}
            </div>

            {pushPermission === 'denied' ? (
              <p className="text-body-sm text-error bg-error-container/20 p-2.5 rounded-xl border border-error-container/30">
                Izin notifikasi diblokir oleh browser. Silakan izinkan notifikasi pada setelan situs browser Anda untuk mengaktifkan pengingat.
              </p>
            ) : pushPermission === 'unsupported' ? (
              <p className="text-body-sm text-on-surface-variant">
                Browser ini tidak mendukung Web Push Notifications.
              </p>
            ) : (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleTogglePush}
                  className={`flex-1 min-h-[40px] px-3 py-1.5 rounded-xl font-label-sm text-label-sm font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-98 ${
                    isPushSubscribed
                      ? 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                      : 'bg-primary text-on-primary shadow-2xs hover:brightness-110'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isPushSubscribed ? 'notifications_paused' : 'notifications'}
                  </span>
                  <span>{isPushSubscribed ? 'Nonaktifkan' : 'Aktifkan Pengingat'}</span>
                </button>

                {isPushSubscribed && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleTestNotification}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold flex items-center justify-center gap-1 transition-all active:scale-98"
                    title="Uji coba pengiriman notifikasi sekarang"
                  >
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    <span>Uji Coba</span>
                  </button>
                )}
              </div>
            )}
          </div>
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
