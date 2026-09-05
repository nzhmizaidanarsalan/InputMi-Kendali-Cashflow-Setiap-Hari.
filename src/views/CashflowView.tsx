import React, { useMemo, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { FilterModal, FilterOptions } from '../components/FilterModal';
import { formatIDR, getCurrentDateStr, getGroupDateHeader } from '../utils/formatters';

export const CashflowView: React.FC = () => {
  const {
    transactions,
    totalIncome,
    totalExpense,
    netCashflow,
    openAddTx,
    openTxDetail,
    setActiveTab,
  } = useFinance();

  const [activePeriod, setActivePeriod] = useState<'hari' | 'minggu' | 'bulan' | 'custom'>('bulan');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [extraFilters, setExtraFilters] = useState<FilterOptions>({
    type: 'all',
    category: 'Semua Kategori',
    paymentMethod: 'Semua Metode',
    onlyWithReceipt: false,
    searchQuery: '',
  });

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Type filter
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (extraFilters.type !== 'all' && tx.type !== extraFilters.type) return false;

      // Category filter
      if (
        extraFilters.category !== 'Semua Kategori' &&
        tx.category !== extraFilters.category
      ) {
        return false;
      }

      // Payment method filter
      if (
        extraFilters.paymentMethod !== 'Semua Metode' &&
        tx.paymentMethod !== extraFilters.paymentMethod
      ) {
        return false;
      }

      // Only with receipt filter
      if (extraFilters.onlyWithReceipt && !tx.receiptUrl) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = tx.title.toLowerCase().includes(q);
        const matchCat = tx.category.toLowerCase().includes(q);
        const matchMethod = tx.paymentMethod.toLowerCase().includes(q);
        const matchAmount = tx.amount.toString().includes(q);
        if (!matchTitle && !matchCat && !matchMethod && !matchAmount) {
          return false;
        }
      }

      // Period filter
      if (activePeriod === 'hari') {
        return tx.date === getCurrentDateStr();
      }
      if (activePeriod === 'minggu') {
        const txTime = new Date(tx.date).getTime();
        const now = new Date();
        const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
        return !isNaN(txTime) && txTime >= sevenDaysAgo;
      }
      if (activePeriod === 'bulan') {
        const [year, month] = (tx.date || '').split('-');
        const now = new Date();
        const curYear = String(now.getFullYear());
        const curMonth = String(now.getMonth() + 1).padStart(2, '0');
        return year === curYear && month === curMonth;
      }

      return true;
    });
  }, [transactions, typeFilter, extraFilters, searchQuery, activePeriod]);

  // Group by date
  const groupedTransactions = useMemo(() => {
    const groups: { [dateStr: string]: typeof transactions } = {};
    filteredTransactions.forEach((tx) => {
      if (!groups[tx.date]) {
        groups[tx.date] = [];
      }
      groups[tx.date].push(tx);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredTransactions]);

  const incomeCount = transactions.filter((t) => t.type === 'income').length;
  const expenseCount = transactions.filter((t) => t.type === 'expense').length;

  return (
    <div id="cashflow-view" className="space-y-5 pb-24 max-w-2xl mx-auto">
      {/* Header with Title and AI Scan Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">Cashflow</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Pencatatan mutasi kas masuk dan keluar secara real-time
          </p>
        </div>
        <button
          id="cashflow-scan-btn"
          type="button"
          onClick={() => setActiveTab('scan')}
          className="min-h-[40px] px-3.5 rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center gap-1.5 active:scale-95 shadow-xs"
        >
          <span className="material-symbols-outlined text-[18px]">document_scanner</span>
          <span>Pindai Struk AI</span>
        </button>
      </div>

      {/* Period Selector Pills */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-surface-container overflow-x-auto no-scrollbar">
        {[
          { id: 'hari', label: 'Hari Ini' },
          { id: 'minggu', label: 'Minggu Ini' },
          { id: 'bulan', label: 'Bulan Ini' },
          { id: 'custom', label: 'Custom' },
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActivePeriod(p.id as any)}
            className={`flex-1 min-w-[70px] min-h-[34px] rounded-xl font-label-sm text-label-sm font-medium transition-all ${
              activePeriod === p.id
                ? 'bg-surface-container-lowest text-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Hero Net Cashflow Card */}
      <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-[0_4px_20px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
            Arus Kas Bersih
          </span>
          {transactions.length > 0 && netCashflow !== 0 ? (
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

        <h2 className="font-display-currency text-[32px] sm:text-[38px] font-bold text-on-surface">
          {netCashflow >= 0 ? '+' : ''}
          {formatIDR(netCashflow)}
        </h2>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-surface-container">
          <div className="p-3 rounded-2xl bg-surface-container-low">
            <div className="flex items-center gap-1 text-secondary text-label-sm font-semibold">
              <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
              <span>Pemasukan</span>
            </div>
            <p className="font-headline-sm text-headline-sm font-bold text-on-surface mt-0.5">
              {formatIDR(totalIncome)}
            </p>
            <span className="text-[11px] text-on-surface-variant">
              {incomeCount} Transaksi Masuk
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-surface-container-low">
            <div className="flex items-center gap-1 text-error text-label-sm font-semibold">
              <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
              <span>Pengeluaran</span>
            </div>
            <p className="font-headline-sm text-headline-sm font-bold text-on-surface mt-0.5">
              {formatIDR(totalExpense)}
            </p>
            <span className="text-[11px] text-on-surface-variant">
              {expenseCount} Transaksi Keluar
            </span>
          </div>
        </div>
      </div>

      {/* Quick Add Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          id="cashflow-add-income-btn"
          type="button"
          onClick={() => openAddTx('income')}
          className="min-h-[46px] rounded-2xl bg-surface-container-lowest hover:bg-surface-container border border-surface-container flex items-center justify-center gap-2 font-label-md text-label-md font-semibold text-secondary active:scale-95 transition-all shadow-2xs"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
          <span>+ Pemasukan</span>
        </button>

        <button
          id="cashflow-add-expense-btn"
          type="button"
          onClick={() => openAddTx('expense')}
          className="min-h-[46px] rounded-2xl bg-surface-container-lowest hover:bg-surface-container border border-surface-container flex items-center justify-center gap-2 font-label-md text-label-md font-semibold text-error active:scale-95 transition-all shadow-2xs"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_downward</span>
          <span>- Pengeluaran</span>
        </button>
      </div>

      {/* Search Input & Filter Chips Bar */}
      <div className="space-y-3">
        <div className="relative">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2">
            search
          </span>
          <input
            id="search-transactions-input"
            type="text"
            placeholder="Cari merchant, nominal, atau kategori..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-[44px] pl-10 pr-10 rounded-2xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary focus:outline-hidden transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[18px]">cancel</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'income', label: 'Pemasukan' },
              { id: 'expense', label: 'Pengeluaran' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTypeFilter(f.id as any)}
                className={`min-h-[34px] px-3.5 rounded-full font-label-sm text-label-sm font-medium transition-all shrink-0 ${
                  typeFilter === f.id
                    ? 'bg-primary text-on-primary font-semibold shadow-2xs'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            id="open-filter-modal-btn"
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className={`min-h-[34px] px-3 rounded-full flex items-center gap-1.5 font-label-sm text-label-sm transition-colors shrink-0 ${
              extraFilters.category !== 'Semua Kategori' ||
              extraFilters.paymentMethod !== 'Semua Metode' ||
              extraFilters.onlyWithReceipt
                ? 'bg-secondary text-on-secondary font-semibold'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>Filter</span>
          </button>
        </div>
      </div>

      {/* Chronological Transaction Groups */}
      <div className="space-y-5">
        {groupedTransactions.length === 0 ? (
          transactions.length === 0 ? (
            <div className="p-10 rounded-3xl bg-surface-container-lowest border border-dashed border-surface-container-highest text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-container-low text-on-surface-variant flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-[28px]">receipt_long</span>
              </div>
              <p className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Belum ada transaksi
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm mx-auto">
                Tambahkan pemasukan atau pengeluaran pertama Anda, atau pindai struk belanja fisik Anda dengan OCR AI.
              </p>
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
          ) : (
            <div className="p-10 rounded-3xl bg-surface-container-lowest border border-surface-container text-center space-y-3">
              <span className="material-symbols-outlined text-[42px] text-on-surface-variant">
                search_off
              </span>
              <p className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Tidak ada transaksi yang cocok
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-xs mx-auto">
                Coba sesuaikan filter atau kata kunci pencarian Anda.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('all');
                  setExtraFilters({ category: 'Semua Kategori', paymentMethod: 'Semua Metode', onlyWithReceipt: false });
                }}
                className="px-3 py-1.5 rounded-full bg-surface-container text-primary font-label-sm text-label-sm font-semibold hover:bg-surface-container-high transition-colors"
              >
                Reset Filter
              </button>
            </div>
          )
        ) : (
          groupedTransactions.map(([dateStr, txs]) => (
            <div key={dateStr} className="space-y-2">
              <div className="px-1 flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  {getGroupDateHeader(dateStr)}
                </span>
                <span className="font-body-sm text-[11px] text-on-surface-variant">
                  {txs.length} Transaksi
                </span>
              </div>

              <div className="space-y-2">
                {txs.map((tx) => {
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
                            {tx.time} WIB • {tx.paymentMethod}
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
            </div>
          ))
        )}
      </div>

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        currentFilters={extraFilters}
        onApplyFilters={(f) => setExtraFilters(f)}
      />
    </div>
  );
};
