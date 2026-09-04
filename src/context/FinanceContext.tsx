import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import {
  cleanAssetForFirestore,
  cleanAuditForFirestore,
  cleanLiabilityForFirestore,
  cleanProfileForFirestore,
  cleanReceiptRecordForFirestore,
  cleanTransactionForFirestore,
  safeSetDoc,
  safeUpdateDoc,
  sanitizeForFirestore,
} from '../utils/firestoreSanitizer';
import { uploadReceiptToStorage } from '../utils/storageUpload';
import {
  ActiveTab,
  Asset,
  BalanceAuditChange,
  CloudSyncStatus,
  Liability,
  ScannedReceiptRecord,
  Transaction,
  UserProfile,
} from '../types';
import {
  DEMO_SAMPLE_DATA,
  INITIAL_ASSETS,
  INITIAL_BALANCE_CHANGES,
  INITIAL_LIABILITIES,
  INITIAL_SCANNED_RECEIPTS,
  INITIAL_TRANSACTIONS,
} from '../data/initialData';

interface FinanceContextType {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;

  // Firebase User & Sync Status
  user: UserProfile | null;
  isAuthLoading: boolean;
  cloudSyncStatus: CloudSyncStatus;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  updateUserDisplayName: (name: string) => Promise<void>;
  updateUserProfilePhoto: (photoDataUrl: string) => Promise<void>;
  syncLocalDataToCloud: () => Promise<void>;
  retrySyncAllPending: () => Promise<void>;
  hasUnsyncedLocalData: boolean;

  // Data Collections
  transactions: Transaction[];
  assets: Asset[];
  liabilities: Liability[];
  balanceChanges: BalanceAuditChange[];
  scannedReceipts: ScannedReceiptRecord[];

  // Computed Financial Metrics (Strictly starts at 0 for new user)
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  savingsRate: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  solvencyAssetPercent: number;
  solvencyLiabilityPercent: number;
  weeklyData: { week: string; income: number; expense: number; isCurrent?: boolean }[];
  categoryBreakdown: { name: string; amount: number; percentage: number; color: string }[];
  incomeBreakdown: { name: string; amount: number; percentage: number; color: string }[];

  // Modal / Sheet States
  isAddTxOpen: boolean;
  openAddTx: (type?: 'income' | 'expense') => void;
  closeAddTx: () => void;
  addTxInitialType: 'income' | 'expense';

  selectedTxDetail: Transaction | null;
  openTxDetail: (tx: Transaction) => void;
  closeTxDetail: () => void;

  editingTx: Transaction | null;
  openEditTx: (tx: Transaction) => void;

  lightboxImageUrl: string | null;
  openLightbox: (url: string) => void;
  closeLightbox: () => void;

  toastMessage: string | null;
  showToast: (msg: string) => void;

