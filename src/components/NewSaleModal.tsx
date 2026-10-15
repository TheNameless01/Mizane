import React, { useState, useEffect } from 'react';
import { Customer, Sale } from '../shared/types';
import {
  calculateLineTotal,
  parseMoneyToCentimes,
  parseQuantityToThousandths,
  formatDZD,
} from '../shared/money';
import { getAlgiersDateString, getNowUtcIso } from '../shared/dates';
import { ShoppingCart, Plus, Trash2, AlertCircle, X, ShieldAlert, Check } from 'lucide-react';

interface NewSaleModalProps {
  customers: Customer[];
  preselectedCustomerId?: number;
  onSaleCreated: (sale: Sale) => void;
  onClose: () => void;
  onOpenCustomerModal: () => void;
}

interface FormLineItem {
  id: string;
  label: string;
  unit: string;
  quantityInput: string;
  priceInput: string;
}

export const NewSaleModal: React.FC<NewSaleModalProps> = ({
  customers,
  preselectedCustomerId,
  onSaleCreated,
  onClose,
  onOpenCustomerModal,
}) => {
  const [customerId, setCustomerId] = useState<number>(
    preselectedCustomerId || (customers[0]?.id ?? 0)
  );

  const [soldAtDate, setSoldAtDate] = useState<string>(getAlgiersDateString());
  const [note, setNote] = useState('');
  const [isCashSale, setIsCashSale] = useState(false);
  const [cashPaymentMethod, setCashPaymentMethod] = useState<'espèces' | 'chèque' | 'virement' | 'autre'>('espèces');
  const [cashPaymentReference, setCashPaymentReference] = useState('');

  const [items, setItems] = useState<FormLineItem[]>([
    { id: '1', label: '', unit: 'pcs', quantityInput: '1', priceInput: '' },
  ]);

  const [overrideCreditLimit, setOverrideCreditLimit] = useState(false);
  const [creditLimitBlocked, setCreditLimitBlocked] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => 'sale-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9));

  // Autocomplete suggestions
  const [suggestions, setSuggestions] = useState<{ label: string; unit: string; last_price_centimes: number }[]>([]);

  useEffect(() => {
    fetch('/api/suggestions')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSuggestions(data);
      })
      .catch(() => {});
  }, []);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  // Compute live estimated total
  let estimatedTotalCentimes = 0;
  const computedLines = items.map((item) => {
    try {
      const q = parseQuantityToThousandths(item.quantityInput || '0');
      const p = parseMoneyToCentimes(item.priceInput || '0');
      const total = calculateLineTotal(q, p);
      estimatedTotalCentimes += total;
      return { total, valid: true };
    } catch {
      return { total: 0, valid: false };
    }
  });

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        label: '',
        unit: 'pcs',
        quantityInput: '1',
        priceInput: '',
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof FormLineItem, value: string) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const applySuggestion = (index: number, sug: { label: string; unit: string; last_price_centimes: number }) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        label: sug.label,
        unit: sug.unit,
        priceInput: (sug.last_price_centimes / 100).toString(),
      };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setError('Veuillez sélectionner un client.');
      return;
    }

    // Validate items
    const preparedItems = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.label.trim()) {
        setError(`Veuillez renseigner la désignation de l'article #${i + 1}`);
        return;
      }
      try {
        const qtyThousandths = parseQuantityToThousandths(it.quantityInput);
        const priceCentimes = parseMoneyToCentimes(it.priceInput);
        if (priceCentimes < 0) {
          setError(`Le prix unitaire de l'article #${i + 1} ne peut pas être négatif`);
          return;
        }
        preparedItems.push({
          label: it.label.trim(),
          unit: it.unit.trim() || 'pcs',
          quantity_thousandths: qtyThousandths,
          unit_price_centimes: priceCentimes,
        });
      } catch (err: any) {
        setError(`Erreur sur l'article #${i + 1} : ${err.message}`);
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);
      setCreditLimitBlocked(null);

      // Convert Algiers date YYYY-MM-DD to ISO UTC (approximate noon UTC)
      const soldAtIso = new Date(`${soldAtDate}T12:00:00.000Z`).toISOString();

      const payload = {
        customer_id: customerId,
        sold_at: soldAtIso,
        note: note.trim() || null,
        vat_mode: 'none',
        items: preparedItems,
        is_cash_sale: isCashSale,
        cash_payment_method: cashPaymentMethod,
        cash_payment_reference: cashPaymentReference.trim() || null,
        override_credit_limit: overrideCreditLimit,
        idempotency_key: idempotencyKey,
      };

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'CREDIT_LIMIT_EXCEEDED') {
          setCreditLimitBlocked(data.error);
          return;
        }
        throw new Error(data.error || 'Erreur lors de la création de la vente');
      }

      onSaleCreated(data.sale);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-lg">Enregistrer une nouvelle vente</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {creditLimitBlocked && (
            <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 text-sm rounded-lg space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                <span>Plafond de crédit dépassé !</span>
              </div>
              <p>{creditLimitBlocked}</p>
              <label className="flex items-center gap-2 mt-2 pt-2 border-t border-amber-200 cursor-pointer font-medium text-amber-950">
                <input
                  type="checkbox"
                  checked={overrideCreditLimit}
                  onChange={(e) => setOverrideCreditLimit(e.target.checked)}
                  className="rounded border-amber-400 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>Autoriser le dépassement exceptionnel (sera consigné dans le journal d'audit)</span>
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Client <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={onOpenCustomerModal}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  + Nouveau client
                </button>
              </div>
              <select
                required
                value={customerId}
                onChange={(e) => setCustomerId(parseInt(e.target.value, 10))}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              >
                <option value="">Sélectionnez un client...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''} — Solde: {formatDZD(c.balance_centimes || 0)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Date de vente
              </label>
              <input
                type="date"
                required
                value={soldAtDate}
                onChange={(e) => setSoldAtDate(e.target.value)}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              />
            </div>
          </div>

          {/* Toggle Sale Type: Credit vs Cash */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-slate-900 block">Type de règlement</span>
                <span className="text-xs text-slate-500">
                  {isCashSale
                    ? 'Vente au comptant : un paiement équivalent sera enregistré automatiquement.'
                    : 'Vente à crédit : le montant sera imputé au compte du client.'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCashSale(false)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    !isCashSale
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  À Crédit
                </button>
                <button
                  type="button"
                  onClick={() => setIsCashSale(true)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    isCashSale
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Au Comptant
                </button>
              </div>
            </div>

            {isCashSale && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Mode de paiement comptant
                  </label>
                  <select
                    value={cashPaymentMethod}
                    onChange={(e) => setCashPaymentMethod(e.target.value as any)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-md bg-white"
                  >
                    <option value="espèces">Espèces</option>
                    <option value="chèque">Chèque</option>
                    <option value="virement">Virement bancaire</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Référence règlement (optionnelle)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: N° chèque BNA..."
                    value={cashPaymentReference}
                    onChange={(e) => setCashPaymentReference(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-md"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Line items table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Articles vendus ({items.length})
              </label>
              {suggestions.length > 0 && (
                <span className="text-xs text-slate-500">Suggestions d'articles disponibles</span>
              )}
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto p-1">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row gap-2 items-start sm:items-center"
                >
                  <div className="flex-1 w-full relative">
                    <input
                      type="text"
                      required
                      placeholder="Désignation (ex: Semoule 25kg)"
                      value={item.label}
                      onChange={(e) => updateItem(idx, 'label', e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-md bg-white"
                    />
                    {/* Fast chips for suggestions */}
                    {idx === 0 && suggestions.length > 0 && !item.label && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {suggestions.slice(0, 3).map((sug, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => applySuggestion(idx, sug)}
                            className="text-[10px] bg-slate-200 hover:bg-indigo-100 text-slate-700 hover:text-indigo-800 px-1.5 py-0.5 rounded transition-colors"
                          >
                            + {sug.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="w-24">
                    <select
                      value={item.unit}
                      onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-md bg-white"
                    >
                      <option value="pcs">pcs</option>
                      <option value="kg">kg</option>
                      <option value="sac">sac</option>
                      <option value="carton">carton</option>
                      <option value="fardeau">fardeau</option>
                      <option value="L">Litre</option>
                      <option value="boîte">boîte</option>
                    </select>
                  </div>

                  <div className="w-24">
                    <input
                      type="text"
                      required
                      placeholder="Qté (ex: 2.5)"
                      value={item.quantityInput}
                      onChange={(e) => updateItem(idx, 'quantityInput', e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-md text-end bg-white"
                    />
                  </div>

                  <div className="w-32">
                    <input
                      type="text"
                      required
                      placeholder="P.U (DZD)"
                      value={item.priceInput}
                      onChange={(e) => updateItem(idx, 'priceInput', e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-md text-end bg-white"
                    />
                  </div>

                  <div className="w-32 text-end text-xs font-bold text-slate-800 tabular-nums">
                    {formatDZD(computedLines[idx]?.total || 0, { showSymbol: false })} DZD
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItemRow(idx)}
                    disabled={items.length <= 1}
                    className={`p-1.5 text-slate-400 hover:text-rose-600 rounded ${
                      items.length <= 1 ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addItemRow}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 p-1"
            >
              <Plus className="w-4 h-4" />
              Ajouter une ligne d'article
            </button>
          </div>

          <div>
            <input
              type="text"
              placeholder="Remarque ou bon de commande associé (optionnel)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full text-xs p-2 border border-slate-300 rounded-md"
            />
          </div>

          {/* Grand total & action bar */}
          <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-400 block font-medium">
                Total à régler (TTC)
              </span>
              <span className="text-2xl font-black tabular-nums text-emerald-400">
                {formatDZD(estimatedTotalCentimes)}
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading || estimatedTotalCentimes <= 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                {loading ? 'Validation en cours...' : 'Valider la vente'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
