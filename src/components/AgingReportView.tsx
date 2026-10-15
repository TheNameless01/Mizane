import React, { useState, useEffect } from 'react';
import { AgingBucket, Customer, BusinessSettings } from '../shared/types';
import { formatDZD } from '../shared/money';
import { RemindModal } from './RemindModal';
import {
  CalendarClock,
  MessageSquare,
  RefreshCw,
  Phone,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';

interface AgingReportViewProps {
  businessSettings?: BusinessSettings | null;
  onSelectCustomer: (customerId: number) => void;
}

export const AgingReportView: React.FC<AgingReportViewProps> = ({
  businessSettings,
  onSelectCustomer,
}) => {
  const [buckets, setBuckets] = useState<AgingBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remindCustomer, setRemindCustomer] = useState<Customer | null>(null);

  const fetchAging = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/aging');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur chargement échéancier');
      setBuckets(data);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAging();
  }, []);

  // Compute aggregate totals per bucket
  const totalBalance = buckets.reduce((acc, b) => acc + b.total_balance_centimes, 0);
  const totalCurrent = buckets.reduce((acc, b) => acc + b.current_centimes, 0);
  const total1to30 = buckets.reduce((acc, b) => acc + b.days_1_30_centimes, 0);
  const total31to60 = buckets.reduce((acc, b) => acc + b.days_31_60_centimes, 0);
  const total61to90 = buckets.reduce((acc, b) => acc + b.days_61_90_centimes, 0);
  const total90Plus = buckets.reduce((acc, b) => acc + b.days_90_plus_centimes, 0);

  const handleOpenRemind = (bucket: AgingBucket) => {
    const cust: Customer = {
      id: bucket.customer_id,
      name: bucket.customer_name,
      phone: bucket.phone,
      address: null,
      notes: null,
      credit_limit_centimes: null,
      payment_terms_days: 30,
      created_at: '',
      updated_at: '',
      archived_at: null,
      balance_centimes: bucket.total_balance_centimes,
    };
    setRemindCustomer(cust);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Balance Âgée des Créances (Échéancier)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ventilation chronologique par ancienneté selon la règle d'imputation FIFO (Oldest-First)
          </p>
        </div>

        <button
          onClick={fetchAging}
          className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-xs transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* Aggregate Aging Buckets Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Total Dû
          </span>
          <span className="text-base font-black text-slate-900 tabular-nums block mt-1">
            {formatDZD(totalBalance)}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">{buckets.length} client(s)</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
            Non échu (Courant)
          </span>
          <span className="text-base font-black text-emerald-700 tabular-nums block mt-1">
            {formatDZD(totalCurrent)}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Dans le délai</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
            1 à 30 jours
          </span>
          <span className="text-base font-black text-amber-700 tabular-nums block mt-1">
            {formatDZD(total1to30)}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Retard faible</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700 block">
            31 à 60 jours
          </span>
          <span className="text-base font-black text-orange-700 tabular-nums block mt-1">
            {formatDZD(total31to60)}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Relance urgente</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
            61 à 90 jours
          </span>
          <span className="text-base font-black text-rose-700 tabular-nums block mt-1">
            {formatDZD(total61to90)}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Risque avéré</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs bg-rose-50/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-900 block">
            + de 90 jours
          </span>
          <span className="text-base font-black text-red-950 tabular-nums block mt-1">
            {formatDZD(total90Plus)}
          </span>
          <span className="text-[10px] text-rose-600 font-semibold mt-0.5 block">Contentieux</span>
        </div>
      </div>

      {/* Aging Table */}
      {loading && buckets.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-600" />
          <p className="text-sm font-medium">Calcul de la balance âgée en cours...</p>
        </div>
      ) : buckets.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center mb-3">
            <CalendarClock className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">Aucune créance en retard !</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Tous les clients sont à jour ou ont soldé leurs comptes.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 text-start">Client</th>
                  <th className="py-3 px-4 text-end">Total Dû</th>
                  <th className="py-3 px-3 text-end text-emerald-700">Non échu</th>
                  <th className="py-3 px-3 text-end text-amber-700">1 - 30j</th>
                  <th className="py-3 px-3 text-end text-orange-700">31 - 60j</th>
                  <th className="py-3 px-3 text-end text-rose-700">61 - 90j</th>
                  <th className="py-3 px-3 text-end text-red-950">+90j</th>
                  <th className="py-3 px-4 text-end">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {buckets.map((b) => (
                  <tr
                    key={b.customer_id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    <td
                      onClick={() => onSelectCustomer(b.customer_id)}
                      className="py-3 px-4 cursor-pointer"
                    >
                      <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors block text-xs sm:text-sm">
                        {b.customer_name}
                      </span>
                      {b.phone && (
                        <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {b.phone}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-end tabular-nums font-black text-slate-900 text-sm">
                      {formatDZD(b.total_balance_centimes)}
                    </td>

                    <td className="py-3 px-3 text-end tabular-nums font-medium text-emerald-700">
                      {b.current_centimes > 0 ? formatDZD(b.current_centimes, { showSymbol: false }) : '—'}
                    </td>

                    <td className="py-3 px-3 text-end tabular-nums font-semibold text-amber-700">
                      {b.days_1_30_centimes > 0 ? formatDZD(b.days_1_30_centimes, { showSymbol: false }) : '—'}
                    </td>

                    <td className="py-3 px-3 text-end tabular-nums font-semibold text-orange-700">
                      {b.days_31_60_centimes > 0 ? formatDZD(b.days_31_60_centimes, { showSymbol: false }) : '—'}
                    </td>

                    <td className="py-3 px-3 text-end tabular-nums font-bold text-rose-700">
                      {b.days_61_90_centimes > 0 ? formatDZD(b.days_61_90_centimes, { showSymbol: false }) : '—'}
                    </td>

                    <td className="py-3 px-3 text-end tabular-nums font-black text-red-950 bg-rose-50/40">
                      {b.days_90_plus_centimes > 0 ? formatDZD(b.days_90_plus_centimes, { showSymbol: false }) : '—'}
                    </td>

                    <td className="py-3 px-4 text-end whitespace-nowrap">
                      <button
                        onClick={() => handleOpenRemind(b)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded text-xs transition-colors shadow-2xs"
                        title="Relancer le client (WhatsApp / SMS)"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Relancer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {remindCustomer && (
        <RemindModal
          customer={remindCustomer}
          business={businessSettings}
          onClose={() => setRemindCustomer(null)}
        />
      )}
    </div>
  );
};