  // CRUD Mutators
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Promise<Transaction>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  addAsset: (asset: Omit<Asset, 'id'>) => Promise<Asset>;
  updateAsset: (id: string, updates: Partial<Asset>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;

  addLiability: (liability: Omit<Liability, 'id'>) => Promise<Liability>;
  updateLiability: (id: string, updates: Partial<Liability>) => Promise<void>;
  deleteLiability: (id: string) => Promise<void>;
  payLiability: (id: string, paymentAmount?: number) => Promise<void>;

  addScannedReceiptRecord: (record: Omit<ScannedReceiptRecord, 'id'>) => Promise<void>;
  checkDuplicateReceipt: (amount: number, date: string, merchant: string) => Transaction | undefined;

  // Data management
  resetToZero: () => Promise<void>;
  loadDemoData: () => Promise<void>;
  exportDataJSON: () => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const STORAGE_KEYS = {
  TRANSACTIONS: 'inputmi_v3_tx',
  ASSETS: 'inputmi_v3_assets',
  LIABILITIES: 'inputmi_v3_liab',
  CHANGES: 'inputmi_v3_changes',
  SCANS: 'inputmi_v3_scans',
};

// Check if stored data belongs to legacy demo data and purge it
function cleanLegacyDemoStorage() {
  try {
    const legacyKeys = [
      'inputmi_tx_v2',
      'inputmi_assets_v2',
      'inputmi_liab_v2',
      'inputmi_changes_v2',
      'inputmi_scans_v2',
      'inputmi_transactions',
      'inputmi_assets',
      'inputmi_liabilities',
    ];
    legacyKeys.forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    console.warn('Storage cleanup notice:', e);
  }
}

cleanLegacyDemoStorage();

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('September 2026');

  // Firebase Auth State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>('offline');

  // Core Data Collections (Starts empty by default)
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  const [assets, setAssets] = useState<Asset[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ASSETS);
      return saved ? JSON.parse(saved) : INITIAL_ASSETS;
    } catch {
      return INITIAL_ASSETS;
    }
  });

  const [liabilities, setLiabilities] = useState<Liability[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LIABILITIES);
      return saved ? JSON.parse(saved) : INITIAL_LIABILITIES;
    } catch {
      return INITIAL_LIABILITIES;
    }
  });

  const [balanceChanges, setBalanceChanges] = useState<BalanceAuditChange[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CHANGES);
      return saved ? JSON.parse(saved) : INITIAL_BALANCE_CHANGES;
    } catch {
      return INITIAL_BALANCE_CHANGES;
    }
  });

  const [scannedReceipts, setScannedReceipts] = useState<ScannedReceiptRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SCANS);
      return saved ? JSON.parse(saved) : INITIAL_SCANNED_RECEIPTS;
    } catch {
      return INITIAL_SCANNED_RECEIPTS;
    }
  });

  // Modal / Interaction States
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [addTxInitialType, setAddTxInitialType] = useState<'income' | 'expense'>('expense');
  const [selectedTxDetail, setSelectedTxDetail] = useState<Transaction | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync to local storage for offline resilience
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    } catch {}
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ASSETS, JSON.stringify(assets));
    } catch {}
  }, [assets]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LIABILITIES, JSON.stringify(liabilities));
    } catch {}
  }, [liabilities]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CHANGES, JSON.stringify(balanceChanges));
    } catch {}
  }, [balanceChanges]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SCANS, JSON.stringify(scannedReceipts));
    } catch {}
  }, [scannedReceipts]);

  // Auth Initialization: Strictly Google Auth or Local Mode (NO ANONYMOUS AUTH)
  useEffect(() => {
    const handleOnline = () => {
      if (auth.currentUser) {
        setCloudSyncStatus('syncing');
        retrySyncAllPending();
      } else {
        setCloudSyncStatus('unauthenticated');
      }
    };
    const handleOffline = () => {
      setCloudSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsAuthLoading(false);

      if (!navigator.onLine) {
        setCloudSyncStatus('offline');
      }

      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || 'Pengguna Google',
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
          isAnonymous: false,
        });
        if (navigator.onLine) {
          setCloudSyncStatus('syncing');
        }
      } else {
        // User is not logged in: Local mode. No anonymous auth!
        setUser(null);
        if (navigator.onLine) {
          setCloudSyncStatus('unauthenticated');
        }
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Real-time Firestore Subscriptions
  useEffect(() => {
    if (!user) {
      if (navigator.onLine) {
        setCloudSyncStatus('unauthenticated');
      }
      return;
    }

    if (!navigator.onLine) {
      setCloudSyncStatus('offline');
      return;
    }

    setCloudSyncStatus('syncing');

    // Ensure user profile document exists in Firestore safely
    const userDocRef = doc(db, 'users', user.uid);
    safeSetDoc(
      userDocRef,
      cleanProfileForFirestore({
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        updatedAt: Date.now(),
      }),
      { merge: true }
    ).catch((err) => {
      console.warn('Profile sync notice:', err);
    });

    // 1. Subscribe to transactions
    const txCol = collection(db, 'users', user.uid, 'transactions');
    const unsubTx = onSnapshot(
      txCol,
      async (snapshot) => {
        if (!snapshot.empty) {
          const list: Transaction[] = [];
          snapshot.forEach((d) => {
            list.push({ ...(d.data() as Transaction), id: d.id });
          });
          list.sort((a, b) => b.createdAt - a.createdAt);
          setTransactions(list);
          setCloudSyncStatus('synced');
        } else {
          // Cloud has no transactions yet: if local has data, auto-upload to cloud safely
          const localSaved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
          if (localSaved) {
            try {
              const localList: Transaction[] = JSON.parse(localSaved);
              if (localList.length > 0) {
                for (const t of localList) {
                  await safeSetDoc(doc(db, 'users', user.uid, 'transactions', t.id), cleanTransactionForFirestore(t));
                }
              }
            } catch (err) {
              console.warn('Initial local tx upload error:', err);
            }
          }
          setCloudSyncStatus('synced');
        }
      },
      (err) => {
        console.warn('Firestore tx sync error:', err);
        setCloudSyncStatus('error');
      }
    );

    // 2. Subscribe to assets
    const assetCol = collection(db, 'users', user.uid, 'assets');
    const unsubAsset = onSnapshot(
      assetCol,
      async (snapshot) => {
        if (!snapshot.empty) {
          const list: Asset[] = [];
          snapshot.forEach((d) => {
            list.push({ ...(d.data() as Asset), id: d.id });
          });
          setAssets(list);
        } else {
          const localSaved = localStorage.getItem(STORAGE_KEYS.ASSETS);
          if (localSaved) {
            try {
              const localList: Asset[] = JSON.parse(localSaved);
              if (localList.length > 0) {
                for (const a of localList) {
                  await safeSetDoc(doc(db, 'users', user.uid, 'assets', a.id), cleanAssetForFirestore(a));
                }
              }
            } catch (err) {
              console.warn('Initial local asset upload error:', err);
            }
          }
        }
      },
      (err) => {
        console.warn('Firestore assets sync error:', err);
        setCloudSyncStatus('error');
      }
    );

    // 3. Subscribe to liabilities
    const liabCol = collection(db, 'users', user.uid, 'liabilities');
    const unsubLiab = onSnapshot(
      liabCol,
      async (snapshot) => {
        if (!snapshot.empty) {
          const list: Liability[] = [];
          snapshot.forEach((d) => {
            list.push({ ...(d.data() as Liability), id: d.id });
          });
          setLiabilities(list);
        } else {
          const localSaved = localStorage.getItem(STORAGE_KEYS.LIABILITIES);
          if (localSaved) {
            try {
              const localList: Liability[] = JSON.parse(localSaved);
              if (localList.length > 0) {
                for (const l of localList) {
                  await safeSetDoc(doc(db, 'users', user.uid, 'liabilities', l.id), cleanLiabilityForFirestore(l));
                }
              }
            } catch (err) {
              console.warn('Initial local liability upload error:', err);
            }
          }
        }
      },
      (err) => {
        console.warn('Firestore liabilities sync error:', err);
        setCloudSyncStatus('error');
      }
    );

    // 4. Subscribe to balance audit changes
    const changeCol = collection(db, 'users', user.uid, 'balanceChanges');
    const unsubChanges = onSnapshot(
      changeCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: BalanceAuditChange[] = [];
          snapshot.forEach((d) => {
            list.push({ ...(d.data() as BalanceAuditChange), id: d.id });
          });
          setBalanceChanges(list);
        }
      },
      (err) => console.warn('Firestore changes sync error:', err)
    );

    // 5. Subscribe to scanned receipts
    const scanCol = collection(db, 'users', user.uid, 'scannedReceipts');
    const unsubScans = onSnapshot(
      scanCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: ScannedReceiptRecord[] = [];
          snapshot.forEach((d) => {
            list.push({ ...(d.data() as ScannedReceiptRecord), id: d.id });
          });
          setScannedReceipts(list);
        }
      },
      (err) => console.warn('Firestore scans sync error:', err)
    );

    return () => {
      unsubTx();
      unsubAsset();
      unsubLiab();
      unsubChanges();
      unsubScans();
    };
  }, [user]);

  // Auth Methods
  const signInWithGoogle = async () => {
    try {
      setCloudSyncStatus('syncing');
      const result = await signInWithPopup(auth, googleProvider);
      setUser({
        uid: result.user.uid,
        displayName: result.user.displayName || 'Pengguna Google',
        email: result.user.email,
        photoURL: result.user.photoURL,
        isAnonymous: false,
      });
      setCloudSyncStatus('synced');
      showToast(`Selamat datang, ${result.user.displayName || 'Pengguna Google'}!`);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        showToast('Proses masuk Google dibatalkan.');
      } else {
        console.error('Google sign in error:', err);
        showToast(`Gagal masuk dengan Google: ${err?.message || 'Terjadi kesalahan'}`);
      }
      setCloudSyncStatus(navigator.onLine ? 'unauthenticated' : 'offline');
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setCloudSyncStatus(navigator.onLine ? 'unauthenticated' : 'offline');
      showToast('Berhasil keluar dari akun Google.');
    } catch (err: any) {
      console.error('Sign out error:', err);
      showToast('Gagal keluar dari akun.');
    }
  };

  const updateUserDisplayName = async (newName: string) => {
    if (!newName.trim()) return;
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: newName.trim() });
      }
      if (user) {
        await safeSetDoc(
          doc(db, 'users', user.uid),
          cleanProfileForFirestore({ displayName: newName.trim(), updatedAt: Date.now() }),
          { merge: true }
        );
        setUser((prev) => (prev ? { ...prev, displayName: newName.trim() } : null));
      }
      showToast('Nama profil berhasil diperbarui.');
    } catch (err: any) {
      console.error('Profile update error:', err);
      showToast('Gagal memperbarui nama profil.');
    }
  };

  const updateUserProfilePhoto = async (photoDataUrl: string) => {
    if (!photoDataUrl) return;
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: photoDataUrl });
      }
      if (user) {
        await safeSetDoc(
          doc(db, 'users', user.uid),
          cleanProfileForFirestore({ photoURL: photoDataUrl, updatedAt: Date.now() }),
          { merge: true }
        );
        setUser((prev) => (prev ? { ...prev, photoURL: photoDataUrl } : null));
      }
      showToast('Foto profil berhasil diperbarui.');
    } catch (err: any) {
      console.error('Profile photo update error:', err);
      showToast('Gagal memperbarui foto profil.');
    }
  };

  const syncLocalDataToCloud = async () => {
    if (!user) {
      showToast('Silakan masuk dengan akun Google terlebih dahulu.');
      return;
    }
    setCloudSyncStatus('syncing');
    try {
      // 1. Transactions
      for (const t of transactions) {
        let syncedTx = { ...t };
        // If receipt is local base64, attempt storage upload
        if (syncedTx.receiptUrl && syncedTx.receiptUrl.startsWith('data:')) {
          try {
            const dlUrl = await uploadReceiptToStorage(user.uid, syncedTx.receiptUrl, syncedTx.receiptFileName || undefined);
            syncedTx.receiptUrl = dlUrl;
          } catch (e) {
            console.warn('Receipt upload in batch sync skipped:', e);
            syncedTx.receiptUrl = null;
          }
        }
        await safeSetDoc(
          doc(db, 'users', user.uid, 'transactions', syncedTx.id),
          cleanTransactionForFirestore(syncedTx),
          { merge: true }
        );
      }

      // 2. Assets
      for (const a of assets) {
        await safeSetDoc(
          doc(db, 'users', user.uid, 'assets', a.id),
          cleanAssetForFirestore(a),
          { merge: true }
        );
      }

      // 3. Liabilities
      for (const l of liabilities) {
        await safeSetDoc(
          doc(db, 'users', user.uid, 'liabilities', l.id),
          cleanLiabilityForFirestore(l),
          { merge: true }
        );
      }

      // 4. Audit Changes
      for (const ch of balanceChanges) {
        await safeSetDoc(
          doc(db, 'users', user.uid, 'balanceChanges', ch.id),
          cleanAuditForFirestore(ch),
          { merge: true }
        );
      }

      // 5. Scanned Receipts
      for (const sc of scannedReceipts) {
        await safeSetDoc(
          doc(db, 'users', user.uid, 'scannedReceipts', sc.id),
          cleanReceiptRecordForFirestore(sc),
          { merge: true }
        );
      }

      // Clear pendingSync status locally
      setTransactions((prev) => prev.map((tx) => ({ ...tx, pendingSync: false, syncError: null })));
      setAssets((prev) => prev.map((a) => ({ ...a, pendingSync: false })));
      setLiabilities((prev) => prev.map((l) => ({ ...l, pendingSync: false })));

      setCloudSyncStatus('synced');
      showToast('Data berhasil disinkronkan ke Google Cloud Firestore.');
    } catch (err: any) {
      console.error('Manual sync error:', err);
      setCloudSyncStatus('error');
      showToast('Gagal menyinkronkan data ke Cloud: ' + (err?.message || 'Koneksi bermasalah'));
    }
  };

  const retrySyncAllPending = async () => {
    await syncLocalDataToCloud();
  };

  const hasUnsyncedLocalData = !user && (transactions.length > 0 || assets.length > 0 || liabilities.length > 0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  const openAddTx = (type: 'income' | 'expense' = 'expense') => {
    setEditingTx(null);
    setAddTxInitialType(type);
    setIsAddTxOpen(true);
  };

  const closeAddTx = () => {
    setIsAddTxOpen(false);
    setEditingTx(null);
  };

  const openTxDetail = (tx: Transaction) => {
    setSelectedTxDetail(tx);
  };

  const closeTxDetail = () => {
    setSelectedTxDetail(null);
  };

  const openEditTx = (tx: Transaction) => {
    setSelectedTxDetail(null);
    setEditingTx(tx);
    setAddTxInitialType(tx.type);
    setIsAddTxOpen(true);
  };

  const openLightbox = (url: string) => {
    setLightboxImageUrl(url);
  };

  const closeLightbox = () => {
    setLightboxImageUrl(null);
  };

  // Financial calculations (Pure mathematical derivation, starts at 0)
  const totalIncome = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const totalExpense = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const netCashflow = useMemo(() => {
    return totalIncome - totalExpense;
  }, [totalIncome, totalExpense]);

  const savingsRate = useMemo(() => {
    if (totalIncome <= 0) return 0;
    return Math.max(0, Math.round((netCashflow / totalIncome) * 1000) / 10);
  }, [totalIncome, netCashflow]);

  const totalAssets = useMemo(() => {
    return assets.reduce((sum, a) => sum + a.value, 0);
  }, [assets]);

  const totalLiabilities = useMemo(() => {
    return liabilities.reduce((sum, l) => sum + l.totalRemaining, 0);
  }, [liabilities]);

  const netWorth = useMemo(() => {
    return totalAssets - totalLiabilities;
  }, [totalAssets, totalLiabilities]);

  const solvencyAssetPercent = useMemo(() => {
    const total = totalAssets + totalLiabilities;
    if (total <= 0) return 100;
    return Math.round((totalAssets / total) * 100);
  }, [totalAssets, totalLiabilities]);

  const solvencyLiabilityPercent = useMemo(() => {
    return Math.max(0, 100 - solvencyAssetPercent);
  }, [solvencyAssetPercent]);

  // Weekly breakdown calculation
  const weeklyData = useMemo(() => {
    const w1 = { week: 'M1', income: 0, expense: 0 };
    const w2 = { week: 'M2', income: 0, expense: 0 };
    const w3 = { week: 'M3', income: 0, expense: 0 };
    const w4 = { week: 'M4 (Kini)', income: 0, expense: 0, isCurrent: true };

    transactions.forEach((tx) => {
      const day = parseInt(tx.date.split('-')[2] || '1', 10);
      let target = w1;
      if (day <= 7) target = w1;
      else if (day <= 14) target = w2;
      else if (day <= 21) target = w3;
      else target = w4;

      if (tx.type === 'income') {
        target.income += tx.amount;
      } else {
        target.expense += tx.amount;
      }
    });

    return [w1, w2, w3, w4];
  }, [transactions]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        map[t.category] = (map[t.category] || 0) + t.amount;
      });

    const colors = ['#ba1a1a', '#45464c', '#3980f4', '#575e70', '#00714d', '#76777d'];
    const total = Object.values(map).reduce((a, b) => a + b, 0) || 1;

    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount], idx) => ({
        name,
        amount,
        percentage: Math.round((amount / total) * 100),
        color: colors[idx % colors.length],
      }));
  }, [transactions]);

  // Income sources breakdown
  const incomeBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter((t) => t.type === 'income')
      .forEach((t) => {
        map[t.title] = (map[t.title] || 0) + t.amount;
      });

    const colors = ['#006c49', '#3980f4', '#6ffbbe', '#7d8497'];
    const total = Object.values(map).reduce((a, b) => a + b, 0) || 1;

    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount], idx) => ({
        name,
        amount,
        percentage: Math.round((amount / total) * 100),
        color: colors[idx % colors.length],
      }));
  }, [transactions]);

  // Firestore Mutators (Optimistic Local + Cloud Firestore Sync)
  const addTransaction = async (txData: Omit<Transaction, 'id' | 'createdAt'>) => {
    // 1. Validate required fields
    if (txData.amount <= 0) {
      showToast('Nominal transaksi harus lebih dari 0.');
      throw new Error('Nominal transaksi harus lebih dari 0.');
    }
    const cleanTitle = (txData.title || '').trim();
    if (!cleanTitle) {
      showToast('Nama transaksi atau merchant wajib diisi.');
      throw new Error('Nama transaksi atau merchant wajib diisi.');
    }

    // 2. Receipt upload handling
    let finalReceiptUrl: string | null = null;
    let uploadErrorOccurred = false;

    if (txData.receiptUrl) {
      if (txData.receiptUrl.startsWith('http://') || txData.receiptUrl.startsWith('https://')) {
        finalReceiptUrl = txData.receiptUrl;
      } else if (user) {
        try {
          finalReceiptUrl = await uploadReceiptToStorage(
            user.uid,
            txData.receiptUrl,
            txData.receiptFileName || undefined
          );
        } catch (uploadErr: any) {
          console.warn('Storage receipt upload warning:', uploadErr);
          uploadErrorOccurred = true;
          showToast('Peringatan: Gagal mengunggah struk ke Cloud. Transaksi disimpan tanpa lampiran foto cloud.');
          finalReceiptUrl = null;
        }
      } else {
        // User not logged in: preserve local preview
        finalReceiptUrl = txData.receiptUrl;
      }
    }

    const newTx: Transaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: txData.type,
      amount: Math.round(txData.amount),
      date: txData.date || new Date().toISOString().split('T')[0],
      time: txData.time || new Date().toTimeString().slice(0, 5),
      title: cleanTitle,
      category: (txData.category || 'Lainnya').trim(),
      paymentMethod: (txData.paymentMethod || 'Tunai').trim(),
      note: txData.note && txData.note.trim() ? txData.note.trim() : null,
      receiptUrl: finalReceiptUrl, // Explicit null if no receipt, never undefined
      receiptFileName: txData.receiptFileName && txData.receiptFileName.trim() ? txData.receiptFileName.trim() : null,
      receiptFileSize: txData.receiptFileSize && txData.receiptFileSize.trim() ? txData.receiptFileSize.trim() : null,
      items: Array.isArray(txData.items) && txData.items.length > 0 ? txData.items : [],
      pendingSync: !user || uploadErrorOccurred,
      syncError: null,
      createdAt: Date.now(),
    };

    // 1. Optimistic local state update
    setTransactions((prev) => [newTx, ...prev]);

    // 2. Persist to Firestore if user active
    if (user) {
      setCloudSyncStatus('syncing');
      try {
        const payload = cleanTransactionForFirestore(newTx);
        await safeSetDoc(doc(db, 'users', user.uid, 'transactions', newTx.id), payload);
        newTx.pendingSync = false;
        newTx.syncError = null;
        setTransactions((prev) => prev.map((item) => (item.id === newTx.id ? { ...newTx } : item)));
        // Only mark UI as synced once write succeeds
        setCloudSyncStatus('synced');
      } catch (err: any) {
        console.error('Failed to sync new transaction to Firestore:', err);
        newTx.pendingSync = true;
        newTx.syncError = err?.message || 'Gagal menyimpan ke Firestore';
        setTransactions((prev) => prev.map((item) => (item.id === newTx.id ? { ...newTx } : item)));
        // Show "Gagal Sinkron"
        setCloudSyncStatus('error');
        showToast('Gagal sinkron ke Cloud. Data tersimpan di perangkat.');
      }
    } else {
      setCloudSyncStatus('unauthenticated');
    }

    // Link with asset if income and bank category exists
    if (newTx.type === 'income') {
      setAssets((prev) =>
        prev.map((a) => (a.category === 'bank' ? { ...a, value: a.value + newTx.amount } : a))
      );
    }

    showToast('Transaksi berhasil disimpan.');
    return newTx;
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    let cleanUpdates: Partial<Transaction> = { ...updates };
    if (cleanUpdates.title) cleanUpdates.title = cleanUpdates.title.trim();
    if (cleanUpdates.note !== undefined) {
      cleanUpdates.note = cleanUpdates.note && cleanUpdates.note.trim() ? cleanUpdates.note.trim() : null;
    }
    if (cleanUpdates.receiptUrl !== undefined) {
      if (!cleanUpdates.receiptUrl) {
        cleanUpdates.receiptUrl = null;
      } else if (cleanUpdates.receiptUrl.startsWith('data:') && user) {
        try {
          cleanUpdates.receiptUrl = await uploadReceiptToStorage(
            user.uid,
            cleanUpdates.receiptUrl,
            cleanUpdates.receiptFileName || undefined
          );
        } catch (e) {
          console.warn('Update receipt upload skipped:', e);
          cleanUpdates.receiptUrl = null;
        }
      }
    }

    setTransactions((prev) =>
      prev.map((tx) => (tx.id === id ? { ...tx, ...cleanUpdates } : tx))
    );

    if (user) {
      setCloudSyncStatus('syncing');
      try {
        const sanitized = sanitizeForFirestore(cleanUpdates);
        await safeSetDoc(doc(db, 'users', user.uid, 'transactions', id), sanitized, { merge: true });
        setCloudSyncStatus('synced');
      } catch (err: any) {
        console.error('Failed to update transaction in Firestore:', err);
        setCloudSyncStatus('error');
        showToast('Gagal memperbarui transaksi di Cloud.');
      }
    }

    showToast('Transaksi berhasil diperbarui.');
  };

  const deleteTransaction = async (id: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
    if (selectedTxDetail?.id === id) {
      setSelectedTxDetail(null);
    }

    if (user) {
      setCloudSyncStatus('syncing');
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'transactions', id));
        setCloudSyncStatus('synced');
      } catch (err: any) {
        console.error('Failed to delete transaction from Firestore:', err);
        setCloudSyncStatus('error');
      }
    }

    showToast('Transaksi berhasil dihapus.');
  };

  // Asset Mutators
  const addAsset = async (assetData: Omit<Asset, 'id'>) => {
    const newAsset: Asset = {
      ...assetData,
      name: assetData.name.trim(),
      notes: assetData.notes && assetData.notes.trim() ? assetData.notes.trim() : null,
      monthlyChange: assetData.monthlyChange && assetData.monthlyChange.trim() ? assetData.monthlyChange.trim() : null,
      monthlyChangeType: assetData.monthlyChangeType || null,
      id: `asset-${Date.now()}`,
      pendingSync: !user,
    };
    const newAudit: BalanceAuditChange = {
      id: `ch-${Date.now()}`,
      name: newAsset.name,
      description: 'Penambahan aset baru',
      changeAmount: newAsset.value,
      type: 'asset_increase',
      date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
    };

    setAssets((prev) => [...prev, newAsset]);
    setBalanceChanges((prev) => [newAudit, ...prev]);

    if (user) {
      setCloudSyncStatus('syncing');
      try {
        await safeSetDoc(doc(db, 'users', user.uid, 'assets', newAsset.id), cleanAssetForFirestore(newAsset));
        await safeSetDoc(doc(db, 'users', user.uid, 'balanceChanges', newAudit.id), cleanAuditForFirestore(newAudit));
        newAsset.pendingSync = false;
        setCloudSyncStatus('synced');
      } catch (err: any) {
        console.error('Failed to sync asset to Firestore:', err);
        newAsset.pendingSync = true;
        setCloudSyncStatus('error');
      }
    }

    showToast('Aset berhasil ditambahkan.');
    return newAsset;
  };

  const updateAsset = async (id: string, updates: Partial<Asset>) => {
    const cleanUpdates = {
      ...updates,
      notes: updates.notes && updates.notes.trim() ? updates.notes.trim() : null,
      monthlyChange: updates.monthlyChange && updates.monthlyChange.trim() ? updates.monthlyChange.trim() : null,
    };

    setAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...cleanUpdates } : a))
    );

    if (user) {
      setCloudSyncStatus('syncing');
      try {
        await safeSetDoc(doc(db, 'users', user.uid, 'assets', id), sanitizeForFirestore(cleanUpdates), { merge: true });
        setCloudSyncStatus('synced');
      } catch (err: any) {
        console.error('Failed to update asset in Firestore:', err);
        setCloudSyncStatus('error');
      }
    }

    showToast('Aset berhasil diperbarui.');
  };

  const deleteAsset = async (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));

    if (user) {
      setCloudSyncStatus('syncing');
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'assets', id));
        setCloudSyncStatus('synced');
      } catch (err: any) {
        console.error('Failed to delete asset from Firestore:', err);
        setCloudSyncStatus('error');
      }
    }

    showToast('Aset berhasil dihapus.');
  };

  // Liability Mutators
  const addLiability = async (liabData: Omit<Liability, 'id'>) => {
    const newLiab: Liability = {
      ...liabData,
      name: liabData.name.trim(),
      monthlyPayment: typeof liabData.monthlyPayment === 'number' && liabData.monthlyPayment > 0 ? liabData.monthlyPayment : null,
      monthlyChange: liabData.monthlyChange && liabData.monthlyChange.trim() ? liabData.monthlyChange.trim() : null,
      monthlyChangeType: liabData.monthlyChangeType || null,
      dueDate: liabData.dueDate && liabData.dueDate.trim() ? liabData.dueDate.trim() : 'Akhir Bulan',
      id: `liab-${Date.now()}`,
      pendingSync: !user,
    };
    const newAudit: BalanceAuditChange = {
      id: `ch-${Date.now()}`,
      name: newLiab.name,
      description: 'Kewajiban baru dicatat',
      changeAmount: newLiab.totalRemaining,
      type: 'liability_increase',
      date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
    };

    setLiabilities((prev) => [...prev, newLiab]);
    setBalanceChanges((prev) => [newAudit, ...prev]);

    if (user) {
      setCloudSyncStatus('syncing');
      try {
        await safeSetDoc(doc(db, 'users', user.uid, 'liabilities', newLiab.id), cleanLiabilityForFirestore(newLiab));
        await safeSetDoc(doc(db, 'users', user.uid, 'balanceChanges', newAudit.id), cleanAuditForFirestore(newAudit));
        newLiab.pendingSync = false;
        setCloudSyncStatus('synced');
      } catch (err: any) {
        console.error('Failed to sync liability to Firestore:', err);
        newLiab.pendingSync = true;
        setCloudSyncStatus('error');
      }
    }

    showToast('Liabilitas berhasil ditambahkan.');
    return newLiab;
  };

  const updateLiability = async (id: string, updates: Partial<Liability>) => {
    const cleanUpdates = {
      ...updates,
      monthlyPayment: updates.monthlyPayment !== undefined ? (typeof updates.monthlyPayment === 'number' && updates.monthlyPayment > 0 ? updates.monthlyPayment : null) : undefined,
      monthlyChange: updates.monthlyChange && updates.monthlyChange.trim() ? updates.monthlyChange.trim() : null,
    };

    setLiabilities((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...cleanUpdates } : l))
    );

    if (user) {
      setCloudSyncStatus('syncing');
      try {
        await safeSetDoc(doc(db, 'users', user.uid, 'liabilities', id), sanitizeForFirestore(cleanUpdates), { merge: true });
        setCloudSyncStatus('synced');
      } catch (err: any) {
        console.error('Failed to update liability in Firestore:', err);
        setCloudSyncStatus('error');
      }
    }

    showToast('Liabilitas berhasil diperbarui.');
  };

  const deleteLiability = async (id: string) => {
    setLiabilities((prev) => prev.filter((l) => l.id !== id));

    if (user) {
      setCloudSyncStatus('syncing');
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'liabilities', id));
        setCloudSyncStatus('synced');
      } catch (err: any) {
        console.error('Failed to delete liability from Firestore:', err);
        setCloudSyncStatus('error');
      }
    }

    showToast('Liabilitas berhasil dihapus.');
  };

  const payLiability = async (id: string, paymentAmount?: number) => {
    const liab = liabilities.find((l) => l.id === id);
    if (!liab) return;

    const amount = paymentAmount || liab.monthlyPayment || 500000;
    const remaining = Math.max(0, liab.totalRemaining - amount);
    const updates = {
      totalRemaining: remaining,
      monthlyChange: `-Rp ${amount.toLocaleString('id-ID')} lunas`,
      monthlyChangeType: 'positive' as const,
    };

    await updateLiability(id, updates);
    showToast('Pembayaran kewajiban berhasil dicatat.');
  };

  const addScannedReceiptRecord = async (record: Omit<ScannedReceiptRecord, 'id'>) => {
    const newRecord: ScannedReceiptRecord = {
      ...record,
      imageUrl: record.imageUrl || '',
      fileName: record.fileName || '',
      fileSize: record.fileSize || '',
      id: `scan-${Date.now()}`,
    };
    setScannedReceipts((prev) => [newRecord, ...prev]);

    if (user) {
      try {
        await safeSetDoc(doc(db, 'users', user.uid, 'scannedReceipts', newRecord.id), cleanReceiptRecordForFirestore(newRecord));
      } catch (err: any) {
        console.warn('Failed to save receipt record to Firestore:', err);
      }
    }
  };

  const checkDuplicateReceipt = (amount: number, date: string, merchant: string) => {
    const normMerchant = merchant.toLowerCase().trim();
    return transactions.find((t) => {
      const matchAmount = Math.abs(t.amount - amount) < 1;
      const matchDate = t.date === date;
      const matchMerchant =
        t.title.toLowerCase().includes(normMerchant) ||
        normMerchant.includes(t.title.toLowerCase());
      return matchAmount && (matchDate || matchMerchant);
    });
  };

  // Reset strictly to zero / empty state
  const resetToZero = async () => {
    setTransactions([]);
    setAssets([]);
    setLiabilities([]);
    setBalanceChanges([]);
    setScannedReceipts([]);

    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    localStorage.removeItem(STORAGE_KEYS.ASSETS);
    localStorage.removeItem(STORAGE_KEYS.LIABILITIES);
    localStorage.removeItem(STORAGE_KEYS.CHANGES);
    localStorage.removeItem(STORAGE_KEYS.SCANS);

    if (user) {
      try {
        // Delete all user documents from collections
        for (const t of transactions) {
          await deleteDoc(doc(db, 'users', user.uid, 'transactions', t.id));
        }
        for (const a of assets) {
          await deleteDoc(doc(db, 'users', user.uid, 'assets', a.id));
        }
        for (const l of liabilities) {
          await deleteDoc(doc(db, 'users', user.uid, 'liabilities', l.id));
        }
      } catch (e) {
        console.warn('Error clearing remote docs:', e);
      }
    }

    showToast('Seluruh data finansial telah direset ke nol.');
  };

  // Explicit demo mode loader (only if requested by user)
  const loadDemoData = async () => {
    setTransactions(DEMO_SAMPLE_DATA.transactions);
    setAssets(DEMO_SAMPLE_DATA.assets);
    setLiabilities(DEMO_SAMPLE_DATA.liabilities);
    showToast('Data demo berhasil dimuat.');
  };

  const exportDataJSON = () => {
    const data = {
      app: 'InputMi',
      exportDate: new Date().toISOString(),
      user: {
        uid: user?.uid,
        displayName: user?.displayName,
        email: user?.email,
      },
      summary: {
        totalIncome,
        totalExpense,
        netCashflow,
        totalAssets,
        totalLiabilities,
        netWorth,
      },
      transactions,
      assets,
      liabilities,
      balanceChanges,
      scannedReceipts,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inputmi-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data cadangan berhasil diunduh.');
  };

  return (
    <FinanceContext.Provider
      value={{
        activeTab,
        setActiveTab,
        selectedPeriod,
        setSelectedPeriod,
        user,
        isAuthLoading,
        cloudSyncStatus,
        signInWithGoogle,
        signOutUser,
        updateUserDisplayName,
        updateUserProfilePhoto,
        syncLocalDataToCloud,
        retrySyncAllPending,
        hasUnsyncedLocalData,
        transactions,
        assets,
        liabilities,
        balanceChanges,
        scannedReceipts,
        totalIncome,
        totalExpense,
        netCashflow,
        savingsRate,
        totalAssets,
        totalLiabilities,
        netWorth,
        solvencyAssetPercent,
        solvencyLiabilityPercent,
        weeklyData,
        categoryBreakdown,
        incomeBreakdown,
        isAddTxOpen,
        openAddTx,
        closeAddTx,
        addTxInitialType,
        selectedTxDetail,
        openTxDetail,
        closeTxDetail,
        editingTx,
        openEditTx,
        lightboxImageUrl,
        openLightbox,
        closeLightbox,
        toastMessage,
        showToast,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addAsset,
        updateAsset,
        deleteAsset,
        addLiability,
        updateLiability,
        deleteLiability,
        payLiability,
        addScannedReceiptRecord,
        checkDuplicateReceipt,
        resetToZero,
        loadDemoData,
        exportDataJSON,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
