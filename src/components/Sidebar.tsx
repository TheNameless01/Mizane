import React from 'react';
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  CreditCard,
  Clock,
  Settings,
  X,
  Scale,
  Globe,
} from 'lucide-react';
import { BusinessSettings } from '../shared/types';
import { useI18n } from '../shared/i18n/context';
import { LanguageSwitcher } from './LanguageSwitcher';

export type NavTab = 'dashboard' | 'customers' | 'aging' | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  businessSettings?: BusinessSettings | null;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenSaleModal: () => void;
  onOpenPaymentModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  businessSettings,
  mobileOpen,
  onCloseMobile,
  onOpenSaleModal,
  onOpenPaymentModal,
}) => {
  const { t, locale } = useI18n();

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: t('nav.dashboard', 'Tableau de bord'), icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'customers', label: t('nav.customers', 'Clients & Soldes'), icon: <Users className="w-4 h-4" /> },
    { id: 'aging', label: t('nav.aging', 'Balance âgée'), icon: <Clock className="w-4 h-4" /> },
    { id: 'settings', label: t('nav.settings', 'Paramètres'), icon: <Settings className="w-4 h-4" /> },
  ];

  const content = (
    <div className="flex flex-col h-full bg-slate-900 text-white select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-black text-base tracking-tight leading-none text-white">
              MIZAN <span className="text-emerald-400 font-bold text-xs">ميزان</span>
            </h1>
            <span className="text-[10px] text-slate-400 block mt-1 truncate max-w-[130px]">
              {businessSettings?.name || 'Grossiste Algérie'}
            </span>
          </div>
        </div>

        {mobileOpen && (
          <button
            onClick={onCloseMobile}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg md:hidden"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Prominent Language Switcher at Top of Sidebar */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-2">
          <Globe className="w-3.5 h-3.5 text-indigo-400" />
          <span>{locale === 'ar' ? 'اختيار اللغة' : 'Langue'}</span>
        </div>
        <LanguageSwitcher variant="sidebar" />
      </div>

      {/* Quick Action Buttons in Sidebar */}
      <div className="p-3.5 space-y-2 border-b border-slate-800">
        <button
          onClick={() => {
            onOpenSaleModal();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
        >
          <ShoppingCart className="w-4 h-4" />
          {t('actions.new_sale', 'Nouvelle vente')}
        </button>
        <button
          onClick={() => {
            onOpenPaymentModal();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
        >
          <CreditCard className="w-4 h-4" />
          {t('actions.new_payment', 'Nouveau règlement')}
        </button>
      </div>

      {/* Main Navigation Items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {locale === 'ar' ? 'التنقل' : 'Navigation'}
        </div>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-slate-800 text-white shadow-xs border-s-4 border-indigo-500'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <span className={isActive ? 'text-indigo-400' : 'text-slate-400'}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Status / Local-First Info */}
      <div className="p-3.5 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
        <div>
          <span className="block font-semibold text-slate-400">Local-First SQLite</span>
          <span className="text-[10px] text-slate-500">{locale === 'ar' ? 'الجزائر (دج)' : 'Algérie (DZD)'}</span>
        </div>
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Connecté localement" />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="no-print hidden md:block w-64 shrink-0 h-screen sticky top-0 shadow-lg z-30">
        {content}
      </aside>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-start duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
