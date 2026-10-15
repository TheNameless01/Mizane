import React, { useState, useEffect } from 'react';
import { Customer, BusinessSettings, DashboardMetrics } from './shared/types';
import { Sidebar, NavTab } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { CustomersView } from './components/CustomersView';
import { CustomerDetailView } from './components/CustomerDetailView';
import { StatementView } from './components/StatementView';
import { AgingReportView } from './components/AgingReportView';
import { SettingsView } from './components/SettingsView';
import { CustomerModal } from './components/NewCustomerModal';
import { NewSaleModal } from './components/NewSaleModal';
import { NewPaymentModal } from './components/NewPaymentModal';
import { NewAdjustmentModal } from './components/NewAdjustmentModal';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { I18nProvider, useI18n } from './shared/i18n/context';
import { Menu, ShoppingCart, CreditCard, Globe, Sparkles } from 'lucide-react';

function AppContent() {
  const { t, locale, dir } = useI18n();

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [statementCustomerId, setStatementCustomerId] = useState<number | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Core Data State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Customer Modal tracking
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerModalOrigin, setCustomerModalOrigin] = useState<'sale' | 'payment' | 'standalone' | null>(null);

  // Newly created customer tracking to immediately pass to open modals
  const [saleNewlyCreatedCustomer, setSaleNewlyCreatedCustomer] = useState<Customer | null>(null);
  const [paymentNewlyCreatedCustomer, setPaymentNewlyCreatedCustomer] = useState<Customer | null>(null);

  // Sale Modal
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [salePreselectedId, setSalePreselectedId] = useState<number | undefined>(undefined);

  // Payment Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentPreselectedId, setPaymentPreselectedId] = useState<number | undefined>(undefined);

  // Adjustment Modal
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [adjustmentPreselectedId, setAdjustmentPreselectedId] = useState<number | undefined>(undefined);

  // Global Data Fetch
  const refreshAllData = async () => {
    try {
      const [cRes, bRes, dRes] = await Promise.all([
        fetch('/api/customers?includeArchived=true'),
        fetch('/api/business'),
        fetch('/api/dashboard'),
      ]);

      const [cData, bData, dData] = await Promise.all([cRes.json(), bRes.json(), dRes.json()]);

      if (cRes.ok && Array.isArray(cData)) setCustomers(cData);
      if (bRes.ok) setBusinessSettings(bData);
      if (dRes.ok) setDashboardMetrics(dData);
    } catch (err) {
      console.error('Failed to refresh data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  // Handlers for Opening Modals
  const handleOpenSale = (custId?: number) => {
    setSalePreselectedId(custId);
    setSaleNewlyCreatedCustomer(null);
    setSaleModalOpen(true);
  };

  const handleOpenPayment = (custId?: number) => {
    setPaymentPreselectedId(custId);
    setPaymentNewlyCreatedCustomer(null);
    setPaymentModalOpen(true);
  };

  const handleOpenAdjustment = (custId?: number) => {
    setAdjustmentPreselectedId(custId);
    setAdjustmentModalOpen(true);
  };

  const handleOpenAddCustomerStandalone = () => {
    setCustomerModalOrigin('standalone');
    setEditingCustomer(null);
    setCustomerModalOpen(true);
  };

  const handleOpenAddCustomerFromSale = () => {
    setCustomerModalOrigin('sale');
    setEditingCustomer(null);
    setCustomerModalOpen(true);
  };

  const handleOpenAddCustomerFromPayment = () => {
    setCustomerModalOrigin('payment');
    setEditingCustomer(null);
    setCustomerModalOpen(true);
  };

  const handleOpenEditCustomer = (c: Customer) => {
    setCustomerModalOrigin('standalone');
    setEditingCustomer(c);
    setCustomerModalOpen(true);
  };

  const handleCustomerSaved = async (saved: Customer) => {
    // 1. Immediately update callers so dropdowns react without waiting
    if (customerModalOrigin === 'sale') {
      setSaleNewlyCreatedCustomer(saved);
      setSalePreselectedId(saved.id);
    } else if (customerModalOrigin === 'payment') {
      setPaymentNewlyCreatedCustomer(saved);
      setPaymentPreselectedId(saved.id);
    }

    if (selectedCustomerId === saved.id) {
      setSelectedCustomerId(saved.id);
    }

    // 2. Fetch fresh backend data
    await refreshAllData();
    setCustomerModalOrigin(null);
  };

  const handleSeedData = async () => {
    const res = await fetch('/api/seed', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors du chargement des données');
    await refreshAllData();
  };

  const handleFlushData = async () => {
    const res = await fetch('/api/flush', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la réinitialisation');
    setSelectedCustomerId(null);
    setStatementCustomerId(null);
    await refreshAllData();
  };

  return (
    <div dir={dir} className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setSelectedCustomerId(null);
          setStatementCustomerId(null);
        }}
        businessSettings={businessSettings}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        onOpenSaleModal={() => handleOpenSale()}
        onOpenPaymentModal={() => handleOpenPayment()}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Mobile Header Bar */}
        <header className="no-print md:hidden bg-slate-900 text-white px-3.5 py-2.5 flex items-center justify-between sticky top-0 z-20 shadow-md">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="p-1.5 -ms-1 text-slate-300 hover:text-white rounded-lg cursor-pointer"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight">
                Mizan <span className="text-emerald-400 font-normal text-xs">ميزان</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />

            <button
              onClick={() => handleOpenSale()}
              className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer"
              title={locale === 'ar' ? 'بيع جديد' : 'Nouvelle vente'}
            >
              <ShoppingCart className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleOpenPayment()}
              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer"
              title={locale === 'ar' ? 'تسجيل قبض' : 'Nouveau règlement'}
            >
              <CreditCard className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Desktop Top Bar with Quick Actions, Business Name and Language Switcher */}
        <div className="no-print hidden md:flex items-center justify-between px-6 py-2.5 bg-white border-b border-slate-200 shrink-0 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
            <span className="font-black text-slate-900 text-sm">
              {businessSettings?.name || 'Établissement Commercial'}
            </span>
            <span>•</span>
            <span className="text-slate-600">
              {locale === 'ar' ? 'سجل ديون الزبائن والتحصيل' : 'Registre de Crédit & Recouvrement'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span>{locale === 'ar' ? 'اللغة' : 'Langue'} :</span>
            </div>
            <LanguageSwitcher variant="header" />
          </div>
        </div>

        {/* View Content Container */}
        <div className="p-4 sm:p-6 lg:p-8 flex-1">
          {statementCustomerId ? (
            <StatementView
              customerId={statementCustomerId}
              onBack={() => setStatementCustomerId(null)}
            />
          ) : selectedCustomerId ? (
            <CustomerDetailView
              customerId={selectedCustomerId}
              businessSettings={businessSettings}
              onBack={() => setSelectedCustomerId(null)}
              onOpenSaleModal={handleOpenSale}
              onOpenPaymentModal={handleOpenPayment}
              onOpenAdjustmentModal={handleOpenAdjustment}
              onOpenStatement={(id) => setStatementCustomerId(id)}
              onEditCustomer={handleOpenEditCustomer}
            />
          ) : activeTab === 'dashboard' ? (
            <DashboardView
              metrics={dashboardMetrics}
              loading={loading}
              customersCount={customers.length}
              onOpenSaleModal={() => handleOpenSale()}
              onOpenPaymentModal={() => handleOpenPayment()}
              onOpenCustomerModal={handleOpenAddCustomerStandalone}
              onSelectCustomer={(id) => setSelectedCustomerId(id)}
              onGoToAging={() => setActiveTab('aging')}
              onGoToCustomers={() => setActiveTab('customers')}
              onSeedData={handleSeedData}
            />
          ) : activeTab === 'customers' ? (
            <CustomersView
              customers={customers}
              onSelectCustomer={(id) => setSelectedCustomerId(id)}
              onOpenCustomerModal={handleOpenAddCustomerStandalone}
            />
          ) : activeTab === 'aging' ? (
            <AgingReportView
              businessSettings={businessSettings}
              onSelectCustomer={(id) => setSelectedCustomerId(id)}
            />
          ) : (
            <SettingsView
              settings={businessSettings}
              onSettingsUpdated={(updated) => {
                setBusinessSettings(updated);
                refreshAllData();
              }}
              onSeedData={handleSeedData}
              onFlushData={handleFlushData}
            />
          )}
        </div>
      </main>

      {/* New Sale Modal (Docked Fixed Layout) */}
      {saleModalOpen && (
        <NewSaleModal
          customers={customers.filter((c) => !c.archived_at)}
          preselectedCustomerId={salePreselectedId}
          newlyCreatedCustomer={saleNewlyCreatedCustomer}
          onSaleCreated={async () => {
            await refreshAllData();
          }}
          onClose={() => setSaleModalOpen(false)}
          onOpenCustomerModal={handleOpenAddCustomerFromSale}
        />
      )}

      {/* New Payment Modal (Docked Fixed Layout) */}
      {paymentModalOpen && (
        <NewPaymentModal
          customers={customers.filter((c) => !c.archived_at)}
          preselectedCustomerId={paymentPreselectedId}
          newlyCreatedCustomer={paymentNewlyCreatedCustomer}
          onPaymentRecorded={async () => {
            await refreshAllData();
          }}
          onClose={() => setPaymentModalOpen(false)}
          onOpenCustomerModal={handleOpenAddCustomerFromPayment}
        />
      )}

      {/* New Adjustment Modal */}
      {adjustmentModalOpen && (
        <NewAdjustmentModal
          customers={customers.filter((c) => !c.archived_at)}
          preselectedCustomerId={adjustmentPreselectedId}
          onAdjustmentRecorded={async () => {
            await refreshAllData();
          }}
          onClose={() => setAdjustmentModalOpen(false)}
        />
      )}

      {/* Customer Modal (Create / Edit) - Rendered at bottom of DOM with z-[70] so it ALWAYS displays above any open Sale or Payment modal! */}
      {customerModalOpen && (
        <CustomerModal
          initialCustomer={editingCustomer}
          onSaved={handleCustomerSaved}
          onClose={() => {
            setCustomerModalOpen(false);
            setCustomerModalOrigin(null);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}
