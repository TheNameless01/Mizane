import React from 'react';
import { DashboardMetrics } from '../shared/types';
import { formatDZD } from '../shared/money';
import { formatDateFr } from '../shared/dates';
import { MoneyDisplay } from './MoneyDisplay';
import { useI18n } from '../shared/i18n/context';
import {
  TrendingUp,
  CreditCard,
  Users,
  AlertTriangle,
  Clock,
  ShoppingCart,
  UserPlus,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface DashboardViewProps {
  metrics: DashboardMetrics | null;
  loading: boolean;
  customersCount?: number;
  onOpenSaleModal: () => void;
  onOpenPaymentModal: () => void;
  onOpenCustomerModal: () => void;
  onSelectCustomer: (customerId: number) => void;
  onGoToAging: () => void;
  onGoToCustomers: () => void;
  onSeedData?: () => Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  loading,
  customersCount,
  onOpenSaleModal,
  onOpenPaymentModal,
  onOpenCustomerModal,
  onSelectCustomer,
  onGoToAging,
  onGoToCustomers,
  onSeedData,
}) => {
  const { t, locale } = useI18n();
  const isAr = locale === 'ar';

  if (loading || !metrics) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Action Top Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {isAr ? 'لوحة القيادة — الديون والتحصيل' : 'Tableau de bord — Crédit & Recouvrement'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAr
              ? 'نظرة شاملة على الوضع المالي، مبيعات اليوم والديون المتأخرة'
              : "Vue d'ensemble de la situation financière et du risque client"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenSaleModal}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            {isAr ? 'تسجيل بيع جديد' : 'Nouvelle vente'}
          </button>
          <button
            onClick={onOpenPaymentModal}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            {isAr ? 'تسجيل قبض جديد' : 'Nouveau paiement'}
          </button>
          <button
            onClick={onOpenCustomerModal}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <UserPlus className="w-4 h-4 text-slate-500" />
            {isAr ? '+ زبون جديد' : '+ Client'}
          </button>
        </div>
      </div>

      {/* 4 Big KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outstanding Debt */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {isAr ? 'إجمالي الديون المستحقة' : 'Créances totales dues'}
            </span>
            <span className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <TrendingUp className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900 tabular-nums font-mono">
              {formatDZD(metrics.total_outstanding_centimes, { locale })}
            </span>
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
              <span>
                {metrics.debtors_count} {isAr ? 'زبون عليه دين' : 'client(s) débiteur(s)'}
              </span>
              <button
                onClick={onGoToCustomers}
                className="text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                {isAr ? 'عرض الكل ←' : 'Voir tout →'}
              </button>
            </div>
          </div>
        </div>

        {/* Overdue Debt */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
              {isAr ? 'ديون تجاوزت الأجل' : 'Créances en retard'}
            </span>
            <span className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-rose-700 tabular-nums font-mono">
              {formatDZD(metrics.overdue_total_centimes, { locale })}
            </span>
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
              <span>{isAr ? 'استحقاق متأخر' : 'Échéance dépassée'}</span>
              <button
                onClick={onGoToAging}
                className="text-rose-600 hover:text-rose-800 font-semibold"
              >
                {isAr ? 'الأعمار ←' : 'Balance âgée →'}
              </button>
            </div>
          </div>
        </div>

        {/* Today's Sales */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {isAr ? 'مبيعات اليوم' : "Ventes d'aujourd'hui"}
            </span>
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
              <ShoppingCart className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900 tabular-nums font-mono">
              {formatDZD(metrics.sales_today_centimes, { locale })}
            </span>
            <p className="text-xs text-slate-500 mt-2">
              {isAr ? 'مجموع الحاضر وبالدين' : 'Crédit et comptant cumulés'}
            </p>
          </div>
        </div>

        {/* Today's Payments */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              {isAr ? 'المقبوضات اليوم' : "Encaissé aujourd'hui"}
            </span>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <CreditCard className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-700 tabular-nums font-mono">
              {formatDZD(metrics.payments_today_centimes, { locale })}
            </span>
            <p className="text-xs text-slate-500 mt-2">
              {isAr ? 'تسديدات الزبائن المقبوضة' : 'Règlements reçus'}
            </p>
          </div>
        </div>
      </div>

      {/* Top Debtors & Recent Activity 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Debtors List */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                {isAr ? 'أكبر المدينين (أولوية التذكير والتحصيل)' : 'Principaux Débiteurs (Priorité de Relance)'}
              </h3>
            </div>
            <button
              onClick={onGoToAging}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
            >
              {isAr ? 'جدول أعمار الديون' : "Rapport d'échéancier"}{' '}
              <ArrowRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {metrics.top_debtors.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic">
              {isAr ? 'لا يوجد أي زبون مدين حالياً. الحسابات مسواة!' : 'Aucun client débiteur pour le moment.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {metrics.top_debtors.map((d, index) => (
                <div
                  key={d.id}
                  onClick={() => onSelectCustomer(d.id)}
                  className="p-3.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-4 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 group-hover:bg-indigo-100 text-slate-600 group-hover:text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-xs sm:text-sm block">
                        {d.name}
                      </span>
                      {d.phone && (
                        <span className="text-[11px] text-slate-500 font-mono">{d.phone}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-end">
                    <span className="font-black text-sm text-slate-900 tabular-nums font-mono block">
                      {formatDZD(d.balance_centimes, { locale })}
                    </span>
                    {d.days_overdue_max > 0 ? (
                      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200">
                        {d.days_overdue_max} {isAr ? 'يوم تأخير' : 'j de retard'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">
                        {isAr ? 'في الأجل العادي' : 'Échéance normale'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity Stream */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-slate-900 text-sm">
              {isAr ? 'آخر الحركات والمعاملات' : 'Dernières Opérations'}
            </h3>
          </div>

          {metrics.recent_activity.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic">
              {isAr ? 'لا توجد حركات حديثة مسجلة.' : 'Aucune activité récente.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
              {metrics.recent_activity.map((act) => (
                <div key={act.id} className="p-3 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        act.type === 'sale'
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {act.type === 'sale' ? (
                        <ShoppingCart className="w-3.5 h-3.5" />
                      ) : (
                        <CreditCard className="w-3.5 h-3.5" />
                      )}
                    </span>
                    <div>
                      <span className="font-semibold text-slate-900 block">{act.customer_name}</span>
                      <span className="text-[11px] text-slate-500">{act.summary}</span>
                    </div>
                  </div>

                  <div className="text-end shrink-0">
                    <span
                      className={`font-bold tabular-nums font-mono block ${
                        act.type === 'sale' ? 'text-slate-900' : 'text-emerald-700'
                      }`}
                    >
                      {act.type === 'sale' ? '+' : '-'} {formatDZD(act.amount_centimes, { locale })}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatDateFr(act.date, { includeTime: false })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
