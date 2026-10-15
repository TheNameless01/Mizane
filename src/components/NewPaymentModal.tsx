import React, { useState, useEffect } from 'react';
import { Customer, Payment } from '../shared/types';
import { parseMoneyToCentimes, formatDZD, getBalanceStatus } from '../shared/money';
import { getAlgiersDateString } from '../shared/dates';
import { useI18n } from '../shared/i18n/context';
import { CreditCard, Check, X, AlertCircle, UserPlus } from 'lucide-react';

interface NewPaymentModalProps {
  customers: Customer[];
  preselectedCustomerId?: number;
  newlyCreatedCustomer?: Customer | null;
  onPaymentRecorded: (payment: Payment) => void;
  onClose: () => void;
  onOpenCustomerModal?: () => void;
}

export const NewPaymentModal: React.FC<NewPaymentModalProps> = ({
  customers,
  preselectedCustomerId,
  newlyCreatedCustomer,
  onPaymentRecorded,
  onClose,
  onOpenCustomerModal,
}) => {
  const { locale, dir } = useI18n();

  const mergedCustomers = React.useMemo(() => {
    const list = [...customers];
    if (newlyCreatedCustomer && !list.some((c) => c.id === newlyCreatedCustomer.id)) {
      list.unshift(newlyCreatedCustomer);
    }
    return list;
  }, [customers, newlyCreatedCustomer]);

  const [customerId, setCustomerId] = useState<number>(() => {
    if (newlyCreatedCustomer) return newlyCreatedCustomer.id;
    if (preselectedCustomerId) return preselectedCustomerId;
    return customers[0]?.id ?? 0;
  });

  const selectedCustomer = mergedCustomers.find((c) => c.id === customerId);
  const currentBalanceCentimes = selectedCustomer?.balance_centimes || 0;

  const [amountInput, setAmountInput] = useState('');
  const [paidAtDate, setPaidAtDate] = useState<string>(getAlgiersDateString());
  const [method, setMethod] = useState<'espèces' | 'chèque' | 'virement' | 'autre'>('espèces');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => 'pay-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9));

  // Sync customerId on newlyCreatedCustomer, preselectedCustomerId or customers update
  useEffect(() => {
    if (newlyCreatedCustomer) {
      setCustomerId(newlyCreatedCustomer.id);
    } else if (preselectedCustomerId) {
      setCustomerId(preselectedCustomerId);
    } else if (customerId === 0 && mergedCustomers.length > 0) {
      setCustomerId(mergedCustomers[0].id);
    }
  }, [newlyCreatedCustomer, preselectedCustomerId, mergedCustomers]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Calculate parsed amount and resulting balance
  let parsedAmountCentimes = 0;
  let parseValid = false;
  try {
    parsedAmountCentimes = parseMoneyToCentimes(amountInput || '0');
    parseValid = parsedAmountCentimes > 0;
  } catch {
    parseValid = false;
  }

  const resultingBalanceCentimes = currentBalanceCentimes - parsedAmountCentimes;

  const handlePayFull = () => {
    if (currentBalanceCentimes > 0) {
      setAmountInput((currentBalanceCentimes / 100).toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setError(locale === 'ar' ? 'يرجى اختيار زبون مسجل.' : 'Veuillez sélectionner un client.');
      return;
    }

    if (!parseValid || parsedAmountCentimes <= 0) {
      setError(
        locale === 'ar'
          ? 'يرجى إدخال مبلغ دفع صالح أكبر من الصفر.'
          : 'Veuillez saisir un montant de règlement valide supérieur à zéro.'
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const paidAtIso = new Date(`${paidAtDate}T12:00:00.000Z`).toISOString();

      const payload = {
        customer_id: customerId,
        amount_centimes: parsedAmountCentimes,
        paid_at: paidAtIso,
        method,
        reference: reference.trim() || null,
        note: note.trim() || null,
        idempotency_key: idempotencyKey,
      };

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de l’enregistrement du paiement');
      }

      onPaymentRecorded(data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const resultingStatus = getBalanceStatus(resultingBalanceCentimes);

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      {/* Modal Dialog Window: Fixed Max-Height & Flex Col prevents off-screen overflows */}
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Sticky Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base sm:text-lg">
              {locale === 'ar' ? 'تسجيل قبض / تسديد حساب' : 'Enregistrer un encaissement'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="new-payment-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Customer Selection or Empty State */}
          {mergedCustomers.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-xs sm:text-sm text-amber-900">
                <p className="font-bold">
                  {locale === 'ar' ? 'لا يوجد أي زبون مسجل حتى الآن.' : 'Aucun client enregistré.'}
                </p>
                <p className="text-amber-700 mt-0.5">
                  {locale === 'ar'
                    ? 'يجب إضافة زبون أولاً لتسجيل القبض.'
                    : 'Veuillez ajouter votre premier client pour enregistrer un versement.'}
                </p>
              </div>
              {onOpenCustomerModal && (
                <button
                  type="button"
                  onClick={onOpenCustomerModal}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  {locale === 'ar' ? 'إضافة زبون الآن' : 'Créer un client'}
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  {locale === 'ar' ? 'الزبون المعني' : 'Client bénéficiaire'} <span className="text-rose-500">*</span>
                </label>
                {onOpenCustomerModal && (
                  <button
                    type="button"
                    onClick={onOpenCustomerModal}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                  >
                    + {locale === 'ar' ? 'زبون جديد' : 'Nouveau client'}
                  </button>
                )}
              </div>
              <select
                required
                value={customerId}
                onChange={(e) => setCustomerId(parseInt(e.target.value, 10))}
                className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
              >
                <option value="">
                  {locale === 'ar' ? 'اختر الزبون...' : 'Sélectionnez un client...'}
                </option>
                {mergedCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {locale === 'ar' ? 'الرصيد الحالي' : 'Solde actuel'}: {formatDZD(c.balance_centimes || 0, { locale })}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  {locale === 'ar' ? 'المبلغ المقبوض (دج)' : 'Montant versé (DZD)'} <span className="text-rose-500">*</span>
                </label>
                {currentBalanceCentimes > 0 && (
                  <button
                    type="button"
                    onClick={handlePayFull}
                    className="text-[11px] text-emerald-600 hover:text-emerald-800 font-bold"
                  >
                    {locale === 'ar' ? 'تسديد الكل' : 'Solde total'}
                  </button>
                )}
              </div>
              <input
                type="text"
                required
                autoFocus
                placeholder="Ex: 50 000 ou 50000,00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold tabular-nums font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {locale === 'ar' ? 'تاريخ القبض' : 'Date du versement'}
              </label>
              <input
                type="date"
                required
                value={paidAtDate}
                onChange={(e) => setPaidAtDate(e.target.value)}
                className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {locale === 'ar' ? 'طريقة الدفع' : 'Mode de règlement'}
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg bg-white"
              >
                <option value="espèces">{locale === 'ar' ? 'نقداً (espèces)' : 'Espèces'}</option>
                <option value="chèque">{locale === 'ar' ? 'صك (chèque)' : 'Chèque'}</option>
                <option value="virement">{locale === 'ar' ? 'تحويل بنكي (virement)' : 'Virement bancaire'}</option>
                <option value="autre">{locale === 'ar' ? 'أخرى' : 'Autre'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {locale === 'ar' ? 'رقم الصك / الوصل' : 'Référence (N° chèque / bordereau)'}
              </label>
              <input
                type="text"
                placeholder="Ex: Chèque BNA N° 788219"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              {locale === 'ar' ? 'ملاحظة خاصة (اختياري)' : 'Note ou motif spécifique (optionnel)'}
            </label>
            <input
              type="text"
              placeholder={locale === 'ar' ? 'مثال: تسديد في المحل نقداً' : 'Ex: Versement direct magasin contre décharge'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg bg-white"
            />
          </div>

          {/* Dynamic Resulting Balance Simulation Box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-500 block">
              {locale === 'ar' ? 'محاكاة التأثير على الرصيد:' : "Simulation de l'impact sur le solde :"}
            </span>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">{locale === 'ar' ? 'الرصيد الحالي:' : 'Solde actuel :'}</span>
              <span className="font-bold tabular-nums font-mono">{formatDZD(currentBalanceCentimes)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">{locale === 'ar' ? 'المبلغ المخصوم:' : 'Versement déduit :'}</span>
              <span className="font-bold text-emerald-600 tabular-nums font-mono">
                - {formatDZD(parsedAmountCentimes)}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-bold text-sm">
              <span className="text-slate-900">
                {locale === 'ar' ? 'الرصيد الجديد التقديري:' : 'Nouveau solde estimé :'}
              </span>
              <div className="text-end">
                <span className={`font-black tabular-nums font-mono ${resultingStatus.textClass}`}>
                  {formatDZD(resultingBalanceCentimes)}
                </span>
                <span className="block text-[11px] text-slate-500 font-normal">
                  {resultingBalanceCentimes > 0
                    ? locale === 'ar' ? 'دين مستحق' : 'Solde dû'
                    : resultingBalanceCentimes < 0
                    ? locale === 'ar' ? 'رصيد دائن للزبون' : 'Crédit client'
                    : locale === 'ar' ? 'حساب مسوى تماماً' : 'Solde réglé'}
                </span>
              </div>
            </div>
          </div>
        </form>

        {/* Sticky Docked Footer with Action Buttons — Always visible! */}
        <div className="px-5 py-3.5 bg-slate-100 flex items-center justify-end gap-3 shrink-0 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            {locale === 'ar' ? 'إلغاء' : 'Annuler'}
          </button>
          <button
            type="submit"
            form="new-payment-form"
            disabled={loading || !parseValid || parsedAmountCentimes <= 0 || mergedCustomers.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Check className="w-4 h-4" />
            {loading
              ? locale === 'ar' ? 'جاري التسجيل...' : 'Enregistrement...'
              : locale === 'ar' ? 'تأكيد تسجيل القبض' : 'Confirmer le règlement'}
          </button>
        </div>
      </div>
    </div>
  );
};
