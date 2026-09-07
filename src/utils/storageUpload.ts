import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, storage } from '../lib/firebase';

export interface StorageUploadResult {
  downloadUrl: string;
  storagePath: string;
}

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
    try {
      const res = await fetch(input);
      const blob = await res.blob();
      return {
        blob,
        contentType: blob.type || 'image/jpeg',
      };
    } catch {
      // Fallback to manual decode
    }

    const commaIndex = input.indexOf(',');
    if (commaIndex === -1) {
      throw new Error('Data gambar struk tidak memiliki format yang valid.');
    }

    const header = input.substring(0, commaIndex);
    let base64Data = input.substring(commaIndex + 1).replace(/\s/g, '');

    while (base64Data.length % 4 !== 0) {
      base64Data += '=';
    }

    const mimeMatch = header.match(/data:([^;]+)/);
    const contentType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

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
 * Includes a strict 7-second timeout to ensure the UI NEVER hangs indefinitely
 * when Firebase Storage is not provisioned or CORS blocks preflights.
 */
export async function uploadReceiptToStorage(
  userId: string,
  receiptImageSource: string | File | Blob,
  fileName?: string
): Promise<StorageUploadResult> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.uid || currentUser.uid !== userId) {
    throw new Error('Pengguna belum terautentikasi untuk menyimpan berkas ke Cloud.');
  }

  if (!receiptImageSource) {
    throw new Error('Sumber gambar struk tidak valid atau kosong.');
  }

  // Already a remote web / cloud storage URL
  if (typeof receiptImageSource === 'string' && (receiptImageSource.startsWith('http://') || receiptImageSource.startsWith('https://'))) {
    return { downloadUrl: receiptImageSource, storagePath: '' };
  }

  const cleanBaseName = (fileName || (receiptImageSource instanceof File ? receiptImageSource.name : `receipt_${Date.now()}.jpg`))
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Safe storage path: users/{uid}/receipts/{fileId}
  const fileId = `${Date.now()}_${cleanBaseName}`;
  const path = `users/${userId}/receipts/${fileId}`;
  const storageRef = ref(storage, path);

  const performUpload = async (): Promise<StorageUploadResult> => {
    const { blob, contentType } = await toBlob(receiptImageSource);

    const uploadResult = await uploadBytes(storageRef, blob, {
      contentType,
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        userId,
      },
    });

    const downloadUrl = await getDownloadURL(uploadResult.ref);
    return { downloadUrl, storagePath: path };
  };

  // 7-second timeout safeguard
  const timeoutPromise = new Promise<StorageUploadResult>((_, reject) => {
    const timer = setTimeout(() => {
      clearTimeout(timer);
      reject(new Error('Batas waktu unggah berkas gambar ke Cloud Storage habis (timeout 7 detik).'));
    }, 7000);
  });

  return await Promise.race([performUpload(), timeoutPromise]);
}
