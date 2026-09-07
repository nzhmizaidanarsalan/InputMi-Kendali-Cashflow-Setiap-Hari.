import { DocumentReference, SetOptions, setDoc, updateDoc } from 'firebase/firestore';
import {
  Asset,
  BalanceAuditChange,
  Liability,
  ScannedReceiptRecord,
  Transaction,
  UserProfile,
} from '../types';

/**
 * Recursively cleans any object or array to ensure NO JavaScript `undefined` values exist.
 * Firestore strictly rejects documents containing `undefined` with:
 * "Function setDoc() called with invalid data. Unsupported field value: undefined"
 *
 * Rules:
 * 1. Omit object keys whose value is undefined.
 * 2. If receiptUrl is explicitly given as undefined, convert to null.
 * 3. Recursively sanitize nested objects and arrays.
 * 4. Filter undefined elements from arrays.
 * 5. Allow null, boolean, number, string, and Date values.
 */
export function sanitizeForFirestore<T = any>(value: any): T {
  if (value === undefined) {
    return null as unknown as T;
  }

  if (typeof value === 'number') {
    if (isNaN(value) || !Number.isFinite(value)) {
      return 0 as unknown as T;
    }
    return value as unknown as T;
  }

  if (value === null || typeof value !== 'object') {
    return value as unknown as T;
  }

  if (value instanceof Date) {
    return value as unknown as T;
  }

  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }

  // Plain object
  const cleanObj: Record<string, any> = {};

  for (const [key, rawVal] of Object.entries(value)) {
    if (rawVal === undefined) {
      // For receiptUrl, Firestore prefers explicit null over undefined
      if (key === 'receiptUrl') {
        cleanObj[key] = null;
      }
      // Omit all other undefined properties
      continue;
    }

    const cleanedVal = sanitizeForFirestore(rawVal);
    if (cleanedVal !== undefined) {
      cleanObj[key] = cleanedVal;
    }
  }

  return cleanObj as T;
}

/**
 * Builds a 100% compliant, sanitized Transaction payload for Firestore.
 * Ensures required fields exist and optional fields never produce undefined.
 */
export function cleanTransactionForFirestore(tx: Partial<Transaction>): Record<string, any> {
  const payload: Record<string, any> = {
    id: tx.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: tx.type === 'income' ? 'income' : 'expense',
    amount: typeof tx.amount === 'number' && !isNaN(tx.amount) ? Math.round(tx.amount) : 0,
    date: tx.date || new Date().toISOString().split('T')[0],
    time: tx.time || new Date().toTimeString().slice(0, 5),
    title: (tx.title || 'Transaksi').trim(),
    category: (tx.category || 'Lainnya').trim(),
    paymentMethod: (tx.paymentMethod || 'Tunai').trim(),
    createdAt: typeof tx.createdAt === 'number' ? tx.createdAt : Date.now(),
    // Receipt URL must be either valid string URL or explicitly null (never undefined)
    receiptUrl: tx.receiptUrl ? String(tx.receiptUrl).trim() : null,
    storagePath: tx.storagePath ? String(tx.storagePath).trim() : null,
    // Audited optional fields
    note: tx.note && tx.note.trim() ? tx.note.trim() : null,
    receiptFileName: tx.receiptFileName && tx.receiptFileName.trim() ? tx.receiptFileName.trim() : null,
    receiptFileSize: tx.receiptFileSize && tx.receiptFileSize.trim() ? tx.receiptFileSize.trim() : null,
  };

  if (Array.isArray(tx.items) && tx.items.length > 0) {
    payload.items = tx.items.map((it) => ({
      name: (it.name || '').trim(),
      price: typeof it.price === 'number' && !isNaN(it.price) ? it.price : 0,
      qty: typeof it.qty === 'number' && !isNaN(it.qty) ? it.qty : 1,
    }));
  } else {
    payload.items = [];
  }

  return sanitizeForFirestore(payload);
}

/**
 * Builds a sanitized Asset payload for Firestore.
 */
export function cleanAssetForFirestore(asset: Partial<Asset>): Record<string, any> {
  const payload: Record<string, any> = {
    id: asset.id || `asset-${Date.now()}`,
    name: (asset.name || 'Aset').trim(),
    category: asset.category || 'bank',
    categoryLabel: (asset.categoryLabel || 'Kas & Bank').trim(),
    value: typeof asset.value === 'number' && !isNaN(asset.value) ? asset.value : 0,
    icon: (asset.icon || 'account_balance_wallet').trim(),
    monthlyChange: asset.monthlyChange ? asset.monthlyChange.trim() : null,
    monthlyChangeType: asset.monthlyChangeType || null,
    notes: asset.notes ? asset.notes.trim() : null,
  };

  return sanitizeForFirestore(payload);
}

