import React, { useMemo, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Transaction } from '../types';
import { formatIDR, formatIndoDate } from '../utils/formatters';

interface TransactionCalendarProps {
  id?: string;
}

export const TransactionCalendar: React.FC<TransactionCalendarProps> = ({
  id = 'transaction-calendar-section',
}) => {
  const { transactions, openTxDetail } = useFinance();

  const [historyViewMode, setHistoryViewMode] = useState<'list' | 'calendar'>('calendar');
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(() => new Date().getDate());
  const [calendarSearch, setCalendarSearch] = useState<string>('');

  // Group transactions by day for current month
  const dayTransactionsMap = useMemo(() => {
    const map: Record<number, Transaction[]> = {};
    transactions.forEach((tx) => {
      const day = parseInt(tx.date.split('-')[2] || '0', 10);
      if (day > 0) {
        if (!map[day]) map[day] = [];
        map[day].push(tx);
      }
    });
    return map;
  }, [transactions]);

  // Selected day transactions
  const selectedDayTransactions = useMemo(() => {
    if (!selectedCalendarDay) return [];
    return dayTransactionsMap[selectedCalendarDay] || [];
  }, [selectedCalendarDay, dayTransactionsMap]);

  // Daily net for selected day
  const selectedDayNet = useMemo(() => {
    const inc = selectedDayTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const exp = selectedDayTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return { inc, exp, net: inc - exp };
  }, [selectedDayTransactions]);

  // Filtered transactions for List mode
  const filteredListTransactions = useMemo(() => {
    if (!calendarSearch.trim()) return transactions;
    const q = calendarSearch.toLowerCase().trim();
    return transactions.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.paymentMethod.toLowerCase().includes(q)
    );
  }, [transactions, calendarSearch]);

  return (
    <div
      id={id}
      className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
          Riwayat Transaksi
        </h3>

        {/* List vs Calendar Toggle */}
        <div className="p-1 rounded-xl bg-surface-container flex gap-1">
          <button
            type="button"
            onClick={() => setHistoryViewMode('calendar')}
            className={`px-3 py-1 rounded-lg font-label-sm text-label-sm font-semibold flex items-center gap-1.5 transition-all ${
              historyViewMode === 'calendar'
                ? 'bg-surface-container-lowest text-primary shadow-2xs'
                : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">calendar_month</span>
            <span>Kalender</span>
          </button>

          <button
            type="button"
            onClick={() => setHistoryViewMode('list')}
            className={`px-3 py-1 rounded-lg font-label-sm text-label-sm font-semibold flex items-center gap-1.5 transition-all ${
              historyViewMode === 'list'
                ? 'bg-surface-container-lowest text-primary shadow-2xs'
                : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
            <span>Daftar</span>
          </button>
        </div>
      </div>

      {/* MODE 1: INTERACTIVE MONTHLY CALENDAR VIEW */}
      {historyViewMode === 'calendar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="font-label-md text-label-md text-on-surface font-bold">
              Kalender Bulan Ini
            </span>
            <div className="flex items-center gap-3 text-[11px] text-on-surface-variant">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-secondary" />
                <span>Pemasukan</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-error" />
                <span>Pengeluaran</span>
              </div>
            </div>
          </div>

          {/* Days of week header */}
          <div className="grid grid-cols-7 text-center font-label-sm text-[11px] text-on-surface-variant font-semibold">
            <span>Sen</span>
            <span>Sel</span>
            <span>Rab</span>
            <span>Kam</span>
            <span>Jum</span>
            <span>Sab</span>
            <span>Min</span>
          </div>

          {/* 30 Days Grid for current month */}
          <div className="grid grid-cols-7 gap-1.5">
            <div className="h-12 rounded-xl bg-transparent" />

            {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => {
              const dayTxs = dayTransactionsMap[day] || [];
              const hasIncome = dayTxs.some((t) => t.type === 'income');
              const hasExpense = dayTxs.some((t) => t.type === 'expense');
              const isSelected = selectedCalendarDay === day;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedCalendarDay(day)}
                  className={`h-12 rounded-xl p-1 flex flex-col items-center justify-between transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-primary text-on-primary ring-2 ring-primary ring-offset-2 font-bold shadow-xs'
                      : dayTxs.length > 0
                      ? 'bg-surface-container-low hover:bg-surface-container text-on-surface font-semibold'
                      : 'bg-surface-container-lowest hover:bg-surface-container text-on-surface-variant'
                  }`}
                >
                  <span className="text-xs">{day}</span>
                  <div className="flex items-center gap-0.5 h-1.5">
                    {hasIncome && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-secondary-fixed' : 'bg-secondary'
                        }`}
                      />
                    )}
                    {hasExpense && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-error-container' : 'bg-error'
                        }`}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Day Transaction Drawer */}
          <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container space-y-3">
            <div className="flex items-center justify-between border-b border-surface-container/60 pb-2">
              <span className="font-label-md text-label-md text-on-surface font-bold">
                Mutasi Kas Tanggal {selectedCalendarDay}
              </span>
              <span
                className={`font-stat-tabular text-label-md font-bold ${
                  selectedDayNet.net >= 0 ? 'text-secondary' : 'text-error'
                }`}
              >
                {selectedDayNet.net >= 0 ? '+' : ''}
                {formatIDR(selectedDayNet.net)}
              </span>
            </div>

            {selectedDayTransactions.length === 0 ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant text-center py-2">
                Tidak ada catatan transaksi pada tanggal ini.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedDayTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => openTxDetail(tx)}
                    className="p-3 rounded-xl bg-surface-container-lowest hover:bg-surface-container border border-surface-container flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-label-md text-label-md text-on-surface font-semibold truncate">
                        {tx.title}
                      </p>
                      <p className="font-body-sm text-[11px] text-on-surface-variant truncate">
                        {tx.time} WIB • {tx.category} • {tx.paymentMethod}
                      </p>
                    </div>
                    <span
                      className={`font-stat-tabular text-stat-tabular font-bold ${
                        tx.type === 'expense' ? 'text-on-surface' : 'text-secondary'
                      }`}
                    >
                      {tx.type === 'expense' ? '-' : '+'}
                      {formatIDR(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 2: SEARCHABLE LIST VIEW */}
      {historyViewMode === 'list' && (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Cari transaksi..."
            value={calendarSearch}
            onChange={(e) => setCalendarSearch(e.target.value)}
            className="w-full min-h-[42px] px-3.5 rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-hidden"
          />

          {filteredListTransactions.length === 0 ? (
            <div className="p-8 rounded-2xl bg-surface-container-low text-center space-y-1">
              <p className="font-label-md text-label-md text-on-surface font-semibold">
                {transactions.length === 0 ? 'Belum ada transaksi' : 'Tidak ada transaksi yang cocok'}
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {transactions.length === 0
                  ? 'Catat transaksi pemasukan atau pengeluaran pertama Anda.'
                  : 'Coba ubah kata kunci pencarian Anda.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredListTransactions.map((tx) => {
                const isExpense = tx.type === 'expense';
                return (
                  <div
                    key={tx.id}
                    onClick={() => openTxDetail(tx)}
                    className="p-3.5 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low border border-surface-container flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isExpense
                            ? 'bg-error-container text-on-error-container'
                            : 'bg-secondary-container text-on-secondary-container'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {isExpense ? 'arrow_downward' : 'arrow_upward'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-label-md text-label-md text-on-surface font-semibold truncate">
                          {tx.title}
                        </p>
                        <p className="font-body-sm text-[11px] text-on-surface-variant truncate">
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
          )}
        </div>
      )}
    </div>
  );
};
