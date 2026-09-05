import React, { useEffect, useRef, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { ReceiptScanResult, Transaction, TransactionType } from '../types';
import {
  formatIDR,
  formatNumberIDR,
  getCurrentDateStr,
  getCurrentTimeStr,
  parseIDR,
} from '../utils/formatters';
import { processImageForOcr, revokeSafePreviewUrl } from '../utils/imageUtils';

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

  // Hidden native file inputs for real device capture & selection
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const transferInputRef = useRef<HTMLInputElement>(null);

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Active uploaded image state for preview and saving
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState<string | null>(null);
  const [currentDataUrl, setCurrentDataUrl] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [currentFileSize, setCurrentFileSize] = useState<string>('');
  const [lastSource, setLastSource] = useState<'kamera' | 'galeri' | 'transfer'>('kamera');

  // Extracted data state for review and editing
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

  // Clean up object URLs on component unmount
  useEffect(() => {
    return () => {
      if (currentPreviewUrl) {
        revokeSafePreviewUrl(currentPreviewUrl);
      }
    };
  }, [currentPreviewUrl]);

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

  // Core file processing pipeline
  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    source: 'kamera' | 'galeri' | 'transfer'
  ) => {
    const file = e.target.files?.[0];
    // Always reset the input value so the same image can be re-selected if necessary
    e.target.value = '';

    if (!file) return;

    setLastSource(source);
    setIsScanning(true);
    setScanError(null);
    setDuplicateWarning(null);

    try {
      // 1. Process image: downscale, convert to clean JPEG, validate format & size, safe preview
      const processed = await processImageForOcr(file, source);

      // Clean up previous preview URL to prevent memory leaks
      if (currentPreviewUrl) {
        revokeSafePreviewUrl(currentPreviewUrl);
      }

      setCurrentPreviewUrl(processed.previewUrl);
      setCurrentDataUrl(processed.dataUrl);
      setCurrentFileName(processed.fileName);
      setCurrentFileSize(processed.fileSizeStr);

      // 2. Call OCR backend API with clean base64 data
      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: processed.cleanBase64,
          mimeType: processed.mimeType,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal memindai struk dengan AI Vision.');
      }

      // 3. Populate review fields
      const extracted: ReceiptScanResult = result.data;
      setReviewData(extracted);
      setEditableType(extracted.type || 'expense');
      setEditableNominal(formatNumberIDR(extracted.amount || 0));
      setEditableMerchant(extracted.merchant || '');
      setEditableCategory(
        extracted.category || (extracted.type === 'income' ? 'Lainnya' : 'Belanja Harian')
      );
      setEditablePayment(extracted.paymentMethod || 'QRIS BCA');
      setEditableDate(extracted.date || getCurrentDateStr());
      setEditableTime(extracted.time || getCurrentTimeStr());
      setEditableNotes(extracted.notes || '');

      // Check for duplicate transaction in database
      const duplicate = checkDuplicateReceipt(
        extracted.amount,
        extracted.date,
        extracted.merchant
      );
      if (duplicate) {
        setDuplicateWarning(duplicate);
      }

      showToast('Struk berhasil dipindai oleh AI Vision.');
    } catch (err: any) {
      console.error('Scan error:', err);
      const friendlyMsg =
        err?.message ||
        'Gagal membaca gambar. Pastikan struk terlihat jelas dan coba lagi.';
      setScanError(friendlyMsg);
      showToast('Gagal membaca gambar struk.');
    } finally {
      setIsScanning(false);
    }
  };

  // Retry last action
  const handleRetryLastAction = () => {
    if (lastSource === 'kamera') {
      cameraInputRef.current?.click();
    } else if (lastSource === 'transfer') {
      transferInputRef.current?.click();
    } else {
      galleryInputRef.current?.click();
    }
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
    const cleanReceiptUrl = currentDataUrl || currentPreviewUrl || null;
    const cleanFileName = currentFileName || null;
    const cleanFileSize = currentFileSize || null;
    const cleanItems =
      reviewData?.items && Array.isArray(reviewData.items) ? reviewData.items : [];

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
    if (cleanReceiptUrl) {
      addScannedReceiptRecord({
        merchant: editableMerchant.trim(),
        amount: amountNum,
        date: editableDate,
        time: editableTime,
        imageUrl: cleanReceiptUrl,
        fileName: currentFileName,
        fileSize: currentFileSize,
        status: 'Tersimpan',
        category: editableCategory,
        paymentMethod: editablePayment,
      });
    }

    // Clean up preview URL
    if (currentPreviewUrl) {
      revokeSafePreviewUrl(currentPreviewUrl);
    }

    // Reset review state and navigate to cashflow
    setReviewData(null);
    setCurrentPreviewUrl(null);
    setCurrentDataUrl(null);
    setDuplicateWarning(null);
    showToast('Transaksi struk berhasil dicatat ke Cashflow!');
    setActiveTab('cashflow');
  };

  const handleCancelReview = () => {
    if (currentPreviewUrl) {
      revokeSafePreviewUrl(currentPreviewUrl);
    }
    setCurrentPreviewUrl(null);
    setCurrentDataUrl(null);
    setReviewData(null);
    setDuplicateWarning(null);
    setScanError(null);
  };

  const activeImage = currentPreviewUrl || currentDataUrl;

  return (
    <div id="scan-view" className="space-y-6 pb-32 max-w-2xl mx-auto">
      {/* Real Native File Inputs - Hidden but triggered by primary buttons */}
      {/* 1. Camera Input: Uses capture="environment" to directly open the native rear camera on mobile devices */}
      <input
        id="scanner-camera-file-input"
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileInputChange(e, 'kamera')}
      />

      {/* 2. Gallery Input: Opens native photo library picker without forcing camera */}
      <input
        id="scanner-gallery-file-input"
        type="file"
        ref={galleryInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileInputChange(e, 'galeri')}
      />

      {/* 3. Transfer Proof Input: For digital banking screenshots & payment proofs */}
      <input
        id="scanner-transfer-file-input"
        type="file"
        ref={transferInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileInputChange(e, 'transfer')}
      />

      {/* Header with Title */}
      <div>
        <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">
          Pindai Struk AI
        </h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Pindai struk fisik belanja atau tangkapan layar bukti transfer m-Banking
        </p>
      </div>

      {/* Top Status & Help */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
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
              <span className="material-symbols-outlined text-[18px] text-secondary">
                tips_and_updates
              </span>
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
            <li>Gunakan pencahayaan yang cukup dan ratakan struk jika kusut.</li>
            <li>Pastikan total belanja, tanggal, dan nama toko terlihat jelas.</li>
            <li>Mendukung foto struk toko, barcode kasir, dan tangkapan layar QRIS / transfer m-Banking.</li>
          </ul>
        </div>
      )}

      {/* VIEW 1: HERO VIEWFINDER CAMERA AREA (When not in review mode) */}
      {!reviewData && (
        <div
          id="scanner-viewfinder-card"
          className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-5"
        >
          {/* Animated Viewfinder Box */}
          <div className="relative w-full aspect-4/3 rounded-2xl bg-surface-container-low border border-surface-container overflow-hidden flex flex-col items-center justify-center p-6 text-center">
            {/* Corner Brackets */}
            <div className="absolute inset-4 sm:inset-6 pointer-events-none">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-lg" />
            </div>

            {/* Scanning Laser Animation or Idle Icon */}
            {isScanning ? (
              <div className="flex flex-col items-center justify-center gap-3 z-10">
                <div className="w-12 h-12 rounded-full border-3 border-secondary border-t-transparent animate-spin" />
                <p className="font-headline-sm text-headline-sm text-on-surface font-semibold animate-pulse">
                  Membaca struk dengan AI Vision...
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Mengekstrak nominal, merchant, tanggal, dan rincian item
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
                    Ambil foto langsung, pilih dari galeri, atau unggah bukti transfer m-Banking
                  </p>
                </div>
              </div>
            )}

            {/* Horizontal Laser Line */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-secondary/80 shadow-[0_0_12px_#00714d] pointer-events-none animate-pulse" />
          </div>

          {/* Error Message with user-friendly retry & manual input actions */}
          {scanError && (
            <div className="p-3.5 rounded-2xl bg-error-container/60 border border-error-container flex items-start gap-2.5 animate-in fade-in">
              <span className="material-symbols-outlined text-[20px] text-error shrink-0 mt-0.5">
                error
              </span>
              <div className="flex-1 text-body-sm text-on-error-container">
                <p className="font-semibold text-error">Pemeriksaan Gambar</p>
                <p className="mt-0.5 text-xs text-on-error-container leading-relaxed">
                  {scanError}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRetryLastAction}
                    className="px-3 py-1.5 rounded-xl bg-error text-white text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-xs"
                  >
                    Coba Lagi
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-surface-container-lowest text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors"
                  >
                    Pilih Gambar Lain
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddTx('expense')}
                    className="px-3 py-1.5 rounded-xl bg-surface-container-lowest text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors"
                  >
                    Input Manual
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3 Real Scanner Trigger Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Button 1: Real Camera Capture */}
            <button
              id="scanner-camera-capture-btn"
              type="button"
              disabled={isScanning}
              onClick={() => cameraInputRef.current?.click()}
              className="min-h-[50px] p-3 rounded-2xl bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md hover:opacity-95 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">photo_camera</span>
              <span>Ambil Foto</span>
            </button>

            {/* Button 2: Real Gallery Picker */}
            <button
              id="scanner-gallery-picker-btn"
              type="button"
              disabled={isScanning}
              onClick={() => galleryInputRef.current?.click()}
              className="min-h-[50px] p-3 rounded-2xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold flex items-center justify-center gap-2 active:scale-95 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">photo_library</span>
              <span>Pilih Galeri</span>
            </button>

            {/* Button 3: Real Transfer Proof Picker */}
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

      {/* VIEW 2: REVIEW & EDIT EXTRACTED RESULT (Review Before Save) */}
      {reviewData && (
        <div
          id="scanner-review-card"
          className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-6 animate-in fade-in"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[22px] text-secondary">
                verified
              </span>
              <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                Tinjau Hasil Pindaian
              </h2>
            </div>
            <button
              type="button"
              onClick={handleCancelReview}
              className="text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm"
            >
              Batal
            </button>
          </div>

          {/* Uploaded Receipt Image Thumbnail Bar */}
          {activeImage && (
            <div className="p-3 rounded-2xl bg-surface-container flex items-center justify-between gap-3">
              <div
                className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                onClick={() => openLightbox(activeImage)}
              >
                <img
                  src={activeImage}
                  alt="Struk Preview"
                  className="w-14 h-14 rounded-xl object-cover ring-1 ring-surface-container-highest shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-label-md text-label-md text-on-surface font-semibold truncate">
                    {currentFileName || 'Foto Struk'}
                  </p>
                  <p className="font-body-sm text-[11px] text-on-surface-variant">
                    {currentFileSize} • Ketuk untuk zoom gambar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openLightbox(activeImage)}
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
              <p className="font-body-sm text-body-sm text-xs leading-relaxed">
                Transaksi sebesar <strong>{formatIDR(duplicateWarning.amount)}</strong> pada{' '}
                {duplicateWarning.date} di toko "{duplicateWarning.title}" sudah pernah dicatat sebelumnya.
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
                  : 'text-on-surface-variant hover:text-on-surface'
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
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Pemasukan
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Nominal */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Total Nominal (IDR)
                </label>
                {(reviewData.uncertainFields?.includes('amount') || reviewData.isUncertain) && (
                  <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-semibold">
                    Perlu Dikonfirmasi
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-headline-sm text-headline-sm font-bold text-on-surface-variant">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editableNominal}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '');
                    setEditableNominal(clean ? formatNumberIDR(parseInt(clean, 10)) : '');
                  }}
                  className="w-full min-h-[52px] pl-12 pr-4 rounded-xl bg-surface-container-low border border-surface-container font-headline-sm text-headline-sm font-bold text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                />
              </div>
            </div>

            {/* Merchant / Nama Toko */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Nama Toko / Merchant / Sumber
                </label>
                {reviewData.uncertainFields?.includes('merchant') && (
                  <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-semibold">
                    Perlu Dikonfirmasi
                  </span>
                )}
              </div>
              <input
                type="text"
                value={editableMerchant}
                onChange={(e) => setEditableMerchant(e.target.value)}
                placeholder="Contoh: Superindo, Starbucks, BCA Transfer"
                className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
              />
            </div>

            {/* Category & Payment Method */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                    Kategori
                  </label>
                  {reviewData.uncertainFields?.includes('category') && (
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-semibold">
                      Perlu Dikonfirmasi
                    </span>
                  )}
                </div>
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
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-semibold">
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

            {/* Scanned Items Accordion if any */}
            {reviewData.items && reviewData.items.length > 0 && (
              <div className="p-3 rounded-2xl bg-surface-container-low border border-surface-container space-y-2">
                <button
                  type="button"
                  onClick={() => setShowItemDetails(!showItemDetails)}
                  className="w-full flex items-center justify-between text-left font-label-md text-label-md font-semibold text-on-surface"
                >
                  <span>Rincian Item ({reviewData.items.length} terdeteksi)</span>
                  <span className="material-symbols-outlined text-[18px]">
                    {showItemDetails ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                {showItemDetails && (
                  <div className="divide-y divide-surface-container pt-1 space-y-1">
                    {reviewData.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs py-1.5">
                        <span className="text-on-surface-variant truncate max-w-[200px]">
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
                onClick={() => galleryInputRef.current?.click()}
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
      <div id="scanned-receipts-history" className="space-y-3">
        <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
          Riwayat Struk Terakhir
        </h2>

        {scannedReceipts.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-surface-container-lowest border border-surface-container space-y-2">
            <span className="material-symbols-outlined text-[36px] text-on-surface-variant">
              receipt_long
            </span>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Belum ada struk yang dipindai
            </p>
            <p className="font-body-sm text-[12px] text-on-surface-variant/80">
              Foto struk kasir atau screenshot pembayaran Anda untuk menguji AI Vision scanner.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {scannedReceipts.slice(0, 10).map((rc) => (
              <div
                key={rc.id}
                className="p-3.5 rounded-2xl bg-surface-container-lowest border border-surface-container flex items-center justify-between gap-3 shadow-xs hover:border-outline-variant transition-colors"
              >
                <div
                  className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                  onClick={() => openLightbox(rc.imageUrl)}
                >
                  <img
                    src={rc.imageUrl}
                    alt={rc.merchant}
                    className="w-12 h-12 rounded-xl object-cover ring-1 ring-surface-container-highest shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-label-md text-label-md text-on-surface font-semibold truncate">
                      {rc.merchant}
                    </p>
                    <p className="font-body-sm text-[11px] text-on-surface-variant">
                      {rc.date} • {rc.category}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-stat-tabular text-headline-sm font-semibold text-error">
                    -{formatIDR(rc.amount)}
                  </p>
                  <span className="inline-block text-[10px] font-semibold text-secondary bg-secondary-container px-2 py-0.5 rounded-full">
                    {rc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
