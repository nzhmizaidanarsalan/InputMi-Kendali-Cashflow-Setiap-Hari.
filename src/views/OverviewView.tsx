import React from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatIDR, formatIndoDate } from '../utils/formatters';
import { TransactionCalendar } from '../components/TransactionCalendar';

export const OverviewView: React.FC = () => {
  const {
    totalIncome,
    totalExpense,
    netCashflow,
    savingsRate,
    totalAssets,
    totalLiabilities,
    netWorth,
    transactions,
    assets,
    liabilities,
    weeklyData,
    openAddTx,
    openTxDetail,
    setActiveTab,
    selectedPeriod,
  } = useFinance();

  const recentTransactions = transactions.slice(0, 5);
  const hasTransactions = transactions.length > 0;

  return (
    <div id="overview-view" className="space-y-6 max-w-2xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">Overview</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Ringkasan arus kas, tabungan, dan portofolio kekayaan
        </p>
      </div>

      {/* SECTION 1: ARUS KAS BERSIH (NET CASHFLOW HERO CARD) */}
      <div
        id="overview-hero-card"
        className="p-5 sm:p-6 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-all"
      >
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Arus Kas Bersih ({selectedPeriod})
            </span>
            {hasTransactions && netCashflow !== 0 ? (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${
                  netCashflow > 0
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'bg-error-container text-on-error-container'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {netCashflow > 0 ? 'trending_up' : 'trending_down'}
                </span>
                {netCashflow > 0 ? 'Surplus' : 'Defisit'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-medium">
                Kondisi Awal
              </span>
            )}
          </div>

          <h1 className="font-display-currency text-[34px] sm:text-[42px] font-bold text-on-surface tracking-tight">
            {netCashflow > 0 ? '+' : ''}
            {formatIDR(netCashflow)}
          </h1>
        </div>

        {/* Income and Expense Grid */}
        <div className="grid grid-cols-2 gap-3 pt-5 mt-4 border-t border-surface-container">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-secondary">
              <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
              <span className="font-label-sm text-label-sm uppercase font-semibold tracking-wider">
                Total Pemasukan
              </span>
            </div>
            <p className="font-headline-sm text-headline-sm font-bold text-on-surface">
              {formatIDR(totalIncome)}
            </p>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-error">
              <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
              <span className="font-label-sm text-label-sm uppercase font-semibold tracking-wider">
                Total Pengeluaran
              </span>
            </div>
            <p className="font-headline-sm text-headline-sm font-bold text-on-surface">
              {formatIDR(totalExpense)}
            </p>
          </div>
        </div>

        {/* Retensi Dana / Savings Rate Progress Bar */}
        <div className="pt-4 mt-3 space-y-2 border-t border-surface-container/60">
          <div className="flex items-center justify-between text-body-sm font-medium">
            <span className="text-on-surface-variant">Retensi Dana (Disimpan)</span>
            <span className="text-secondary font-bold font-stat-tabular">
              {savingsRate}% Disimpan
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
            <div
              className="h-full rounded-full bg-secondary transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(hasTransactions ? 5 : 0, savingsRate))}%` }}
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: QUICK ACTION BUTTONS */}
      <div id="quick-action-buttons-group" className="grid grid-cols-3 gap-3">
        <button
          id="quick-add-income-btn"
          type="button"
          onClick={() => openAddTx('income')}
          className="min-h-[48px] p-3 rounded-2xl bg-surface-container-lowest hover:bg-surface-container border border-surface-container flex flex-col items-center justify-center gap-1 active:scale-95 transition-all group"
        >
          <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
          </div>
          <span className="font-label-sm text-label-sm font-semibold text-on-surface text-center">
            Pemasukan
          </span>
        </button>

        <button
          id="quick-add-expense-btn"
          type="button"
          onClick={() => openAddTx('expense')}
          className="min-h-[48px] p-3 rounded-2xl bg-surface-container-lowest hover:bg-surface-container border border-surface-container flex flex-col items-center justify-center gap-1 active:scale-95 transition-all group"
        >
          <div className="w-8 h-8 rounded-full bg-error-container text-on-error-container flex items-center justify-center group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
          </div>
          <span className="font-label-sm text-label-sm font-semibold text-on-surface text-center">
            Pengeluaran
          </span>
        </button>

        <button
          id="quick-scan-receipt-btn"
          type="button"
          onClick={() => setActiveTab('scan')}
          className="min-h-[48px] p-3 rounded-2xl bg-surface-container-lowest hover:bg-surface-container border border-surface-container flex flex-col items-center justify-center gap-1 active:scale-95 transition-all group"
        >
          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[18px]">document_scanner</span>
          </div>
          <span className="font-label-sm text-label-sm font-semibold text-on-surface text-center">
            Pindai Struk AI
          </span>
        </button>
      </div>

      {/* SECTION 3: KEKAYAAN BERSIH (NET WORTH CARD) */}
      <div
        id="overview-networth-card"
        className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container space-y-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Kekayaan Bersih (Net Worth)
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface">
                {formatIDR(netWorth)}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('balance')}
            className="min-h-[36px] px-3.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold flex items-center gap-1 transition-colors"
          >
            <span>Buka Neraca</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-surface-container">
          <div className="p-3 rounded-2xl bg-surface-container-low">
            <span className="font-body-sm text-body-sm text-on-surface-variant block">Total Aset</span>
            <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
              {formatIDR(totalAssets)}
            </span>
            <span className="text-[11px] text-secondary font-medium block mt-0.5">
              {assets.length} Akun Terdaftar
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-surface-container-low">
            <span className="font-body-sm text-body-sm text-on-surface-variant block">
              Total Liabilitas
            </span>
            <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
              {formatIDR(totalLiabilities)}
            </span>
            <span className="text-[11px] text-error font-medium block mt-0.5">
              {liabilities.length} Kewajiban Dicatat
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 4: TRANSAKSI TERBARU LIST */}
      <div id="overview-recent-transactions" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Transaksi Terbaru
          </h2>
          {hasTransactions && (
            <button
              id="view-all-tx-link-btn"
              type="button"
              onClick={() => setActiveTab('cashflow')}
              className="font-label-md text-label-md text-secondary hover:underline flex items-center gap-0.5 font-semibold"
            >
              <span>Lihat Semua ({transactions.length})</span>
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          )}
        </div>

        {hasTransactions ? (
          <div className="space-y-2">
            {recentTransactions.map((tx) => {
              const isExpense = tx.type === 'expense';
              return (
                <div
                  key={tx.id}
                  onClick={() => openTxDetail(tx)}
                  className="p-3.5 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low border border-surface-container flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isExpense
                          ? 'bg-error-container text-on-error-container'
                          : 'bg-secondary-container text-on-secondary-container'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {isExpense ? 'arrow_downward' : 'arrow_upward'}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-label-md text-label-md text-on-surface font-semibold truncate">
                          {tx.title}
                        </h3>
                        {tx.receiptUrl && (
                          <span
                            className="material-symbols-outlined text-[16px] text-secondary shrink-0"
                            title="Struk tersimpan"
                          >
                            receipt_long
                          </span>
                        )}
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                        {formatIndoDate(tx.date)} • {tx.paymentMethod}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-2">
                    <span
                      className={`font-stat-tabular text-stat-tabular font-bold ${
                        isExpense ? 'text-on-surface' : 'text-secondary'
                      }`}
                    >
                      {isExpense ? '-' : '+'}
                      {formatIDR(tx.amount)}
                    </span>
                    <span className="font-body-sm text-[11px] text-on-surface-variant block">
                      {tx.category}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* High quality Indonesian empty state */
          <div className="p-8 rounded-3xl bg-surface-container-lowest border border-dashed border-surface-container-highest text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-container-low text-on-surface-variant flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[26px]">receipt_long</span>
            </div>
            <div>
              <p className="font-label-md text-label-md text-on-surface font-semibold">
                Belum ada transaksi
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm mx-auto mt-1">
                Tambahkan pemasukan atau pengeluaran pertama Anda, atau pindai struk belanja dengan OCR AI.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => openAddTx('expense')}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-sm text-label-sm font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Catat Transaksi</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 5: RIWAYAT TRANSAKSI KALENDER */}
      <TransactionCalendar id="overview-history-section" />

      {/* SECTION 6: WEEKLY COMPARISON BAR CHART */}
      <div
        id="overview-weekly-chart"
        className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Pemasukan vs Pengeluaran Bulan Ini
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Perbandingan arus kas per minggu di {selectedPeriod}
            </p>
          </div>
          {hasTransactions && (
            <div className="flex items-center gap-3 text-label-sm font-medium">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
                <span>Masuk</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-error" />
                <span>Keluar</span>
              </div>
            </div>
          )}
        </div>

        {hasTransactions ? (
          <div className="grid grid-cols-4 gap-3 pt-2">
            {weeklyData.map((item) => {
              const maxVal = Math.max(1, ...weeklyData.map((w) => Math.max(w.income, w.expense)));
              const incH = Math.min(100, Math.max(item.income > 0 ? 10 : 2, Math.round((item.income / maxVal) * 100)));
              const expH = Math.min(100, Math.max(item.expense > 0 ? 10 : 2, Math.round((item.expense / maxVal) * 100)));

              return (
                <div key={item.week} className="flex flex-col items-center gap-2">
                  <div className="w-full h-28 bg-surface-container-low rounded-2xl p-1.5 flex items-end justify-center gap-1.5">
                    <div
                      className="w-3.5 bg-secondary rounded-t-md transition-all"
                      style={{ height: `${incH}%` }}
                      title={`Pemasukan: ${formatIDR(item.income)}`}
                    />
                    <div
                      className="w-3.5 bg-error rounded-t-md transition-all"
                      style={{ height: `${expH}%` }}
                      title={`Pengeluaran: ${formatIDR(item.expense)}`}
                    />
                  </div>
                  <span
                    className={`font-label-sm text-label-sm text-center ${
                      item.isCurrent ? 'font-bold text-primary' : 'text-on-surface-variant'
                    }`}
                  >
                    {item.week}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-on-surface-variant font-body-sm text-body-sm bg-surface-container-low rounded-2xl">
            Belum ada mutasi minggu ini untuk divisualisasikan dalam diagram.
          </div>
        )}
      </div>
    </div>
  );
};
