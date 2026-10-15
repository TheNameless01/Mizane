import React from 'react';
import { useI18n, Locale } from '../shared/i18n/context';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'header' | 'sidebar' | 'settings' | 'compact';
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  className = '',
  variant = 'header',
}) => {
  const { locale, setLocale } = useI18n();

  if (variant === 'settings') {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setLocale('fr')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
            locale === 'fr'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <span className="text-base">🇫🇷</span>
          <span>Français</span>
        </button>

        <button
          type="button"
          onClick={() => setLocale('ar')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
            locale === 'ar'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <span className="text-base">🇩🇿</span>
          <span>العربية (الجزائر)</span>
        </button>
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div
        className={`w-full bg-slate-950/70 p-1 rounded-xl border border-slate-800 flex items-center gap-1 text-xs font-semibold ${className}`}
      >
        <button
          type="button"
          onClick={() => setLocale('fr')}
          className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            locale === 'fr'
              ? 'bg-indigo-600 text-white shadow-xs font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
          title="Afficher en Français"
        >
          <span>🇫🇷</span>
          <span>Français</span>
        </button>

        <button
          type="button"
          onClick={() => setLocale('ar')}
          className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            locale === 'ar'
              ? 'bg-emerald-600 text-white shadow-xs font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
          title="عرض باللغة العربية"
        >
          <span>🇩🇿</span>
          <span>العربية</span>
        </button>
      </div>
    );
  }

  // Header variant (light/neutral container for top bar)
  return (
    <div
      className={`inline-flex items-center bg-slate-100 hover:bg-slate-200/80 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold shadow-2xs transition-colors ${className}`}
      title="Changer de langue / تغيير اللغة"
    >
      <button
        type="button"
        onClick={() => setLocale('fr')}
        className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
          locale === 'fr'
            ? 'bg-white text-indigo-700 shadow-xs font-bold border border-slate-200/60'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <span>🇫🇷</span>
        <span>FR</span>
      </button>

      <button
        type="button"
        onClick={() => setLocale('ar')}
        className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
          locale === 'ar'
            ? 'bg-emerald-600 text-white shadow-xs font-bold'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <span>🇩🇿</span>
        <span>عربي</span>
      </button>
    </div>
  );
};
