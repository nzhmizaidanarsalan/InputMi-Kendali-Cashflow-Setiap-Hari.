import React, { useEffect, useRef, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { DocumentType, ReceiptScanResult, SourceMode, Transaction, TransactionType } from '../types';
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
  const [scanErrorCode, setScanErrorCode] = useState<string | null>(null);

  // Active uploaded image state for preview and saving
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState<string | null>(null);
  const [currentDataUrl, setCurrentDataUrl] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [currentFileSize, setCurrentFileSize] = useState<string>('');
  const [lastSource, setLastSource] = useState<'kamera' | 'galeri' | 'transfer'>('kamera');
  const [lastSourceMode, setLastSourceMode] = useState<SourceMode>('camera');

  // Extracted data state for review and editing
  const [reviewData, setReviewData] = useState<ReceiptScanResult | null>(null);
  const [docType, setDocType] = useState<DocumentType>('receipt');
  const [isManualFallback, setIsManualFallback] = useState<boolean>(false);
  const [editableNominal, setEditableNominal] = useState<string>('');
  const [editableMerchant, setEditableMerchant] = useState<string>('');
  const [editableBankOrWallet, setEditableBankOrWallet] = useState<string>('');
  const [editableSender, setEditableSender] = useState<string>('');
  const [editableRecipient, setEditableRecipient] = useState<string>('');
  const [editableInvoiceNumber, setEditableInvoiceNumber] = useState<string>('');
  const [editableDueDate, setEditableDueDate] = useState<string>('');
  const [editableCategory, setEditableCategory] = useState<string>('Belanja Harian');
  const [editablePayment, setEditablePayment] = useState<string>('QRIS BCA');
  const [editableDate, setEditableDate] = useState<string>(getCurrentDateStr());
  const [editableTime, setEditableTime] = useState<string>(getCurrentTimeStr());
  const [editableDescription, setEditableDescription] = useState<string>('');
  const [editableRefNo, setEditableRefNo] = useState<string>('');
  const [editableNotes, setEditableNotes] = useState<string>('');
  const [editableType, setEditableType] = useState<TransactionType>('expense');
  const [duplicateWarning, setDuplicateWarning] = useState<Transaction | null>(null);
  const [showItemDetails, setShowItemDetails] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const nominalInputRef = useRef<HTMLInputElement>(null);

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

    const sourceMode: SourceMode =
      source === 'kamera' ? 'camera' : source === 'transfer' ? 'transfer' : 'gallery';

    setLastSource(source);
    setLastSourceMode(sourceMode);
    setIsScanning(true);
    setScanError(null);
    setDuplicateWarning(null);

    let processed;
    try {
      // 1. Process image: downscale, convert to clean JPEG, validate format & size, safe preview
      processed = await processImageForOcr(file, source);

      // Clean up previous preview URL to prevent memory leaks
      if (currentPreviewUrl) {
        revokeSafePreviewUrl(currentPreviewUrl);
      }

      setCurrentPreviewUrl(processed.previewUrl);
      setCurrentDataUrl(processed.dataUrl);
      setCurrentFileName(processed.fileName);
      setCurrentFileSize(processed.fileSizeStr);
    } catch (processErr: any) {
      console.error('Image processing error:', processErr);
      const friendlyMsg =
        processErr?.message ||
        'Format file tidak didukung. Harap pilih foto struk atau screenshot berformat JPG, JPEG, PNG, atau WEBP.';
      setScanError(friendlyMsg);
      showToast(friendlyMsg);
      setIsScanning(false);
      return;
    }

    try {
      // 2. Call OCR backend API with clean base64 data and contextual sourceMode
      let response: Response;
      try {
        response = await fetch('/api/scan-receipt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageBase64: processed.cleanBase64,
            mimeType: processed.mimeType,
            sourceMode,
          }),
        });
      } catch (fetchErr: any) {
        console.error('Fetch to /api/scan-receipt failed:', fetchErr);
        const errObj = new Error('Endpoint OCR tidak dapat dihubungi (AI_SERVER_UNAVAILABLE). Silakan input manual atau periksa konfigurasi jaringan.');
        (errObj as any).errorCode = 'AI_SERVER_UNAVAILABLE';
        throw errObj;
      }

      const contentType = response.headers.get('content-type') || '';
      let result: any = null;

      if (contentType.includes('application/json')) {
        try {
          result = await response.json();
        } catch (jsonErr) {
          console.error('Failed to parse JSON response:', jsonErr);
        }
      }

      if (!response.ok || !result || !result.success) {
        let code = result?.errorCode;
        if (!code) {
          if (response.status === 404) code = 'AI_SERVER_UNAVAILABLE';
          else if (response.status === 503) code = 'AI_MODEL_UNAVAILABLE';
          else if (response.status === 400) code = 'INVALID_IMAGE_PAYLOAD';
          else code = 'AI_REQUEST_FAILED';
        }
        const errorMsg = result?.error || `Gagal memindai struk (${code}, status ${response.status}).`;
        const errObj = new Error(errorMsg);
        (errObj as any).errorCode = code;
        throw errObj;
      }

      // 3. Populate review fields from AI
      const extracted: ReceiptScanResult = result.data;
      setReviewData(extracted);

      const detectedDocType: DocumentType =
        extracted.documentType || (sourceMode === 'transfer' ? 'transfer_proof' : 'receipt');
      setDocType(detectedDocType);

      // Practical Confidence Check: High and Medium are successful extractions
      const isLowConfidence = extracted.confidence === 'low';

      const txType =
        extracted.transactionType === 'income' || extracted.type === 'income'
          ? 'income'
          : 'expense';

      setEditableType(txType);
      setEditableNominal(extracted.amount ? formatNumberIDR(extracted.amount) : '');
      setEditableMerchant(extracted.merchant || '');
      setEditableBankOrWallet(
        extracted.bankOrWallet || (detectedDocType === 'transfer_proof' ? 'BCA' : '')
      );
      setEditableSender(extracted.sender || '');
      setEditableRecipient(extracted.recipient || '');
      setEditableInvoiceNumber(extracted.invoiceNumber || '');
      setEditableDueDate(extracted.dueDate || '');
      setEditableCategory(
        extracted.category ||
          (detectedDocType === 'transfer_proof'
            ? (txType === 'income' ? 'Karir & Gaji' : 'Lainnya')
            : (txType === 'income' ? 'Lainnya' : 'Belanja Harian'))
      );
      setEditablePayment(
        extracted.paymentMethod ||
          (detectedDocType === 'transfer_proof'
            ? (extracted.bankOrWallet ? `Transfer ${extracted.bankOrWallet}` : 'Transfer BCA')
            : 'QRIS BCA')
      );
      setEditableDate(extracted.date || getCurrentDateStr());
      setEditableTime(extracted.time || getCurrentTimeStr());
      setEditableDescription(extracted.description || '');
      setEditableRefNo(extracted.referenceNumber || extracted.referenceNo || '');
      setEditableNotes(extracted.notes || '');

      if (isLowConfidence) {
        setIsManualFallback(true);
        setScanErrorCode('OCR_LOW_CONFIDENCE');
        setScanError('Gambar berhasil dimuat, tetapi data belum terbaca dengan yakin.');
        showToast('Gambar berhasil dimuat. Silakan lengkapi data transaksi.');
      } else {
        setIsManualFallback(false);
        setScanErrorCode(null);
        setScanError(null);
        showToast('Bukti transaksi berhasil dipindai oleh AI Vision.');
      }

      // Check for duplicate transaction in database
      if (extracted.amount) {
        const duplicate = checkDuplicateReceipt(
          extracted.amount,
          extracted.date || getCurrentDateStr(),
          extracted.merchant || ''
        );
        if (duplicate) {
          setDuplicateWarning(duplicate);
        }
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      const code = err?.errorCode || 'UNKNOWN_ERROR';
      setScanErrorCode(code);

      let friendlyError = 'Gambar berhasil dimuat, tetapi data belum terbaca dengan yakin.';
      if (code === 'AI_API_KEY_MISSING') {
        friendlyError = 'Kunci API Gemini belum dikonfigurasi (AI_API_KEY_MISSING). Anda dapat menginput transaksi secara manual.';
      } else if (code === 'AI_SERVER_UNAVAILABLE') {
        friendlyError = 'Endpoint server AI tidak dapat dihubungi (AI_SERVER_UNAVAILABLE). Anda dapat menginput transaksi secara manual.';
      } else if (code === 'AI_MODEL_UNAVAILABLE') {
        friendlyError = 'Layanan AI sedang sibuk atau antrean penuh (AI_MODEL_UNAVAILABLE). Silakan input manual atau coba lagi.';
      } else if (code === 'INVALID_IMAGE_PAYLOAD') {
        friendlyError = 'Format gambar tidak dapat dibaca oleh AI (INVALID_IMAGE_PAYLOAD). Silakan input manual atau pilih gambar lain.';
      } else if (err.message && !err.message.includes('Gagal memindai')) {
        friendlyError = err.message;
      }

      const fallbackData: ReceiptScanResult = {
        transactionType: source === 'transfer' ? 'expense' : 'expense',
        type: 'expense',
        amount: null,
        date: getCurrentDateStr(),
        time: getCurrentTimeStr(),
        merchant: '',
        category: 'Belanja Harian',
        paymentMethod: source === 'transfer' ? 'Transfer BCA' : 'Tunai',
        referenceNumber: '',
        referenceNo: '',
        description: '',
        notes: '',
        items: [],
        confidence: 'low',
        isUncertain: true,
        uncertainFields: ['amount', 'merchant', 'category', 'paymentMethod'],
        detectionSummary: friendlyError,
      };

      setReviewData(fallbackData);
      setIsManualFallback(true);
      setEditableType('expense');
      setEditableNominal('');
      setEditableMerchant('');
      setEditableCategory('Belanja Harian');
      setEditablePayment(source === 'transfer' ? 'Transfer BCA' : 'Tunai');
      setEditableDate(getCurrentDateStr());
      setEditableTime(getCurrentTimeStr());
      setEditableDescription('');
      setEditableRefNo('');
      setEditableNotes('');
      setScanError(friendlyError);
      showToast(friendlyError);
    } finally {
      setIsScanning(false);
    }
  };

  // Re-scan the currently loaded photo without re-uploading
  const handleRescanCurrentPhoto = async () => {
    if (!currentDataUrl) {
      handleRetryLastAction();
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setScanErrorCode(null);

    try {
      const cleanBase64 = currentDataUrl.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
      const mimeMatch = currentDataUrl.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

      let response: Response;
      try {
        response = await fetch('/api/scan-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: cleanBase64,
            mimeType,
            sourceMode: lastSourceMode,
          }),
        });
      } catch (fetchErr) {
        const errObj = new Error('Endpoint OCR tidak dapat dihubungi (AI_SERVER_UNAVAILABLE).');
        (errObj as any).errorCode = 'AI_SERVER_UNAVAILABLE';
        throw errObj;
      }

      const contentType = response.headers.get('content-type') || '';
      let result: any = null;

      if (contentType.includes('application/json')) {
        try {
          result = await response.json();
        } catch (jsonErr) {
          console.error('Failed to parse JSON response on rescan:', jsonErr);
        }
      }

      if (!response.ok || !result || !result.success) {
        let code = result?.errorCode;
        if (!code) {
          if (response.status === 404) code = 'AI_SERVER_UNAVAILABLE';
          else if (response.status === 503) code = 'AI_MODEL_UNAVAILABLE';
          else if (response.status === 400) code = 'INVALID_IMAGE_PAYLOAD';
          else code = 'AI_REQUEST_FAILED';
        }
        const errObj = new Error(result?.error || `Gagal membaca struk (${code}).`);
        (errObj as any).errorCode = code;
        throw errObj;
      }

      const extracted: ReceiptScanResult = result.data;
      setReviewData(extracted);

      const detectedDocType: DocumentType =
        extracted.documentType || (lastSourceMode === 'transfer' ? 'transfer_proof' : 'receipt');
      setDocType(detectedDocType);

      const isLowConfidence = extracted.confidence === 'low';

      const txType =
        extracted.transactionType === 'income' || extracted.type === 'income'
          ? 'income'
          : 'expense';

      setEditableType(txType);
      setEditableNominal(extracted.amount ? formatNumberIDR(extracted.amount) : '');
      setEditableMerchant(extracted.merchant || '');
      setEditableBankOrWallet(
        extracted.bankOrWallet || (detectedDocType === 'transfer_proof' ? 'BCA' : '')
      );
      setEditableSender(extracted.sender || '');
      setEditableRecipient(extracted.recipient || '');
      setEditableInvoiceNumber(extracted.invoiceNumber || '');
      setEditableDueDate(extracted.dueDate || '');
      setEditableCategory(
        extracted.category ||
          (detectedDocType === 'transfer_proof'
            ? (txType === 'income' ? 'Karir & Gaji' : 'Lainnya')
            : (txType === 'income' ? 'Lainnya' : 'Belanja Harian'))
      );
      setEditablePayment(
        extracted.paymentMethod ||
          (detectedDocType === 'transfer_proof'
            ? (extracted.bankOrWallet ? `Transfer ${extracted.bankOrWallet}` : 'Transfer BCA')
            : 'QRIS BCA')
      );
      setEditableDate(extracted.date || getCurrentDateStr());
      setEditableTime(extracted.time || getCurrentTimeStr());
      setEditableDescription(extracted.description || '');
      setEditableRefNo(extracted.referenceNumber || extracted.referenceNo || '');
      setEditableNotes(extracted.notes || '');

      if (isLowConfidence) {
        setIsManualFallback(true);
        setScanErrorCode('OCR_LOW_CONFIDENCE');
        setScanError('Gambar berhasil dimuat, tetapi data belum terbaca dengan yakin.');
        showToast('Gambar berhasil dimuat. Silakan lengkapi data transaksi.');
      } else {
        setIsManualFallback(false);
        setScanErrorCode(null);
        setScanError(null);
        showToast('Bukti transaksi berhasil dipindai oleh AI Vision.');
      }
    } catch (err: any) {
      console.error('Rescan error:', err);
      const code = err?.errorCode || 'UNKNOWN_ERROR';
      setScanErrorCode(code);

      let friendlyError = 'Gambar berhasil dimuat, tetapi data belum terbaca dengan yakin.';
      if (code === 'AI_API_KEY_MISSING') {
        friendlyError = 'Kunci API Gemini belum dikonfigurasi (AI_API_KEY_MISSING). Anda dapat menginput transaksi secara manual.';
      } else if (code === 'AI_SERVER_UNAVAILABLE') {
        friendlyError = 'Endpoint server AI tidak dapat dihubungi (AI_SERVER_UNAVAILABLE). Anda dapat menginput transaksi secara manual.';
      } else if (code === 'AI_MODEL_UNAVAILABLE') {
        friendlyError = 'Layanan AI sedang sibuk (AI_MODEL_UNAVAILABLE). Silakan input manual atau coba lagi.';
      } else if (code === 'INVALID_IMAGE_PAYLOAD') {
        friendlyError = 'Format gambar tidak dapat dibaca oleh AI (INVALID_IMAGE_PAYLOAD). Silakan input manual atau pilih gambar lain.';
      } else if (err?.message && !err.message.includes('Gagal memindai')) {
        friendlyError = err.message;
      }

      setIsManualFallback(true);
      setScanError(friendlyError);
      showToast(friendlyError);
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

  // Status badges: "Terdeteksi", "Perlu Dikonfirmasi", "Tidak Terbaca" (Requirement 6)
  const getFieldStatusBadge = (fieldName: string, value: string | number | undefined) => {
    const isUncertain = reviewData?.isUncertain && reviewData.uncertainFields?.includes(fieldName);
    const isEmpty =
      value === undefined ||
      value === null ||
      value === '' ||
      value === 0 ||
      value === '0';

    if (isUncertain) {
      return (
        <span className="text-[10px] text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
          Perlu Dikonfirmasi
        </span>
      );
    }
    if (isEmpty) {
      return (
        <span className="text-[10px] text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full font-semibold">
          Tidak Terbaca
        </span>
      );
    }
    return (
      <span className="text-[10px] text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
        Terdeteksi
      </span>
    );
  };

  // Save Transaction (Requirement 7 & 9)
  const handleSaveTransaction = async () => {
    if (isSaving) return;

    const amountNum = parseIDR(editableNominal);

    if (amountNum <= 0) {
      showToast('Nominal harus lebih besar dari 0.');
      nominalInputRef.current?.focus();
      return;
    }

    const finalTitle =
      editableMerchant.trim() ||
      (docType === 'transfer_proof'
        ? editableRecipient.trim()
          ? `Transfer ke ${editableRecipient.trim()}`
          : editableBankOrWallet.trim()
          ? `Transfer ${editableBankOrWallet.trim()}`
          : 'Bukti Transfer'
        : docType === 'invoice'
        ? 'Faktur Tagihan'
        : 'Struk Belanja');

    if (!finalTitle.trim()) {
      showToast('Harap isi nama merchant atau sumber transaksi.');
      return;
    }

    setIsSaving(true);

    try {
      const noteParts: string[] = [];
      if (docType === 'transfer_proof') {
        if (editableBankOrWallet.trim()) noteParts.push(`Bank/E-Wallet: ${editableBankOrWallet.trim()}`);
        if (editableSender.trim()) noteParts.push(`Pengirim: ${editableSender.trim()}`);
        if (editableRecipient.trim()) noteParts.push(`Penerima: ${editableRecipient.trim()}`);
      } else if (docType === 'invoice') {
        if (editableInvoiceNumber.trim()) noteParts.push(`No. Faktur: ${editableInvoiceNumber.trim()}`);
        if (editableDueDate.trim()) noteParts.push(`Jatuh Tempo: ${editableDueDate.trim()}`);
      }
      if (editableRefNo.trim()) noteParts.push(`Ref: ${editableRefNo.trim()}`);
      if (editableDescription.trim()) noteParts.push(editableDescription.trim());
      if (editableNotes.trim()) noteParts.push(editableNotes.trim());

      const combinedNote = noteParts.length > 0 ? noteParts.join(' • ') : null;

      const rawReceiptUrl = currentDataUrl || currentPreviewUrl || null;
      const cleanFileName = currentFileName || null;
      const cleanFileSize = currentFileSize || null;
      const cleanItems =
        reviewData?.items && Array.isArray(reviewData.items) ? reviewData.items : [];

      // Save to transactions (persisted to Firestore when authenticated, and localStorage)
      const savedTx = await addTransaction({
        type: editableType,
        amount: amountNum,
        title: finalTitle.trim(),
        category: editableCategory,
        paymentMethod: editablePayment,
        date: editableDate,
        time: editableTime,
        note: combinedNote,
        receiptUrl: rawReceiptUrl,
        receiptFileName: cleanFileName,
        receiptFileSize: cleanFileSize,
        items: cleanItems,
      });

      // Save to scanned receipts history with the permanent storage URL or local preview
      if (rawReceiptUrl) {
        try {
          await addScannedReceiptRecord({
            merchant: finalTitle.trim(),
            amount: amountNum,
            date: editableDate,
            time: editableTime,
            imageUrl: savedTx?.receiptUrl || (rawReceiptUrl.startsWith('http') ? rawReceiptUrl : ''),
            fileName: currentFileName || 'struk.jpg',
            fileSize: currentFileSize || '0 KB',
            status: 'Tersimpan',
            category: editableCategory,
            paymentMethod: editablePayment,
          });
        } catch (recordErr) {
          console.warn('Non-fatal scanned receipt history save error:', recordErr);
        }
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
      setIsManualFallback(false);
      setScanErrorCode(null);
      showToast('Transaksi struk berhasil dicatat ke Cashflow!');
      setActiveTab('cashflow');
    } catch (err: any) {
      console.error('Save transaction error:', err);
      showToast('Gagal menyimpan: ' + (err?.message || 'Terjadi kesalahan saat menyimpan'));
    } finally {
      setIsSaving(false);
    }
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
    setScanErrorCode(null);
    setIsManualFallback(false);
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
                {isManualFallback ? 'edit_note' : 'verified'}
              </span>
              <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                {isManualFallback ? 'Input Detail Transaksi' : 'Tinjau Hasil Pindaian'}
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

          {/* Fallback Banner if OCR was uncertain or encountered an issue (Requirement 8) */}
          {isManualFallback && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[22px] text-amber-700 shrink-0 mt-0.5">
                  {scanErrorCode === 'AI_API_KEY_MISSING' || scanErrorCode === 'AI_SERVER_UNAVAILABLE' ? 'warning' : 'info'}
                </span>
                <div className="space-y-1">
                  <p className="font-semibold text-label-md text-amber-950">
                    {scanErrorCode === 'AI_API_KEY_MISSING'
                      ? 'Kunci API AI Belum Dikonfigurasi (AI_API_KEY_MISSING)'
                      : scanErrorCode === 'AI_SERVER_UNAVAILABLE'
                      ? 'Server AI Tidak Terjangkau (AI_SERVER_UNAVAILABLE)'
                      : scanErrorCode === 'AI_MODEL_UNAVAILABLE'
                      ? 'Layanan AI Sedang Sibuk (AI_MODEL_UNAVAILABLE)'
                      : scanErrorCode === 'INVALID_IMAGE_PAYLOAD'
                      ? 'Format Gambar Tidak Sesuai (INVALID_IMAGE_PAYLOAD)'
                      : scanErrorCode === 'INVALID_AI_RESPONSE'
                      ? 'Respon AI Tidak Valid (INVALID_AI_RESPONSE)'
                      : 'Gambar berhasil dimuat, tetapi data belum terbaca dengan yakin.'}
                  </p>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    {scanError || 'Foto struk tetap terlampir dengan aman. Anda dapat melengkapi nominal dan merchant di bawah, memindai ulang, atau memilih foto yang lebih jelas.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => nominalInputRef.current?.focus()}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-label-sm text-label-sm font-semibold flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  <span>Isi Manual</span>
                </button>
                <button
                  type="button"
                  onClick={handleRescanCurrentPhoto}
                  disabled={isScanning}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-label-sm text-label-sm font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">sync</span>
                  <span>{isScanning ? 'Memindai...' : 'Coba Scan Lagi'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-amber-50 text-amber-900 border border-amber-200 font-label-sm text-label-sm font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">photo_library</span>
                  <span>Pilih Gambar Lain</span>
                </button>
              </div>
            </div>
          )}

          {/* Uploaded Receipt Image Thumbnail Bar (Requirement 7: Lampiran Gambar) */}
          {activeImage && (
            <div className="p-3 rounded-2xl bg-surface-container flex items-center justify-between gap-3">
              <div
                className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                onClick={() => openLightbox(activeImage)}
              >
                <img
                  src={activeImage}
                  alt="Struk Preview"
                  className="w-14 h-14 rounded-xl object-cover ring-1 ring-surface-container-highest shrink-0 shadow-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-label-md text-label-md text-on-surface font-semibold truncate">
                    {currentFileName || 'Foto Lampiran Struk'}
                  </p>
                  <p className="font-body-sm text-[11px] text-on-surface-variant">
                    {currentFileSize} • Ketuk untuk melihat gambar penuh
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openLightbox(activeImage)}
                  className="min-h-[34px] px-3 rounded-full bg-surface-container-lowest hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                  <span>Zoom</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="min-h-[34px] px-2.5 rounded-full bg-surface-container-lowest hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm"
                  title="Ganti Foto"
                >
                  <span className="material-symbols-outlined text-[16px]">photo_library</span>
                </button>
              </div>
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
                {duplicateWarning.date} di "{duplicateWarning.title}" sudah pernah dicatat sebelumnya.
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

          {/* Document Type Indicator & Selector */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-surface-container-low border border-surface-container">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-secondary">
                {docType === 'transfer_proof'
                  ? 'payments'
                  : docType === 'invoice'
                  ? 'receipt_long'
                  : 'shopping_bag'}
              </span>
              <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                {docType === 'transfer_proof'
                  ? 'Bukti Transfer'
                  : docType === 'invoice'
                  ? 'Faktur / Tagihan'
                  : docType === 'payment_screenshot'
                  ? 'Pembayaran QRIS / Digital'
                  : 'Struk Belanja'}
              </span>
            </div>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocumentType)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-container-lowest border border-surface-container text-on-surface focus:ring-1 focus:ring-primary focus:outline-hidden"
            >
              <option value="receipt">Struk Belanja</option>
              <option value="transfer_proof">Bukti Transfer</option>
              <option value="invoice">Invoice / Faktur</option>
              <option value="payment_screenshot">Pembayaran Digital</option>
            </select>
          </div>

          {/* Form Fields - Conditionally customized based on documentType */}
          <div className="space-y-4">
            {/* === CASE 1: BUKTI TRANSFER (bank/wallet, amount, sender/recipient, reference, date) === */}
            {docType === 'transfer_proof' ? (
              <>
                {/* Nominal */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Nominal Transfer (IDR)
                    </label>
                    {getFieldStatusBadge('amount', editableNominal)}
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-headline-sm text-headline-sm font-bold text-on-surface-variant">
                      Rp
                    </span>
                    <input
                      id="receipt-nominal-input"
                      ref={nominalInputRef}
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={editableNominal}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\D/g, '');
                        setEditableNominal(clean ? formatNumberIDR(parseInt(clean, 10)) : '');
                      }}
                      className="w-full min-h-[52px] pl-12 pr-4 rounded-xl bg-surface-container-low border border-surface-container font-headline-sm text-headline-sm font-bold text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden font-stat-tabular"
                    />
                  </div>
                </div>

                {/* Bank / E-Wallet */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Bank / Dompet Digital
                    </label>
                    {getFieldStatusBadge('bankOrWallet', editableBankOrWallet || editablePayment)}
                  </div>
                  <input
                    id="receipt-bank-input"
                    type="text"
                    value={editableBankOrWallet}
                    onChange={(e) => {
                      setEditableBankOrWallet(e.target.value);
                      if (e.target.value) setEditablePayment(`Transfer ${e.target.value}`);
                    }}
                    placeholder="Contoh: BCA, Mandiri, BRI, GoPay, DANA, Flip"
                    className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                {/* Sender & Recipient */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                        Pengirim (Opsional)
                      </label>
                      {getFieldStatusBadge('sender', editableSender)}
                    </div>
                    <input
                      id="receipt-sender-input"
                      type="text"
                      value={editableSender}
                      onChange={(e) => setEditableSender(e.target.value)}
                      placeholder="Nama / Rekening Pengirim"
                      className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                        Penerima (Tujuan)
                      </label>
                      {getFieldStatusBadge('recipient', editableRecipient || editableMerchant)}
                    </div>
                    <input
                      id="receipt-recipient-input"
                      type="text"
                      value={editableRecipient || editableMerchant}
                      onChange={(e) => {
                        setEditableRecipient(e.target.value);
                        setEditableMerchant(e.target.value);
                      }}
                      placeholder="Nama Penerima / No. Rekening"
                      className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Reference Number */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Nomor Referensi / Ref ID
                    </label>
                    {getFieldStatusBadge('referenceNumber', editableRefNo)}
                  </div>
                  <input
                    id="receipt-ref-input"
                    type="text"
                    value={editableRefNo}
                    onChange={(e) => setEditableRefNo(e.target.value)}
                    placeholder="Contoh: 2026090412345 / Ref ID Transaksi"
                    className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                        Tanggal Transfer
                      </label>
                      {getFieldStatusBadge('date', editableDate)}
                    </div>
                    <input
                      id="receipt-date-input"
                      type="date"
                      value={editableDate}
                      onChange={(e) => setEditableDate(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                        Waktu
                      </label>
                      {getFieldStatusBadge('time', editableTime)}
                    </div>
                    <input
                      id="receipt-time-input"
                      type="time"
                      value={editableTime}
                      onChange={(e) => setEditableTime(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Category & Description */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Kategori Transaksi
                    </label>
                    <select
                      id="receipt-category-select"
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
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Berita / Keterangan Transfer
                    </label>
                    <input
                      id="receipt-description-input"
                      type="text"
                      value={editableDescription}
                      onChange={(e) => setEditableDescription(e.target.value)}
                      placeholder="Contoh: Bayar sewa, Belanja bulanan, Gaji"
                      className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                    />
                  </div>
                </div>
              </>
            ) : docType === 'invoice' ? (
              /* === CASE 2: INVOICE (merchant, invoice number, amount, due date) === */
              <>
                {/* Vendor / Merchant */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Penerbit / Vendor Tagihan
                    </label>
                    {getFieldStatusBadge('merchant', editableMerchant)}
                  </div>
                  <input
                    id="receipt-merchant-input"
                    type="text"
                    value={editableMerchant}
                    onChange={(e) => setEditableMerchant(e.target.value)}
                    placeholder="Contoh: PLN, PDAM, Indihome, PT Vendor Sejahtera"
                    className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                {/* Invoice Number */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Nomor Invoice / Faktur
                    </label>
                    {getFieldStatusBadge('invoiceNumber', editableInvoiceNumber || editableRefNo)}
                  </div>
                  <input
                    id="receipt-invoice-input"
                    type="text"
                    value={editableInvoiceNumber || editableRefNo}
                    onChange={(e) => {
                      setEditableInvoiceNumber(e.target.value);
                      setEditableRefNo(e.target.value);
                    }}
                    placeholder="Contoh: INV/2026/09/001"
                    className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                {/* Total Tagihan (Amount) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Total Nominal Tagihan (IDR)
                    </label>
                    {getFieldStatusBadge('amount', editableNominal)}
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-headline-sm text-headline-sm font-bold text-on-surface-variant">
                      Rp
                    </span>
                    <input
                      id="receipt-nominal-input"
                      ref={nominalInputRef}
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={editableNominal}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\D/g, '');
                        setEditableNominal(clean ? formatNumberIDR(parseInt(clean, 10)) : '');
                      }}
                      className="w-full min-h-[52px] pl-12 pr-4 rounded-xl bg-surface-container-low border border-surface-container font-headline-sm text-headline-sm font-bold text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden font-stat-tabular"
                    />
                  </div>
                </div>

                {/* Due Date & Invoice Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                        Tanggal Jatuh Tempo
                      </label>
                      {getFieldStatusBadge('dueDate', editableDueDate)}
                    </div>
                    <input
                      id="receipt-duedate-input"
                      type="date"
                      value={editableDueDate}
                      onChange={(e) => setEditableDueDate(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                        Tanggal Faktur Terbit
                      </label>
                      {getFieldStatusBadge('date', editableDate)}
                    </div>
                    <input
                      id="receipt-date-input"
                      type="date"
                      value={editableDate}
                      onChange={(e) => setEditableDate(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Category & Description */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Kategori
                    </label>
                    <select
                      id="receipt-category-select"
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
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Deskripsi Layanan
                    </label>
                    <input
                      id="receipt-description-input"
                      type="text"
                      value={editableDescription}
                      onChange={(e) => setEditableDescription(e.target.value)}
                      placeholder="Contoh: Tagihan Internet Kantor Bulan September"
                      className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                    />
                  </div>
                </div>
              </>
            ) : (
              /* === CASE 3: STRUK BELANJA (merchant, amount, date, payment method, category) === */
              <>
                {/* Merchant */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Nama Toko / Merchant
                    </label>
                    {getFieldStatusBadge('merchant', editableMerchant)}
                  </div>
                  <input
                    id="receipt-merchant-input"
                    type="text"
                    value={editableMerchant}
                    onChange={(e) => setEditableMerchant(e.target.value)}
                    placeholder="Contoh: Indomaret, Alfamart, SPBU Pertamina, Starbucks"
                    className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                {/* Amount (Total IDR) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Total Nominal (IDR)
                    </label>
                    {getFieldStatusBadge('amount', editableNominal)}
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-headline-sm text-headline-sm font-bold text-on-surface-variant">
                      Rp
                    </span>
                    <input
                      id="receipt-nominal-input"
                      ref={nominalInputRef}
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={editableNominal}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\D/g, '');
                        setEditableNominal(clean ? formatNumberIDR(parseInt(clean, 10)) : '');
                      }}
                      className="w-full min-h-[52px] pl-12 pr-4 rounded-xl bg-surface-container-low border border-surface-container font-headline-sm text-headline-sm font-bold text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden font-stat-tabular"
                    />
                  </div>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                        Tanggal
                      </label>
                      {getFieldStatusBadge('date', editableDate)}
                    </div>
                    <input
                      id="receipt-date-input"
                      type="date"
                      value={editableDate}
                      onChange={(e) => setEditableDate(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                        Waktu
                      </label>
                      {getFieldStatusBadge('time', editableTime)}
                    </div>
                    <input
                      id="receipt-time-input"
                      type="time"
                      value={editableTime}
                      onChange={(e) => setEditableTime(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Category & Payment Method */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                        Kategori
                      </label>
                      {getFieldStatusBadge('category', editableCategory)}
                    </div>
                    <select
                      id="receipt-category-select"
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
                      {getFieldStatusBadge('paymentMethod', editablePayment)}
                    </div>
                    <select
                      id="receipt-payment-select"
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

                {/* Description & Reference No */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Deskripsi Transaksi (Opsional)
                    </label>
                    <input
                      id="receipt-description-input"
                      type="text"
                      value={editableDescription}
                      onChange={(e) => setEditableDescription(e.target.value)}
                      placeholder="Contoh: Belanja mingguan, Makan siang"
                      className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Nomor Bon / Ref (Opsional)
                    </label>
                    <input
                      id="receipt-ref-input"
                      type="text"
                      value={editableRefNo}
                      onChange={(e) => setEditableRefNo(e.target.value)}
                      placeholder="Contoh: No. Bon / POS ID"
                      className="w-full min-h-[44px] px-3 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
                    />
                  </div>
                </div>
              </>
            )}

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
                id="receipt-notes-input"
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
              disabled={isSaving}
              onClick={handleSaveTransaction}
              className="w-full min-h-[50px] rounded-2xl bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold flex items-center justify-center gap-2 active:scale-95 shadow-md hover:opacity-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Menyimpan Transaksi...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">save</span>
                  <span>Simpan Transaksi</span>
                </>
              )}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRescanCurrentPhoto}
                disabled={isScanning}
                className="flex-1 min-h-[42px] rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">sync</span>
                <span>Pindai Ulang</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex-1 min-h-[42px] rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">photo_library</span>
                <span>Ganti Foto</span>
              </button>
              <button
                type="button"
                onClick={handleCancelReview}
                className="min-h-[42px] px-4 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium transition-colors"
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
