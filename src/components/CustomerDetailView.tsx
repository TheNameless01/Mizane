import React, { useState, useEffect } from 'react';
import { Customer, CustomerStatement, StatementRow, BusinessSettings } from '../shared/types';
import { formatDZD, getBalanceStatus } from '../shared/money';
import { formatDateFr } from '../shared/dates';
import { MoneyDisplay } from './MoneyDisplay';
import { RemindModal } from './RemindModal';
import { VoidModal } from './VoidModal';
import {
  ArrowLeft,
  ShoppingCart,
  CreditCard,
  Sliders,
  FileText,
  MessageSquare,
  Edit2,
  Archive,
  ArchiveRestore,
  Phone,
  MapPin,
  Clock,
  ShieldAlert,
  Ban,
  RefreshCw,
} from 'lucide-react';

interface CustomerDetailViewProps {
  customerId: number;
  businessSettings?: BusinessSettings | null;
  onBack: () => void;
  onOpenSaleModal: (customerId: number) => void;
  onOpenPaymentModal: (customerId: number) => void;
  onOpenAdjustmentModal: (customerId: number) => void;
  onOpenStatement: (customerId: number) => void;
  onEditCustomer: (customer: Customer) => void;
}

export const CustomerDetailView: React.FC<CustomerDetailViewProps> = ({
  customerId,
  businessSettings,
  onBack,
  onOpenSaleModal,
  onOpenPaymentModal,
  onOpenAdjustmentModal,
  onOpenStatement,
  onEditCustomer,
}) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [statement, setStatement] = useState<CustomerStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'all' | 'sales' | 'payments' | 'adjustments'>('all');
  const [showRemindModal, setShowRemindModal] = useState(false);
  const [voidingTarget, setVoidingTarget] = useState<{
    type: 'sale' | 'payment';
    id: number;
    description: string;
  } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [cRes, sRes] = await Promise.all([
        fetch(`/api/customers/${customerId}`),
        fetch(`/api/customers/${customerId}/statement`),
      ]);

      const [cData, sData] = await Promise.all([cRes.json(), sRes.json()]);

      if (!cRes.ok) throw new Error(cData.error || 'Erreur client');
      if (!sRes.ok) throw new Error(sData.error || 'Erreur relevé');

      setCustomer(cData);
      setStatement(sData);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [customerId]);

  const handleToggleArchive = async () => {
    if (!customer) return;
    const isArchived = Boolean(customer.archived_at);
    const endpoint = isArchived ? 'unarchive' : 'archive';

    try {
      const res = await fetch(`/api/customers/${customer.id}/${endpoint}`, { method: 'POST' });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || 'Erreur');
      setCustomer(updated);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleConfirmVoid = async (reason: string) => {
    if (!voidingTarget) return;
    const { type, id } = voidingTarget;
    const url = type === 'sale' ? `/api/sales/${id}/void` : `/api/payments/${id}/void`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur lors de l'annulation");

    await loadData();
  };

  if (loading && !customer) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-600" />
        <p className="text-sm font-medium">Chargement du compte client...</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-8 text-center">
        <p className="text-rose-600 font-semibold mb-4">{error || 'Client introuvable'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium"
        >
          Retour à la liste des clients
        </button>
      </div>
    );
  }

  const balanceCentimes = customer.balance_centimes || 0;
  const status = getBalanceStatus(balanceCentimes);

  // Credit limit evaluation
  let creditLimitPercent = 0;
  if (customer.credit_limit_centimes && customer.credit_limit_centimes > 0) {
    creditLimitPercent = Math.min(100, Math.round((balanceCentimes / customer.credit_limit_centimes) * 100));
  }

  // Filter rows for history
  const filteredRows = (statement?.rows || []).filter((r) => {
    if (activeTab === 'sales') return r.type === 'sale';
    if (activeTab === 'payments') return r.type === 'payment';
    if (activeTab === 'adjustments') return r.type === 'adjustment';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top back navigation and main actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-xs hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux clients
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {balanceCentimes > 0 && (
            <button
              onClick={() => setShowRemindModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Relancer (WhatsApp / SMS)
            </button>
          )}

          <button
            onClick={() => onOpenSaleModal(customer.id)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            Nouvelle vente
          </button>

          <button
            onClick={() => onOpenPaymentModal(customer.id)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            Nouveau paiement
          </button>

          <button
            onClick={() => onOpenAdjustmentModal(customer.id)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg shadow-xs transition-colors"
          >
            <Sliders className="w-4 h-4 text-slate-500" />
            Ajustement
          </button>

          <button
            onClick={() => onOpenStatement(customer.id)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg shadow-xs transition-colors"
          >
            <FileText className="w-4 h-4 text-slate-500" />
            Imprimer relevé
          </button>

          <button
            onClick={() => onEditCustomer(customer)}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            title="Modifier le client"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleToggleArchive}
            className={`p-2 rounded-lg border transition-colors ${
              customer.archived_at
                ? 'text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100'
                : 'text-slate-400 border-slate-200 hover:text-rose-600 hover:bg-rose-50'
            }`}
            title={customer.archived_at ? 'Désarchiver le client' : 'Archiver le client'}
          >
            {customer.archived_at ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Customer Profile Header Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{customer.name}</h1>
              {customer.archived_at && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
                  Archivé
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-600">
              {customer.phone && (
                <div className="flex items-center gap-1 font-medium">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <a href={`tel:${customer.phone}`} className="hover:text-indigo-600">
                    {customer.phone}
                  </a>
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{customer.address}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Délai accordé : <strong>{customer.payment_terms_days} jours</strong></span>
              </div>
            </div>

            {customer.notes && (
              <p className="text-xs text-slate-500 mt-2 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                "{customer.notes}"
              </p>
            )}
          </div>

          {/* Current Balance Display */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-start lg:text-end min-w-[240px]">
            <span className="text-xs uppercase tracking-wider font-bold text-slate-500 block mb-1">
              Solde en temps réel
            </span>
            <MoneyDisplay centimes={balanceCentimes} size="xl" showBadge />

            {customer.credit_limit_centimes !== null && customer.credit_limit_centimes > 0 && (
              <div className="mt-3 pt-2 border-t border-slate-200">
                <div className="flex justify-between text-[11px] font-medium text-slate-600 mb-1">
                  <span>Plafond : {formatDZD(customer.credit_limit_centimes)}</span>
                  <span className={creditLimitPercent >= 90 ? 'text-rose-600 font-bold' : ''}>
                    {creditLimitPercent}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      creditLimitPercent >= 90
                        ? 'bg-rose-600'
                        : creditLimitPercent >= 70
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${creditLimitPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Aggregate Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total des ventes (TTC)
          </span>
          <span className="text-xl font-bold text-slate-900 tabular-nums block mt-1">
            {formatDZD(customer.total_sales_centimes || 0)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total des règlements
          </span>
          <span className="text-xl font-bold text-emerald-700 tabular-nums block mt-1">
            {formatDZD(customer.total_payments_centimes || 0)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Ajustements cumulés
          </span>
          <span className="text-xl font-bold text-slate-800 tabular-nums block mt-1">
            {formatDZD(customer.total_adjustments_centimes || 0, { showSign: true })}
          </span>
        </div>
      </div>

      {/* Transaction History & Running Balance Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <h3 className="font-bold text-slate-900 text-sm">
            Historique chronologique des écritures
          </h3>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                activeTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tous ({statement?.rows.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                activeTab === 'sales' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ventes
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                activeTab === 'payments' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Paiements
            </button>
            <button
              onClick={() => setActiveTab('adjustments')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                activeTab === 'adjustments' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ajustements
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4 text-start">Date</th>
                <th className="py-2.5 px-4 text-start">Type & Réf</th>
                <th className="py-2.5 px-4 text-start">Désignation / Note</th>
                <th className="py-2.5 px-4 text-end">Débit (+)</th>
                <th className="py-2.5 px-4 text-end">Crédit (-)</th>
                <th className="py-2.5 px-4 text-end">Solde Courant</th>
                <th className="py-2.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                    Aucune opération enregistrée pour ce filtre.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const [itemType, rawId] = row.id.split('-');
                  const numId = parseInt(rawId, 10);

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        row.is_voided ? 'opacity-40 bg-slate-50 line-through' : ''
                      }`}
                    >
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-mono">
                        {formatDateFr(row.date)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-slate-700">
                        {row.reference}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900">{row.label}</span>
                        {row.details && (
                          <span className="block text-[11px] text-slate-500 font-normal">
                            {row.details}
                          </span>
                        )}
                        {row.is_voided && (
                          <span className="inline-block text-[10px] text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 not-italic">
                            [ANNULÉ : {row.void_reason || 'Non précisé'}]
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-end tabular-nums font-semibold text-slate-900">
                        {row.debit_centimes > 0 ? formatDZD(row.debit_centimes) : '—'}
                      </td>
                      <td className="py-3 px-4 text-end tabular-nums font-semibold text-emerald-700">
                        {row.credit_centimes > 0 ? formatDZD(row.credit_centimes) : '—'}
                      </td>
                      <td className="py-3 px-4 text-end tabular-nums font-bold text-slate-900">
                        {formatDZD(row.running_balance_centimes)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {!row.is_voided && (itemType === 'sale' || itemType === 'payment') && (
                          <button
                            onClick={() =>
                              setVoidingTarget({
                                type: itemType as any,
                                id: numId,
                                description: `${row.label} (${row.reference})`,
                              })
                            }
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors rounded"
                            title="Annuler cette écriture"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reminder Modal */}
      {showRemindModal && (
        <RemindModal
          customer={customer}
          business={businessSettings}
          onClose={() => setShowRemindModal(false)}
        />
      )}

      {/* Void Modal */}
      {voidingTarget && (
        <VoidModal
          title={voidingTarget.type === 'sale' ? "Annulation d'une vente" : "Annulation d'un paiement"}
          itemDescription={voidingTarget.description}
          onConfirm={handleConfirmVoid}
          onClose={() => setVoidingTarget(null)}
        />
      )}
    </div>
  );
};
