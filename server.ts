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
      const { imageBase64, mimeType = 'image/jpeg' } = req.body;

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

      const prompt = `Anda adalah asisten AI ahli OCR dan analisis dokumen keuangan untuk Indonesia.
Tugas Anda adalah membaca dan mengekstrak data dari gambar struk belanja, tiket kasir, bukti QRIS, atau bukti transfer perbankan/e-wallet.

Format kembalian HARUS berupa JSON murni tanpa markdown, dengan struktur PERSIS seperti ini:
{
  "transactionType": "income | expense | unknown",
  "amount": number | null,
  "date": "YYYY-MM-DD" | null,
  "time": "HH:mm" | null,
  "merchant": string | null,
  "paymentMethod": string | null,
  "referenceNumber": string | null,
  "description": string | null,
  "category": string | null,
  "confidence": "high | medium | low"
}

ATURAN STRUK BELANJA:
- merchant: Nama toko/merchant (contoh: Indomaret, Alfamart, SPBU Pertamina, Toko, Restoran, Kafe, dll).
- amount: Cari dan prioritaskan TOTAL, GRAND TOTAL, TOTAL BAYAR, TOTAL PEMBAYARAN, atau JUMLAH BAYAR.
  PENTING: Jangan tertukar dengan Subtotal, Pajak/PPN, Nominal Tunai yang diserahkan pembeli, atau Uang Kembalian.
  Konversi format angka Indonesia menjadi angka bulat (integer), contoh:
  "Rp 25.000" -> 25000
  "25.000" -> 25000
  "Rp25,000" -> 25000
  "1.250.000" -> 1250000
  "IDR 50,000" -> 50000
- date: Tanggal transaksi format YYYY-MM-DD (jika tahun tidak tertera, gunakan 2026).
- time: Waktu transaksi format HH:mm (24 jam, contoh: "14:35").
- category: Kategori yang sesuai: 'Belanja Harian', 'Kuliner', 'Transportasi', 'Tagihan & Langganan', 'Hiburan', 'Kesehatan', 'Pendidikan', atau 'Lainnya'.
- paymentMethod: Metode pembayaran jika tertera (contoh: 'Tunai', 'QRIS BCA', 'Debit Mandiri', 'GoPay', 'ShopeePay', dll).
- referenceNumber: Nomor struk / No. Transaksi / Bon ID jika tertera.
- transactionType: 'expense'.

ATURAN BUKTI TRANSFER / MUTASI:
- amount: Nominal dana yang ditransfer atau diterima (dalam Rupiah bulat).
- transactionType: Tentukan dengan teliti:
  * Jika bukti transfer keluar / kirim dana / pembayaran sukses -> "expense".
  * Jika bukti transfer masuk / dana diterima / top up masuk -> "income".
  * Jika arah transaksi tidak dapat dipastikan dari gambar -> "unknown" (JANGAN mengarang).
- merchant: Nama penerima atau nama pengirim transfer atau nama bank/merchant.
- paymentMethod: Sumber bank/e-wallet (contoh: 'Transfer BCA', 'Bank Mandiri', 'BRI', 'BNI', 'GoPay', 'Dana', 'OVO', 'ShopeePay', dll).
- referenceNumber: Nomor referensi / No. Referensi / Ref ID / ID Transaksi.
- date: Tanggal transfer format YYYY-MM-DD.
- time: Jam transfer format HH:mm.
- description: Keterangan atau catatan transfer jika ada.

ATURAN CONFIDENCE & KELENGKAPAN:
- Jika suatu kolom tidak terdeteksi pada gambar, isi dengan null. JANGAN membatalkan pemindaian hanya karena satu field tidak ada.
- "high": nominal (amount) + nama merchant/sumber + tanggal terdeteksi jelas.
- "medium": nominal (amount) terdeteksi ditambah minimal satu field lain (merchant, metode, tanggal, atau nomor referensi).
- "low": tidak ada data transaksi yang berguna terbaca.

HANYA kembalikan JSON murni, tanpa teks pembuka, dan tanpa format markdown.`;

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

      // Compute practical confidence rules (Requirement 7)
      const rawAmount = parsed.amount;
      const numericAmount =
        typeof rawAmount === 'number' && !isNaN(rawAmount) && rawAmount > 0
          ? Math.round(rawAmount)
          : null;

      const merchantStr =
        typeof parsed.merchant === 'string' && parsed.merchant.trim()
          ? parsed.merchant.trim()
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

      const paymentStr =
        typeof parsed.paymentMethod === 'string' && parsed.paymentMethod.trim()
          ? parsed.paymentMethod.trim()
          : null;

      const descStr =
        typeof parsed.description === 'string' && parsed.description.trim()
          ? parsed.description.trim()
          : null;

      const categoryStr =
        typeof parsed.category === 'string' && parsed.category.trim()
          ? parsed.category.trim()
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

      // Confidence Evaluation
      const hasAmount = numericAmount !== null && numericAmount > 0;
      const hasMerchant = merchantStr !== null;
      const hasDate = dateStr !== null;
      const hasRef = refNoStr !== null;
      const hasPayment = paymentStr !== null;

      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (hasAmount && (hasMerchant || hasPayment) && hasDate) {
        confidence = 'high';
      } else if (hasAmount && (hasMerchant || hasPayment || hasDate || hasRef)) {
        confidence = 'medium';
      } else if (hasAmount || hasMerchant || hasRef) {
        confidence = 'medium';
      } else {
        confidence = 'low';
      }

      // If model itself provided high/medium/low, respect it if consistent
      if (['high', 'medium', 'low'].includes(parsed.confidence)) {
        if (confidence !== 'low') {
          confidence = parsed.confidence;
        }
      }

      const uncertainList: string[] = [];
      if (!hasAmount) uncertainList.push('amount');
      if (!hasMerchant) uncertainList.push('merchant');
      if (!hasDate) uncertainList.push('date');
      if (!hasPayment) uncertainList.push('paymentMethod');

      const isUncertain = confidence === 'low';

      const summaryText =
        confidence === 'high'
          ? `Berhasil membaca: ${merchantStr || 'Merchant'}, ${numericAmount ? 'Rp ' + numericAmount.toLocaleString('id-ID') : ''} (${dateStr || 'Hari ini'})`
          : confidence === 'medium'
          ? `Data terdeteksi sebagian: ${numericAmount ? 'Rp ' + numericAmount.toLocaleString('id-ID') : merchantStr || 'Struk/Transfer'}. Silakan periksa kembali.`
          : 'Gambar berhasil dimuat, tetapi data transaksi belum terbaca dengan yakin.';

      const finalData = {
        // Requested format fields
        transactionType: rawTxType,
        amount: numericAmount,
        date: dateStr,
        time: timeStr,
        merchant: merchantStr,
        paymentMethod: paymentStr,
        referenceNumber: refNoStr,
        description: descStr,
        category: categoryStr,
        confidence,

        // Backwards-compatible fields for existing UI components
        type: txType,
        referenceNo: refNoStr || '',
        notes: descStr || '',
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
