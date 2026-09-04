import React, { useState } from 'react';

export interface FilterOptions {
  type: 'all' | 'income' | 'expense';
  category: string;
  paymentMethod: string;
  onlyWithReceipt: boolean;
  searchQuery: string;
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilters: FilterOptions;
  onApplyFilters: (filters: FilterOptions) => void;
}

export const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  currentFilters,
  onApplyFilters,
}) => {
  const [localFilters, setLocalFilters] = useState<FilterOptions>(currentFilters);

  if (!isOpen) return null;

  const categories = [
    'Semua Kategori',
    'Belanja Harian',
    'Kuliner',
    'Transportasi',
    'Tagihan & Langganan',
    'Karir & Gaji',
    'Bisnis',
    'Investasi',
  ];

  const paymentMethods = [
    'Semua Metode',
    'QRIS BCA',
    'Transfer BCA',
    'Debit BCA',
    'Bank Mandiri',
    'Kartu Kredit',
    'GoPay',
    'ShopeePay',
  ];

  const handleReset = () => {
    const resetValues: FilterOptions = {
      type: 'all',
      category: 'Semua Kategori',
      paymentMethod: 'Semua Metode',
      onlyWithReceipt: false,
      searchQuery: '',
    };
    setLocalFilters(resetValues);
    onApplyFilters(resetValues);
    onClose();
  };

  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  return (
    <div
      id="filter-transactions-modal"
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
            <span className="material-symbols-outlined text-[20px] text-primary">filter_list</span>
            <h2 className="font-headline-md text-headline-md text-on-surface">Filter Transaksi</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Tipe Transaksi */}
          <div className="space-y-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Tipe Transaksi
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'all', label: 'Semua' },
                { id: 'income', label: 'Pemasukan' },
                { id: 'expense', label: 'Pengeluaran' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      type: opt.id as 'all' | 'income' | 'expense',
                    }))
                  }
                  className={`min-h-[38px] rounded-xl font-label-md text-label-md transition-all ${
                    localFilters.type === opt.id
                      ? 'bg-primary text-on-primary font-semibold shadow-xs'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Kategori */}
          <div className="space-y-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Kategori
            </label>
            <select
              value={localFilters.category}
              onChange={(e) =>
                setLocalFilters((prev) => ({ ...prev, category: e.target.value }))
              }
              className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Metode Pembayaran */}
          <div className="space-y-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Metode Pembayaran
            </label>
            <select
              value={localFilters.paymentMethod}
              onChange={(e) =>
                setLocalFilters((prev) => ({ ...prev, paymentMethod: e.target.value }))
              }
              className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
            >
              {paymentMethods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Struk Lampiran Checkbox */}
          <div className="pt-2">
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container-low border border-surface-container cursor-pointer">
              <input
                type="checkbox"
                checked={localFilters.onlyWithReceipt}
                onChange={(e) =>
                  setLocalFilters((prev) => ({ ...prev, onlyWithReceipt: e.target.checked }))
                }
                className="w-4 h-4 rounded text-primary focus:ring-primary"
              />
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">
                  receipt_long
                </span>
                <span className="font-body-md text-body-md text-on-surface font-medium">
                  Hanya yang memiliki bukti struk
                </span>
              </div>
            </label>
          </div>
        </div>

        <div className="p-4 bg-surface flex items-center justify-between gap-3 border-t border-surface-container">
          <button
            type="button"
            onClick={handleReset}
            className="min-h-[44px] px-4 rounded-xl font-label-md text-label-md text-on-surface-variant hover:bg-surface-container"
          >
            Reset Filter
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="min-h-[44px] flex-1 rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold flex items-center justify-center gap-2 active:scale-95 shadow-md"
          >
            Terapkan Filter
          </button>
        </div>
      </div>
    </div>
  );
};
