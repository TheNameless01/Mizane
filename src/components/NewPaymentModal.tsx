import React, { useState } from 'react';
import { Customer, Payment } from '../shared/types';
import { parseMoneyToCentimes, formatDZD, getBalanceStatus } from '../shared/money';
import { getAlgiersDateString } from '../shared/dates';
import { CreditCard, Check, X, ArrowRight, AlertCircle } from 'lucide-react';

interface NewPaymentModalProps {
  customers: Customer[];
  preselectedCustomerId?: number;
  onPaymentRecorded: (payment: Payment) => void;
  onClose: () => void;
}

export const NewPaymentModal: React.FC<NewPaymentModalProps> = ({
  customers,
  preselectedCustomerId,
  onPaymentRecorded,
  onClose,
}) => {
  const [customerId, setCustomerId] = useState<number>(
    preselectedCustomerId || (customers[0]?.id ?? 0)
  );

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const currentBalanceCentimes = selectedCustomer?.balance_centimes || 0;

  const [amountInput, setAmountInput] = useState('');
  const [paidAtDate, setPaidAtDate] = useState<string>(getAlgiersDateString());
  const [method, setMethod] = useState<'espèces' | 'chèque' | 'virement' | 'autre'>('espèces');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => 'pay-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9));

  // Calculate parsed amount and resulting balance
  let parsedAmountCentimes = 0;
  let parseValid = false;
  try {
    parsedAmountCentimes = parseMoneyToCentimes(amountInput || '0');
    parseValid = parsedAmountCentimes > 0;
  } catch {
    parseValid = false;
  }

  // Positive balance = debt. Payment reduces debt: new balance = current - payment
  const resultingBalanceCentimes = currentBalanceCentimes - parsedAmountCentimes;

  const handlePayFull = () => {
    if (currentBalanceCentimes > 0) {
      setAmountInput((currentBalanceCentimes / 100).toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setError('Veuillez sélectionner un client.');
      return;
    }

    if (!parseValid || parsedAmountCentimes <= 0) {
      setError('Veuillez saisir un montant de règlement valide supérieur à zéro.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-lg">Enregistrer un encaissement</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Client bénéficiaire <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(parseInt(e.target.value, 10))}
              className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
            >
              <option value="">Sélectionnez un client...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — Solde actuel: {formatDZD(c.balance_centimes || 0)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Montant versé (DZD) <span className="text-rose-500">*</span>
                </label>
                {currentBalanceCentimes > 0 && (
                  <button
                    type="button"
                    onClick={handlePayFull}
                    className="text-[11px] text-emerald-600 hover:text-emerald-800 font-semibold"
                  >
                    Solde total
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
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Date du versement
              </label>
              <input
                type="date"
                required
                value={paidAtDate}
                onChange={(e) => setPaidAtDate(e.target.value)}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Mode de règlement
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg bg-white"
              >
                <option value="espèces">Espèces</option>
                <option value="chèque">Chèque</option>
                <option value="virement">Virement bancaire</option>
                <option value="autre">Autre</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Référence (N° chèque / bordereau)
              </label>
              <input
                type="text"
                placeholder="Ex: Chèque BNA N° 788219"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Note ou motif spécifique (optionnel)
            </label>
            <input
              type="text"
              placeholder="Ex: Versement direct magasin contre décharge"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full text-sm p-2.5 border border-slate-300 rounded-lg"
            />
          </div>

          {/* Dynamic Resulting Balance Preview */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Simulation de l'impact sur le solde :
            </span>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Solde actuel :</span>
              <span className="font-semibold tabular-nums">{formatDZD(currentBalanceCentimes)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Versement déduit :</span>
              <span className="font-bold text-emerald-600 tabular-nums">
                - {formatDZD(parsedAmountCentimes)}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                Nouveau solde estimé :
              </span>
              <div className="text-end">
                <span className={`font-black text-base tabular-nums ${resultingStatus.textClass}`}>
                  {formatDZD(resultingBalanceCentimes)}
                </span>
                <span className="block text-[11px] text-slate-500">{resultingStatus.label}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !parseValid || parsedAmountCentimes <= 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              {loading ? 'Enregistrement...' : 'Confirmer le règlement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
