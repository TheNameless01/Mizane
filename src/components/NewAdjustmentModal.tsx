import React, { useState } from 'react';
import { Customer, Adjustment } from '../shared/types';
import { parseMoneyToCentimes, formatDZD, getBalanceStatus } from '../shared/money';
import { getAlgiersDateString } from '../shared/dates';
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
      setError('Veuillez sélectionner un client.');
      return;
    }

    if (!parseValid || parsedCentimes <= 0) {
      setError('Veuillez saisir un montant valide.');
      return;
    }

    if (note.trim().length < 3) {
      setError('Une note explicative d’au moins 3 caractères est obligatoire pour l’audit.');
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
        throw new Error(data.error || 'Erreur lors de l’enregistrement de l’ajustement');
      }

      onAdjustmentRecorded(data);
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
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-lg">Ajustement de solde / Reprise carnet</h3>
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
              Client concerné <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(parseInt(e.target.value, 10))}
              className="w-full text-sm p-2.5 border border-slate-300 rounded-lg bg-white"
            >
              <option value="">Sélectionnez un client...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — Solde: {formatDZD(c.balance_centimes || 0)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Motif de l'ajustement
              </label>
              <select
                value={reason}
                onChange={(e) => {
                  const r = e.target.value as any;
                  setReason(r);
                  // Automatic smart direction suggestion
                  if (r === 'Solde initial') setDirection('debit');
                  else if (r === 'Remise' || r === 'Perte/Radiation') setDirection('credit');
                }}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg bg-white"
              >
                <option value="Solde initial">Solde initial (reprise carnet)</option>
                <option value="Remise">Remise commerciale accordée</option>
                <option value="Perte/Radiation">Perte / Créance irrécouvrable</option>
                <option value="Correction">Correction d'écriture</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Sens de l'impact
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection('debit')}
                  className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition-colors ${
                    direction === 'debit'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  + Augmente dette
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('credit')}
                  className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition-colors ${
                    direction === 'credit'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  - Diminue dette
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Montant (DZD) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="Ex: 85 000"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg font-bold tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Date d'effet
              </label>
              <input
                type="date"
                required
                value={adjustedAtDate}
                onChange={(e) => setAdjustedAtDate(e.target.value)}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Note explicative obligatoire (Audit) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Ancien solde carnet manuscrit au 01/01/2026..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full text-sm p-2.5 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Solde actuel :</span>
              <span className="font-semibold tabular-nums">{formatDZD(currentBalanceCentimes)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Ajustement :</span>
              <span className={`font-bold tabular-nums ${direction === 'debit' ? 'text-amber-700' : 'text-emerald-700'}`}>
                {direction === 'debit' ? '+' : '-'} {formatDZD(parsedCentimes)}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm">
              <span>Nouveau solde :</span>
              <span className={`tabular-nums ${resultingStatus.textClass}`}>
                {formatDZD(resultingBalanceCentimes)} ({resultingStatus.label})
              </span>
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
              disabled={loading || !parseValid || parsedCentimes <= 0 || note.trim().length < 3}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              {loading ? 'Enregistrement...' : 'Valider l’écriture'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
