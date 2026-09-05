import React, { useRef, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatIDR } from '../utils/formatters';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const {
    user,
    cloudSyncStatus,
    signInWithGoogle,
    signOutUser,
    updateUserDisplayName,
    updateUserProfilePhoto,
    syncLocalDataToCloud,
    transactions,
    totalAssets,
    netWorth,
    exportDataJSON,
    resetToZero,
    loadDemoData,
    showToast,
  } = useFinance();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(user?.displayName || 'Pengguna Google');
  const [confirmReset, setConfirmReset] = useState(false);
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSaveName = async () => {
    if (editedName.trim()) {
      await updateUserDisplayName(editedName.trim());
      setIsEditingName(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Ukuran foto maksimal 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      if (dataUrl) {
        await updateUserProfilePhoto(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleManualSync = async () => {
    setIsSyncingLocal(true);
    await syncLocalDataToCloud();
    setIsSyncingLocal(false);
  };

  const userInitial = user?.displayName
    ? user.displayName.trim().charAt(0).toUpperCase()
    : user?.email
    ? user.email.charAt(0).toUpperCase()
    : 'U';

  return (
    <div
      id="profile-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 transition-opacity animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-6 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-10 h-1.5 rounded-full bg-surface-container-highest" />
        </div>

        <div className="px-5 py-3.5 flex items-center justify-between border-b border-surface-container">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">manage_accounts</span>
            <h2 className="font-headline-md text-headline-md text-on-surface">Akun & Pengaturan</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {/* User Profile Card */}
          <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container space-y-3">
            <div className="flex items-center gap-3.5">
              {/* Profile Avatar with Photo Upload Button */}
              <div className="relative group shrink-0">
                {user?.photoURL ? (
                  <img
                    alt={user.displayName || 'Avatar'}
                    className="w-14 h-14 rounded-full object-cover ring-2 ring-primary/20 shadow-xs"
                    src={user.photoURL}
                    referrerPolicy="no-referrer"
                  />
                ) : user ? (
                  <div className="w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xl ring-2 ring-primary/20 shadow-xs">
                    {userInitial}
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center font-bold text-xl ring-2 ring-surface-container shadow-xs">
                    <span className="material-symbols-outlined text-[28px]">person</span>
                  </div>
                )}

                {/* Upload overlay button */}
                {user && (
                  <button
                    type="button"
                    onClick={handleTriggerUpload}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md hover:bg-primary-hover transition-colors"
                    title="Ganti Foto Profil"
                  >
                    <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="flex-1 min-w-0">
                {isEditingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="w-full px-2 py-1 text-sm bg-surface-container rounded-lg border border-primary focus:outline-hidden font-semibold text-on-surface"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveName}
                      className="px-2 py-1 text-xs bg-primary text-on-primary rounded-lg font-semibold shrink-0"
                    >
                      Simpan
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(false)}
                      className="px-2 py-1 text-xs bg-surface-container text-on-surface rounded-lg shrink-0"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
                      {user?.displayName || 'Pengguna Tamu'}
                    </h3>
                    {user && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditedName(user?.displayName || 'Pengguna Google');
                          setIsEditingName(true);
                        }}
                        className="text-on-surface-variant hover:text-primary transition-colors"
                        title="Ubah nama profil"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                    )}
                  </div>
                )}

                <p className="font-body-sm text-body-sm text-on-surface-variant truncate mt-0.5">
                  {user?.email || 'Mode Penyimpanan Lokal (Belum Masuk)'}
                </p>

                {/* Real Sync Status Badge */}
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      cloudSyncStatus === 'synced'
                        ? 'bg-emerald-500'
                        : cloudSyncStatus === 'syncing'
                        ? 'bg-primary animate-pulse'
                        : cloudSyncStatus === 'unauthenticated'
                        ? 'bg-amber-500'
                        : cloudSyncStatus === 'error'
                        ? 'bg-error'
                        : 'bg-on-surface-variant/70'
                    }`}
                  />
                  <span className="text-on-surface-variant">
                    {cloudSyncStatus === 'synced'
                      ? 'Tersinkron dengan Cloud Firestore'
                      : cloudSyncStatus === 'syncing'
                      ? 'Menyinkronkan ke Cloud...'
                      : cloudSyncStatus === 'unauthenticated'
                      ? 'Belum Tersinkron (Mode Lokal)'
                      : cloudSyncStatus === 'error'
                      ? 'Gagal Sinkron ke Cloud'
                      : 'Offline'}
                  </span>
                </div>
                {cloudSyncStatus === 'error' && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-error-container/30 border border-error/20 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-error font-medium">
                      <span className="material-symbols-outlined text-[16px]">cloud_off</span>
                      <span>Gagal sinkron. Data tersimpan di HP/PC.</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleManualSync}
                      disabled={isSyncingLocal}
                      className="px-2.5 py-1 rounded-lg bg-error text-white text-[11px] font-semibold shrink-0 hover:opacity-90 active:scale-95 transition-all"
                    >
                      Coba Lagi
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Authentication Action Card */}
            {!user ? (
              <div className="pt-2 border-t border-surface-container space-y-2.5">
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Data transaksi Anda tersimpan di perangkat ini. Masuk dengan Google untuk menyinkronkan seluruh catatan secara aman ke Google Cloud.
                </p>
                <button
                  id="profile-google-signin-btn"
                  type="button"
                  onClick={signInWithGoogle}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-hover flex items-center justify-center gap-2.5 font-label-md text-label-md font-semibold active:scale-98 transition-all shadow-xs"
                >
                  <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  </div>
                  <span>Masuk dengan Google</span>
                </button>
                <p className="text-[11px] text-on-surface-variant/80 text-center">
                  Mendukung browser mobile (Safari iOS, Chrome Android) & desktop.
                </p>
              </div>
            ) : (
              <div className="pt-2 border-t border-surface-container space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-secondary font-medium">
                    <span className="material-symbols-outlined text-[16px]">cloud_done</span>
                    <span>Tersambung ke Google</span>
                  </div>
                  <button
                    id="profile-signout-btn"
                    type="button"
                    onClick={signOutUser}
                    className="text-xs text-error font-semibold hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">logout</span>
                    <span>Keluar</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncingLocal}
                  className="w-full min-h-[36px] px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-surface-container flex items-center justify-center gap-1.5 text-xs font-semibold text-on-surface transition-all active:scale-98"
                >
                  <span className={`material-symbols-outlined text-[16px] ${isSyncingLocal ? 'animate-spin' : ''}`}>
                    sync
                  </span>
                  <span>{isSyncingLocal ? 'Menyinkronkan...' : 'Sinkronkan Data ke Cloud Sekarang'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Metrics Summary */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container">
              <span className="font-body-sm text-[11px] text-on-surface-variant block">Transaksi</span>
              <span className="font-stat-tabular text-headline-sm text-on-surface font-bold">
                {transactions.length}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container">
              <span className="font-body-sm text-[11px] text-on-surface-variant block">Total Aset</span>
              <span className="font-stat-tabular text-headline-sm text-on-surface font-bold">
                {formatIDR(totalAssets)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container">
              <span className="font-body-sm text-[11px] text-on-surface-variant block">Net Worth</span>
              <span className="font-stat-tabular text-headline-sm text-secondary font-bold">
                {formatIDR(netWorth)}
              </span>
            </div>
          </div>

          {/* Actions & Utilities */}
          <div className="space-y-2">
            <h4 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Data & Cadangan
            </h4>

            <button
              type="button"
              onClick={exportDataJSON}
              className="w-full min-h-[48px] px-4 rounded-xl bg-surface-container-low hover:bg-surface-container border border-surface-container flex items-center justify-between transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[20px] text-primary">download</span>
                <div>
                  <p className="font-label-md text-label-md text-on-surface font-semibold">
                    Ekspor Data Cadangan (JSON)
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Unduh file arsip mutasi kas dan portofolio neraca
                  </p>
                </div>
              </div>
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                chevron_right
              </span>
            </button>

            {/* Optional demo data button */}
            {transactions.length === 0 && totalAssets === 0 && (
              <button
                type="button"
                onClick={loadDemoData}
                className="w-full min-h-[48px] px-4 rounded-xl bg-surface-container-low hover:bg-surface-container border border-surface-container flex items-center justify-between transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[20px] text-secondary">science</span>
                  <div>
                    <p className="font-label-md text-label-md text-on-surface font-semibold">
                      Muat Data Percobaan (Demo Mode)
                    </p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Isi contoh data untuk eksplorasi grafik dan laporan
                    </p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                  chevron_right
                </span>
              </button>
            )}

            {/* Reset All Data to Zero */}
            {confirmReset ? (
              <div className="p-4 rounded-2xl bg-error-container/30 border border-error-container space-y-2.5">
                <p className="font-body-sm text-body-sm text-on-surface font-medium">
                  Apakah Anda yakin ingin menghapus seluruh data transaksi, aset, dan liabilitas? Semua nilai finansial akan dikosongkan ke Rp 0.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="px-3.5 py-1.5 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await resetToZero();
                      setConfirmReset(false);
                      onClose();
                    }}
                    className="px-4 py-1.5 rounded-full bg-error text-on-error font-label-sm text-label-sm font-semibold"
                  >
                    Ya, Reset ke Nol
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="w-full min-h-[48px] px-4 rounded-xl bg-surface-container-low hover:bg-surface-container border border-surface-container flex items-center justify-between transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[20px] text-error">restart_alt</span>
                  <div>
                    <p className="font-label-md text-label-md text-error font-semibold">
                      Reset Seluruh Data Finansial
                    </p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Kosongkan mutasi dan portofolio kembali ke keadaan awal Rp 0
                    </p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                  chevron_right
                </span>
              </button>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container flex items-center justify-center gap-3 select-none">
            <img
              src="/icons/inputmi-icon.svg"
              alt="InputMi"
              className="w-9 h-9 rounded-lg shadow-xs shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="text-left">
              <p className="font-label-md text-label-md font-bold tracking-tight">
                <span className="text-on-surface">Input</span>
                <span className="text-[#289E77]">Mi</span>
              </p>
              <p className="font-body-sm text-[12px] text-on-surface-variant font-medium">
                Kendali Cashflow Setiap Hari.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-surface border-t border-surface-container">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold active:scale-95"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
