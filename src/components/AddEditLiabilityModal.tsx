import React, { useEffect, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Liability, LiabilityCategory } from '../types';
import { formatNumberIDR, parseIDR } from '../utils/formatters';

interface AddEditLiabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingLiability: Liability | null;
}

export const AddEditLiabilityModal: React.FC<AddEditLiabilityModalProps> = ({
  isOpen,
  onClose,
  editingLiability,
}) => {
  const { addLiability, updateLiability, showToast } = useFinance();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<LiabilityCategory>('kendaraan');
  const [totalDisplay, setTotalDisplay] = useState('');
  const [monthlyDisplay, setMonthlyDisplay] = useState('');
  const [dueDate, setDueDate] = useState('15 Sep 2026');

  const categoryOptions: { key: LiabilityCategory; label: string; icon: string }[] = [
    { key: 'kendaraan', label: 'Cicilan Kendaraan', icon: 'two_wheeler' },
    { key: 'konsumsi', label: 'Kartu Kredit & Konsumsi', icon: 'credit_card' },
    { key: 'fintech', label: 'PayLater & Fintech', icon: 'payments' },
    { key: 'kpr', label: 'KPR & Properti', icon: 'home_work' },
    { key: 'lainnya', label: 'Kewajiban Lainnya', icon: 'money_off' },
  ];

  useEffect(() => {
    if (editingLiability) {
      setName(editingLiability.name);
      setCategory(editingLiability.category);
      setTotalDisplay(formatNumberIDR(editingLiability.totalRemaining));
      setMonthlyDisplay(editingLiability.monthlyPayment ? formatNumberIDR(editingLiability.monthlyPayment) : '');
      setDueDate(editingLiability.dueDate || '15 Sep 2026');
    } else {
      setName('');
      setCategory('kendaraan');
      setTotalDisplay('');
      setMonthlyDisplay('');
      setDueDate('15 Sep 2026');
    }
  }, [editingLiability, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const total = parseIDR(totalDisplay);
    const monthly = parseIDR(monthlyDisplay);

    if (!name.trim()) {
      showToast('Harap masukkan nama kewajiban.');
      return;
    }
    if (total <= 0) {
      showToast('Harap masukkan total sisa utang yang valid.');
      return;
    }

    const selectedCat = categoryOptions.find((c) => c.key === category);
    const categoryLabel = selectedCat?.label || 'Kewajiban';
    const icon = selectedCat?.icon || 'credit_card';
    const cleanMonthly = monthly > 0 ? monthly : null;

    if (editingLiability) {
      updateLiability(editingLiability.id, {
        name: name.trim(),
        category,
        categoryLabel,
        totalRemaining: total,
        monthlyPayment: cleanMonthly,
        dueDate: dueDate.trim() || 'Akhir Bulan',
        icon,
      });
    } else {
      addLiability({
        name: name.trim(),
        category,
        categoryLabel,
        totalRemaining: total,
        monthlyPayment: cleanMonthly,
        dueDate: dueDate.trim() || 'Akhir Bulan',
        monthlyChange: `Jatuh tempo: ${dueDate.trim() || 'Akhir Bulan'}`,
        monthlyChangeType: 'neutral',
        icon,
      });
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      id="add-liability-modal"
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
          <h2 className="font-headline-md text-headline-md text-on-surface">
            {editingLiability ? 'Edit Liabilitas' : 'Tambah Liabilitas Baru'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Nama Kewajiban
            </label>
            <input
              type="text"
              required
              placeholder="Misal: Cicilan Motor, Kartu Kredit BCA"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Kategori Liabilitas
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as LiabilityCategory)}
              className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
            >
              {categoryOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Total Sisa Kewajiban (IDR)
            </label>
            <div className="relative rounded-2xl bg-surface-container-low border border-surface-container p-3 flex items-center gap-2 focus-within:ring-2 focus-within:ring-primary">
              <span className="font-headline-md text-headline-md text-on-surface-variant font-bold">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={totalDisplay}
                onChange={(e) => setTotalDisplay(formatNumberIDR(parseIDR(e.target.value)))}
                className="w-full bg-transparent font-headline-lg text-headline-lg font-bold text-on-surface focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Cicilan Bulanan
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Rp 0"
                value={monthlyDisplay ? `Rp ${monthlyDisplay}` : ''}
                onChange={(e) => setMonthlyDisplay(formatNumberIDR(parseIDR(e.target.value)))}
                className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Jatuh Tempo
              </label>
              <input
                type="text"
                placeholder="15 Sep 2026"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
              />
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              className="w-full min-h-[48px] rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold flex items-center justify-center gap-2 active:scale-95 shadow-md"
            >
              <span className="material-symbols-outlined text-[20px]">save</span>
              <span>{editingLiability ? 'Simpan Perubahan' : 'Tambah Liabilitas'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
