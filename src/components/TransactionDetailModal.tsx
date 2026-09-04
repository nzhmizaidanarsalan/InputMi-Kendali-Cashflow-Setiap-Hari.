import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatIDR, formatIndoDate } from '../utils/formatters';

export const TransactionDetailModal: React.FC = () => {
  const {
    selectedTxDetail,
    closeTxDetail,
    openEditTx,
    deleteTransaction,
    openLightbox,
  } = useFinance();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!selectedTxDetail) return null;

  const isExpense = selectedTxDetail.type === 'expense';

  const handleDelete = () => {
    deleteTransaction(selectedTxDetail.id);
    setShowDeleteConfirm(false);
  };

  return (
    <div
      id="transaction-detail-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
      onClick={closeTxDetail}
    >
      <div
        className="w-full max-w-lg bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-10 h-1.5 rounded-full bg-surface-container-highest" />
        </div>

        {/* Header */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-surface-container">
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                isExpense ? 'bg-error' : 'bg-secondary'
              }`}
            />
            <h2 className="font-headline-md text-headline-md text-on-surface">Rincian Transaksi</h2>
          </div>
          <button
            id="close-tx-detail-btn"
            type="button"
            onClick={closeTxDetail}
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Amount & Merchant Hero */}
          <div className="text-center space-y-1.5 py-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm font-semibold bg-surface-container text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">
                {isExpense ? 'arrow_downward' : 'arrow_upward'}
              </span>
              <span>{isExpense ? 'Pengeluaran' : 'Pemasukan'}</span>
            </div>

            <h1
              className={`font-display-currency text-[32px] sm:text-[38px] font-bold ${
                isExpense ? 'text-error' : 'text-secondary'
              }`}
            >
              {isExpense ? '-' : '+'}
              {formatIDR(selectedTxDetail.amount)}
            </h1>

            <p className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              {selectedTxDetail.title}
            </p>
          </div>

          {/* Details Card */}
          <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container space-y-3.5">
            <div className="flex items-center justify-between py-1 border-b border-surface-container/60">
              <span className="font-body-sm text-body-sm text-on-surface-variant">Tanggal & Waktu</span>
              <span className="font-stat-tabular text-stat-tabular text-on-surface">
                {formatIndoDate(selectedTxDetail.date)} • {selectedTxDetail.time} WIB
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-surface-container/60">
              <span className="font-body-sm text-body-sm text-on-surface-variant">Kategori</span>
              <span className="font-label-md text-label-md text-on-surface font-semibold px-2.5 py-0.5 rounded-full bg-surface-container">
                {selectedTxDetail.category}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-surface-container/60">
              <span className="font-body-sm text-body-sm text-on-surface-variant">Metode Pembayaran</span>
              <span className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary">credit_card</span>
                {selectedTxDetail.paymentMethod}
              </span>
            </div>

            {selectedTxDetail.note && (
              <div className="py-1">
                <span className="font-body-sm text-body-sm text-on-surface-variant block mb-1">
                  Catatan
                </span>
                <p className="font-body-md text-body-md text-on-surface bg-surface-container-lowest p-2.5 rounded-xl border border-surface-container">
                  {selectedTxDetail.note}
                </p>
              </div>
            )}
          </div>

          {/* Items breakdown if available */}
          {selectedTxDetail.items && selectedTxDetail.items.length > 0 && (
            <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container space-y-2.5">
              <h3 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Rincian Item ({selectedTxDetail.items.length})
              </h3>
              <div className="space-y-1.5">
                {selectedTxDetail.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-body-sm">
                    <span className="text-on-surface">
                      {item.qty && item.qty > 1 ? `${item.qty}x ` : ''}
                      {item.name}
                    </span>
                    <span className="font-stat-tabular text-on-surface font-medium">
                      {formatIDR(item.price * (item.qty || 1))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attached Receipt Card */}
          {selectedTxDetail.receiptUrl && (
            <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">
                    receipt_long
                  </span>
                  <h3 className="font-label-sm text-label-sm text-on-surface font-semibold uppercase tracking-wider">
                    Foto Struk Asli
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => openLightbox(selectedTxDetail.receiptUrl!)}
                  className="font-label-sm text-label-sm text-secondary hover:underline flex items-center gap-1 font-semibold"
                >
                  <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                  Lihat Penuh
                </button>
              </div>

              <div
                className="relative rounded-xl overflow-hidden bg-black/5 aspect-4/3 cursor-pointer group flex items-center justify-center border border-surface-container"
                onClick={() => openLightbox(selectedTxDetail.receiptUrl!)}
              >
                <img
                  src={selectedTxDetail.receiptUrl}
                  alt={selectedTxDetail.title}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="px-3 py-1 rounded-full bg-black/70 text-white font-label-sm text-label-sm">
                    Klik untuk memperbesar
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-surface flex items-center justify-between gap-3 border-t border-surface-container">
          {showDeleteConfirm ? (
            <div className="w-full flex items-center justify-between gap-3">
              <span className="font-body-sm text-body-sm text-error font-medium">
                Yakin hapus transaksi ini?
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm"
                >
                  Batal
                </button>
                <button
                  id="confirm-delete-tx-btn"
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-1.5 rounded-full bg-error text-on-error font-label-sm text-label-sm font-semibold active:scale-95"
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                id="delete-transaction-btn"
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="min-h-[44px] px-4 rounded-xl text-error hover:bg-error-container/50 font-label-md text-label-md flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
                <span>Hapus</span>
              </button>

              <button
                id="edit-transaction-btn"
                type="button"
                onClick={() => openEditTx(selectedTxDetail)}
                className="min-h-[44px] flex-1 rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xs"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
                <span>Edit Transaksi</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
