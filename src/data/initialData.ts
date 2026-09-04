import { Asset, BalanceAuditChange, Liability, ScannedReceiptRecord, Transaction } from '../types';

// Default initial state for production users: Strictly zero and empty
export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const INITIAL_ASSETS: Asset[] = [];

export const INITIAL_LIABILITIES: Liability[] = [];

export const INITIAL_BALANCE_CHANGES: BalanceAuditChange[] = [];

export const INITIAL_SCANNED_RECEIPTS: ScannedReceiptRecord[] = [];

// Optional sample data available only if the user explicitly triggers Demo Mode
export const DEMO_SAMPLE_DATA = {
  transactions: [
    {
      id: 'tx-demo-1',
      type: 'expense' as const,
      amount: 185000,
      date: '2026-09-04',
      time: '12:45',
      title: 'Grand Lucky SCBD',
      category: 'Belanja Harian',
      paymentMethod: 'QRIS BCA',
      note: 'Stok susu almond, apel fuji, dan camilan kantor',
      receiptUrl:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuCLb1rZtWF5avH-k_rW1_1CqDgKTmOUDf2-luW6qayru335zD7YjWjxBob6HnD3nWBMeIul74-E_CiwsonnBk-LTRPBxeaR2yh6KGzk2BHXz2OmYXQqerIfEn8ELgqxPovLgRSQ3Y1NJIqc8W6uqd16OewiDcRZpjITb2ygLgcyduxmxwU0PpBxfUdrC5U93xjVyl_jo-igxXFpM0spaoiFoRHfOQbFR-2KhIGx5FOvUNKy5tnSZJFFGw',
      receiptFileName: 'Grand Lucky SCBD.jpg',
      receiptFileSize: '1.2 MB',
      items: [
        { name: 'Buah Segar', price: 65000, qty: 1 },
        { name: 'Daging & Ayam', price: 95000, qty: 1 },
        { name: 'Bumbu Dapur', price: 25000, qty: 1 },
      ],
      createdAt: 1788525900000,
    },
    {
      id: 'tx-demo-2',
      type: 'income' as const,
      amount: 5000000,
      date: '2026-09-04',
      time: '09:12',
      title: 'Gaji PT Teknologi',
      category: 'Karir & Gaji',
      paymentMethod: 'Transfer BCA',
      note: 'Payroll periode September 2026',
      createdAt: 1788513120000,
    },
  ],
  assets: [
    {
      id: 'asset-demo-1',
      name: 'Tabungan Utama BCA',
      category: 'bank' as const,
      categoryLabel: 'Kas & Bank',
      value: 12500000,
      monthlyChange: 'Rekening operasional harian',
      monthlyChangeType: 'positive' as const,
      icon: 'account_balance',
    },
  ],
  liabilities: [
    {
      id: 'liab-demo-1',
      name: 'Kartu Kredit BCA',
      category: 'konsumsi' as const,
      categoryLabel: 'Kartu Kredit',
      totalRemaining: 1500000,
      monthlyPayment: 500000,
      dueDate: '15 Sep 2026',
      monthlyChange: 'Jatuh tempo 15 September',
      monthlyChangeType: 'neutral' as const,
      icon: 'credit_card',
    },
  ],
};
