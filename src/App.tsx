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
import { Menu, Plus, RefreshCw, ShoppingCart, CreditCard } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [statementCustomerId, setStatementCustomerId] = useState<number | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Core Data State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [salePreselectedId, setSalePreselectedId] = useState<number | undefined>(undefined);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentPreselectedId, setPaymentPreselectedId] = useState<number | undefined>(undefined);

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
    setSaleModalOpen(true);
  };

  const handleOpenPayment = (custId?: number) => {
    setPaymentPreselectedId(custId);
    setPaymentModalOpen(true);
  };

  const handleOpenAdjustment = (custId?: number) => {
    setAdjustmentPreselectedId(custId);
    setAdjustmentModalOpen(true);
  };

  const handleOpenAddCustomer = () => {
    setEditingCustomer(null);
    setCustomerModalOpen(true);
  };

  const handleOpenEditCustomer = (c: Customer) => {
    setEditingCustomer(c);
    setCustomerModalOpen(true);
  };

  const handleCustomerSaved = (saved: Customer) => {
    refreshAllData();
    if (selectedCustomerId === saved.id) {
      setSelectedCustomerId(saved.id);
    }
  };

  const handleSeedData = async () => {
    // Calling seed via API or script
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Supérette El Baraka (M. Karim)',
        phone: '0555 12 34 56',
        address: 'Bab Ezzouar, Alger',
        payment_terms_days: 30,
        credit_limit_centimes: 100000000,
      }),
    });
    const c = await res.json();
    if (c.id) {
      await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: c.id,
          sold_at: new Date().toISOString(),
          items: [
            { label: 'Semoule Extra 25kg', unit: 'sac', quantity_thousandths: 20000, unit_price_centimes: 125000 },
            { label: 'Huile Elio 5L', unit: 'carton', quantity_thousandths: 10000, unit_price_centimes: 360000 },
          ],
        }),
      });
    }
    await refreshAllData();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans">
      {/* Sidebar Navigation (Desktop persistent, Mobile drawer) */}
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
        <header className="no-print md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-md">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="p-1.5 -ms-1 text-slate-300 hover:text-white rounded-lg"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-bold text-sm tracking-tight">
              Mizan <span className="text-emerald-400 font-normal text-xs">ميزان</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleOpenSale()}
              className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
              title="Nouvelle vente"
            >
              <ShoppingCart className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleOpenPayment()}
              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
              title="Nouveau règlement"
            >
              <CreditCard className="w-4 h-4" />
            </button>
          </div>
        </header>

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
              onOpenSaleModal={() => handleOpenSale()}
              onOpenPaymentModal={() => handleOpenPayment()}
              onOpenCustomerModal={handleOpenAddCustomer}
              onSelectCustomer={(id) => setSelectedCustomerId(id)}
              onGoToAging={() => setActiveTab('aging')}
              onGoToCustomers={() => setActiveTab('customers')}
            />
          ) : activeTab === 'customers' ? (
            <CustomersView
              customers={customers}
              onSelectCustomer={(id) => setSelectedCustomerId(id)}
              onOpenCustomerModal={handleOpenAddCustomer}
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
            />
          )}
        </div>
      </main>

      {/* Customer Modal (Create / Edit) */}
      {customerModalOpen && (
        <CustomerModal
          initialCustomer={editingCustomer}
          onSaved={handleCustomerSaved}
          onClose={() => setCustomerModalOpen(false)}
        />
      )}

      {/* New Sale Modal */}
      {saleModalOpen && (
        <NewSaleModal
          customers={customers.filter((c) => !c.archived_at)}
          preselectedCustomerId={salePreselectedId}
          onSaleCreated={async () => {
            await refreshAllData();
          }}
          onClose={() => setSaleModalOpen(false)}
          onOpenCustomerModal={handleOpenAddCustomer}
        />
      )}

      {/* New Payment Modal */}
      {paymentModalOpen && (
        <NewPaymentModal
          customers={customers.filter((c) => !c.archived_at)}
          preselectedCustomerId={paymentPreselectedId}
          onPaymentRecorded={async () => {
            await refreshAllData();
          }}
          onClose={() => setPaymentModalOpen(false)}
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
    </div>
  );
}
