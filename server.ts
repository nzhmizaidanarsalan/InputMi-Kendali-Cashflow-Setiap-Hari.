import express from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for receipt images
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Initialize Gemini client lazily
  let aiClient: GoogleGenAI | null = null;
  function getAiClient(): GoogleGenAI | null {
    if (!aiClient && process.env.GEMINI_API_KEY) {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return aiClient;
  }

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
      time: new Date().toISOString(),
    });
  });

  // Receipt Scanner AI OCR API
  app.post('/api/scan-receipt', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg', sourceMode = 'gallery' } = req.body;

      // Validate sourceMode
      const validSourceMode: 'camera' | 'gallery' | 'transfer' =
        sourceMode === 'camera' || sourceMode === 'transfer' ? sourceMode : 'gallery';

      if (!imageBase64) {
        return res.status(200).json({
          success: false,
          errorCode: 'INVALID_PAYLOAD',
          error: 'Gambar struk tidak ditemukan atau kosong. Harap pilih/ambil foto kembali.',
        });
      }

      // Check for clean base64 data (strip prefix data:image/...;base64, and any whitespace/newlines)
      const cleanBase64 = String(imageBase64)
        .replace(/^data:[^;]+;base64,/, '')
        .replace(/\s/g, '');

      if (!cleanBase64 || cleanBase64.length < 100) {
        return res.status(200).json({
          success: false,
          errorCode: 'INVALID_PAYLOAD',
          error: 'Data gambar tidak valid atau terlalu kecil. Harap ambil foto yang lebih jelas.',
        });
      }

      const cleanMime =
        typeof mimeType === 'string' && mimeType.startsWith('image/')
          ? mimeType.toLowerCase()
          : 'image/jpeg';

      const supportedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!supportedMimes.includes(cleanMime)) {
        return res.status(200).json({
          success: false,
          errorCode: 'UNSUPPORTED_MIME',
          error: `Format gambar (${cleanMime}) tidak didukung. Harap gunakan foto JPG, PNG, atau WEBP.`,
        });
      }

      const ai = getAiClient();
      if (!ai) {
        return res.status(200).json({
          success: false,
          errorCode: 'API_KEY_MISSING',
          error: 'Layanan AI Vision belum terhubung (GEMINI_API_KEY tidak ditemukan). Anda dapat mengisi data transaksi secara manual.',
        });
      }

      // Contextual instructions based on sourceMode
      let sourceModeContextInstruction = '';
      if (validSourceMode === 'transfer') {
        sourceModeContextInstruction = `Pengguna mengunggah gambar melalui mode 'Bukti Transfer' (sourceMode="transfer").
Prioritas dugaan awal: Bukti transfer bank (BCA, Mandiri, BRI, BNI, dll), konfirmasi e-wallet (GoPay, OVO, DANA, ShopeePay), tangkapan layar transaksi digital, atau pembayaran QRIS.
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
Periksa gambar secara visual dan tentukan nilai "documentType" dari salah satu kategori berikut:
1. "receipt": Struk fisik kasir/minimarket/toko kertas (contoh: Indomaret, Alfamart, SPBU Pertamina, restoran, cafe, supermarket, parkir).
2. "transfer_proof": Bukti konfirmasi transfer mobile banking atau internet banking (contoh: BCA Mobile, myBCA, Livin' by Mandiri, BRImo, BNI Mobile, Flip, Seabank, GoPay/OVO/DANA transfer antar bank).
3. "payment_screenshot": Tangkapan layar status pembayaran sukses digital (contoh: QRIS, transaksi merchant GoPay, OVO, ShopeePay, DANA, kartu kredit digital).
4. "invoice": Tagihan atau faktur penjualan barang/jasa yang memiliki nomor invoice, rincian tagihan, atau tanggal jatuh tempo.
5. "financial_document": Dokumen keuangan lainnya seperti mutasi rekening, slip gaji, atau rekening koran.
6. "unknown": Gambar tidak relevan dengan keuangan atau teks tidak dapat dibaca sama sekali.

====================================================
TAHAP 2: EKSTRAKSI DATA SPESIFIK SESUAI DOCUMENT TYPE
====================================================

A. Jika documentType == "receipt":
- merchant: Nama toko/restoran/minimarket (contoh: 'Indomaret', 'Alfamart', 'Kopi Kenangan').
- amount: Cari dan prioritaskan nilai TOTAL AKHIR pembayaran (TOTAL, GRAND TOTAL, TOTAL BAYAR, JUMLAH BAYAR, TOTAL PEMBAYARAN).
  PENTING: Jangan tertukar dengan Subtotal, Pajak/PPN, Uang Tunai/Cash yang diserahkan pembeli, atau Kembalian.
  Konversi angka ke integer bulat rupiah (misal "Rp 45.500" -> 45500).
- date: Tanggal transaksi format YYYY-MM-DD (jika tahun tidak tertulis, gunakan 2026).
- time: Waktu transaksi format HH:mm (24 jam).
- paymentMethod: Metode pembayaran jika tertulis (contoh: 'Tunai', 'QRIS BCA', 'Debit Mandiri', 'GoPay').
- referenceNumber: Nomor bon / nomor struk / transaksi ID.
- category: Kategori belanja yang paling tepat: 'Belanja Harian', 'Kuliner', 'Transportasi', 'Tagihan & Langganan', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Lainnya'.
- transactionType: "expense".
- items: Array rincian belanja [{ "name": string, "price": number, "qty": number }].

B. Jika documentType == "transfer_proof":
- amount: Nominal dana transfer (angka bulat Rupiah).
- bankOrWallet: Nama bank atau dompet digital (contoh: 'BCA', 'Bank Mandiri', 'BRI', 'BNI', 'GoPay', 'DANA', 'OVO', 'ShopeePay', 'Flip', dll).
- sender: Nama pengirim atau nomor rekening pengirim jika terlihat.
- recipient: Nama penerima atau nomor rekening tujuan.
- referenceNumber: Nomor referensi / No. Referensi / Ref ID / ID Transaksi.
- date: Tanggal transfer format YYYY-MM-DD.
- time: Waktu transfer format HH:mm.
- status: Status transfer (contoh: "Berhasil", "Sukses", "Pending").
- description: Berita atau keterangan transfer.
- merchant: Isi dengan nama penerima atau nama bank tujuan (untuk label transaksi).
- transactionType:
  * "expense" jika bukti transfer keluar / kirim uang / bayar ke orang lain.
  * "income" jika bukti transfer masuk / dana diterima / top up masuk.
  * "unknown" jika arah aliran dana tidak jelas.

C. Jika documentType == "payment_screenshot":
- amount: Nominal pembayaran yang berhasil (angka bulat).
- merchant: Nama merchant atau toko penerima pembayaran.
- paymentMethod: Metode pembayaran digital (contoh: 'QRIS BCA', 'GoPay', 'ShopeePay', 'OVO', 'DANA').
- referenceNumber: Ref ID / RRN / No. Transaksi.
- date: Tanggal transaksi format YYYY-MM-DD.
- time: Jam transaksi format HH:mm.
- status: Status (misal "Berhasil", "Sukses").
- category: Kategori yang sesuai.
- transactionType: "expense".

D. Jika documentType == "invoice":
- merchant: Nama vendor atau penerbit tagihan/faktur.
- invoiceNumber: Nomor invoice / nomor faktur / nomor tagihan.
- amount: Total nominal tagihan (angka bulat).
- dueDate: Tanggal jatuh tempo format YYYY-MM-DD jika ada.
- date: Tanggal faktur terbit format YYYY-MM-DD.
- description: Deskripsi tagihan / layanan yang ditagihkan.
- status: Status faktur (JANGAN anggap otomatis lunas jika belum ada bukti lunas).
- transactionType: "expense".

====================================================
ATURAN CONFIDENCE & KELENGKAPAN:
====================================================
- "high": amount terdeteksi DITAMBAH minimal 2 kolom berguna lainnya (seperti merchant/bankOrWallet/sender/recipient/date/referenceNumber).
- "medium": amount terdeteksi DITAMBAH 1 kolom berguna lainnya, ATAU terdapat minimal 2 kolom berguna non-nominal terdeteksi.
- "low": hanya jika hampir tidak ada data transaksi yang dapat dikenali.
PENTING: Ekstraksi parsial adalah KEBERHASILAN. JANGAN memberikan "low" jika amount dan salah satu nama bank/merchant/referensi terdeteksi.

KEMBALIKAN HANYA JSON MURNI DENGAN STRUKTUR BERIKUT (tanpa markdown dan tanpa teks pembuka):
{
  "documentType": "receipt" | "transfer_proof" | "invoice" | "payment_screenshot" | "financial_document" | "unknown",
  "transactionType": "income" | "expense" | "unknown",
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
  "confidence": "high" | "medium" | "low",
  "items": [
    { "name": string, "price": number, "qty": number }
  ]
}`;

      // Multimodal Candidate Models list (active in Google AI Studio)
      const CANDIDATE_MODELS = [
        'gemini-3.1-flash-lite',
        'gemini-flash-latest',
        'gemini-3.8-flash',
        'gemini-3.6-flash',
        'gemini-3.7-flash',
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
          console.warn(`Model ${modelName} encountered error:`, modelErr?.message || modelErr);
          // Try next candidate model
        }
      }

      if (!responseText) {
        console.error('All multimodal candidate models failed. Last error:', lastModelError);
        const errMsg = String(lastModelError?.message || '');

        let errorCode = 'MODEL_UNAVAILABLE';
        let friendlyMessage = 'Layanan AI Vision sedang sibuk. Silakan coba sesaat lagi atau gunakan input manual.';

        if (errMsg.includes('404') || errMsg.includes('NOT_FOUND')) {
          errorCode = 'MODEL_NOT_FOUND';
          friendlyMessage = 'Model AI Vision tidak tersedia saat ini. Silakan input manual atau coba lagi nanti.';
        } else if (errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand')) {
          errorCode = 'MODEL_OVERLOADED';
          friendlyMessage = 'Layanan AI Vision sedang mengalami lonjakan beban. Silakan coba beberapa detik lagi atau isi manual.';
        } else if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
          errorCode = 'RATE_LIMIT';
          friendlyMessage = 'Batas kuota pemindaian tercapai sementara. Silakan coba kembali atau input manual.';
        } else if (errMsg.includes('ENOTFOUND') || errMsg.includes('ECONNREFUSED') || errMsg.includes('fetch failed')) {
          errorCode = 'NETWORK_ERROR';
          friendlyMessage = 'Koneksi ke server AI Vision terputus. Pastikan koneksi internet aktif.';
        }

        return res.status(200).json({
          success: false,
          errorCode,
          error: friendlyMessage,
          technicalDetails: process.env.NODE_ENV !== 'production' ? errMsg : undefined,
        });
      }

      // Safe JSON parsing & cleaning
      let parsed: any = null;
      try {
        const cleanJsonStr = responseText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim();
        parsed = JSON.parse(cleanJsonStr);
      } catch (jsonErr) {
        console.warn('Direct JSON parse failed, attempting regex extraction:', jsonErr);
        const match = responseText.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          return res.status(200).json({
            success: false,
            errorCode: 'INVALID_AI_RESPONSE',
            error: 'Format data dari AI tidak valid. Silakan coba scan ulang atau isi data secara manual.',
          });
        }
      }

      // Safe Extraction & Normalization
      // 1. Amount
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

      // 2. Document Type
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

      // If unknown but sourceMode was transfer and we have bank or transfer fields
      if (docType === 'unknown' && validSourceMode === 'transfer') {
        if (parsed.bankOrWallet || parsed.recipient || parsed.sender) {
          docType = 'transfer_proof';
        }
      }

      // 3. String fields
      const merchantStr =
        typeof parsed.merchant === 'string' && parsed.merchant.trim()
          ? parsed.merchant.trim()
          : null;

      const bankOrWalletStr =
        typeof parsed.bankOrWallet === 'string' && parsed.bankOrWallet.trim()
          ? parsed.bankOrWallet.trim()
          : null;

      const senderStr =
        typeof parsed.sender === 'string' && parsed.sender.trim()
          ? parsed.sender.trim()
          : null;

      const recipientStr =
        typeof parsed.recipient === 'string' && parsed.recipient.trim()
          ? parsed.recipient.trim()
          : null;

      const dateStr =
        typeof parsed.date === 'string' && parsed.date.trim()
          ? parsed.date.trim()
          : null;

      const timeStr =
        typeof parsed.time === 'string' && parsed.time.trim()
          ? parsed.time.trim()
          : null;

      const refNoStr =
        typeof parsed.referenceNumber === 'string' && parsed.referenceNumber.trim()
          ? parsed.referenceNumber.trim()
          : null;

      const invoiceNoStr =
        typeof parsed.invoiceNumber === 'string' && parsed.invoiceNumber.trim()
          ? parsed.invoiceNumber.trim()
          : null;

      const dueDateStr =
        typeof parsed.dueDate === 'string' && parsed.dueDate.trim()
          ? parsed.dueDate.trim()
          : null;

      const paymentStr =
        typeof parsed.paymentMethod === 'string' && parsed.paymentMethod.trim()
          ? parsed.paymentMethod.trim()
          : bankOrWalletStr
          ? `Transfer ${bankOrWalletStr}`
          : null;

      const descStr =
        typeof parsed.description === 'string' && parsed.description.trim()
          ? parsed.description.trim()
          : null;

      const categoryStr =
        typeof parsed.category === 'string' && parsed.category.trim()
          ? parsed.category.trim()
          : null;

      const statusStr =
        typeof parsed.status === 'string' && parsed.status.trim()
          ? parsed.status.trim()
          : null;

      // Determine transaction type
      let txType: 'expense' | 'income' = 'expense';
      let rawTxType: 'income' | 'expense' | 'unknown' = 'unknown';
      if (parsed.transactionType === 'income' || parsed.type === 'income') {
        txType = 'income';
        rawTxType = 'income';
      } else if (parsed.transactionType === 'expense' || parsed.type === 'expense') {
        txType = 'expense';
        rawTxType = 'expense';
      } else {
        txType = 'expense';
        rawTxType = 'unknown';
      }

      // Requirement 6: Confidence Evaluation
      // HIGH: amount plus at least two useful fields
      // MEDIUM: amount plus one useful field OR at least two useful non-amount transaction fields
      // LOW: essentially nothing useful detected
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

      const nonAmountUsefulCount = usefulNonAmountValues.length;
      const detectedFieldCount = (hasAmount ? 1 : 0) + nonAmountUsefulCount;

      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (hasAmount && nonAmountUsefulCount >= 2) {
        confidence = 'high';
      } else if (hasAmount && nonAmountUsefulCount >= 1) {
        confidence = 'medium';
      } else if (hasAmount) {
        confidence = 'medium';
      } else if (nonAmountUsefulCount >= 2) {
        confidence = 'medium';
      } else {
        confidence = 'low';
      }

      // Safe telemetry logging (Requirement 9: Never log raw image or sensitive financial values)
      console.log('[AI Document Analysis]', {
        sourceMode: validSourceMode,
        documentType: docType,
        detectedFieldCount,
        confidence,
        modelUsed: usedModel,
      });

      const uncertainList: string[] = [];
      if (!hasAmount) uncertainList.push('amount');
      if (!merchantStr && !bankOrWalletStr && !recipientStr) uncertainList.push('merchant');
      if (!dateStr) uncertainList.push('date');
      if (!paymentStr) uncertainList.push('paymentMethod');

      const isUncertain = confidence === 'low';

      // Summary label
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
        // Structured format per Requirement 5
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

        // Backwards-compatible fields for existing UI components
        type: txType,
        referenceNo: refNoStr || invoiceNoStr || '',
        notes: descStr || (statusStr ? `Status: ${statusStr}` : ''),
        isUncertain,
        uncertainFields: uncertainList,
        detectionSummary: summaryText,
        items: Array.isArray(parsed.items) ? parsed.items : [],
      };

      return res.json({
        success: true,
        source: 'gemini-ai',
        model: usedModel,
        data: finalData,
      });
    } catch (error: any) {
      console.error('Unhandled error in /api/scan-receipt:', error);
      return res.status(200).json({
        success: false,
        errorCode: 'SERVER_ERROR',
        error: error.message || 'Gagal memindai struk dengan AI Vision. Silakan coba lagi atau input manual.',
      });
    }
  });

  // Serve public static assets (favicons, manifests, logos, open graph images) directly
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`InputMi server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
