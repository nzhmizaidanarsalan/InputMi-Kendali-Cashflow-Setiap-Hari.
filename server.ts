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
        return res.status(400).json({
          success: false,
          error: 'Gambar struk tidak ditemukan. Harap unggah gambar terlebih dahulu.',
        });
      }

      // Check for clean base64 data (strip prefix data:image/...;base64, and any whitespace/newlines)
      const cleanBase64 = String(imageBase64)
        .replace(/^data:[^;]+;base64,/, '')
        .replace(/\s/g, '');
      const cleanMime =
        typeof mimeType === 'string' && mimeType.startsWith('image/')
          ? mimeType
          : 'image/jpeg';

      const ai = getAiClient();
      if (!ai) {
        return res.status(503).json({
          success: false,
          error: 'Layanan Gemini Vision belum terhubung (GEMINI_API_KEY tidak ditemukan). Anda dapat mengisi data struk secara manual.',
        });
      }

      const prompt = `Anda adalah asisten AI ahli OCR dan analisis dokumen keuangan untuk Indonesia.
Tugas Anda adalah membaca dan menganalisis gambar struk belanja, tiket kasir, bukti QRIS, atau bukti transfer perbankan/e-wallet.

Aturan Deteksi Jenis Transaksi:
1. Struk Toko / Merchant (Indomaret, Alfamart, Supermarket, Restoran, Kafe, SPBU, Toko Retail, dll) -> type: 'expense'.
2. Bukti Transfer Keluar / Pembayaran (Transfer Berhasil, Pembayaran Berhasil, Kirim Uang, QRIS Berhasil dari BCA, Mandiri, BRI, BNI, GoPay, OVO, ShopeePay, Dana, Flip, dll) -> type: 'expense'.
3. Bukti Transfer Masuk / Penerimaan Dana (Transfer Masuk, Uang Diterima, Dana Masuk, Top Up Berhasil, Gaji Masuk) -> type: 'income'.

Format Ekstraksi Data JSON:
- type: 'expense' atau 'income'
- amount: angka bulat positif dalam Rupiah (integer, contoh: 25000 atau 1250000. JANGAN gunakan string atau titik/koma). Ambil total pembayaran akhir / total transfer yang sah.
- date: tanggal transaksi format YYYY-MM-DD (jika tahun tidak tertera, gunakan 2026).
- time: waktu transaksi format HH:mm (24 jam, contoh: "14:35").
- merchant: nama toko, merchant, penerima transfer, atau pengirim transfer.
- category: saran kategori yang tepat:
  * Untuk expense: 'Belanja Harian', 'Kuliner', 'Transportasi', 'Tagihan & Langganan', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Lainnya'
  * Untuk income: 'Karir & Gaji', 'Bisnis', 'Investasi', 'Hadiah & Bonus', 'Penjualan Aset', 'Lainnya'
- paymentMethod: metode pembayaran jika terdeteksi (contoh: 'QRIS BCA', 'Transfer BCA', 'Debit BCA', 'Bank Mandiri', 'GoPay', 'ShopeePay', 'OVO', 'Tunai', 'Kartu Kredit', dll).
- referenceNo: nomor referensi / No. Transaksi / Ref ID / Trace Number jika terlihat jelas pada bukti transfer atau struk.
- description: keterangan singkat transaksi (contoh: 'Pembayaran belanja Indomaret', 'Transfer ke Budi Santoso', dll).
- notes: catatan rincian belanja atau keterangan transfer.
- items: rincian barang/jasa jika terbaca (array of { name: string, price: number, qty?: number }).
- isUncertain: boolean true jika gambar buram, nilai terpotong, atau tidak terbaca jelas.
- uncertainFields: array field yang kurang jelas atau tidak dapat dipastikan (contoh: ['amount', 'paymentMethod']).
- detectionSummary: ringkasan ramah dalam bahasa Indonesia tentang apa yang berhasil dibaca.

PENTING TENTANG KEAMANAN KEUANGAN:
Jangan pernah mengarang angka jika tidak yakin. Jika nominal atau nama toko meragukan, tandai di uncertainFields.`;

      let response;
      const primaryModel = 'gemini-3.8-flash';
      try {
        response = await ai.models.generateContent({
          model: primaryModel,
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
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ['expense', 'income'] },
                amount: { type: Type.NUMBER },
                date: { type: Type.STRING },
                time: { type: Type.STRING },
                merchant: { type: Type.STRING },
                category: { type: Type.STRING },
                paymentMethod: { type: Type.STRING },
                referenceNo: { type: Type.STRING },
                description: { type: Type.STRING },
                notes: { type: Type.STRING },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      price: { type: Type.NUMBER },
                      qty: { type: Type.NUMBER },
                    },
                    required: ['name', 'price'],
                  },
                },
                isUncertain: { type: Type.BOOLEAN },
                uncertainFields: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                detectionSummary: { type: Type.STRING },
              },
              required: ['type', 'amount', 'date', 'merchant', 'category'],
            },
          },
        });
      } catch (geminiError: any) {
        const msg = String(geminiError?.message || '');
        if (msg.includes('404') || msg.includes('NOT_FOUND') || msg.includes('not found')) {
          console.warn(`Model ${primaryModel} returned 404, falling back to gemini-2.5-flash...`);
          response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
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
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ['expense', 'income'] },
                  amount: { type: Type.NUMBER },
                  date: { type: Type.STRING },
                  time: { type: Type.STRING },
                  merchant: { type: Type.STRING },
                  category: { type: Type.STRING },
                  paymentMethod: { type: Type.STRING },
                  referenceNo: { type: Type.STRING },
                  description: { type: Type.STRING },
                  notes: { type: Type.STRING },
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        qty: { type: Type.NUMBER },
                      },
                      required: ['name', 'price'],
                    },
                  },
                  isUncertain: { type: Type.BOOLEAN },
                  uncertainFields: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  detectionSummary: { type: Type.STRING },
                },
                required: ['type', 'amount', 'date', 'merchant', 'category'],
              },
            },
          });
        } else {
          throw geminiError;
        }
      }

      const text = response.text;
      if (!text) {
        throw new Error('Model tidak mengembalikan hasil teks.');
      }

      const parsedData = JSON.parse(text);
      return res.json({
        success: true,
        source: 'gemini-ai',
        data: parsedData,
      });
    } catch (error: any) {
      console.error('Error scanning receipt:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Gagal memindai struk dengan AI. Silakan coba lagi atau input manual.',
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
