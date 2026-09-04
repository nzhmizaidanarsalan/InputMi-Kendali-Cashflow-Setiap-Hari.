import React, { useEffect, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Asset, AssetCategory } from '../types';
import { formatNumberIDR, parseIDR } from '../utils/formatters';

interface AddEditAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAsset: Asset | null;
}

export const AddEditAssetModal: React.FC<AddEditAssetModalProps> = ({
  isOpen,
  onClose,
  editingAsset,
}) => {
  const { addAsset, updateAsset, showToast } = useFinance();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<AssetCategory>('bank');
  const [valueDisplay, setValueDisplay] = useState('');
  const [notes, setNotes] = useState('');

  const categoryOptions: { key: AssetCategory; label: string; icon: string }[] = [
    { key: 'bank', label: 'Kas & Bank', icon: 'account_balance' },
    { key: 'investasi', label: 'Investasi', icon: 'show_chart' },
    { key: 'digital', label: 'Aset Digital & Kripto', icon: 'currency_bitcoin' },
    { key: 'peralatan', label: 'Peralatan & Elektronik', icon: 'laptop_mac' },
    { key: 'properti', label: 'Properti & Real Estate', icon: 'home' },
    { key: 'lainnya', label: 'Aset Lainnya', icon: 'inventory_2' },
  ];

  useEffect(() => {
    if (editingAsset) {
      setName(editingAsset.name);
      setCategory(editingAsset.category);
      setValueDisplay(formatNumberIDR(editingAsset.value));
      setNotes(editingAsset.notes || '');
    } else {
      setName('');
      setCategory('bank');
      setValueDisplay('');
      setNotes('');
    }
  }, [editingAsset, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseIDR(valueDisplay);

    if (!name.trim()) {
      showToast('Harap masukkan nama aset.');
      return;
    }
    if (val <= 0) {
      showToast('Harap masukkan nilai aset yang valid.');
      return;
    }

    const selectedCat = categoryOptions.find((c) => c.key === category);
    const categoryLabel = selectedCat?.label || 'Aset';
    const icon = selectedCat?.icon || 'account_balance';
    const cleanNotes = notes.trim() ? notes.trim() : null;

    if (editingAsset) {
      updateAsset(editingAsset.id, {
        name: name.trim(),
        category,
        categoryLabel,
        value: val,
        notes: cleanNotes,
        icon,
      });
    } else {
      addAsset({
        name: name.trim(),
        category,
        categoryLabel,
        value: val,
        monthlyChange: 'Aset baru',
        monthlyChangeType: 'positive',
        notes: cleanNotes,
        icon,
      });
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      id="add-asset-modal"
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
            {editingAsset ? 'Edit Aset' : 'Tambah Aset Baru'}
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
              Nama Aset
            </label>
            <input
              type="text"
              required
              placeholder="Misal: Tabungan BCA, Reksadana, Logam Mulia"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Kategori Aset
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AssetCategory)}
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
              Nilai Valuasi (IDR)
            </label>
            <div className="relative rounded-2xl bg-surface-container-low border border-surface-container p-3 flex items-center gap-2 focus-within:ring-2 focus-within:ring-primary">
              <span className="font-headline-md text-headline-md text-on-surface-variant font-bold">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={valueDisplay}
                onChange={(e) => setValueDisplay(formatNumberIDR(parseIDR(e.target.value)))}
                className="w-full bg-transparent font-headline-lg text-headline-lg font-bold text-on-surface focus:outline-hidden"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Catatan (Opsional)
            </label>
            <textarea
              rows={2}
              placeholder="Catatan rekening, platform atau nomor instrumen..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden resize-none"
            />
          </div>

          <div className="pt-3">
            <button
              type="submit"
              className="w-full min-h-[48px] rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold flex items-center justify-center gap-2 active:scale-95 shadow-md"
            >
              <span className="material-symbols-outlined text-[20px]">save</span>
              <span>{editingAsset ? 'Simpan Perubahan' : 'Tambah Aset'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
