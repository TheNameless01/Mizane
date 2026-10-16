import React, { useState, useEffect } from 'react';
import { Customer } from '../shared/types';
import { parseMoneyToCentimes, formatDZD } from '../shared/money';
import { useI18n } from '../shared/i18n/context';
import { X, UserPlus, Save, AlertCircle } from 'lucide-react';

interface CustomerModalProps {
  initialCustomer?: Customer | null;
  onSaved: (customer: Customer) => void;
  onClose: () => void;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  initialCustomer,
  onSaved,
  onClose,
}) => {
  const { t, locale, dir } = useI18n();
  const isAr = locale === 'ar';
  const isEdit = Boolean(initialCustomer);

  const [name, setName] = useState(initialCustomer?.name || '');
  const [phone, setPhone] = useState(initialCustomer?.phone || '');
  const [address, setAddress] = useState(initialCustomer?.address || '');
  const [notes, setNotes] = useState(initialCustomer?.notes || '');
  const [creditLimitDzd, setCreditLimitDzd] = useState(
    initialCustomer?.credit_limit_centimes !== null && initialCustomer?.credit_limit_centimes !== undefined
      ? (initialCustomer.credit_limit_centimes / 100).toString()
      : ''
  );
  const [paymentTermsDays, setPaymentTermsDays] = useState(
    initialCustomer?.payment_terms_days?.toString() || '30'
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError(
        isAr
          ? 'يجب أن يحتوي اسم الزبون على حرفين على الأقل.'
          : 'Le nom du client doit comporter au moins 2 caractères.'
      );
      return;
    }

    let limitCentimes: number | null = null;
    if (creditLimitDzd.trim()) {
      try {
        limitCentimes = parseMoneyToCentimes(creditLimitDzd.trim());
        if (limitCentimes < 0) {
          setError(
            isAr
              ? 'لا يمكن أن يكون سقف الدين سالباً.'
              : 'La limite de crédit ne peut pas être négative.'
          );
          return;
        }
      } catch (err: any) {
        setError(
          isAr
            ? 'مبلغ سقف الدين غير صالح (مثال: 500000 أو 500 000).'
            : err.message || 'Montant de limite de crédit invalide'
        );
        return;
      }
    }

    const termsDays = parseInt(paymentTermsDays, 10);
    if (isNaN(termsDays) || termsDays < 0) {
      setError(
        isAr
          ? 'أجل السداد يجب أن يكون عدداً موجباً من الأيام.'
          : 'Le délai de paiement doit être un nombre de jours positif.'
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        credit_limit_centimes: limitCentimes,
        payment_terms_days: termsDays,
      };

      const url = isEdit ? `/api/customers/${initialCustomer!.id}` : '/api/customers';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || (isAr ? 'خطأ أثناء تسجيل الزبون' : 'Erreur lors de l’enregistrement'));
      }

      onSaved(data);
      onClose();
    } catch (err: any) {
      setError(err.message || (isAr ? 'حدث خطأ غير متوقع' : 'Une erreur est survenue'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto bg-slate-950/70 backdrop-blur-xs"
    >
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-lg w-full my-auto max-h-[92vh] sm:max-h-[88vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-base sm:text-lg">
              {isEdit
                ? isAr ? 'تعديل بيانات الزبون' : 'Modifier la fiche client'
                : isAr ? 'إضافة زبون جديد' : 'Nouveau client'}
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
              {isAr ? 'اسم الزبون / المؤسسة' : 'Nom / Raison sociale du client'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder={isAr ? 'مثال: سوبرماركت البركة (السيد كريم)' : 'Ex: Supérette El Baraka (M. Karim)'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {isAr ? 'رقم الهاتف' : 'Numéro de téléphone'}
              </label>
              <input
                type="text"
                dir="ltr"
                placeholder={isAr ? '0555 12 34 56' : 'Ex: 0555 12 34 56'}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-mono text-left"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {isAr ? 'أجل السداد الممنوح (أيام)' : 'Délai de paiement (jours)'}
              </label>
              <input
                type="number"
                min="0"
                max="365"
                dir="ltr"
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(e.target.value)}
                className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-mono text-left"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              {isAr ? 'سقف الدين المسموح به (دج)' : 'Plafond de crédit autorisé (DZD)'}
            </label>
            <input
              type="text"
              dir="ltr"
              placeholder={isAr ? 'مثال: 500 000 (اتركه فارغاً إذا كان غير محدود)' : 'Ex: 500 000 (laisser vide si illimité)'}
              value={creditLimitDzd}
              onChange={(e) => setCreditLimitDzd(e.target.value)}
              className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-mono text-left"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              {isAr
                ? 'سيتم إظهار تنبيه وتأكيد إلزامي عند محاولة تسجيل بيع يتجاوز هذا السقف.'
                : "Une alerte bloquante sera déclenchée lors d'une vente à crédit dépassant ce montant."}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              {isAr ? 'العنوان / المدينة / الولاية' : 'Adresse / Ville / Wilaya'}
            </label>
            <input
              type="text"
              placeholder={isAr ? 'مثال: باب الزوار، الجزائر' : 'Ex: Bab Ezzouar, Alger'}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              {isAr ? 'ملاحظات ومعلومات إضافية' : 'Remarques / Informations complémentaires'}
            </label>
            <textarea
              rows={2}
              placeholder={
                isAr
                  ? 'مثال: يفضل التوصيل صباحاً، يوم الدفع المعتاد...'
                  : 'Ex: Préfère les livraisons le matin, jour de règlement habituel...'
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            />
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
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {loading
                ? isAr ? 'جاري الحفظ...' : 'Enregistrement...'
                : isEdit
                ? isAr ? 'حفظ التعديلات' : 'Modifier le client'
                : isAr ? 'إضافة الزبون' : 'Enregistrer le client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
