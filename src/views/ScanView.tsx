import React, { useRef, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { CameraCaptureModal } from '../components/CameraCaptureModal';
import { ReceiptScanResult, Transaction, TransactionType } from '../types';
import {
  formatIDR,
  formatNumberIDR,
  getCurrentDateStr,
  getCurrentTimeStr,
  parseIDR,
} from '../utils/formatters';

export const ScanView: React.FC = () => {
  const {
    addTransaction,
    addScannedReceiptRecord,
    checkDuplicateReceipt,
    scannedReceipts,
    openLightbox,
    setActiveTab,
    openAddTx,
    showToast,
  } = useFinance();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const transferInputRef = useRef<HTMLInputElement>(null);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Active uploaded image for review
  const [currentImageBase64, setCurrentImageBase64] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [currentFileSize, setCurrentFileSize] = useState<string>('');

  // Extracted data state for review and edit
  const [reviewData, setReviewData] = useState<ReceiptScanResult | null>(null);
  const [editableNominal, setEditableNominal] = useState<string>('');
  const [editableMerchant, setEditableMerchant] = useState<string>('');
  const [editableCategory, setEditableCategory] = useState<string>('Belanja Harian');
  const [editablePayment, setEditablePayment] = useState<string>('QRIS BCA');
  const [editableDate, setEditableDate] = useState<string>(getCurrentDateStr());
  const [editableTime, setEditableTime] = useState<string>(getCurrentTimeStr());
  const [editableNotes, setEditableNotes] = useState<string>('');
  const [editableType, setEditableType] = useState<TransactionType>('expense');
  const [duplicateWarning, setDuplicateWarning] = useState<Transaction | null>(null);
  const [showItemDetails, setShowItemDetails] = useState<boolean>(true);

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

  // OCR Processing Function
  const processReceiptImage = async (
    dataUrl: string,
    fileName: string,
    fileSize: string,
    mimeType: string = 'image/jpeg'
  ) => {
    try {
      setIsScanning(true);
      setScanError(null);
      setDuplicateWarning(null);
      setCurrentImageBase64(dataUrl);
      setCurrentFileName(fileName);
      setCurrentFileSize(fileSize);

      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal memindai struk.');
      }

      const extracted: ReceiptScanResult = result.data;
      setReviewData(extracted);
      setEditableType(extracted.type || 'expense');
      setEditableNominal(formatNumberIDR(extracted.amount || 0));
      setEditableMerchant(extracted.merchant || '');
      setEditableCategory(extracted.category || 'Belanja Harian');
      setEditablePayment(extracted.paymentMethod || 'QRIS BCA');
      setEditableDate(extracted.date || getCurrentDateStr());
      setEditableTime(extracted.time || getCurrentTimeStr());
      setEditableNotes(extracted.notes || '');

      // Check for duplicate transaction
      const duplicate = checkDuplicateReceipt(
        extracted.amount,
        extracted.date,
        extracted.merchant
      );
      if (duplicate) {
        setDuplicateWarning(duplicate);
      }

      showToast('Struk berhasil dibaca oleh AI Vision.');
    } catch (err: any) {
      console.error('Scan error:', err);
      setScanError(
        err.message || 'Gagal membaca gambar. Pastikan struk terlihat jelas dan coba lagi.'
      );
      showToast('Gagal membaca gambar struk.');
    } finally {
      setIsScanning(false);
    }
  };

  // Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      showToast('Ukuran file maksimal 15MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const sizeInKb = Math.round(file.size / 1024);
      const sizeStr = sizeInKb > 1024 ? `${(sizeInKb / 1024).toFixed(1)} MB` : `${sizeInKb} KB`;
      processReceiptImage(dataUrl, file.name, sizeStr, file.type);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Handle Camera capture
  const handleCameraCapture = (dataUrl: string) => {
    const fileName = `Kamera_Struk_${Date.now()}.jpg`;
    processReceiptImage(dataUrl, fileName, '920 KB', 'image/jpeg');
  };

  // Save Transaction
  const handleSaveTransaction = () => {
    const amountNum = parseIDR(editableNominal);

    if (amountNum <= 0) {
      showToast('Nominal harus lebih besar dari 0.');
      return;
    }

    if (!editableMerchant.trim()) {
      showToast('Harap isi nama merchant atau sumber transaksi.');
      return;
    }

    const cleanNote = editableNotes.trim() ? editableNotes.trim() : null;
    const cleanReceiptUrl = currentImageBase64 || null;
    const cleanFileName = currentFileName || null;
    const cleanFileSize = currentFileSize || null;
    const cleanItems = reviewData?.items && Array.isArray(reviewData.items) ? reviewData.items : [];

    // Save to transactions
    addTransaction({
      type: editableType,
      amount: amountNum,
      title: editableMerchant.trim(),
      category: editableCategory,
      paymentMethod: editablePayment,
      date: editableDate,
      time: editableTime,
      note: cleanNote,
      receiptUrl: cleanReceiptUrl,
      receiptFileName: cleanFileName,
      receiptFileSize: cleanFileSize,
      items: cleanItems,
    });

    // Save to scanned history
    if (currentImageBase64) {
      addScannedReceiptRecord({
        merchant: editableMerchant.trim(),
        amount: amountNum,
        date: editableDate,
        time: editableTime,
        imageUrl: currentImageBase64,
        fileName: currentFileName,
        fileSize: currentFileSize,
        status: 'Tersimpan',
        category: editableCategory,
        paymentMethod: editablePayment,
      });
    }

    // Reset review state and navigate to cashflow
    setReviewData(null);
    setCurrentImageBase64(null);
    setDuplicateWarning(null);
    showToast('Transaksi struk berhasil dicatat ke Cashflow!');
    setActiveTab('cashflow');
  };

  const handleCancelReview = () => {
    setReviewData(null);
    setCurrentImageBase64(null);
    setDuplicateWarning(null);
    setScanError(null);
  };

  return (
    <div id="scan-view" className="space-y-6 pb-24 max-w-2xl mx-auto">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png, image/jpeg, image/jpg, image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        type="file"
        ref={transferInputRef}
        accept="image/png, image/jpeg, image/jpg, image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header with Title */}
      <div>
        <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">Pindai Struk AI</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Pindai struk fisik atau screenshot m-Banking secara otomatis
        </p>
      </div>

      {/* Top Status & Help */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
            AI Vision Scanner Siap
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsHelpOpen(!isHelpOpen)}
          className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-colors"
          title="Petunjuk Pemindaian"
        >
          <span className="material-symbols-outlined text-[20px]">help_outline</span>
        </button>
      </div>

      {/* Help Banner if toggled */}
      {isHelpOpen && (
        <div className="p-4 rounded-2xl bg-surface-container border border-surface-container-highest space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-secondary">tips_and_updates</span>
              Tips Pemindaian Akurat
            </span>
            <button
              type="button"
              onClick={() => setIsHelpOpen(false)}
              className="text-on-surface-variant hover:text-on-surface text-xs"
            >
              Tutup
            </button>
          </div>
          <ul className="font-body-sm text-body-sm text-on-surface-variant space-y-1 list-disc pl-4">
            <li>Pastikan pencahayaan cukup dan struk tidak terlipat.</li>
            <li>Nama toko, total harga, dan tanggal harus berada di dalam bidang foto.</li>
            <li>Mendukung struk kasir supermarket, cafe, SPBU, serta screenshot m-Banking.</li>
          </ul>
        </div>
      )}

      {/* VIEW 1: HERO VIEWFINDER CAMERA AREA (If not reviewing) */}
      {!reviewData && (
        <div
          id="scanner-viewfinder-card"
          className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-5"
        >
          {/* Animated Laser Viewfinder Box */}
          <div className="relative w-full aspect-4/3 rounded-2xl bg-surface-container-low border border-surface-container overflow-hidden flex flex-col items-center justify-center p-6 text-center">
            {/* Viewfinder Corner Brackets */}
            <div className="absolute inset-4 sm:inset-6 pointer-events-none">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-lg" />
            </div>

            {/* Scanning Laser Animation line */}
            {isScanning ? (
              <div className="flex flex-col items-center justify-center gap-3 z-10">
                <div className="w-12 h-12 rounded-full border-3 border-secondary border-t-transparent animate-spin" />
                <p className="font-headline-sm text-headline-sm text-on-surface font-semibold animate-pulse">
                  Membaca struk dengan AI Vision...
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Mengekstrak nominal, toko, tanggal, dan rincian belanja
                </p>
              </div>
            ) : (
              <div className="space-y-3 z-10">
                <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mx-auto text-primary shadow-xs">
                  <span className="material-symbols-outlined text-[32px]">document_scanner</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Arahkan Kamera ke Struk
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant max-w-xs mx-auto mt-1">
                    Ambil foto langsung atau unggah bukti transfer digital
                  </p>
                </div>
              </div>
            )}

            {/* Horizontal Laser Line animation */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-secondary/80 shadow-[0_0_12px_#00714d] pointer-events-none animate-pulse" />
          </div>

          {/* Scan Error Message if any */}
          {scanError && (
            <div className="p-3.5 rounded-2xl bg-error-container/60 border border-error-container flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[20px] text-error shrink-0">error</span>
              <div className="flex-1 text-body-sm text-on-error-container">
                <p className="font-semibold">Pemeriksaan Gambar</p>
                <p>{scanError}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1 rounded-full bg-surface-container-lowest text-on-surface text-label-sm font-semibold"
                  >
                    Pilih Gambar Lain
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddTx('expense')}
                    className="px-3 py-1 rounded-full bg-surface-container-lowest text-on-surface text-label-sm font-semibold"
                  >
                    Input Manual
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3 Scanner Trigger Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <button
              id="scanner-camera-capture-btn"
              type="button"
              disabled={isScanning}
              onClick={() => setIsCameraOpen(true)}
              className="min-h-[50px] p-3 rounded-2xl bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md hover:opacity-95 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">photo_camera</span>
              <span>Ambil Foto</span>
            </button>

            <button
              id="scanner-gallery-picker-btn"
              type="button"
              disabled={isScanning}
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[50px] p-3 rounded-2xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold flex items-center justify-center gap-2 active:scale-95 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">photo_library</span>
              <span>Pilih Galeri</span>
            </button>

            <button
              id="scanner-transfer-proof-btn"
              type="button"
              disabled={isScanning}
              onClick={() => transferInputRef.current?.click()}
              className="min-h-[50px] p-3 rounded-2xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold flex items-center justify-center gap-2 active:scale-95 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">send_to_mobile</span>
              <span>Bukti Transfer</span>
            </button>
          </div>

          {/* Fallback Assistance Banner */}
          <div className="p-3 rounded-2xl bg-surface-container-low border border-surface-container flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                help
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Foto struk buram atau rusak?
              </span>
            </div>
            <button
              type="button"
              onClick={() => openAddTx('expense')}
              className="font-label-sm text-label-sm text-secondary hover:underline font-semibold"
            >
              Input Manual Kas
            </button>
          </div>
        </div>
      )}

      {/* VIEW 2: REVIEW & EDIT EXTRACTED RECEIPT CARD */}
      {reviewData && (
        <div
          id="receipt-review-card"
          className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-[0_4px_24px_rgba(0,0,0,0.04)] space-y-5 animate-in fade-in"
        >
          {/* Review Header */}
          <div className="flex items-center justify-between border-b border-surface-container pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[24px] text-secondary">
                task_alt
              </span>
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                  Tinjau Transaksi
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Hasil pemindaian AI Vision • Silakan konfirmasi sebelum disimpan
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancelReview}
              className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Uploaded Receipt Image Thumbnail Bar */}
          {currentImageBase64 && (
            <div className="p-3 rounded-2xl bg-surface-container flex items-center justify-between gap-3">
              <div
                className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                onClick={() => openLightbox(currentImageBase64)}
              >
                <img
                  src={currentImageBase64}
                  alt="Struk Preview"
                  className="w-14 h-14 rounded-xl object-cover ring-1 ring-surface-container-highest shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-label-md text-label-md text-on-surface font-semibold truncate">
                    {currentFileName}
                  </p>
                  <p className="font-body-sm text-[11px] text-on-surface-variant">
                    {currentFileSize} • Klik untuk perbesar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openLightbox(currentImageBase64)}
                className="min-h-[34px] px-3 rounded-full bg-surface-container-lowest hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold flex items-center gap-1 shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                <span>Zoom</span>
              </button>
            </div>
          )}

          {/* Duplicate Warning if matched */}
          {duplicateWarning && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-label-md">
                <span className="material-symbols-outlined text-[20px] text-amber-600">warning</span>
                <span>Transaksi Serupa Ditemukan</span>
              </div>
              <p className="font-body-sm text-body-sm">
                Transaksi sebesar <strong>{formatIDR(duplicateWarning.amount)}</strong> pada {duplicateWarning.date} di toko "{duplicateWarning.title}" sudah pernah dicatat sebelumnya.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCancelReview}
                  className="px-3 py-1 rounded-full bg-amber-200 hover:bg-amber-300 text-amber-900 font-label-sm text-label-sm font-semibold"
                >
                  Batalkan
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="px-3 py-1 rounded-full bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-label-sm text-label-sm font-semibold"
                >
                  Tetap Simpan
                </button>
              </div>
            </div>
          )}

          {/* Type Toggle: Expense / Income */}
          <div className="p-1 rounded-xl bg-surface-container flex gap-1">
            <button
              type="button"
              onClick={() => setEditableType('expense')}
              className={`flex-1 min-h-[38px] rounded-lg font-label-md text-label-md font-semibold transition-all ${
                editableType === 'expense'
                  ? 'bg-surface-container-lowest text-error shadow-xs'
                  : 'text-on-surface-variant'
              }`}
            >
              Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => setEditableType('income')}
              className={`flex-1 min-h-[38px] rounded-lg font-label-md text-label-md font-semibold transition-all ${
                editableType === 'income'
                  ? 'bg-surface-container-lowest text-secondary shadow-xs'
                  : 'text-on-surface-variant'
              }`}
            >
              Pemasukan
            </button>
          </div>

          {/* Form Fields Grid */}
          <div className="space-y-4">
            {/* Amount Field with Detected Badge */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Nominal Terbaca
                </label>
                <span className="font-label-sm text-label-sm text-secondary bg-secondary-container px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                  Terdeteksi AI
                </span>
              </div>
              <div className="relative rounded-2xl bg-surface-container-low border border-surface-container p-3 flex items-center gap-2 focus-within:ring-2 focus-within:ring-primary">
                <span className="font-headline-md text-headline-md text-on-surface font-bold">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editableNominal}
                  onChange={(e) => setEditableNominal(formatNumberIDR(parseIDR(e.target.value)))}
                  className="w-full bg-transparent font-headline-lg text-headline-lg font-bold text-on-surface focus:outline-hidden"
                />
              </div>
            </div>

            {/* Merchant / Source */}
            <div className="space-y-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Nama Merchant / Penerima
              </label>
              <input
                type="text"
                value={editableMerchant}
                onChange={(e) => setEditableMerchant(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
              />
            </div>

            {/* Category and Payment Method */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Kategori
                </label>
                <select
                  value={editableCategory}
                  onChange={(e) => setEditableCategory(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                >
                  {(editableType === 'expense' ? expenseCategories : incomeCategories).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                    Metode Pembayaran
                  </label>
                  {reviewData.uncertainFields?.includes('paymentMethod') && (
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full font-semibold">
                      Perlu Dikonfirmasi
                    </span>
                  )}
                </div>
                <select
                  value={editablePayment}
                  onChange={(e) => setEditablePayment(e.target.value)}
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

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={editableDate}
                  onChange={(e) => setEditableDate(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Waktu
                </label>
                <input
                  type="time"
                  value={editableTime}
                  onChange={(e) => setEditableTime(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                />
              </div>
            </div>

            {/* Items Breakdown Collapsible */}
            {reviewData.items && reviewData.items.length > 0 && (
              <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container space-y-2">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setShowItemDetails(!showItemDetails)}
                >
                  <span className="font-label-sm text-label-sm text-on-surface font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">list_alt</span>
                    Detail Belanja ({reviewData.items.length} Item)
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                    {showItemDetails ? 'expand_less' : 'expand_more'}
                  </span>
                </div>

                {showItemDetails && (
                  <div className="pt-2 space-y-2 border-t border-surface-container/60">
                    {reviewData.items.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between text-body-sm">
                        <span className="text-on-surface">
                          {it.qty && it.qty > 1 ? `${it.qty}x ` : ''}
                          {it.name}
                        </span>
                        <span className="font-stat-tabular text-on-surface font-medium">
                          {formatIDR(it.price * (it.qty || 1))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Catatan Transaksi
              </label>
              <textarea
                rows={2}
                value={editableNotes}
                onChange={(e) => setEditableNotes(e.target.value)}
                placeholder="Tambahkan catatan keterangan belanja..."
                className="w-full p-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden resize-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              id="confirm-save-receipt-btn"
              type="button"
              onClick={handleSaveTransaction}
              className="w-full min-h-[50px] rounded-2xl bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold flex items-center justify-center gap-2 active:scale-95 shadow-md"
            >
              <span className="material-symbols-outlined text-[20px]">save</span>
              <span>Simpan Transaksi</span>
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 min-h-[42px] rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium"
              >
                Pindai Ulang
              </button>
              <button
                type="button"
                onClick={handleCancelReview}
                className="flex-1 min-h-[42px] rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: STRUK TERAKHIR (RECENT SCANNED RECEIPTS LIST) */}
      <div id="recent-scanned-receipts-section" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Struk Terakhir
          </h3>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {scannedReceipts.length} Tersimpan
          </span>
        </div>

        {scannedReceipts.length === 0 ? (
          <div className="p-8 rounded-3xl bg-surface-container-lowest border border-surface-container text-center space-y-2">
            <span className="material-symbols-outlined text-[32px] text-on-surface-variant">
              receipt_long
            </span>
            <p className="font-label-md text-label-md text-on-surface font-semibold">
              Belum ada arsip struk tersimpan
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm mx-auto">
              Struk fisik atau bukti transfer yang Anda pindai akan diarsipkan di sini secara rapi beserta lampiran fotonya.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {scannedReceipts.map((scan) => (
              <div
                key={scan.id}
                onClick={() => openLightbox(scan.imageUrl)}
                className="p-3.5 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low border border-surface-container flex items-center justify-between cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={scan.imageUrl}
                    alt={scan.merchant}
                    className="w-12 h-12 rounded-xl object-cover ring-1 ring-surface-container-highest shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-label-md text-label-md text-on-surface font-semibold truncate">
                        {scan.merchant}
                      </h4>
                      <span className="font-label-sm text-[10px] text-secondary bg-secondary-container px-1.5 py-0.2 rounded-full font-semibold">
                        {scan.status}
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                      {scan.date} {scan.time} • {scan.paymentMethod}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 pl-2">
                  <span className="font-stat-tabular text-stat-tabular font-bold text-on-surface">
                    {formatIDR(scan.amount)}
                  </span>
                  <span className="font-body-sm text-[11px] text-on-surface-variant block">
                    {scan.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
};
