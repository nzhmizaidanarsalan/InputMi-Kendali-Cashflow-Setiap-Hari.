import React from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatIDR } from '../utils/formatters';

interface FinancialFlowDiagramProps {
  id?: string;
}

export const FinancialFlowDiagram: React.FC<FinancialFlowDiagramProps> = ({
  id = 'financial-flow-diagram',
}) => {
  const { totalIncome, netCashflow, netWorth } = useFinance();

  return (
    <div
      id={id}
      className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-primary">hub</span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Alur Finansial Anda
          </h3>
        </div>
        <span className="font-label-sm text-label-sm text-secondary font-semibold bg-secondary-container px-2 py-0.5 rounded-full">
          {netCashflow >= 0 ? 'Surplus Terkendali' : 'Defisit Terpantau'}
        </span>
      </div>

      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Ringkasan integrasi antara mutasi kas masuk, retensi dana, dan akumulasi nilai kekayaan bersih Anda.
      </p>

      {/* Interactive Diagram Card */}
      <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[20px]">payments</span>
          </div>
          <div>
            <span className="text-[11px] text-on-surface-variant uppercase font-semibold">
              Pemasukan
            </span>
            <p className="font-label-md text-label-md font-bold text-on-surface">
              {formatIDR(totalIncome)}
            </p>
          </div>
        </div>

        <span className="material-symbols-outlined text-[20px] text-on-surface-variant rotate-90 sm:rotate-0">
          arrow_forward
        </span>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-container-highest text-on-surface flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[20px]">savings</span>
          </div>
          <div>
            <span className="text-[11px] text-on-surface-variant uppercase font-semibold">
              Surplus Bersih
            </span>
            <p
              className={`font-label-md text-label-md font-bold ${
                netCashflow >= 0 ? 'text-secondary' : 'text-error'
              }`}
            >
              {netCashflow > 0 ? '+' : ''}
              {formatIDR(netCashflow)}
            </p>
          </div>
        </div>

        <span className="material-symbols-outlined text-[20px] text-on-surface-variant rotate-90 sm:rotate-0">
          arrow_forward
        </span>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
          </div>
          <div>
            <span className="text-[11px] text-on-surface-variant uppercase font-semibold">
              Valuasi Net Worth
            </span>
            <p className="font-label-md text-label-md font-bold text-primary">
              {formatIDR(netWorth)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
