import React from 'react';
import { useFinance } from '../context/FinanceContext';
import { ActiveTab } from '../types';

export const NavigationDock: React.FC = () => {
  const { activeTab, setActiveTab } = useFinance();

  const navItems: { id: ActiveTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'grid_view' },
    { id: 'cashflow', label: 'Cashflow', icon: 'swap_vert' },
    { id: 'scan', label: 'Pindai', icon: 'document_scanner' },
    { id: 'balance', label: 'Balance', icon: 'account_balance_wallet' },
    { id: 'analytics', label: 'More', icon: 'more_horiz' },
  ];

  return (
    <nav
      id="bottom-navigation-dock"
      className="fixed bottom-0 w-full z-40 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-2px_12px_rgba(0,0,0,0.04)] border-t border-surface-container/60"
    >
      <div className="h-16 px-2 flex items-center justify-around relative max-w-md mx-auto">
        {navItems.map((item) => {
          if (item.id === 'scan') {
            return (
              <div key={item.id} className="flex items-center justify-center -mt-5">
                <button
                  id="nav-scan-floating-btn"
                  type="button"
                  aria-label="Pindai Struk"
                  onClick={() => setActiveTab('scan')}
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-[0_8px_16px_rgba(0,0,0,0.18)] active:scale-95 transition-all ${
                    activeTab === 'scan'
                      ? 'bg-secondary text-on-secondary ring-4 ring-secondary-container/50'
                      : 'bg-primary text-on-primary hover:bg-primary-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[26px]">document_scanner</span>
                </button>
              </div>
            );
          }

          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              id={`nav-${item.id}-tab`}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[48px] min-w-[52px] flex flex-col items-center justify-center gap-0.5 transition-all ${
                isActive
                  ? 'text-primary font-semibold scale-105'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span
                className="material-symbols-outlined text-[22px]"
                style={{
                  fontVariationSettings: isActive ? "'FILL' 1, 'wght' 600" : "'FILL' 0, 'wght' 400",
                }}
              >
                {item.icon}
              </span>
              <span className="font-label-sm text-label-sm tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
