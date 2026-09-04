import React, { useEffect, useState } from 'react';
import { useFinance } from '../context/FinanceContext';

export const Toast: React.FC = () => {
  const { toastMessage } = useFinance();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (toastMessage) {
      setMessage(toastMessage);
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 2600);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  if (!visible) return null;

  return (
    <div
      id="global-toast-banner"
      role="status"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-primary text-on-primary px-4 py-2 rounded-full shadow-xl font-label-md text-label-md flex items-center gap-2 pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-top-2"
    >
      <span className="material-symbols-outlined text-[18px] text-secondary">check_circle</span>
      <span>{message}</span>
    </div>
  );
};
