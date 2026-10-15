import React from 'react';
import { formatDZD, getBalanceStatus } from '../shared/money';
import { useI18n } from '../shared/i18n/context';

interface MoneyDisplayProps {
  centimes: number;
  showBadge?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSign?: boolean;
  className?: string;
}

export const MoneyDisplay: React.FC<MoneyDisplayProps> = ({
  centimes,
  showBadge = false,
  size = 'md',
  showSign = false,
  className = '',
}) => {
  const { locale } = useI18n();
  const status = getBalanceStatus(centimes, locale);
  const formatted = formatDZD(centimes, { showSign, locale });

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base font-semibold',
    lg: 'text-lg font-bold',
    xl: 'text-2xl font-black tracking-tight',
  }[size];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`tabular-nums font-mono ${sizeClasses} ${status.textClass}`}>
        {formatted}
      </span>
      {showBadge && (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${status.badgeClass}`}
        >
          {status.label}
        </span>
      )}
    </div>
  );
};
