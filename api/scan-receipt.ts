import { GoogleGenAI } from '@google/genai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
  maxDuration: 60,
};

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      errorCode: 'METHOD_NOT_ALLOWED',
      error: 'Hanya metode POST yang didukung.',
    });
  }

  const { imageBase64, mimeType = 'image/jpeg', sourceMode = 'gallery' } = req.body || {};

  // Validate sourceMode
  const validSourceMode: 'camera' | 'gallery' | 'transfer' =
    sourceMode === 'camera' || sourceMode === 'transfer' ? sourceMode : 'gallery';

  // Validate clean base64 image
  const cleanBase64 = String(imageBase64 || '')
    .replace(/^data:[^;]+;base64,/, '')
    .replace(/\s/g, '');

  const cleanMime =
    typeof mimeType === 'string' && mimeType.startsWith('image/')
      ? mimeType.toLowerCase()
      : 'image/jpeg';

  const supportedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

  if (!cleanBase64 || cleanBase64.length < 100 || !supportedMimes.includes(cleanMime)) {
    console.log('[OCR Diagnostics]', JSON.stringify({
      apiRouteReached: true,
      sourceMode: validSourceMode,
      mimeType: cleanMime,
      fileSizeApproxBytes: cleanBase64 ? Math.round(cleanBase64.length * 0.75) : 0,
      modelSelected: 'none',
      geminiRequestStatus: 'REJECTED',
      geminiResponseReceived: false,
      documentType: 'unknown',
      detectedFieldCount: 0,
      finalOcrStatus: 'INVALID_IMAGE_PAYLOAD',
    }));

    return res.status(400).json({
      success: false,
      errorCode: 'INVALID_IMAGE_PAYLOAD',
      error: 'Data gambar tidak valid atau format tidak didukung (gunakan JPG, PNG, atau WEBP).',
    });
  }

  // Resolve API key
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    console.log('[OCR Diagnostics]', JSON.stringify({
      apiRouteReached: true,
      sourceMode: validSourceMode,
      mimeType: cleanMime,
      fileSizeApproxBytes: Math.round(cleanBase64.length * 0.75),
      modelSelected: 'none',
      geminiRequestStatus: 'ABORTED_NO_API_KEY',
      geminiResponseReceived: false,
      documentType: 'unknown',
      detectedFieldCount: 0,
      finalOcrStatus: 'AI_API_KEY_MISSING',
    }));

    return res.status(503).json({
      success: false,
      errorCode: 'AI_API_KEY_MISSING',
      error: 'Kunci API Gemini (GEMINI_API_KEY) belum dikonfigurasi di server produksi Vercel. Silakan tambahkan GEMINI_API_KEY pada Vercel Project Settings.',
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'inputmi-production',
        },
      },
    });

    // Contextual instructions based on sourceMode
    let sourceModeContextInstruction = '';
    if (validSourceMode === 'transfer') {
      sourceModeContextInstruction = `Pengguna mengunggah gambar melalui mode 'Bukti Transfer' (sourceMode="transfer").
Prioritas dugaan awal: Bukti transfer bank (BCA, Mandiri, BRI, BNI, Jago, Seabank, dll), konfirmasi e-wallet (GoPay, OVO, DANA, ShopeePay), tangkapan layar transaksi digital, atau pembayaran QRIS.
Catatan: Verifikasi visual dokumen tetap menjadi penentu utama. Jika secara visual gambar ternyata struk fisik toko atau faktur, klasifikasikan sesuai tampilan visual sebenarnya.`;
    } else if (validSourceMode === 'camera') {
      sourceModeContextInstruction = `Pengguna mengambil foto langsung dengan kamera (sourceMode="camera").
Kemungkinan besar berupa: Struk fisik kertas belanja toko/minimarket/restoran/SPBU, faktur tagihan fisik, atau cetakan struk EDC/ATM.
Lakukan klasifikasi visual terlebih dahulu.`;
    } else {
      sourceModeContextInstruction = `Pengguna memilih gambar dari galeri perangkat (sourceMode="gallery").
Bisa berupa: Foto struk fisik, tangkapan layar bukti transfer m-banking, bukti pembayaran QRIS/e-wallet, atau unduhan faktur/tagihan.
JANGAN berasumsi bahwa galeri pasti struk belanja. Klasifikasikan berdasarkan konten visual gambar.`;
    }

    const prompt = `Anda adalah asisten AI Vision ahli analitik dan OCR dokumen transaksi keuangan Indonesia.
Analisis gambar dokumen yang diberikan dengan alur penalaran 2 tahap (Two-Stage Reasoning Flow):

====================================================
KONTEKS INPUT PENGGUNA:
sourceMode: "${validSourceMode}"
${sourceModeContextInstruction}

====================================================
TAHAP 1: KLASIFIKASI DOKUMEN (Document Classification)
====================================================
Klasifikasikan dokumen ke dalam salah satu kategori berikut:
- "receipt": Struk fisik toko, minimarket (Indomaret, Alfamart, dll), resto, kafe, SPBU, supermarket.
- "transfer_proof": Bukti transfer m-banking, ATM, internet banking, atau mutasi bank.
- "invoice": Faktur tagihan formal, kwitansi resmi, invoice layanan.
- "payment_screenshot": Tangkapan layar konfirmasi pembayaran QRIS, e-wallet (GoPay, OVO, ShopeePay, DANA), merchant checkout online.
- "financial_document": Dokumen keuangan lainnya yang sah.
- "unknown": Bukan dokumen keuangan, foto buram total, tidak terbaca sama sekali, atau gambar non-finansial.

====================================================
TAHAP 2: EKSTRAKSI DATA SPESIFIK DOKUMEN
====================================================
Ekstraksi data berikut secara akurat:
1. amount: Nominal angka bulat (tanpa Rp, tanpa titik/koma pemisah ribuan). Ambil TOTAL AKHIR yang dibayar/ditransfer.
2. date: Format YYYY-MM-DD. Jika tahun tidak tertera, gunakan tahun saat ini (2026).
3. time: Format HH:mm (24 jam).
4. merchant: Nama toko/restoran/penerima dana/tujuan transfer.
5. bankOrWallet: Nama bank atau e-wallet pengirim/penerima (BCA, Mandiri, BRI, BNI, GoPay, OVO, ShopeePay, DANA, dll).
6. sender: Nama pemilik rekening atau pihak pengirim (khusus bukti transfer).
7. recipient: Nama pemilik rekening atau pihak penerima (khusus bukti transfer).
8. paymentMethod: Metode pembayaran (QRIS, Transfer Bank, Debit, Tunai, GoPay, ShopeePay, OVO, Kartu Kredit).
9. referenceNumber: Nomor referensi transaksi, No. Ref, RRN, atau ID Transaksi.
10. invoiceNumber: Nomor invoice atau nomor tagihan (jika ada).
11. dueDate: Tanggal jatuh tempo jika ini faktur tagihan (YYYY-MM-DD).
12. description: Catatan transfer, berita transaksi, atau rincian singkat.
13. category: Kategori pengeluaran/pemasukan yang paling cocok di Indonesia:
    - 'Kuliner' (makanan, minuman, resto, kafe)
    - 'Belanja Harian' (minimarket, supermarket, sembako)
    - 'Transportasi' (bensin, tol, tiket, ojol)
    - 'Tagihan & Langganan' (listrik, air, wifi, pulsa, sewa)
    - 'Hiburan' (game, bioskop, rekreasi)
    - 'Kesehatan' (obat, dokter, rumah sakit)
    - 'Pendidikan' (sekolah, kursus, buku)
    - 'Karir & Gaji' (pemasukan gaji, upah)
    - 'Bisnis' (hasil penjualan, modal usaha)
    - 'Investasi' (reksadana, saham, emas)
    - 'Hadiah & Bonus' (uang saku, THR, hadiah)
    - 'Lainnya'
14. transactionType: 'expense' (pengeluaran) atau 'income' (pemasukan/dana masuk).
15. status: Status transaksi ('Berhasil', 'Sukses', 'Pending', 'Gagal').
16. items: Daftar item belanja jika tertera (array of { name, price, qty }).

KEMBALIKAN HANYA JSON VALID DENGAN SKEMA PERSIS:
{
  "documentType": "receipt" | "transfer_proof" | "invoice" | "payment_screenshot" | "financial_document" | "unknown",
  "transactionType": "expense" | "income" | "unknown",
  "amount": number | null,
  "date": "YYYY-MM-DD" | null,
  "time": "HH:mm" | null,
  "merchant": string | null,
  "bankOrWallet": string | null,
  "sender": string | null,
  "recipient": string | null,
  "paymentMethod": string | null,
  "referenceNumber": string | null,
  "invoiceNumber": string | null,
  "dueDate": string | null,
  "description": string | null,
  "category": string | null,
  "status": string | null,
  "items": [
    { "name": string, "price": number, "qty": number }
  ]
}`;

    // Supported, non-deprecated multimodal Gemini models with automatic fallback
    // gemini-3.1-flash-lite has the highest availability and lowest latency
    const CANDIDATE_MODELS = [
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
      'gemini-3.8-flash',
    ];

    let responseText: string | null = null;
    let usedModel: string | null = null;
    let lastModelError: any = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const result = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: cleanMime,
                  data: cleanBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
          },
        });

        if (result.text && result.text.trim()) {
          responseText = result.text.trim();
          usedModel = modelName;
          break;
        }
      } catch (modelErr: any) {
        lastModelError = modelErr;
        console.warn(`[OCR Diagnostics] Model ${modelName} error:`, modelErr?.message || modelErr);
      }
    }

    if (!responseText) {
      const errMsg = String(lastModelError?.message || '');
      const isOverloadedOrUnavailable =
        errMsg.includes('503') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('high demand') ||
        errMsg.includes('429') ||
        errMsg.includes('RESOURCE_EXHAUSTED');

      const errorCode = isOverloadedOrUnavailable ? 'AI_MODEL_UNAVAILABLE' : 'AI_REQUEST_FAILED';
      const friendlyMessage = isOverloadedOrUnavailable
        ? 'Layanan model AI sedang mengalami lonjakan beban atau kuota tercapai sementara. Silakan coba kembali sesaat lagi atau gunakan tombol Isi Manual.'
        : 'Permintaan ke layanan AI Vision gagal diproses. Silakan gunakan pengisian manual.';

      console.log('[OCR Diagnostics]', JSON.stringify({
        apiRouteReached: true,
        sourceMode: validSourceMode,
        mimeType: cleanMime,
        fileSizeApproxBytes: Math.round(cleanBase64.length * 0.75),
        modelSelected: usedModel || 'none',
        geminiRequestStatus: 'FAILED',
        geminiResponseReceived: false,
        documentType: 'unknown',
        detectedFieldCount: 0,
        finalOcrStatus: errorCode,
      }));

      return res.status(isOverloadedOrUnavailable ? 503 : 502).json({
        success: false,
        errorCode,
        error: friendlyMessage,
        details: process.env.NODE_ENV !== 'production' ? errMsg : undefined,
      });
    }

    // Parse JSON
    let parsed: any = null;
    try {
      const cleanJsonStr = responseText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      parsed = JSON.parse(cleanJsonStr);
    } catch (jsonErr) {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = null;
        }
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      console.log('[OCR Diagnostics]', JSON.stringify({
        apiRouteReached: true,
        sourceMode: validSourceMode,
        mimeType: cleanMime,
        fileSizeApproxBytes: Math.round(cleanBase64.length * 0.75),
        modelSelected: usedModel,
        geminiRequestStatus: 'SUCCESS',
        geminiResponseReceived: true,
        documentType: 'unknown',
        detectedFieldCount: 0,
        finalOcrStatus: 'INVALID_AI_RESPONSE',
      }));

      return res.status(502).json({
        success: false,
        errorCode: 'INVALID_AI_RESPONSE',
        error: 'Format data respon dari model AI tidak dapat diurai. Silakan coba lagi atau isi data secara manual.',
      });
    }

    // Normalization
    let numericAmount: number | null = null;
    if (typeof parsed.amount === 'number' && !isNaN(parsed.amount) && parsed.amount > 0) {
      numericAmount = Math.round(parsed.amount);
    } else if (typeof parsed.amount === 'string') {
      const digitsOnly = parsed.amount.replace(/[^\d]/g, '');
      if (digitsOnly.length > 0) {
        const pNum = parseInt(digitsOnly, 10);
        if (!isNaN(pNum) && pNum > 0) {
          numericAmount = pNum;
        }
      }
    }

    const allowedDocTypes = [
      'receipt',
      'transfer_proof',
      'invoice',
      'payment_screenshot',
      'financial_document',
      'unknown',
    ];
    let docType =
      typeof parsed.documentType === 'string' && allowedDocTypes.includes(parsed.documentType.toLowerCase())
        ? parsed.documentType.toLowerCase()
        : 'unknown';

    if (docType === 'unknown' && validSourceMode === 'transfer') {
      if (parsed.bankOrWallet || parsed.recipient || parsed.sender) {
        docType = 'transfer_proof';
      }
    }

    const merchantStr = typeof parsed.merchant === 'string' && parsed.merchant.trim() ? parsed.merchant.trim() : null;
    const bankOrWalletStr = typeof parsed.bankOrWallet === 'string' && parsed.bankOrWallet.trim() ? parsed.bankOrWallet.trim() : null;
    const senderStr = typeof parsed.sender === 'string' && parsed.sender.trim() ? parsed.sender.trim() : null;
    const recipientStr = typeof parsed.recipient === 'string' && parsed.recipient.trim() ? parsed.recipient.trim() : null;
    const dateStr = typeof parsed.date === 'string' && parsed.date.trim() ? parsed.date.trim() : null;
    const timeStr = typeof parsed.time === 'string' && parsed.time.trim() ? parsed.time.trim() : null;
    const refNoStr = typeof parsed.referenceNumber === 'string' && parsed.referenceNumber.trim() ? parsed.referenceNumber.trim() : null;
    const invoiceNoStr = typeof parsed.invoiceNumber === 'string' && parsed.invoiceNumber.trim() ? parsed.invoiceNumber.trim() : null;
    const dueDateStr = typeof parsed.dueDate === 'string' && parsed.dueDate.trim() ? parsed.dueDate.trim() : null;
    const paymentStr = typeof parsed.paymentMethod === 'string' && parsed.paymentMethod.trim()
      ? parsed.paymentMethod.trim()
      : bankOrWalletStr
      ? `Transfer ${bankOrWalletStr}`
      : null;
    const descStr = typeof parsed.description === 'string' && parsed.description.trim() ? parsed.description.trim() : null;
    const categoryStr = typeof parsed.category === 'string' && parsed.category.trim() ? parsed.category.trim() : null;
    const statusStr = typeof parsed.status === 'string' && parsed.status.trim() ? parsed.status.trim() : null;

    let txType: 'expense' | 'income' = 'expense';
    let rawTxType: 'income' | 'expense' | 'unknown' = 'unknown';
    if (parsed.transactionType === 'income' || parsed.type === 'income') {
      txType = 'income';
      rawTxType = 'income';
    } else if (parsed.transactionType === 'expense' || parsed.type === 'expense') {
      txType = 'expense';
      rawTxType = 'expense';
    }

    // Confidence Evaluation
    const hasAmount = numericAmount !== null && numericAmount > 0;
    const usefulNonAmountValues = [
      merchantStr,
      bankOrWalletStr,
      senderStr,
      recipientStr,
      refNoStr,
      invoiceNoStr,
      dateStr,
      paymentStr,
      descStr,
    ].filter((v): v is string => Boolean(v && v.trim().length > 0));

    const detectedFieldCount = (hasAmount ? 1 : 0) + usefulNonAmountValues.length;

    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (hasAmount && usefulNonAmountValues.length >= 2) {
      confidence = 'high';
    } else if (hasAmount && usefulNonAmountValues.length >= 1) {
      confidence = 'medium';
    } else if (hasAmount || usefulNonAmountValues.length >= 2) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    const finalOcrStatus = confidence === 'low' ? 'OCR_LOW_CONFIDENCE' : `OCR_SUCCESS_${confidence.toUpperCase()}`;

    // Safe telemetry logging without sensitive raw image or credentials
    console.log('[OCR Diagnostics]', JSON.stringify({
      apiRouteReached: true,
      sourceMode: validSourceMode,
      mimeType: cleanMime,
      fileSizeApproxBytes: Math.round(cleanBase64.length * 0.75),
      modelSelected: usedModel,
      geminiRequestStatus: 'SUCCESS',
      geminiResponseReceived: true,
      documentType: docType,
      detectedFieldCount,
      finalOcrStatus,
    }));

    const uncertainList: string[] = [];
    if (!hasAmount) uncertainList.push('amount');
    if (!merchantStr && !bankOrWalletStr && !recipientStr) uncertainList.push('merchant');
    if (!dateStr) uncertainList.push('date');
    if (!paymentStr) uncertainList.push('paymentMethod');

    const isUncertain = confidence === 'low';

    let summaryText = 'Gambar berhasil dimuat, tetapi data transaksi belum terbaca dengan yakin.';
    const displayName =
      merchantStr ||
      recipientStr ||
      (bankOrWalletStr ? `Transfer ${bankOrWalletStr}` : null) ||
      (docType === 'receipt' ? 'Struk Toko' : 'Bukti Transaksi');

    if (confidence === 'high') {
      summaryText = `Berhasil membaca: ${displayName}, ${numericAmount ? 'Rp ' + numericAmount.toLocaleString('id-ID') : ''} (${dateStr || 'Hari ini'})`;
    } else if (confidence === 'medium') {
      summaryText = `Data terdeteksi: ${displayName}${numericAmount ? ' - Rp ' + numericAmount.toLocaleString('id-ID') : ''}. Silakan tinjau kembali.`;
    }

    const finalData = {
      documentType: docType,
      transactionType: rawTxType,
      amount: numericAmount,
      date: dateStr,
      time: timeStr,
      merchant: merchantStr || recipientStr || bankOrWalletStr || null,
      bankOrWallet: bankOrWalletStr,
      sender: senderStr,
      recipient: recipientStr,
      paymentMethod: paymentStr,
      referenceNumber: refNoStr,
      invoiceNumber: invoiceNoStr,
      dueDate: dueDateStr,
      description: descStr,
      category: categoryStr,
      status: statusStr,
      confidence,
      type: txType,
      referenceNo: refNoStr || invoiceNoStr || '',
      notes: descStr || (statusStr ? `Status: ${statusStr}` : ''),
      isUncertain,
      uncertainFields: uncertainList,
      detectionSummary: summaryText,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };

    return res.status(200).json({
      success: true,
      source: 'gemini-ai',
      model: usedModel,
      data: finalData,
    });
  } catch (error: any) {
    console.error('[OCR Diagnostics] Unhandled error:', error);
    return res.status(502).json({
      success: false,
      errorCode: 'AI_REQUEST_FAILED',
      error: error.message || 'Gagal memindai gambar dokumen dengan AI. Silakan coba lagi atau gunakan input manual.',
    });
  }
}
