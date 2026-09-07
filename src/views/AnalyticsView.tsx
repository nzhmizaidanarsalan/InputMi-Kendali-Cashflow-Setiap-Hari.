import React, { useMemo, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatIDR } from '../utils/formatters';
import { FinancialFlowDiagram } from '../components/FinancialFlowDiagram';

export const AnalyticsView: React.FC = () => {
  const {
    transactions,
    totalIncome,
    totalExpense,
    netCashflow,
    savingsRate,
    weeklyData,
    categoryBreakdown,
    incomeBreakdown,
    assets,
    liabilities,
    netWorth,
    totalAssets,
    totalLiabilities,
  } = useFinance();

  const [activePeriod, setActivePeriod] = useState<string>('Bulan Ini');
  const [trendView, setTrendView] = useState<'mingguan' | 'bulanan'>('mingguan');

  const periods = ['Bulan Ini', '3 Bulan', '6 Bulan', '1 Tahun'];

  const weeklyNets = useMemo(() => {
    return weeklyData.map((w) => w.income - w.expense);
  }, [weeklyData]);

  const peakSurplus = useMemo(() => {
    return Math.max(0, ...weeklyNets);
  }, [weeklyNets]);

  const avgWeekly = useMemo(() => {
    return Math.round(netCashflow / 4);
  }, [netCashflow]);

  const incomeTxCount = transactions.filter((t) => t.type === 'income').length;
  const expenseTxCount = transactions.filter((t) => t.type === 'expense').length;

  return (
    <div id="analytics-view" className="space-y-6 pb-24 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">
            Riwayat & Analitik
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Evaluasi kesehatan cashflow, kategori belanja, dan kalender transaksi
          </p>
        </div>

        {/* Period Selector Pills */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-surface-container overflow-x-auto no-scrollbar">
          {periods.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setActivePeriod(p)}
              className={`px-3 py-1 rounded-xl font-label-sm text-label-sm font-medium transition-all ${
                activePeriod === p
                  ? 'bg-surface-container-lowest text-primary font-bold shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 1: 2x2 FINANCIAL SUMMARY CARDS */}
      <div className="grid grid-cols-2 gap-3">
        {/* Card 1: Pemasukan */}
        <div className="p-4 rounded-3xl bg-surface-container-lowest border border-surface-container space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
              Pemasukan
            </span>
            <span className="text-secondary font-label-sm text-[11px] font-bold">
              {incomeTxCount > 0 ? `${incomeTxCount} Transaksi` : 'Rp 0'}
            </span>
          </div>
          <p className="font-headline-sm text-headline-sm font-bold text-on-surface">
            {formatIDR(totalIncome)}
          </p>
          <span className="font-body-sm text-[11px] text-on-surface-variant block">
            {totalIncome > 0 ? 'Pemasukan tercatat' : 'Belum ada pemasukan'}
          </span>
        </div>

        {/* Card 2: Pengeluaran */}
        <div className="p-4 rounded-3xl bg-surface-container-lowest border border-surface-container space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
              Pengeluaran
            </span>
            <span className="text-error font-label-sm text-[11px] font-bold">
              {expenseTxCount > 0 ? `${expenseTxCount} Transaksi` : 'Rp 0'}
            </span>
          </div>
          <p className="font-headline-sm text-headline-sm font-bold text-on-surface">
            {formatIDR(totalExpense)}
          </p>
          <span className="font-body-sm text-[11px] text-on-surface-variant block">
            {totalExpense > 0 ? 'Pengeluaran tercatat' : 'Belum ada pengeluaran'}
          </span>
        </div>

        {/* Card 3: Arus Kas Bersih */}
        <div className="p-4 rounded-3xl bg-surface-container-lowest border border-surface-container space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
              Arus Kas Bersih
            </span>
            <span
              className={`font-label-sm text-[11px] font-bold ${
                netCashflow >= 0 ? 'text-secondary' : 'text-error'
              }`}
            >
              {transactions.length === 0 ? 'Kondisi Awal' : netCashflow >= 0 ? 'Surplus' : 'Defisit'}
            </span>
          </div>
          <p
            className={`font-headline-sm text-headline-sm font-bold ${
              netCashflow >= 0 ? 'text-secondary' : 'text-error'
            }`}
          >
            {netCashflow >= 0 ? '+' : ''}
            {formatIDR(netCashflow)}
          </p>
          <span className="font-body-sm text-[11px] text-on-surface-variant block">
            {transactions.length === 0
              ? 'Belum ada mutasi kas'
              : netCashflow >= 0
              ? 'Arus kas positif'
              : 'Arus kas defisit'}
          </span>
        </div>

        {/* Card 4: Rasio Tabungan */}
        <div className="p-4 rounded-3xl bg-surface-container-lowest border border-surface-container space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
              Rasio Tabungan
            </span>
            <span className="text-secondary font-label-sm text-[11px] font-bold">
              {totalIncome > 0 ? (savingsRate >= 20 ? 'Optimal' : 'Perlu Ditingkatkan') : '0%'}
            </span>
          </div>
          <p className="font-headline-sm text-headline-sm font-bold text-on-surface">
            {savingsRate}%
          </p>
          <span className="font-body-sm text-[11px] text-on-surface-variant block">
            {totalIncome > 0
              ? savingsRate >= 20
                ? 'Target acuan 20% terpenuhi'
                : 'Target acuan minimal 20%'
              : 'Belum ada pemasukan'}
          </span>
        </div>
      </div>

      {/* SECTION 2: CASHFLOW TREND CHART */}
      <div
        id="analytics-trend-chart"
        className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Tren Arus Kas Bersih
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Kurva akumulasi surplus kas periode berjalan
            </p>
          </div>

          <div className="p-1 rounded-xl bg-surface-container flex gap-1">
            <button
              type="button"
              onClick={() => setTrendView('mingguan')}
              className={`px-2.5 py-0.5 rounded-lg font-label-sm text-label-sm font-medium ${
                trendView === 'mingguan'
                  ? 'bg-surface-container-lowest text-primary font-bold shadow-2xs'
                  : 'text-on-surface-variant'
              }`}
            >
              Mingguan
            </button>
            <button
              type="button"
              onClick={() => setTrendView('bulanan')}
              className={`px-2.5 py-0.5 rounded-lg font-label-sm text-label-sm font-medium ${
                trendView === 'bulanan'
                  ? 'bg-surface-container-lowest text-primary font-bold shadow-2xs'
                  : 'text-on-surface-variant'
              }`}
            >
              Bulanan
            </button>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="h-36 w-full bg-surface-container-low rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-1">
            <span className="material-symbols-outlined text-[28px] text-on-surface-variant">
              show_chart
            </span>
            <p className="font-label-md text-label-md text-on-surface font-semibold">
              Belum ada data tren kas
            </p>
            <p className="text-[12px] text-on-surface-variant">
              Kurva akumulasi tren kas mingguan akan tampil setelah ada transaksi tercatat.
            </p>
          </div>
        ) : (
          <div className="h-36 w-full bg-surface-container-low rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-medium">
              <span>Puncak Surplus: {formatIDR(peakSurplus)}</span>
              <span>Rata-rata: {avgWeekly >= 0 ? '+' : ''}{formatIDR(avgWeekly)}/minggu</span>
            </div>

            <svg className="w-full h-20 overflow-visible" viewBox="0 0 300 80">
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#006c49" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#006c49" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 10 65 Q 80 50, 150 35 T 290 20 L 290 80 L 10 80 Z"
                fill="url(#trendGradient)"
              />
              <path
                d="M 10 65 Q 80 50, 150 35 T 290 20"
                fill="none"
                stroke="#006c49"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx="10" cy="65" r="4" fill="#006c49" />
              <circle cx="150" cy="35" r="4" fill="#006c49" />
              <circle cx="290" cy="20" r="5" fill="#006c49" stroke="#fff" strokeWidth="2" />
            </svg>

            <div className="grid grid-cols-4 text-center text-label-sm text-on-surface-variant">
              {weeklyData.map((w) => (
                <span key={w.week} className={w.isCurrent ? 'font-bold text-primary' : ''}>
                  {w.week}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: PENGELUARAN PER KATEGORI */}
      <div
        id="analytics-category-breakdown"
        className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Pengeluaran per Kategori
          </h3>
          <span className="font-stat-tabular text-label-md font-bold text-on-surface">
            {formatIDR(totalExpense)}
          </span>
        </div>

        {categoryBreakdown.length === 0 ? (
          <div className="p-8 rounded-2xl bg-surface-container-low text-center space-y-2">
            <span className="material-symbols-outlined text-[32px] text-on-surface-variant">
              pie_chart
            </span>
            <p className="font-label-md text-label-md text-on-surface font-semibold">
              Belum ada data pengeluaran
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Catat pengeluaran Anda untuk melihat visualisasi komposisi belanja per kategori.
            </p>
          </div>
        ) : (
          <>
            {/* Donut progress visual bar */}
            <div className="w-full h-3 rounded-full bg-surface-container flex overflow-hidden">
              {categoryBreakdown.map((cat, idx) => (
                <div
                  key={idx}
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${cat.percentage}%`,
                    backgroundColor: cat.color,
                  }}
                  title={`${cat.name}: ${cat.percentage}%`}
                />
              ))}
            </div>

            {/* Category breakdown item list */}
            <div className="space-y-2.5 pt-1">
              {categoryBreakdown.map((cat) => (
                <div key={cat.name} className="flex items-center justify-between text-body-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-on-surface font-medium">{cat.name}</span>
                    <span className="text-[11px] text-on-surface-variant">({cat.percentage}%)</span>
                  </div>
                  <span className="font-stat-tabular text-on-surface font-semibold">
                    {formatIDR(cat.amount)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* SECTION 4: SUMBER PEMASUKAN */}
      <div
        id="analytics-income-sources"
        className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Sumber Pemasukan
          </h3>
          <span className="font-stat-tabular text-label-md font-bold text-secondary">
            {formatIDR(totalIncome)}
          </span>
        </div>

        {incomeBreakdown.length === 0 ? (
          <div className="p-8 rounded-2xl bg-surface-container-low text-center space-y-2">
            <span className="material-symbols-outlined text-[32px] text-on-surface-variant">
              account_balance_wallet
            </span>
            <p className="font-label-md text-label-md text-on-surface font-semibold">
              Belum ada data pemasukan
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Catat pemasukan Anda untuk melihat visualisasi komposisi sumber pendapatan.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {incomeBreakdown.map((inc) => (
              <div key={inc.name} className="space-y-1">
                <div className="flex items-center justify-between text-body-sm">
                  <span className="text-on-surface font-medium">{inc.name}</span>
                  <span className="font-stat-tabular text-on-surface font-semibold">
                    {formatIDR(inc.amount)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                  <div
                    className="h-full rounded-full bg-secondary transition-all duration-500"
                    style={{ width: `${inc.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 5: AI FINANCIAL INSIGHTS */}
      <div
        id="analytics-ai-insights"
        className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container space-y-3"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-primary">auto_awesome</span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Insight Keuangan AI
          </h3>
        </div>

        <div className="space-y-2.5">
          {transactions.length === 0 ? (
            <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary-container text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px]">lightbulb</span>
              </div>
              <div className="text-body-sm">
                <h4 className="font-semibold text-on-surface">Insight AI Siap Dianalisis</h4>
                <p className="text-on-surface-variant mt-0.5">
                  Mulai mencatat transaksi kas atau memindai struk belanja dengan OCR AI untuk mendapatkan evaluasi rasio finansial otomatis.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container flex items-start gap-3">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    netCashflow >= 0
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-error-container text-on-error-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {netCashflow >= 0 ? 'verified' : 'warning'}
                  </span>
                </div>
                <div className="text-body-sm">
                  <h4 className="font-semibold text-on-surface">
                    {netCashflow >= 0 ? 'Arus Kas Mengalami Surplus' : 'Arus Kas Mengalami Defisit'}
                  </h4>
                  <p className="text-on-surface-variant mt-0.5">
                    {netCashflow >= 0
                      ? `Surplus bersih tercatat sebesar ${formatIDR(netCashflow)}. Anda dapat mengalokasikan kelebihan likuiditas ini ke instrumen investasi likuid atau tabungan dana darurat.`
                      : `Total pengeluaran melampaui pemasukan sebesar ${formatIDR(Math.abs(netCashflow))}. Evaluasi kembali pos pengeluaran sekunder Anda.`}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary-container text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">savings</span>
                </div>
                <div className="text-body-sm">
                  <h4 className="font-semibold text-on-surface">
                    Evaluasi Rasio Tabungan ({savingsRate}%)
                  </h4>
                  <p className="text-on-surface-variant mt-0.5">
                    {savingsRate >= 20
                      ? `Tingkat tabungan Anda ${savingsRate}% berada dalam zona optimal dan memenuhi standar rasio acuan finansial (≥20%).`
                      : totalIncome > 0
                      ? `Tingkat tabungan Anda saat ini ${savingsRate}%. Upayakan target acuan 20% dengan menekan pos belanja non-primer.`
                      : 'Catat pemasukan rutin Anda untuk menghitung rasio tabungan yang akurat.'}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* SECTION 6: ALUR FINANSIAL ANDA */}
      <FinancialFlowDiagram id="analytics-financial-flow-diagram" />

      {/* SECTION 7: PERJALANAN KEKAYAAN BERSIH */}
      <div
        id="analytics-networth-milestone"
        className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Kekayaan Bersih Terkini
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Status ekuitas dan solvabilitas portofolio finansial Anda
            </p>
          </div>
          {assets.length > 0 || liabilities.length > 0 ? (
            <span className="font-label-sm text-label-sm text-secondary bg-secondary-container px-2.5 py-0.5 rounded-full font-semibold">
              {netWorth >= 0 ? 'Solvabel' : 'Defisit'}
            </span>
          ) : (
            <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded-full font-medium">
              Kondisi Awal
            </span>
          )}
        </div>

        {assets.length === 0 && liabilities.length === 0 ? (
          <div className="p-8 rounded-2xl bg-surface-container-low text-center space-y-2">
            <span className="material-symbols-outlined text-[32px] text-on-surface-variant">
              account_balance
            </span>
            <p className="font-label-md text-label-md text-on-surface font-semibold">
              Belum ada portofolio neraca
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Tambahkan aset (kas, tabungan, investasi) dan liabilitas di tab Neraca untuk melacak kekayaan bersih Anda secara real-time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-surface-container-low text-center space-y-1">
              <span className="text-[11px] font-semibold text-on-surface-variant uppercase">
                Total Aset
              </span>
              <p className="font-stat-tabular text-body-md font-bold text-on-surface">
                {formatIDR(totalAssets)}
              </p>
              <span className="text-[10px] text-secondary font-medium">
                {assets.length} Akun
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-container-low text-center space-y-1">
              <span className="text-[11px] font-semibold text-on-surface-variant uppercase">
                Total Liabilitas
              </span>
              <p className="font-stat-tabular text-body-md font-bold text-error">
                {formatIDR(totalLiabilities)}
              </p>
              <span className="text-[10px] text-error font-medium">
                {liabilities.length} Kewajiban
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-secondary-container text-center space-y-1">
              <span className="text-[11px] font-semibold text-on-secondary-container uppercase">
                Net Worth
              </span>
              <p className="font-stat-tabular text-body-md font-bold text-on-secondary-container">
                {formatIDR(netWorth)}
              </p>
              <span className="text-[10px] text-on-secondary-container font-medium">
                Ekuitas Bersih
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
