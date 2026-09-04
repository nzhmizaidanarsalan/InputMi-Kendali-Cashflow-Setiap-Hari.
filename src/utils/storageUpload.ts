import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { storage } from '../lib/firebase';

/**
 * Uploads a base64/data URL receipt image to Firebase Storage.
 * Returns the public download URL.
 * 
 * If receiptDataUrl is already an external/cloud HTTP(S) URL, it returns it directly.
 */
export async function uploadReceiptToStorage(
  userId: string,
  receiptDataUrl: string,
  fileName?: string
): Promise<string> {
  if (!receiptDataUrl) {
    throw new Error('Data gambar struk tidak ditemukan');
  }

  // Already a web or cloud storage URL
  if (receiptDataUrl.startsWith('http://') || receiptDataUrl.startsWith('https://')) {
    return receiptDataUrl;
  }

  const cleanFileName = (fileName || `receipt_${Date.now()}.jpg`)
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `receipts/${userId}/${Date.now()}_${cleanFileName}`;
  const storageRef = ref(storage, path);

  try {
    const uploadResult = await uploadString(storageRef, receiptDataUrl, 'data_url', {
      contentType: receiptDataUrl.startsWith('data:image/png')
        ? 'image/png'
        : receiptDataUrl.startsWith('data:image/webp')
        ? 'image/webp'
        : 'image/jpeg',
    });

    const downloadUrl = await getDownloadURL(uploadResult.ref);
    return downloadUrl;
  } catch (err: any) {
    console.error('Firebase Storage upload error:', err);
    throw new Error(
      err?.message || 'Gagal mengunggah foto struk ke Firebase Storage'
    );
  }
}
