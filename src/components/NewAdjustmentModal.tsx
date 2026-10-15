import React, { useState, useEffect } from 'react';
import { Customer, Adjustment } from '../shared/types';
import { parseMoneyToCentimes, formatDZD, getBalanceStatus } from '../shared/money';
import { getAlgiersDateString } from '../shared/dates';
import { useI18n } from '../shared/i18n/context';
import { Sliders, Check, X, AlertCircle } from 'lucide-react';

interface NewAdjustmentModalProps {
  customers: Customer[];
  preselectedCustomerId?: number;
  onAdjustmentRecorded: (adj: Adjustment) => void;
  onClose: () => void;
}

export const NewAdjustmentModal: React.FC<NewAdjustmentModalProps> = ({
  customers,
  preselectedCustomerId,
  onAdjustmentRecorded,
  onClose,
}) => {
  const { t, locale, dir } = useI18n();
  const isAr = locale === 'ar';

  const [customerId, setCustomerId] = useState<number>(
    preselectedCustomerId || (customers[0]?.id ?? 0)
  );

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const currentBalanceCentimes = selectedCustomer?.balance_centimes || 0;

  const [direction, setDirection] = useState<'debit' | 'credit'>('debit');
  const [reason, setReason] = useState<'Solde initial' | 'Remise' | 'Perte/Radiation' | 'Correction'>(
    'Solde initial'
  );
  const [amountInput, setAmountInput] = useState('');
  const [note, setNote] = useState('');
  const [adjustedAtDate, setAdjustedAtDate] = useState<string>(getAlgiersDateString());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => 'adj-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  let parsedCentimes = 0;
  let parseValid = false;
  try {
    parsedCentimes = Math.abs(parseMoneyToCentimes(amountInput || '0'));
    parseValid = parsedCentimes > 0;
  } catch {
    parseValid = false;
  }

  // Direction: debit = adds debt (+), credit = reduces debt (-)
  const signedCentimes = direction === 'debit' ? parsedCentimes : -parsedCentimes;
  const resultingBalanceCentimes = currentBalanceCentimes + signedCentimes;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setError(isAr ? 'يرجى اختيار الزبون.' : 'Veuillez sélectionner un client.');
      return;
    }

    if (!parseValid || parsedCentimes <= 0) {
      setError(isAr ? 'يرجى إدخال مبلغ صحيح.' : 'Veuillez saisir un montant valide.');
      return;
    }

    if (note.trim().length < 3) {
      setError(
        isAr
          ? 'الملاحظة التوضيحية (3 أحرف على الأقل) إجبارية لأغراض التدقيق المحاسبي.'
          : 'Une note explicative d’au moins 3 caractères est obligatoire pour l’audit.'
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const adjustedAtIso = new Date(`${adjustedAtDate}T12:00:00.000Z`).toISOString();

      const payload = {
        customer_id: customerId,
        amount_centimes: signedCentimes,
        reason,
        note: note.trim(),
        adjusted_at: adjustedAtIso,
        idempotency_key: idempotencyKey,
      };

      const res = await fetch('/api/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || (isAr ? 'خطأ أثناء تسجيل التسوية' : 'Erreur lors de l’enregistrement de l’ajustement'));
      }

      onAdjustmentRecorded(data);
      onClose();
    } catch (err: any) {
      setError(err.message || (isAr ? 'حدث خطأ' : 'Une erreur est survenue'));
    } finally {
      setLoading(false);
    }
  };

  const resultingStatus = getBalanceStatus(resultingBalanceCentimes, locale);

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base sm:text-lg">
              {isAr ? 'تسوية رصيد / نقل دين قديم' : 'Ajustement de solde / Reprise carnet'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800"
            aria-label={isAr ? 'إغلاق' : 'Fermer'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              {isAr ? 'الزبون المعني' : 'Client concerné'} <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(parseInt(e.target.value, 10))}
              className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">{isAr ? 'اختر الزبون...' : 'Sélectionnez un client...'}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {isAr ? 'الرصيد' : 'Solde'}: {formatDZD(c.balance_centimes || 0, { locale })}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {isAr ? 'سبب التسوية' : "Motif de l'ajustement"}
              </label>
              <select
                value={reason}
                onChange={(e) => {
                  const r = e.target.value as any;
                  setReason(r);
                  if (r === 'Solde initial') setDirection('debit');
                  else if (r === 'Remise' || r === 'Perte/Radiation') setDirection('credit');
                }}
                className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Solde initial">
                  {isAr ? 'رصيد أولي (نقل من الدفتر القديم)' : 'Solde initial (reprise carnet)'}
                </option>
                <option value="Remise">
                  {isAr ? 'تخفيض تجاري ممنوح (Remise)' : 'Remise commerciale accordée'}
                </option>
                <option value="Perte/Radiation">
                  {isAr ? 'دين هالك / إعدام دين (Perte)' : 'Perte / Créance irrécouvrable'}
                </option>
                <option value="Correction">
                  {isAr ? 'تصحيح قيد محاسبي' : "Correction d'écriture"}
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {isAr ? 'طبيعة الأثر' : "Sens de l'impact"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection('debit')}
                  className={`py-2 px-2 text-xs font-bold rounded-lg border text-center transition-colors cursor-pointer ${
                    direction === 'debit'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {isAr ? '+ زيادة الدين' : '+ Augmente dette'}
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('credit')}
                  className={`py-2 px-2 text-xs font-bold rounded-lg border text-center transition-colors cursor-pointer ${
                    direction === 'credit'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {isAr ? '- إنقاص الدين' : '- Diminue dette'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {isAr ? 'المبلغ (دج)' : 'Montant (DZD)'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder={isAr ? 'مثال: 85 000' : 'Ex: 85 000'}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg font-bold tabular-nums font-mono bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {isAr ? 'تاريخ السريان' : "Date d'effet"}
              </label>
              <input
                type="date"
                required
                value={adjustedAtDate}
                onChange={(e) => setAdjustedAtDate(e.target.value)}
                className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              {isAr ? 'ملاحظة توضيحية إجبارية (للتدقيق)' : 'Note explicative obligatoire (Audit)'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={isAr ? 'مثال: الرصيد المنقول من الدفتر الورقي بتاريخ 01/01/2026...' : 'Ex: Ancien solde carnet manuscrit au 01/01/2026...'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>{isAr ? 'الرصيد الحالي :' : 'Solde actuel :'}</span>
              <span className="font-semibold tabular-nums font-mono">{formatDZD(currentBalanceCentimes, { locale })}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>{isAr ? 'مبلغ التسوية :' : 'Ajustement :'}</span>
              <span className={`font-bold tabular-nums font-mono ${direction === 'debit' ? 'text-amber-700' : 'text-emerald-700'}`}>
                {direction === 'debit' ? '+' : '-'} {formatDZD(parsedCentimes, { locale })}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-xs sm:text-sm">
              <span>{isAr ? 'الرصيد الجديد المتوقع :' : 'Nouveau solde :'}</span>
              <span className={`tabular-nums font-mono ${resultingStatus.textClass}`}>
                {formatDZD(resultingBalanceCentimes, { locale })} ({resultingStatus.label})
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Annuler'}
            </button>
            <button
              type="submit"
              disabled={loading || !parseValid || parsedCentimes <= 0 || note.trim().length < 3}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {loading
                ? isAr ? 'جاري التسجيل...' : 'Enregistrement...'
                : isAr ? 'تأكيد وحفظ التسوية' : 'Valider l’écriture'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