/**
 * Builds a sanitized Liability payload for Firestore.
 */
export function cleanLiabilityForFirestore(liab: Partial<Liability>): Record<string, any> {
  const payload: Record<string, any> = {
    id: liab.id || `liab-${Date.now()}`,
    name: (liab.name || 'Kewajiban').trim(),
    category: liab.category || 'fintech',
    categoryLabel: (liab.categoryLabel || 'Kewajiban').trim(),
    totalRemaining: typeof liab.totalRemaining === 'number' && !isNaN(liab.totalRemaining) ? liab.totalRemaining : 0,
    monthlyPayment: typeof liab.monthlyPayment === 'number' && !isNaN(liab.monthlyPayment) ? liab.monthlyPayment : null,
    dueDate: (liab.dueDate || 'Akhir Bulan').trim(),
    icon: (liab.icon || 'credit_card').trim(),
    monthlyChange: liab.monthlyChange ? liab.monthlyChange.trim() : null,
    monthlyChangeType: liab.monthlyChangeType || null,
  };

  return sanitizeForFirestore(payload);
}

/**
 * Builds a sanitized BalanceAuditChange payload for Firestore.
 */
export function cleanAuditForFirestore(audit: Partial<BalanceAuditChange>): Record<string, any> {
  const payload: Record<string, any> = {
    id: audit.id || `ch-${Date.now()}`,
    name: (audit.name || 'Penyesuaian Saldo').trim(),
    description: (audit.description || '').trim(),
    changeAmount: typeof audit.changeAmount === 'number' && !isNaN(audit.changeAmount) ? audit.changeAmount : 0,
    type: audit.type || 'asset_increase',
    date: audit.date || new Date().toLocaleDateString('id-ID'),
  };

  return sanitizeForFirestore(payload);
}

/**
 * Builds a sanitized ScannedReceiptRecord payload for Firestore.
 */
export function cleanReceiptRecordForFirestore(record: Partial<ScannedReceiptRecord>): Record<string, any> {
  const rawImg = record.imageUrl ? String(record.imageUrl).trim() : null;
  // If imageUrl is a huge data URL, do not send multi-megabytes to Firestore document
  const safeImageUrl = rawImg && (rawImg.startsWith('http://') || rawImg.startsWith('https://')) ? rawImg : null;

  const payload: Record<string, any> = {
    id: record.id || `scan-${Date.now()}`,
    merchant: (record.merchant || 'Struk').trim(),
    amount: typeof record.amount === 'number' && !isNaN(record.amount) ? Math.round(record.amount) : 0,
    date: record.date || new Date().toISOString().split('T')[0],
    time: record.time || new Date().toTimeString().slice(0, 5),
    imageUrl: safeImageUrl,
    fileName: record.fileName || null,
    fileSize: record.fileSize || null,
    status: record.status || 'Tersimpan',
    category: record.category || 'Belanja Harian',
    paymentMethod: record.paymentMethod || 'QRIS BCA',
  };

  return sanitizeForFirestore(payload);
}

/**
 * Builds a sanitized User Profile payload for Firestore.
 */
export function cleanProfileForFirestore(profile: Partial<UserProfile> & { updatedAt?: number }): Record<string, any> {
  const payload: Record<string, any> = {
    displayName: profile.displayName ? profile.displayName.trim() : 'Pengguna',
    email: profile.email || null,
    photoURL: profile.photoURL || null,
    updatedAt: profile.updatedAt || Date.now(),
  };

  return sanitizeForFirestore(payload);
}

/**
 * Universal safe setDoc wrapper:
 * Automatically sanitizes data before writing to Firestore, eliminating undefined errors.
 */
export async function safeSetDoc(docRef: DocumentReference, data: any, options?: SetOptions) {
  const sanitized = sanitizeForFirestore(data);
  return await setDoc(docRef, sanitized, options || {});
}

/**
 * Universal safe updateDoc wrapper:
 * Automatically sanitizes updates before writing to Firestore.
 */
export async function safeUpdateDoc(docRef: DocumentReference, data: any) {
  const sanitized = sanitizeForFirestore(data);
  return await updateDoc(docRef, sanitized);
}
