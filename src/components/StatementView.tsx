import React, { useState, useEffect } from 'react';
import { CustomerStatement } from '../shared/types';
import { formatDZD } from '../shared/money';
import { formatDateFr } from '../shared/dates';
import { useI18n } from '../shared/i18n/context';
import { Printer, ArrowLeft, RefreshCw, Calendar } from 'lucide-react';

interface StatementViewProps {
  customerId: number;
  onBack: () => void;
}

export const StatementView: React.FC<StatementViewProps> = ({ customerId, onBack }) => {
  const { t, locale } = useI18n();
  const isAr = locale === 'ar';

  const [statement, setStatement] = useState<CustomerStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const fetchStatement = async () => {
    try {
      setLoading(true);
      setError(null);

      let url = `/api/customers/${customerId}/statement`;
      const params = new URLSearchParams();
      if (fromDate) params.append('from', new Date(`${fromDate}T00:00:00.000Z`).toISOString());
      if (toDate) params.append('to', new Date(`${toDate}T23:59:59.999Z`).toISOString());
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors du chargement du relevé');

      setStatement(data);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatement();
  }, [customerId, fromDate, toDate]);

  const handlePrint = () => {
    window.print();
  };

  if (loading && !statement) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-600" />
        <p className="text-sm font-medium">
          {isAr ? 'جاري إعداد كشف الحساب...' : 'Génération du relevé comptable en cours...'}
        </p>
      </div>
    );
  }

  if (error || !statement) {
    return (
      <div className="p-8 text-center">
        <p className="text-rose-600 font-semibold mb-4">{error || 'Relevé indisponible'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium"
        >
          {isAr ? 'العودة لملف الزبون' : 'Retour à la fiche client'}
        </button>
      </div>
    );
  }

  const { customer, business, rows, opening_balance_centimes, closing_balance_centimes } = statement;

  return (
    <div className="space-y-6">
      {/* Interactive Controls Bar (hidden during printing) */}
      <div className="no-print bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <ArrowLeft className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
            {isAr ? 'رجوع' : 'Retour'}
          </button>
          <span className="text-sm font-bold text-slate-800">
            {isAr ? 'كشف الحساب — ' : 'Relevé de compte — '} {customer.name}
          </span>
        </div>

        {/* Date Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{isAr ? 'من' : 'Du'}</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="p-1.5 text-xs border border-slate-300 rounded-md bg-white"
            />
            <span>{isAr ? 'إلى' : 'Au'}</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="p-1.5 text-xs border border-slate-300 rounded-md bg-white"
            />
          </div>

          {(fromDate || toDate) && (
            <button
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1"
            >
              {isAr ? 'مسح التصفية' : 'Effacer filtre'}
            </button>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors ms-2"
          >
            <Printer className="w-4 h-4" />
            {isAr ? 'طباعة كشف الحساب (A4 / PDF)' : 'Imprimer relevé (A4 / PDF)'}
          </button>
        </div>
      </div>

      {/* Printable Sheet (Standard A4 format) */}
      <div className="print-page bg-white p-6 sm:p-10 rounded-xl border border-slate-200 shadow-sm max-w-4xl mx-auto space-y-6">
        {/* Wholesaler Header & Algerian Tax Identifiers */}
        <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {business.name || (isAr ? 'مؤسسة تجارية' : 'ÉTABLISSEMENT COMMERCIAL')}
            </h1>
            {business.address && (
              <p className="text-xs text-slate-600 mt-0.5">{business.address}</p>
            )}
            {business.phone && (
              <p className="text-xs text-slate-600 font-medium font-mono">
                {isAr ? 'الهاتف :' : 'Tél :'} {business.phone}
              </p>
            )}

            {/* Fiscal mentions (Algeria) */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500 font-mono">
              {business.nif && <span>NIF : {business.nif}</span>}
              {business.nis && <span>NIS : {business.nis}</span>}
              {business.rc && <span>RC : {business.rc}</span>}
              {business.ai && <span>AI : {business.ai}</span>}
            </div>
          </div>

          <div className="text-start sm:text-end">
            <span className="inline-block px-3 py-1 bg-slate-100 border border-slate-300 rounded text-xs font-black uppercase tracking-wider text-slate-800">
              {isAr ? 'كشف حساب الزبون' : 'RELEVÉ DE COMPTE CLIENT'}
            </span>
            <p className="text-xs text-slate-500 mt-2">
              {isAr ? 'تاريخ التحرير :' : "Date d'édition :"}{' '}
              <strong className="text-slate-800 font-mono">
                {formatDateFr(statement.generated_at, { includeTime: true })}
              </strong>
            </p>
            {(statement.from_date || statement.to_date) && (
              <p className="text-xs text-slate-600 mt-0.5 font-medium">
                {isAr ? 'الفترة :' : 'Période :'}{' '}
                {statement.from_date ? formatDateFr(statement.from_date) : isAr ? 'البداية' : 'Début'} {isAr ? 'إلى' : 'au'}{' '}
                {statement.to_date ? formatDateFr(statement.to_date) : isAr ? 'اليوم' : 'ce jour'}
              </p>
            )}
          </div>
        </div>

        {/* Customer Profile Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 p-4 rounded-lg">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              {isAr ? 'حساب الزبون' : 'Compte Client'}
            </span>
            <h2 className="text-base font-bold text-slate-900">{customer.name}</h2>
            {customer.phone && <p className="text-xs text-slate-600 font-mono">{isAr ? 'الهاتف :' : 'Tél :'} {customer.phone}</p>}
            {customer.address && <p className="text-xs text-slate-600">{customer.address}</p>}
          </div>

          <div className="text-start sm:text-end sm:border-s sm:border-slate-200 sm:ps-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              {isAr ? 'وضعية الحساب' : 'État du compte'}
            </span>
            <div className="mt-1">
              <span className="text-xs text-slate-600 me-2">{isAr ? 'رصيد الختام :' : 'Solde de clôture :'}</span>
              <span className="text-lg font-black text-slate-900 tabular-nums font-mono">
                {formatDZD(closing_balance_centimes, { locale })}
              </span>
            </div>
            {customer.credit_limit_centimes !== null && (
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                {isAr ? 'سقف الدين المسموح :' : 'Plafond autorisé :'}{' '}
                {formatDZD(customer.credit_limit_centimes, { locale })}
              </p>
            )}
          </div>
        </div>

        {/* Chronological Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300 bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                <th className="py-2.5 px-3 text-start">{isAr ? 'المرجع / الوصل' : 'Réf / Pièce'}</th>
                <th className="py-2.5 px-3 text-start">{isAr ? 'بيان العملية' : "Libellé de l'opération"}</th>
                <th className="py-2.5 px-3 text-end">{isAr ? 'مدين (مبيعات)' : 'Débit (Ventes)'}</th>
                <th className="py-2.5 px-3 text-end">{isAr ? 'دائن (تسديدات)' : 'Crédit (Règlements)'}</th>
                <th className="py-2.5 px-3 text-end">{isAr ? 'الرصيد الجاري' : 'Solde Courant'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {/* Opening balance row */}
              <tr className="bg-slate-50/70 font-semibold text-slate-800">
                <td className="py-2.5 px-3 font-mono">
                  {statement.from_date ? formatDateFr(statement.from_date) : '—'}
                </td>
                <td className="py-2.5 px-3 font-mono text-slate-500">SOLDE-INIT</td>
                <td className="py-2.5 px-3">
                  {isAr
                    ? `رصيد الافتتاح ${statement.from_date ? 'قبل هذه الفترة' : ''}`
                    : `Solde d'ouverture ${statement.from_date ? 'avant la période' : ''}`}
                </td>
                <td className="py-2.5 px-3 text-end tabular-nums text-slate-400">—</td>
                <td className="py-2.5 px-3 text-end tabular-nums text-slate-400">—</td>
                <td className="py-2.5 px-3 text-end font-bold tabular-nums font-mono">
                  {formatDZD(opening_balance_centimes, { locale })}
                </td>
              </tr>

              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                    {isAr ? 'لا توجد أي حركات مسجلة في هذه الفترة.' : 'Aucun mouvement enregistré pour cette période.'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      row.is_voided ? 'opacity-40 bg-slate-100/60 line-through' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-mono">
                      {formatDateFr(row.date)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-700">
                      {row.reference}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-slate-900">{row.label}</span>
                      {row.details && (
                        <span className="block text-[11px] text-slate-500 font-normal">
                          {row.details}
                        </span>
                      )}
                      {row.is_voided && (
                        <span className="inline-block text-[10px] text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 not-italic">
                          [{isAr ? 'ملغى :' : 'ANNULÉ :'} {row.void_reason || (isAr ? 'غير محدد' : 'Non précisé')}]
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-end tabular-nums font-mono font-semibold text-slate-900">
                      {row.debit_centimes > 0 ? formatDZD(row.debit_centimes, { showSymbol: false, locale }) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-end tabular-nums font-mono font-semibold text-emerald-700">
                      {row.credit_centimes > 0 ? formatDZD(row.credit_centimes, { showSymbol: false, locale }) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-end tabular-nums font-mono font-bold text-slate-900">
                      {formatDZD(row.running_balance_centimes, { locale })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              {/* Totals row */}
              <tr className="border-t-2 border-slate-900 bg-slate-100 font-bold text-slate-900">
                <td colSpan={3} className="py-3 px-3 uppercase text-[11px]">
                  {isAr ? 'مجموع الفترة والرصيد النهائي' : 'Totaux de la période & Solde Final'}
                </td>
                <td className="py-3 px-3 text-end tabular-nums font-mono text-slate-900 font-black">
                  {formatDZD(statement.total_debit_centimes, { showSymbol: false, locale })}
                </td>
                <td className="py-3 px-3 text-end tabular-nums font-mono text-emerald-700 font-black">
                  {formatDZD(statement.total_credit_centimes, { showSymbol: false, locale })}
                </td>
                <td className="py-3 px-3 text-end tabular-nums font-mono text-slate-950 font-black text-sm">
                  {formatDZD(closing_balance_centimes, { locale })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Signature & Stamp blocks */}
        <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs text-slate-500">
          <div className="p-4 border border-dashed border-slate-300 rounded-lg min-h-[100px] flex flex-col justify-between">
            <span className="font-semibold text-slate-700">
              {isAr ? 'ختم وتوقيع المؤسسة التجارية' : "Cachet & Signature de l'Entreprise"}
            </span>
            <span className="text-[10px] text-slate-400">{isAr ? 'وصل تسليم وقبض' : 'Pour acquit'}</span>
          </div>

          <div className="p-4 border border-dashed border-slate-300 rounded-lg min-h-[100px] flex flex-col justify-between">
            <span className="font-semibold text-slate-700">
              {isAr ? 'موافق عليه وتوقيع الزبون' : 'Bon pour accord & Signature du Client'}
            </span>
            <span className="text-[10px] text-slate-400">{isAr ? 'قرأت ووافقت' : 'Lu et approuvé'}</span>
          </div>
        </div>

        {/* Legal notice footer */}
        <div className="text-[10px] text-slate-400 text-center pt-2">
          {isAr
            ? 'كشف حساب داخلي صادر عن نظام ميزان. يرجى مراجعة قيودكم المحاسبية مع محاسبكم القانوني.'
            : 'Document interne de suivi de compte client émis par le système Mizan. Vérifiez vos écritures auprès de votre comptable.'}
        </div>
      </div>
    </div>
  );
};
