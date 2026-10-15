import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useI18n } from '../shared/i18n/context';

interface VoidModalProps {
  title: string;
  itemDescription: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

export const VoidModal: React.FC<VoidModalProps> = ({
  title,
  itemDescription,
  onConfirm,
  onClose,
}) => {
  const { locale, dir } = useI18n();
  const isAr = locale === 'ar';

  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError(
        isAr
          ? 'سبب الإلغاء يجب أن يحتوي على 3 أحرف على الأقل.'
          : "Le motif d'annulation doit comporter au moins 3 caractères."
      );
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onConfirm(reason.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || (isAr ? 'خطأ أثناء الإلغاء' : "Erreur lors de l'annulation"));
      setSubmitting(false);
    }
  };

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-100" />
            <h3 className="font-bold text-base sm:text-lg">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-rose-200 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-rose-700 cursor-pointer"
            aria-label={isAr ? 'إغلاق' : 'Fermer'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs sm:text-sm text-slate-600">
            {isAr ? 'أنت على وشك إلغاء المعاملة التالية :' : 'Vous êtes sur le point d’annuler la transaction :'}{' '}
            <strong className="text-slate-900">{itemDescription}</strong>.
          </p>

          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 leading-relaxed">
            <strong>{isAr ? 'قاعدة محاسبية :' : 'Règle comptable :'}</strong>{' '}
            {isAr
              ? 'لن يتم حذف المعاملة من قاعدة البيانات، بل ستوضع عليها علامة "ملغاة" مع ذكر السبب، وستظهر في كشف الحساب مستثناة من حساب الرصيد.'
              : 'La transaction ne sera pas supprimée mais marquée comme annulée. Elle restera visible sur le relevé avec son motif et sera exclue du calcul du solde.'}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              {isAr ? 'سبب الإلغاء الإجباري' : "Motif de l'annulation"} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              required
              placeholder={
                isAr
                  ? 'مثال: خطأ في الإدخال، صك بدون رصيد، إرجاع بضاعة...'
                  : 'Ex: Erreur de saisie, chèque sans provision, retour marchandise...'
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white"
            />
            {error && <p className="text-xs text-rose-600 mt-1 font-semibold">{error}</p>}
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              {isAr ? 'تراجع' : 'Abandonner'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              {submitting
                ? isAr ? 'جاري الإلغاء...' : 'Annulation en cours...'
                : isAr ? 'تأكيد الإلغاء' : 'Confirmer l’annulation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
