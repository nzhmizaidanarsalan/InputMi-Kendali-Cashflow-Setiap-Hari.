import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../lib/firebase';

/**
 * Converts a data URL, blob URL, or native File/Blob into a native Blob with content-type.
 * Completely eliminates "The string did not match the expected pattern" and File-as-string errors.
 */
async function toBlob(input: string | Blob | File): Promise<{ blob: Blob; contentType: string }> {
  // If already a Blob or File
  if (input instanceof Blob) {
    return {
      blob: input,
      contentType: input.type || 'image/jpeg',
    };
  }

  if (typeof input !== 'string') {
    throw new Error('Format gambar tidak dikenali untuk diunggah ke Cloud Storage.');
  }

  // Handle blob: URLs
  if (input.startsWith('blob:')) {
    const res = await fetch(input);
    const blob = await res.blob();
    return {
      blob,
      contentType: blob.type || 'image/jpeg',
    };
  }

  // Handle data: URLs
  if (input.startsWith('data:')) {
    // Attempt fast native browser fetch for data URL first
    try {
      const res = await fetch(input);
      const blob = await res.blob();
      return {
        blob,
        contentType: blob.type || 'image/jpeg',
      };
    } catch {
      // Fallback to manual decode if fetch fails
    }

    const commaIndex = input.indexOf(',');
    if (commaIndex === -1) {
      throw new Error('Data gambar struk tidak memiliki format yang valid.');
    }

    const header = input.substring(0, commaIndex);
    // Strip whitespace and newlines that cause DOMException in atob
    let base64Data = input.substring(commaIndex + 1).replace(/\s/g, '');

    // Add required base64 padding if missing
    while (base64Data.length % 4 !== 0) {
      base64Data += '=';
    }

    // Extract mime type safely
    const mimeMatch = header.match(/data:([^;]+)/);
    const contentType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    // Decode base64 to byte array
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return {
      blob: new Blob([bytes], { type: contentType }),
      contentType,
    };
  }

  throw new Error('Format gambar tidak dikenali untuk diunggah ke Cloud Storage.');
}

/**
 * Uploads a receipt image to Firebase Storage under the authenticated user's directory.
 * Path structure: users/{uid}/receipts/{fileId}
 * 
 * Accepts string (data URL, blob URL, HTTP URL) or native File/Blob.
 * Returns the public download URL.
 * If already an external HTTP(S) URL, returns directly.
 */
export async function uploadReceiptToStorage(
  userId: string,
  receiptImageSource: string | File | Blob,
  fileName?: string
): Promise<string> {
  if (!userId || !userId.trim()) {
    throw new Error('Pengguna belum terautentikasi untuk menyimpan berkas ke Cloud.');
  }

  if (!receiptImageSource) {
    throw new Error('Sumber gambar struk tidak valid atau kosong.');
  }

  // Already a remote web / cloud storage URL
  if (typeof receiptImageSource === 'string' && (receiptImageSource.startsWith('http://') || receiptImageSource.startsWith('https://'))) {
    return receiptImageSource;
  }

  const cleanBaseName = (fileName || (receiptImageSource instanceof File ? receiptImageSource.name : `receipt_${Date.now()}.jpg`))
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Safe storage path: users/{uid}/receipts/{fileId}
  const fileId = `${Date.now()}_${cleanBaseName}`;
  const path = `users/${userId}/receipts/${fileId}`;
  const storageRef = ref(storage, path);

  try {
    const { blob, contentType } = await toBlob(receiptImageSource);

    const uploadResult = await uploadBytes(storageRef, blob, {
      contentType,
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        userId,
      },
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
