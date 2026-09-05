/**
 * Safe Image Utilities for InputMi Mobile & Web
 * Handles file validation, safe object URLs, HEIC handling, and canvas resizing for OCR & Storage.
 */

export interface ProcessedImageResult {
  file: File;
  previewUrl: string;       // Safe blob: URL for local preview
  dataUrl: string;          // Safe compressed data:image/jpeg;base64,... URL
  cleanBase64: string;      // Base64 payload without prefix for OCR
  mimeType: string;         // 'image/jpeg'
  fileName: string;
  fileSizeStr: string;
}

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_DIMENSION = 1800; // Optimal for OCR readability & fast transmission

/**
 * Validates file presence, size, and image MIME type.
 */
export function validateImageFile(file: unknown): { valid: boolean; error?: string } {
  if (!file || !(file instanceof File)) {
    return { valid: false, error: 'Tidak ada file gambar yang dipilih.' };
  }

  if (file.size === 0) {
    return { valid: false, error: 'File gambar kosong atau rusak.' };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Ukuran foto (${sizeMb} MB) melebihi batas maksimal 15 MB. Silakan pilih foto lain atau perkecil resolusi kamera.`,
    };
  }

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  const isSupportedType =
    type.startsWith('image/') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp') ||
    name.endsWith('.heic') ||
    name.endsWith('.heif');

  if (!isSupportedType) {
    return {
      valid: false,
      error: 'Format file tidak didukung. Harap pilih foto struk atau screenshot berformat JPG, PNG, WEBP, atau HEIC.',
    };
  }

  return { valid: true };
}

/**
 * Creates a safe local object URL for preview.
 */
export function createSafePreviewUrl(file: File): string {
  try {
    return URL.createObjectURL(file);
  } catch (err) {
    console.warn('URL.createObjectURL failed, falling back to empty string', err);
    return '';
  }
}

/**
 * Revokes a safe local object URL when no longer needed.
 */
export function revokeSafePreviewUrl(url: string | null | undefined): void {
  if (url && typeof url === 'string' && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore revocation errors
    }
  }
}

/**
 * Formats bytes to readable KB/MB string.
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  const kb = Math.round(bytes / 1024);
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * Safely processes an uploaded/captured image:
 * - Creates safe preview URL
 * - Downscales large phone camera photos to MAX_DIMENSION
 * - Exports as standard clean image/jpeg
 * - Handles HEIC fallback gracefully without crashing
 */
export async function processImageForOcr(
  file: File,
  sourceLabel: 'kamera' | 'galeri' | 'transfer' = 'galeri'
): Promise<ProcessedImageResult> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const isHeic =
    file.type.toLowerCase().includes('heic') ||
    file.type.toLowerCase().includes('heif') ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name);

  // Generate safe temporary object URL for reading
  let tempObjectUrl: string | null = null;
  try {
    tempObjectUrl = URL.createObjectURL(file);
  } catch (e) {
    console.warn('createObjectURL failed for file:', e);
  }

  // Generate a clean file name
  const timestamp = Date.now();
  const ext = 'jpg';
  const prefix =
    sourceLabel === 'kamera'
      ? 'Foto_Kamera'
      : sourceLabel === 'transfer'
      ? 'Bukti_Transfer'
      : 'Struk_Galeri';
  const safeFileName = `${prefix}_${timestamp}.${ext}`;

  try {
    // Attempt to load into an HTMLImageElement to downscale & normalize
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      // Required for CORS when dealing with canvas
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          if (!width || !height) {
            return reject(new Error('Dimensi foto tidak valid.'));
          }

          // Scale down if exceeds MAX_DIMENSION while keeping aspect ratio
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width > height) {
              height = Math.round((height * MAX_DIMENSION) / width);
              width = MAX_DIMENSION;
            } else {
              width = Math.round((width * MAX_DIMENSION) / height);
              height = MAX_DIMENSION;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Canvas konteks 2D tidak tersedia di browser ini.'));
          }

          // High quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Fill white background (useful for transparent PNGs converted to JPEG)
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);

          // Draw image
          ctx.drawImage(img, 0, 0, width, height);

          // Export as clean JPEG data URL
          const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.88);
          resolve(jpegDataUrl);
        } catch (canvasErr) {
          reject(canvasErr);
        }
      };

      img.onerror = () => {
        if (isHeic) {
          reject(
            new Error(
              'Format foto HEIC/HEIF dari perangkat Anda tidak dapat didekode oleh browser. Harap gunakan foto JPG/PNG atau screenshot bukti transaksi tersebut.'
            )
          );
        } else {
          reject(new Error('Gagal memuat gambar. Pastikan file tidak rusak dan coba lagi.'));
        }
      };

      if (tempObjectUrl) {
        img.src = tempObjectUrl;
      } else {
        // Fallback to FileReader if createObjectURL failed
        const reader = new FileReader();
        reader.onload = () => {
          img.src = reader.result as string;
        };
        reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
        reader.readAsDataURL(file);
      }
    });

    // Extract base64 without prefix
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex === -1) {
      throw new Error('Format data gambar tidak valid.');
    }
    const cleanBase64 = dataUrl.substring(commaIndex + 1);

    // Approximate size from base64 length
    const approxBytes = Math.round((cleanBase64.length * 3) / 4);
    const fileSizeStr = formatFileSize(approxBytes);

    // Safe persistent preview URL
    const previewUrl = tempObjectUrl || dataUrl;

    return {
      file,
      previewUrl,
      dataUrl,
      cleanBase64,
      mimeType: 'image/jpeg',
      fileName: safeFileName,
      fileSizeStr,
    };
  } catch (err: any) {
    if (tempObjectUrl) {
      revokeSafePreviewUrl(tempObjectUrl);
    }
    throw err;
  }
}
