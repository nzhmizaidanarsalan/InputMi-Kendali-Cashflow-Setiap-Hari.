/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { Header } from './components/Header';
import { NavigationDock } from './components/NavigationDock';
import { AddEditTransactionSheet } from './components/AddEditTransactionSheet';
import { TransactionDetailModal } from './components/TransactionDetailModal';
import { ReceiptLightboxModal } from './components/ReceiptLightboxModal';
import { ProfileModal } from './components/ProfileModal';
import { NotificationSheet } from './components/NotificationSheet';
import { Toast } from './components/Toast';

import { OverviewView } from './views/OverviewView';
import { CashflowView } from './views/CashflowView';
import { ScanView } from './views/ScanView';
import { BalanceView } from './views/BalanceView';
import { AnalyticsView } from './views/AnalyticsView';

const MainAppContent: React.FC = () => {
  const {
    activeTab,
    isAuthLoading,
    selectedPeriod,
    setSelectedPeriod,
    isAddTxOpen,
    closeAddTx,
    addTxInitialType,
    selectedTxDetail,
    closeTxDetail,
    lightboxImageUrl,
    closeLightbox,
    toastMessage,
  } = useFinance();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // Dynamic Browser Tab Title conforming to InputMi Official Branding
  React.useEffect(() => {
    const tabTitles: Record<string, string> = {
      overview: 'Overview | InputMi',
      cashflow: 'Cashflow | InputMi',
      scan: 'Pindai Struk AI | InputMi',
      balance: 'Balance | InputMi',
      analytics: 'More | InputMi',
    };
    document.title = tabTitles[activeTab] || 'InputMi';
  }, [activeTab]);

  // Official InputMi Splash & Initial Loading Screen
  if (isAuthLoading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-surface antialiased select-none p-6">
        <div className="flex flex-col items-center gap-3.5 animate-in fade-in duration-300">
          <img
            src="/icons/inputmi-icon.svg"
            alt="InputMi"
            className="w-16 h-16 rounded-2xl shadow-sm animate-pulse"
            referrerPolicy="no-referrer"
          />
          <div className="text-center">
            <h1 className="font-headline-md text-headline-md tracking-tight font-bold">
              <span className="text-on-surface">Input</span>
              <span className="text-[#289E77]">Mi</span>
            </h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant font-medium mt-0.5">
              Kendali Cashflow Setiap Hari.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col text-on-surface antialiased selection:bg-secondary-container selection:text-on-secondary-container">
      {/* Sticky Top Header */}
      <Header
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenNotifications={() => setIsNotificationOpen(true)}
      />

      {/* Main Responsive View Container with safe top clearance below fixed header */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-32">
        {activeTab === 'overview' && <OverviewView />}
        {activeTab === 'cashflow' && <CashflowView />}
        {activeTab === 'scan' && <ScanView />}
        {activeTab === 'balance' && <BalanceView />}
        {activeTab === 'analytics' && <AnalyticsView />}
      </main>

      {/* Sticky Bottom Modern Floating Navigation Dock */}
      <NavigationDock />

      {/* Full Sheet & Modals */}
      <AddEditTransactionSheet
        isOpen={isAddTxOpen}
        onClose={closeAddTx}
        initialType={addTxInitialType}
      />

      <TransactionDetailModal
        isOpen={!!selectedTxDetail}
        onClose={closeTxDetail}
        transaction={selectedTxDetail}
      />

      <ReceiptLightboxModal
        isOpen={!!lightboxImageUrl}
        onClose={closeLightbox}
        imageUrl={lightboxImageUrl}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <NotificationSheet
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
      />

      {/* Global Real-Time Feedback Toast */}
      <Toast message={toastMessage} />
    </div>
  );
};

export default function App() {
  return (
    <FinanceProvider>
      <MainAppContent />
    </FinanceProvider>
  );
}
