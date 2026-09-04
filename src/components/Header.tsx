import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';

interface HeaderProps {
  onOpenProfile: () => void;
  onOpenNotifications: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenProfile, onOpenNotifications }) => {
  const { liabilities, selectedPeriod, setSelectedPeriod, user, cloudSyncStatus } = useFinance();
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);

  const months = ['Agustus 2026', 'September 2026', 'Oktober 2026', 'Semua Periode'];

  // Check pending liabilities near due date
  const pendingBills = liabilities.filter((l) => l.totalRemaining > 0).length;

  const userInitial = user?.displayName ? user.displayName.trim().charAt(0).toUpperCase() : 'U';

  return (
    <header
      id="app-header"
      className="fixed top-0 left-0 right-0 z-40 h-16 bg-surface/90 backdrop-blur-xl border-b border-surface-container/60 shadow-[0_1px_8px_rgba(0,0,0,0.02)] transition-all"
    >
      <div className="h-full px-4 flex items-center justify-between max-w-2xl mx-auto">
        {/* Logo & Month Picker */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 cursor-pointer">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-on-primary font-bold shadow-xs">
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
            </div>
            <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-bold">
              InputMi
            </span>
          </div>

          {/* Month Dropdown */}
          <div className="relative">
            <button
              id="month-selector-btn"
              type="button"
              onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
              className="min-h-[36px] flex items-center gap-1 pl-2.5 pr-2 py-1 rounded-full bg-surface-container-low hover:bg-surface-container border border-surface-container transition-colors active:scale-95"
            >
              <span className="font-label-sm text-label-sm text-on-surface font-medium max-w-[80px] sm:max-w-none truncate">
                {selectedPeriod}
              </span>
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                expand_more
              </span>
            </button>

            {isMonthDropdownOpen && (
              <div
                id="month-dropdown-menu"
                className="absolute left-0 top-full mt-1.5 w-44 bg-surface-container-lowest rounded-2xl shadow-xl py-1 z-50 border border-surface-container"
              >
                {months.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setSelectedPeriod(m);
                      setIsMonthDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 font-body-sm text-body-sm flex items-center justify-between hover:bg-surface-container-low transition-colors ${
                      selectedPeriod === m
                        ? 'text-primary font-semibold bg-surface-container/50'
                        : 'text-on-surface'
                    }`}
                  >
                    <span>{m}</span>
                    {selectedPeriod === m && (
                      <span className="material-symbols-outlined text-[16px] text-secondary">
                        check
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Action Icons: Cloud Indicator, Notification & Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Cloud sync status badge with meaningful status */}
          <button
            id="header-sync-status-btn"
            type="button"
            onClick={onOpenProfile}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-low hover:bg-surface-container text-xs font-medium border border-surface-container transition-all active:scale-95"
            title="Klik untuk membuka Akun & Pengaturan"
          >
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
            <span className="text-[11px] font-medium text-on-surface hidden min-[420px]:inline whitespace-nowrap">
              {cloudSyncStatus === 'synced'
                ? 'Tersinkron'
                : cloudSyncStatus === 'syncing'
                ? 'Menyinkronkan...'
                : cloudSyncStatus === 'unauthenticated'
                ? 'Belum Tersinkron'
                : cloudSyncStatus === 'error'
                ? 'Gagal Sinkron'
                : 'Offline'}
            </span>
          </button>

          <button
            id="header-notification-btn"
            type="button"
            aria-label="Notifikasi"
            onClick={onOpenNotifications}
            className="w-10 h-10 relative flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {pendingBills > 0 && (
              <span
                id="notif-badge-indicator"
                className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-error ring-2 ring-surface animate-pulse"
              />
            )}
          </button>

          <button
            id="header-profile-btn"
            type="button"
            aria-label="Akun & Pengaturan"
            onClick={onOpenProfile}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:opacity-90 transition-opacity active:scale-95"
          >
            {user?.photoURL ? (
              <img
                alt={user.displayName || 'Google Profile'}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20"
                src={user.photoURL}
                referrerPolicy="no-referrer"
              />
            ) : user ? (
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container font-bold text-xs flex items-center justify-center ring-1 ring-surface-container">
                {userInitial}
              </div>
            ) : (
              <div
                className="w-8 h-8 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center ring-1 ring-surface-container"
                title="Mode Lokal (Belum Masuk)"
              >
                <span className="material-symbols-outlined text-[18px]">person</span>
              </div>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
