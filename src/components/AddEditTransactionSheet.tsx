import React, { useEffect, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { TransactionType } from '../types';
import { formatNumberIDR, getCurrentDateStr, getCurrentTimeStr, parseIDR } from '../utils/formatters';
import { CameraCaptureModal } from './CameraCaptureModal';

export const AddEditTransactionSheet: React.FC = () => {
  const {
    isAddTxOpen,
    closeAddTx,
    addTxInitialType,
    editingTx,
    addTransaction,
    updateTransaction,
    openLightbox,
    showToast,
  } = useFinance();

  const [type, setType] = useState<TransactionType>(addTxInitialType);
  const [nominalDisplay, setNominalDisplay] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Belanja Harian');
  const [paymentMethod, setPaymentMethod] = useState('QRIS BCA');
  const [date, setDate] = useState(getCurrentDateStr());
  const [time, setTime] = useState(getCurrentTimeStr());
  const [note, setNote] = useState('');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [receiptFileSize, setReceiptFileSize] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const expenseCategories = [
    'Belanja Harian',
    'Kuliner',
    'Transportasi',
    'Tagihan & Langganan',
    'Hiburan',
    'Kesehatan',
    'Pendidikan',
    'Lainnya',
  ];

  const incomeCategories = [
    'Karir & Gaji',
    'Bisnis',
    'Investasi',
    'Hadiah & Bonus',
    'Penjualan Aset',
    'Lainnya',
  ];

  const paymentMethods = [
    'QRIS BCA',
    'Transfer BCA',
    'Debit BCA',
    'Bank Mandiri',
    'Kartu Kredit',
    'GoPay',
    'ShopeePay',
    'OVO',
    'Tunai',
  ];

  // Synchronize when opening or editing
  useEffect(() => {
    if (editingTx) {
      setType(editingTx.type);
      setNominalDisplay(formatNumberIDR(editingTx.amount));
      setTitle(editingTx.title);
      setCategory(editingTx.category);
      setPaymentMethod(editingTx.paymentMethod);
      setDate(editingTx.date);
      setTime(editingTx.time);
      setNote(editingTx.note || '');
      setReceiptUrl(editingTx.receiptUrl);
      setReceiptFileName(editingTx.receiptFileName);
      setReceiptFileSize(editingTx.receiptFileSize);
    } else {
      setType(addTxInitialType);
      setNominalDisplay('');
      setTitle('');
      setCategory(addTxInitialType === 'expense' ? 'Belanja Harian' : 'Karir & Gaji');
      setPaymentMethod('QRIS BCA');
      setDate(getCurrentDateStr());
      setTime(getCurrentTimeStr());
      setNote('');
      setReceiptUrl(null);
      setReceiptFileName(null);
      setReceiptFileSize(null);
    }
  }, [editingTx, addTxInitialType, isAddTxOpen]);

  // Handle amount typing
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const num = parseIDR(raw);
    if (num === 0 && raw === '') {
      setNominalDisplay('');
    } else {
      setNominalDisplay(formatNumberIDR(num));
    }
  };

  // Handle file input for receipt
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast('Ukuran file maksimal 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setReceiptUrl(dataUrl);
      setReceiptFileName(file.name);
      const sizeInKb = Math.round(file.size / 1024);
      setReceiptFileSize(sizeInKb > 1024 ? `${(sizeInKb / 1024).toFixed(1)} MB` : `${sizeInKb} KB`);
    };
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = (dataUrl: string) => {
    setReceiptUrl(dataUrl);
    setReceiptFileName(`Foto_Struk_${Date.now()}.jpg`);
    setReceiptFileSize('850 KB');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseIDR(nominalDisplay);

    if (amountNum <= 0) {
      showToast('Harap masukkan nominal yang valid.');
      return;
    }

    if (!title.trim()) {
      showToast('Harap masukkan nama transaksi atau merchant.');
      return;
    }

    const cleanNote = note.trim() ? note.trim() : null;
    const cleanReceiptUrl = receiptUrl || null;
    const cleanReceiptFileName = receiptFileName || null;
    const cleanReceiptFileSize = receiptFileSize || null;

    if (editingTx) {
      updateTransaction(editingTx.id, {
        type,
        amount: amountNum,
        title: title.trim(),
        category,
        paymentMethod,
        date,
        time,
        note: cleanNote,
        receiptUrl: cleanReceiptUrl,
        receiptFileName: cleanReceiptFileName,
        receiptFileSize: cleanReceiptFileSize,
      });
    } else {
      addTransaction({
        type,
        amount: amountNum,
        title: title.trim(),
        category,
        paymentMethod,
        date,
        time,
        note: cleanNote,
        receiptUrl: cleanReceiptUrl,
        receiptFileName: cleanReceiptFileName,
        receiptFileSize: cleanReceiptFileSize,
      });
    }

    closeAddTx();
  };

  if (!isAddTxOpen) return null;

  return (
    <div
      id="add-transaction-sheet"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
      onClick={closeAddTx}
    >
      <div
        className="w-full max-w-lg bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-10 h-1.5 rounded-full bg-surface-container-highest" />
        </div>

        {/* Sheet Header */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-surface-container">
          <h2 className="font-headline-md text-headline-md text-on-surface">
            {editingTx ? 'Edit Transaksi' : 'Catat Transaksi'}
          </h2>
          <button
            id="close-add-tx-sheet-btn"
            type="button"
            onClick={closeAddTx}
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Segmented Type Control */}
          <div className="p-1 rounded-xl bg-surface-container flex gap-1">
            <button
              type="button"
              onClick={() => {
                setType('expense');
                if (!editingTx) setCategory('Belanja Harian');
              }}
              className={`flex-1 min-h-[40px] rounded-lg font-label-md text-label-md flex items-center justify-center gap-1.5 transition-all ${
                type === 'expense'
                  ? 'bg-surface-container-lowest text-error font-semibold shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
              <span>Pengeluaran</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setType('income');
                if (!editingTx) setCategory('Karir & Gaji');
              }}
              className={`flex-1 min-h-[40px] rounded-lg font-label-md text-label-md flex items-center justify-center gap-1.5 transition-all ${
                type === 'income'
                  ? 'bg-surface-container-lowest text-secondary font-semibold shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
              <span>Pemasukan</span>
            </button>
          </div>

          {/* Nominal Input */}
          <div className="space-y-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Nominal Transaksi (IDR)
            </label>
            <div className="relative rounded-2xl bg-surface-container-low border border-surface-container p-3 flex items-center gap-2 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
              <span className="font-headline-md text-headline-md text-on-surface-variant font-bold">
                Rp
              </span>
              <input
                id="transaction-amount-input"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={nominalDisplay}
                onChange={handleAmountChange}
                className="w-full bg-transparent font-headline-lg text-headline-lg font-bold text-on-surface placeholder:text-outline-variant focus:outline-hidden"
              />
            </div>
          </div>

          {/* Merchant / Title */}
          <div className="space-y-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              {type === 'expense' ? 'Nama Merchant / Toko' : 'Sumber Pemasukan'}
            </label>
            <input
              id="transaction-title-input"
              type="text"
              required
              placeholder={type === 'expense' ? 'Misal: Grand Lucky, Kopi Kenangan' : 'Misal: Gaji Kantor, Bonus, Freelance'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:outline-hidden transition-all"
            />
          </div>

          {/* Category & Payment Method Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Kategori
              </label>
              <select
                id="transaction-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
              >
                {(type === 'expense' ? expenseCategories : incomeCategories).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Metode Pembayaran
              </label>
              <select
                id="transaction-payment-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
              >
                {paymentMethods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date & Time Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Tanggal
              </label>
              <input
                id="transaction-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Waktu
              </label>
              <input
                id="transaction-time-input"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
              />
            </div>
          </div>

          {/* Catatan */}
          <div className="space-y-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Catatan (Opsional)
            </label>
            <textarea
              id="transaction-note-input"
              rows={2}
              placeholder="Tambahkan detail atau keterangan..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:outline-hidden resize-none"
            />
          </div>

          {/* Struk Pembayaran / Lampiran Bukti */}
          <div className="space-y-2 pt-1 border-t border-surface-container">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Lampiran Bukti Struk
              </span>
              {receiptUrl && (
                <button
                  type="button"
                  onClick={() => openLightbox(receiptUrl)}
                  className="font-label-sm text-label-sm text-secondary hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">zoom_in</span>
                  Lihat Foto
                </button>
              )}
            </div>

            {receiptUrl ? (
              <div className="p-3 rounded-xl bg-surface-container flex items-center justify-between gap-3 border border-surface-container-highest">
                <div
                  className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                  onClick={() => openLightbox(receiptUrl)}
                >
                  <img
                    src={receiptUrl}
                    alt="Preview Struk"
                    className="w-12 h-12 rounded-lg object-cover ring-1 ring-surface-container-highest shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-label-md text-label-md text-on-surface truncate font-semibold">
                      {receiptFileName || 'Struk_Pembayaran.jpg'}
                    </p>
                    <p className="font-body-sm text-body-sm text-secondary flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      <span>Struk terlampir ({receiptFileSize || '800 KB'})</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptUrl(null);
                    setReceiptFileName(null);
                    setReceiptFileSize(null);
                  }}
                  className="w-8 h-8 rounded-full bg-error-container text-on-error-container hover:opacity-80 flex items-center justify-center transition-opacity"
                  title="Hapus struk"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label className="min-h-[44px] px-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-low hover:bg-surface-container flex items-center justify-center gap-2 text-on-surface-variant font-label-md text-label-md cursor-pointer transition-colors">
                  <span className="material-symbols-outlined text-[20px] text-primary">upload_file</span>
                  <span>Pilih Galeri</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="min-h-[44px] px-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-low hover:bg-surface-container flex items-center justify-center gap-2 text-on-surface-variant font-label-md text-label-md transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px] text-primary">photo_camera</span>
                  <span>Ambil Foto</span>
                </button>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              id="submit-transaction-btn"
              type="submit"
              className="w-full min-h-[48px] rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold flex items-center justify-center gap-2 shadow-md hover:opacity-95 active:scale-[0.99] transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">save</span>
              <span>{editingTx ? 'Perbarui Transaksi' : 'Simpan Transaksi'}</span>
            </button>
          </div>
        </form>
      </div>

      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
};
