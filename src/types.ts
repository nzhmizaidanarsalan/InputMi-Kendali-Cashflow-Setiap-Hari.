export type TransactionType = 'income' | 'expense';

export interface TransactionItem {
  name: string;
  price: number;
  qty?: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number; // numeric integer in IDR (e.g. 185000)
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  title: string; // Merchant or source name
  category: string;
  paymentMethod: string;
  note?: string | null;
  receiptUrl?: string | null;
  receiptFileName?: string | null;
  receiptFileSize?: string | null;
  storagePath?: string | null;
  items?: TransactionItem[];
  pendingSync?: boolean;
  syncError?: string | null;
  createdAt: number;
}

export type AssetCategory = 'bank' | 'investasi' | 'digital' | 'peralatan' | 'properti' | 'lainnya';

export interface Asset {
  id: string;
  name: string;
  category: AssetCategory;
  categoryLabel: string;
  value: number;
  monthlyChange?: string | null;
  monthlyChangeType?: 'positive' | 'neutral' | 'negative' | null;
  notes?: string | null;
  icon: string;
  pendingSync?: boolean;
}

export type LiabilityCategory = 'kendaraan' | 'konsumsi' | 'fintech' | 'kpr' | 'lainnya';

export interface LiabilityReminderState {
  h3Sent?: boolean;
  h1Sent?: boolean;
  dueDateSent?: boolean;
  lastEvaluatedDueDate?: string;
  updatedAt?: number;
}

export interface Liability {
  id: string;
  name: string;
  category: LiabilityCategory;
  categoryLabel: string;
  totalRemaining: number;
  monthlyPayment?: number | null;
  dueDate: string; // e.g. "15 Sep 2026"
  monthlyChange?: string | null;
  monthlyChangeType?: 'positive' | 'neutral' | 'negative' | null;
  icon: string;
  pendingSync?: boolean;
  reminderState?: LiabilityReminderState;
}

export interface BalanceAuditChange {
  id: string;
  name: string;
  description: string;
  changeAmount: number;
  type: 'asset_increase' | 'liability_decrease' | 'asset_decrease' | 'liability_increase';
  date: string;
}

export interface ScannedReceiptRecord {
  id: string;
  merchant: string;
  amount: number;
  date: string;
  time: string;
  imageUrl: string;
  fileName: string;
  fileSize: string;
  status: 'Tersimpan' | 'Draft';
  category: string;
  paymentMethod: string;
}

export type SourceMode = 'camera' | 'gallery' | 'transfer';

export type DocumentType =
  | 'receipt'
  | 'transfer_proof'
  | 'invoice'
  | 'payment_screenshot'
  | 'financial_document'
  | 'unknown';

export interface ReceiptScanResult {
  documentType?: DocumentType;
  transactionType?: 'income' | 'expense' | 'unknown';
  type: TransactionType;
  amount: number | null;
  date: string | null;
  time: string | null;
  merchant: string | null;
  bankOrWallet?: string | null;
  sender?: string | null;
  recipient?: string | null;
  paymentMethod: string | null;
  referenceNumber?: string | null;
  invoiceNumber?: string | null;
  dueDate?: string | null;
  description?: string | null;
  category: string | null;
  status?: string | null;
  confidence?: 'high' | 'medium' | 'low';
  items?: TransactionItem[];
  referenceNo?: string;
  notes?: string;
  isUncertain?: boolean;
  uncertainFields?: string[];
  detectionSummary?: string;
}

export type ActiveTab = 'overview' | 'cashflow' | 'scan' | 'balance' | 'analytics';

export type CloudSyncStatus =
  | 'offline'
  | 'unauthenticated'
  | 'syncing'
  | 'synced'
  | 'error';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
}
