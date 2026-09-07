import React, { useMemo, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { AddEditAssetModal } from '../components/AddEditAssetModal';
import { AddEditLiabilityModal } from '../components/AddEditLiabilityModal';
import { Asset, Liability } from '../types';
import { formatIDR } from '../utils/formatters';

export const BalanceView: React.FC = () => {
  const {
    assets,
    liabilities,
    balanceChanges,
    totalAssets,
    totalLiabilities,
    netWorth,
    solvencyAssetPercent,
    solvencyLiabilityPercent,
    deleteAsset,
    deleteLiability,
    payLiability,
    pushPermission,
    isPushSubscribed,
    enableWebPushReminders,
    disableWebPushReminders,
    testSendWebPushReminder,
  } = useFinance();

  const [isPushProcessing, setIsPushProcessing] = useState(false);

  const [assetCategoryFilter, setAssetCategoryFilter] = useState<string>('all');
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [isAddLiabOpen, setIsAddLiabOpen] = useState(false);
  const [editingLiability, setEditingLiability] = useState<Liability | null>(null);
  const [showAuditChanges, setShowAuditChanges] = useState(false);

  // Active action menu states
  const [activeMenuAssetId, setActiveMenuAssetId] = useState<string | null>(null);
  const [activeMenuLiabId, setActiveMenuLiabId] = useState<string | null>(null);

  const filteredAssets = useMemo(() => {
    if (assetCategoryFilter === 'all') return assets;
    return assets.filter((a) => a.category === assetCategoryFilter);
  }, [assets, assetCategoryFilter]);

  const debtToEquityRatio = useMemo(() => {
    if (netWorth <= 0) return '0.00';
    return (totalLiabilities / netWorth).toFixed(2);
  }, [totalLiabilities, netWorth]);

  return (
    <div id="balance-view" className="space-y-6 pb-24 max-w-2xl mx-auto">
      {/* Header with Title and Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">
            Neraca Keuangan
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Pencatatan aset riil, investasi, dan liabilitas terpadu
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAuditChanges(!showAuditChanges)}
            className="min-h-[38px] px-3 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold flex items-center gap-1.5 transition-colors"
            title="Riwayat Audit Perubahan Posisi"
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            <span>Audit</span>
          </button>

          <button
            id="add-asset-btn"
            type="button"
            onClick={() => {
              setEditingAsset(null);
              setIsAddAssetOpen(true);
            }}
            className="min-h-[38px] px-3.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm font-semibold flex items-center gap-1 active:scale-95 shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>+ Aset</span>
          </button>

          <button
            id="add-liability-btn"
            type="button"
            onClick={() => {
              setEditingLiability(null);
              setIsAddLiabOpen(true);
            }}
            className="min-h-[38px] px-3.5 rounded-full bg-surface-container-highest hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold flex items-center gap-1 active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>+ Liabilitas</span>
          </button>
        </div>
      </div>

      {/* Audit Changes Panel if toggled */}
      {showAuditChanges && (
        <div className="p-4 rounded-3xl bg-surface-container border border-surface-container-highest space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">analytics</span>
              Riwayat Perubahan Posisi Neraca
            </h3>
            <button
              type="button"
              onClick={() => setShowAuditChanges(false)}
              className="text-on-surface-variant hover:text-on-surface text-xs"
            >
              Tutup
            </button>
          </div>

          <div className="space-y-2">
            {balanceChanges.map((ch) => (
              <div
                key={ch.id}
                className="p-3 rounded-2xl bg-surface-container-lowest flex items-center justify-between text-body-sm"
              >
                <div>
                  <p className="font-semibold text-on-surface">{ch.name}</p>
                  <p className="text-on-surface-variant text-[11px]">
                    {ch.date} • {ch.description}
                  </p>
                </div>
                <span
                  className={`font-stat-tabular font-bold ${
                    ch.changeAmount >= 0 ? 'text-secondary' : 'text-error'
                  }`}
                >
                  {ch.changeAmount >= 0 ? '+' : ''}
                  {formatIDR(ch.changeAmount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HERO NET WORTH CARD */}
      <div
        id="balance-hero-card"
        className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4"
      >
        <div className="flex items-center justify-between">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
            Kekayaan Bersih (Net Worth)
          </span>
          {totalAssets > 0 || totalLiabilities > 0 ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">
              <span className="material-symbols-outlined text-[14px]">account_balance</span>
              {netWorth >= 0 ? 'Solvabel' : 'Defisit Ekuitas'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-medium">
              Kondisi Awal
            </span>
          )}
        </div>

        <h2 className="font-display-currency text-[34px] sm:text-[42px] font-bold text-on-surface">
          {formatIDR(netWorth)}
        </h2>

        {/* Total Assets and Total Liabilities Grid */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-surface-container">
          <div className="p-3 rounded-2xl bg-surface-container-low">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
              Total Aset
            </span>
            <p className="font-headline-sm text-headline-sm font-bold text-on-surface mt-0.5">
              {formatIDR(totalAssets)}
            </p>
            <span className="text-[11px] text-secondary font-medium">
              {assets.length} Akun & Instrumen
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-surface-container-low">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
              Total Liabilitas
            </span>
            <p className="font-headline-sm text-headline-sm font-bold text-on-surface mt-0.5">
              {formatIDR(totalLiabilities)}
            </p>
            <span className="text-[11px] text-error font-medium">
              {liabilities.length} Kewajiban
            </span>
          </div>
        </div>
      </div>

      {/* STRUKTUR MODAL & SOLVABILITAS RATIO BAR */}
      <div
        id="balance-solvency-bar"
        className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container space-y-3"
      >
        <div className="flex items-center justify-between">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
            Struktur Modal & Solvabilitas
          </span>
          <span className="font-label-sm text-label-sm text-secondary bg-secondary-container px-2.5 py-0.5 rounded-full font-semibold">
            {totalAssets === 0 && totalLiabilities === 0
              ? 'Bebas Kewajiban'
              : totalLiabilities === 0
              ? '100% Bebas Utang'
              : `Rasio (${solvencyAssetPercent}:${solvencyLiabilityPercent})`}
          </span>
        </div>

        {/* Visual Solvency Bar */}
        <div className="w-full h-3 rounded-full bg-surface-container flex overflow-hidden">
          <div
            className="h-full bg-secondary transition-all duration-500"
            style={{ width: `${solvencyAssetPercent}%` }}
            title={`Aset: ${solvencyAssetPercent}%`}
          />
          <div
            className="h-full bg-error transition-all duration-500"
            style={{ width: `${solvencyLiabilityPercent}%` }}
            title={`Liabilitas: ${solvencyLiabilityPercent}%`}
          />
        </div>

        <div className="flex items-center justify-between text-body-sm text-on-surface-variant pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
            <span className="font-medium text-on-surface">Aset: {solvencyAssetPercent}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-error" />
            <span className="font-medium text-on-surface">Liabilitas: {solvencyLiabilityPercent}%</span>
          </div>
          <span className="text-[11px] font-semibold text-on-surface-variant">
            D/E Ratio: {debtToEquityRatio}
          </span>
        </div>
      </div>

      {/* SECTION 1: ASET LIST */}
      <div id="assets-management-section" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Aset</h3>
            <span className="font-stat-tabular text-headline-sm text-on-surface font-bold">
              {formatIDR(totalAssets)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingAsset(null);
              setIsAddAssetOpen(true);
            }}
            className="font-label-sm text-label-sm text-secondary font-semibold hover:underline flex items-center gap-0.5"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Tambah</span>
          </button>
        </div>

        {/* Asset Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'bank', label: 'Kas & Bank' },
            { id: 'investasi', label: 'Investasi' },
            { id: 'digital', label: 'Digital' },
            { id: 'peralatan', label: 'Peralatan' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setAssetCategoryFilter(cat.id)}
              className={`min-h-[34px] px-3.5 rounded-full font-label-sm text-label-sm font-medium transition-all shrink-0 ${
                assetCategoryFilter === cat.id
                  ? 'bg-primary text-on-primary font-semibold shadow-2xs'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Asset Cards */}
        <div className="space-y-2">
          {filteredAssets.length === 0 ? (
            <div className="p-8 rounded-3xl bg-surface-container-lowest border border-dashed border-surface-container-highest text-center space-y-2.5">
              <div className="w-11 h-11 rounded-2xl bg-surface-container-low text-on-surface-variant flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-[24px]">account_balance</span>
              </div>
              <p className="font-label-md text-label-md text-on-surface font-semibold">
                Belum ada aset
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm mx-auto">
                Tambahkan aset pertama Anda seperti rekening bank, e-wallet, atau instrumen investasi.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingAsset(null);
                  setIsAddAssetOpen(true);
                }}
                className="mt-1 px-3.5 py-1.5 rounded-xl bg-primary text-on-primary font-label-sm text-label-sm font-semibold inline-flex items-center gap-1 active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Tambah Aset</span>
              </button>
            </div>
          ) : (
            filteredAssets.map((asset) => (
              <div
                key={asset.id}
                className="p-3.5 rounded-2xl bg-surface-container-lowest border border-surface-container flex items-center justify-between relative group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0">
                    <span className="material-symbols-outlined text-[20px]">{asset.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-label-md text-label-md text-on-surface font-semibold truncate">
                        {asset.name}
                      </h4>
                      <span className="font-label-sm text-[10px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
                        {asset.categoryLabel}
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                      {asset.monthlyChange || asset.notes || 'Aset stabil'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pl-2">
                  <div className="text-right">
                    <span className="font-stat-tabular text-stat-tabular font-bold text-on-surface block">
                      {formatIDR(asset.value)}
                    </span>
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveMenuAssetId(activeMenuAssetId === asset.id ? null : asset.id)
                      }
                      className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
                    >
                      <span className="material-symbols-outlined text-[18px]">more_vert</span>
                    </button>

                    {activeMenuAssetId === asset.id && (
                      <div className="absolute right-0 top-full mt-1 w-32 bg-surface-container-lowest rounded-xl shadow-lg border border-surface-container py-1 z-30">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAsset(asset);
                            setIsAddAssetOpen(true);
                            setActiveMenuAssetId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 font-label-sm text-label-sm text-on-surface hover:bg-surface-container flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deleteAsset(asset.id);
                            setActiveMenuAssetId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 font-label-sm text-label-sm text-error hover:bg-error-container/40 flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                          <span>Hapus</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 2: LIABILITAS LIST */}
      <div id="liabilities-management-section" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Liabilitas
            </h3>
            <span className="font-stat-tabular text-headline-sm text-on-surface font-bold">
              {formatIDR(totalLiabilities)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingLiability(null);
              setIsAddLiabOpen(true);
            }}
            className="font-label-sm text-label-sm text-error font-semibold hover:underline flex items-center gap-0.5"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Tambah</span>
          </button>
        </div>

        {/* Web Push Due Date Reminder Control Card */}
        <div
          id="liability-push-notification-banner"
          className="p-3.5 sm:p-4 rounded-2xl bg-surface-container-lowest border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isPushSubscribed
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isPushSubscribed ? 'notifications_active' : 'notifications'}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-label-md text-label-md font-semibold text-on-surface truncate">
                  Pengingat Jatuh Tempo Web Push
                </span>
                {isPushSubscribed && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[11px] font-semibold shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    Aktif (H-3, H-1, Hari H)
                  </span>
                )}
              </div>
              <p className="text-[12px] text-on-surface-variant line-clamp-1 sm:line-clamp-none">
                Notifikasi privasi otomatis dikirim 3 hari sebelum, 1 hari sebelum, dan di hari jatuh tempo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {pushPermission === 'denied' ? (
              <span className="text-[12px] text-error font-medium">Izin Diblokir Browser</span>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isPushProcessing}
                  onClick={async () => {
                    setIsPushProcessing(true);
                    try {
                      if (isPushSubscribed) {
                        await disableWebPushReminders();
                      } else {
                        await enableWebPushReminders();
                      }
                    } finally {
                      setIsPushProcessing(false);
                    }
                  }}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-xl font-label-sm text-label-sm font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
                    isPushSubscribed
                      ? 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                      : 'bg-primary text-on-primary shadow-2xs hover:brightness-110'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isPushSubscribed ? 'notifications_off' : 'notifications'}
                  </span>
                  <span>{isPushSubscribed ? 'Nonaktifkan' : 'Aktifkan'}</span>
                </button>

                {isPushSubscribed && (
                  <button
                    type="button"
                    disabled={isPushProcessing}
                    onClick={async () => {
                      setIsPushProcessing(true);
                      try {
                        await testSendWebPushReminder();
                      } finally {
                        setIsPushProcessing(false);
                      }
                    }}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold flex items-center gap-1 transition-all active:scale-95"
                    title="Kirim pengingat uji coba ke perangkat ini"
                  >
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    <span>Uji Coba</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Liability Cards */}
        <div className="space-y-2">
          {liabilities.length === 0 ? (
            <div className="p-8 rounded-3xl bg-surface-container-lowest border border-dashed border-surface-container-highest text-center space-y-2.5">
              <div className="w-11 h-11 rounded-2xl bg-surface-container-low text-on-surface-variant flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-[24px]">credit_card</span>
              </div>
              <p className="font-label-md text-label-md text-on-surface font-semibold">
                Belum ada liabilitas
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm mx-auto">
                Tidak ada catatan utang, cicilan, atau kewajiban aktif saat ini.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingLiability(null);
                  setIsAddLiabOpen(true);
                }}
                className="mt-1 px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold inline-flex items-center gap-1 active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Tambah Liabilitas</span>
              </button>
            </div>
          ) : (
            liabilities.map((liab) => (
            <div
              key={liab.id}
              className="p-3.5 rounded-2xl bg-surface-container-lowest border border-surface-container flex items-center justify-between relative group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-error-container/40 text-error flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">{liab.icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-label-md text-label-md text-on-surface font-semibold truncate">
                      {liab.name}
                    </h4>
                    <span className="font-label-sm text-[10px] text-error bg-error-container px-2 py-0.5 rounded-full">
                      {liab.categoryLabel}
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                    Jatuh tempo: {liab.dueDate}
                    {liab.monthlyPayment ? ` • Cicilan ${formatIDR(liab.monthlyPayment)}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 pl-2">
                <div className="text-right">
                  <span className="font-stat-tabular text-stat-tabular font-bold text-on-surface block">
                    {formatIDR(liab.totalRemaining)}
                  </span>
                  {liab.totalRemaining > 0 && (
                    <button
                      type="button"
                      onClick={() => payLiability(liab.id)}
                      className="text-[11px] text-secondary font-bold hover:underline"
                    >
                      Bayar
                    </button>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveMenuLiabId(activeMenuLiabId === liab.id ? null : liab.id)
                    }
                    className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined text-[18px]">more_vert</span>
                  </button>

                  {activeMenuLiabId === liab.id && (
                    <div className="absolute right-0 top-full mt-1 w-32 bg-surface-container-lowest rounded-xl shadow-lg border border-surface-container py-1 z-30">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLiability(liab);
                          setIsAddLiabOpen(true);
                          setActiveMenuLiabId(null);
                        }}
                        className="w-full text-left px-3 py-1.5 font-label-sm text-label-sm text-on-surface hover:bg-surface-container flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          deleteLiability(liab.id);
                          setActiveMenuLiabId(null);
                        }}
                        className="w-full text-left px-3 py-1.5 font-label-sm text-label-sm text-error hover:bg-error-container/40 flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        <span>Hapus</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>

      {/* SECTION 3: BALANCE SHEET EQUATION INSIGHT CARD */}
      <div
        id="balance-equation-insight-card"
        className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container space-y-3"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-primary">functions</span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Persamaan Neraca Finansial
          </h3>
        </div>

        <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <span className="text-[11px] text-on-surface-variant uppercase font-semibold">
              Total Aset
            </span>
            <p className="font-headline-sm text-headline-sm font-bold text-on-surface">
              {formatIDR(totalAssets)}
            </p>
          </div>

          <span className="font-headline-sm text-headline-sm font-bold text-on-surface-variant">
            =
          </span>

          <div>
            <span className="text-[11px] text-on-surface-variant uppercase font-semibold">
              Liabilitas
            </span>
            <p className="font-headline-sm text-headline-sm font-bold text-error">
              {formatIDR(totalLiabilities)}
            </p>
          </div>

          <span className="font-headline-sm text-headline-sm font-bold text-on-surface-variant">
            +
          </span>

          <div>
            <span className="text-[11px] text-on-surface-variant uppercase font-semibold">
              Ekuitas (Net Worth)
            </span>
            <p className="font-headline-sm text-headline-sm font-bold text-secondary">
              {formatIDR(netWorth)}
            </p>
          </div>
        </div>

        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Neraca Anda seimbang secara akuntansi. Nilai ekuitas riil Anda merepresentasikan 89% dari seluruh total aset yang Anda kendalikan.
        </p>
      </div>

      <AddEditAssetModal
        isOpen={isAddAssetOpen}
        onClose={() => setIsAddAssetOpen(false)}
        editingAsset={editingAsset}
      />

      <AddEditLiabilityModal
        isOpen={isAddLiabOpen}
        onClose={() => setIsAddLiabOpen(false)}
        editingLiability={editingLiability}
      />
    </div>
  );
};
