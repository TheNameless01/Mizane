import React, { useState, useEffect } from 'react';
import { Customer, Sale } from '../shared/types';
import {
  calculateLineTotal,
  parseMoneyToCentimes,
  parseQuantityToThousandths,
  formatDZD,
} from '../shared/money';
import { getAlgiersDateString } from '../shared/dates';
import { useI18n } from '../shared/i18n/context';
import { ShoppingCart, Plus, Trash2, AlertCircle, X, ShieldAlert, Check, UserPlus } from 'lucide-react';

interface NewSaleModalProps {
  customers: Customer[];
  preselectedCustomerId?: number;
  newlyCreatedCustomer?: Customer | null;
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
  newlyCreatedCustomer,
  onSaleCreated,
  onClose,
  onOpenCustomerModal,
}) => {
  const { t, locale, dir } = useI18n();

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

  // Update customerId if newlyCreatedCustomer, preselectedCustomerId changes or customers list loads
  useEffect(() => {
    if (newlyCreatedCustomer) {
      setCustomerId(newlyCreatedCustomer.id);
    } else if (preselectedCustomerId) {
      setCustomerId(preselectedCustomerId);
    } else if (customerId === 0 && mergedCustomers.length > 0) {
      setCustomerId(mergedCustomers[0].id);
    }
  }, [newlyCreatedCustomer, preselectedCustomerId, mergedCustomers]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const selectedCustomer = mergedCustomers.find((c) => c.id === customerId);

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
      setError(locale === 'ar' ? 'يرجى اختيار زبون مسجل أو إضافة زبون جديد.' : 'Veuillez sélectionner un client.');
      return;
    }

    // Validate items
    const preparedItems = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.label.trim()) {
        setError(
          locale === 'ar'
            ? `يرجى تحديد بيان السلعة رقم ${i + 1}`
            : `Veuillez renseigner la désignation de l'article #${i + 1}`
        );
        return;
      }
      try {
        const qtyThousandths = parseQuantityToThousandths(it.quantityInput);
        const priceCentimes = parseMoneyToCentimes(it.priceInput);
        if (priceCentimes < 0) {
          setError(
            locale === 'ar'
              ? `سعر الوحدة للسلعة رقم ${i + 1} لا يمكن أن يكون سالباً`
              : `Le prix unitaire de l'article #${i + 1} ne peut pas être négatif`
          );
          return;
        }
        preparedItems.push({
          label: it.label.trim(),
          unit: it.unit.trim() || 'pcs',
          quantity_thousandths: qtyThousandths,
          unit_price_centimes: priceCentimes,
        });
      } catch (err: any) {
        setError(
          locale === 'ar'
            ? `خطأ في السطر ${i + 1} : ${err.message}`
            : `Erreur sur l'article #${i + 1} : ${err.message}`
        );
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);
      setCreditLimitBlocked(null);

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
    <div
      dir={dir}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      {/* Modal Dialog Window: Fixed Max-Height & Flex Col prevents off-screen overflows */}
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Sticky Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base sm:text-lg">
              {locale === 'ar' ? 'تسجيل بيع جديد' : 'Enregistrer une nouvelle vente'}
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
        <form id="new-sale-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {creditLimitBlocked && (
            <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 text-xs sm:text-sm rounded-lg space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                <span>
                  {locale === 'ar' ? 'تم تجاوز سقف الدين المسموح به!' : 'Plafond de crédit dépassé !'}
                </span>
              </div>
              <p>{creditLimitBlocked}</p>
              <label className="flex items-center gap-2 mt-2 pt-2 border-t border-amber-200 cursor-pointer font-medium text-amber-950">
                <input
                  type="checkbox"
                  checked={overrideCreditLimit}
                  onChange={(e) => setOverrideCreditLimit(e.target.checked)}
                  className="rounded border-amber-400 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>
                  {locale === 'ar'
                    ? 'الموافقة الاستثنائية على التجاوز (سيتم تدوينها في سجل التدقيق)'
                    : "Autoriser le dépassement exceptionnel (sera consigné dans le journal d'audit)"}
                </span>
              </label>
            </div>
          )}

          {/* Customer Selection or Empty Warning */}
          {mergedCustomers.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-xs sm:text-sm text-amber-900">
                <p className="font-bold">
                  {locale === 'ar' ? 'لا يوجد أي زبون مسجل حتى الآن.' : 'Aucun client enregistré.'}
                </p>
                <p className="text-amber-700 mt-0.5">
                  {locale === 'ar'
                    ? 'يجب إضافة زبون أولاً لإجراء عملية البيع.'
                    : 'Veuillez ajouter votre premier client pour enregistrer cette vente.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenCustomerModal}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                {locale === 'ar' ? 'إضافة زبون الآن' : 'Créer un client'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    {locale === 'ar' ? 'الزبون' : 'Client'} <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={onOpenCustomerModal}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                  >
                    + {locale === 'ar' ? 'زبون جديد' : 'Nouveau client'}
                  </button>
                </div>
                <select
                  required
                  value={customerId}
                  onChange={(e) => setCustomerId(parseInt(e.target.value, 10))}
                  className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  <option value="">
                    {locale === 'ar' ? 'اختر الزبون...' : 'Sélectionnez un client...'}
                  </option>
                  {mergedCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''} — {locale === 'ar' ? 'الرصيد' : 'Solde'}: {formatDZD(c.balance_centimes || 0, { locale })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  {locale === 'ar' ? 'تاريخ البيع' : 'Date de vente'}
                </label>
                <input
                  type="date"
                  required
                  value={soldAtDate}
                  onChange={(e) => setSoldAtDate(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
              </div>
            </div>
          )}

          {/* Toggle Sale Type: Credit vs Cash */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                  {locale === 'ar' ? 'طريقة التسوية' : 'Type de règlement'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {isCashSale
                    ? locale === 'ar'
                      ? 'بيع نقدي حاضر: يتم تسجيل دفع مماثل تلقائياً في نفس اللحظة.'
                      : 'Vente au comptant : un paiement équivalent sera enregistré automatiquement.'
                    : locale === 'ar'
                    ? 'بيع بالدين (كريدي): يضاف المبلغ إلى حساب ودين الزبون.'
                    : 'Vente à crédit : le montant sera imputé au compte du client.'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCashSale(false)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    !isCashSale
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {locale === 'ar' ? 'بالدين (كريدي)' : 'À Crédit'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCashSale(true)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    isCashSale
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {locale === 'ar' ? 'نقداً (حاضر)' : 'Au Comptant'}
                </button>
              </div>
            </div>

            {isCashSale && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {locale === 'ar' ? 'وسيلة الدفع النقدي' : 'Mode de paiement comptant'}
                  </label>
                  <select
                    value={cashPaymentMethod}
                    onChange={(e) => setCashPaymentMethod(e.target.value as any)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-md bg-white"
                  >
                    <option value="espèces">{locale === 'ar' ? 'نقداً (espèces)' : 'Espèces'}</option>
                    <option value="chèque">{locale === 'ar' ? 'صك بريدي/بنكي (chèque)' : 'Chèque'}</option>
                    <option value="virement">{locale === 'ar' ? 'تحويل بنكي (virement)' : 'Virement bancaire'}</option>
                    <option value="autre">{locale === 'ar' ? 'أخرى' : 'Autre'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {locale === 'ar' ? 'رقم الصك أو الوصل (اختياري)' : 'Référence règlement (optionnelle)'}
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: N° chèque BNA..."
                    value={cashPaymentReference}
                    onChange={(e) => setCashPaymentReference(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-md bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Line items table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                {locale === 'ar' ? 'قائمة السلع المباعة' : 'Articles vendus'} ({items.length})
              </label>
              {suggestions.length > 0 && (
                <span className="text-[11px] text-slate-500">
                  {locale === 'ar' ? 'اقتراحات سريعة متاحة' : 'Suggestions rapides disponibles'}
                </span>
              )}
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row gap-2 items-start sm:items-center"
                >
                  <div className="flex-1 w-full">
                    <input
                      type="text"
                      required
                      placeholder={locale === 'ar' ? 'بيان السلعة (مثال: سميد 25كغ)' : 'Désignation (ex: Semoule 25kg)'}
                      value={item.label}
                      onChange={(e) => updateItem(idx, 'label', e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500"
                    />
                    {idx === 0 && suggestions.length > 0 && !item.label && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {suggestions.slice(0, 3).map((sug, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => applySuggestion(idx, sug)}
                            className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded transition-colors"
                          >
                            + {sug.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="w-20">
                      <select
                        value={item.unit}
                        onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                        className="w-full text-xs p-2 border border-slate-300 rounded-md bg-white"
                      >
                        <option value="pcs">{locale === 'ar' ? 'قطعة' : 'pcs'}</option>
                        <option value="kg">{locale === 'ar' ? 'كغ' : 'kg'}</option>
                        <option value="sac">{locale === 'ar' ? 'كيس' : 'sac'}</option>
                        <option value="carton">{locale === 'ar' ? 'علبة/كردونة' : 'carton'}</option>
                        <option value="fardeau">{locale === 'ar' ? 'حزمة' : 'fardeau'}</option>
                        <option value="L">{locale === 'ar' ? 'لتر' : 'Litre'}</option>
                        <option value="boîte">{locale === 'ar' ? 'علبة' : 'boîte'}</option>
                      </select>
                    </div>

                    <div className="w-20">
                      <input
                        type="text"
                        required
                        placeholder={locale === 'ar' ? 'الكمية' : 'Qté'}
                        value={item.quantityInput}
                        onChange={(e) => updateItem(idx, 'quantityInput', e.target.value)}
                        className="w-full text-xs p-2 border border-slate-300 rounded-md text-end bg-white font-mono"
                      />
                    </div>

                    <div className="w-28">
                      <input
                        type="text"
                        required
                        placeholder={locale === 'ar' ? 'السعر (دج)' : 'P.U (DZD)'}
                        value={item.priceInput}
                        onChange={(e) => updateItem(idx, 'priceInput', e.target.value)}
                        className="w-full text-xs p-2 border border-slate-300 rounded-md text-end bg-white font-mono"
                      />
                    </div>

                    <div className="w-28 text-end text-xs font-bold text-slate-800 tabular-nums font-mono whitespace-nowrap">
                      {formatDZD(computedLines[idx]?.total || 0, { showSymbol: false })}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItemRow(idx)}
                      disabled={items.length <= 1}
                      className={`p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors ${
                        items.length <= 1 ? 'opacity-30 cursor-not-allowed' : ''
                      }`}
                      title={locale === 'ar' ? 'حذف هذا السطر' : 'Supprimer cette ligne'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addItemRow}
              className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 p-1"
            >
              <Plus className="w-4 h-4" />
              {locale === 'ar' ? 'إضافة سطر سلعة آخر' : "Ajouter une ligne d'article"}
            </button>
          </div>

          <div>
            <input
              type="text"
              placeholder={locale === 'ar' ? 'ملاحظة أو رقم وصل الطلبية (اختياري)' : 'Remarque ou bon de commande associé (optionnel)'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-md bg-white"
            />
          </div>
        </form>

        {/* Sticky Docked Footer with Grand Total & Submit Button — Never pushed off screen! */}
        <div className="px-5 py-4 bg-slate-900 text-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0 border-t border-slate-800">
          <div>
            <span className="text-[10px] sm:text-xs uppercase tracking-wider text-slate-400 block font-bold">
              {locale === 'ar' ? 'المجموع الكلي المطلوب' : 'Total à régler (TTC)'}
            </span>
            <span className="text-xl sm:text-2xl font-black tabular-nums text-emerald-400">
              {formatDZD(estimatedTotalCentimes)}
            </span>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg transition-colors"
            >
              {locale === 'ar' ? 'إلغاء' : 'Annuler'}
            </button>
            <button
              type="submit"
              form="new-sale-form"
              disabled={loading || estimatedTotalCentimes <= 0 || mergedCustomers.length === 0}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {loading
                ? locale === 'ar' ? 'جاري الحفظ...' : 'Validation en cours...'
                : locale === 'ar' ? 'تأكيد وحفظ البيع' : 'Valider la vente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
