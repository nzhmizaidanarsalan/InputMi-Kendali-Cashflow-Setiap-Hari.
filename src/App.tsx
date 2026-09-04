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
