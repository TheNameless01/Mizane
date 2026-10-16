import React, { useState } from 'react';
import { Customer, BusinessSettings } from '../shared/types';
import { formatDZD } from '../shared/money';
import { formatDate } from '../shared/dates';
import { useI18n } from '../shared/i18n/context';
import { MessageSquare, Phone, Send, Copy, Check, X } from 'lucide-react';

interface RemindModalProps {
  customer: Customer;
  business?: BusinessSettings | null;
  onClose: () => void;
}

export const RemindModal: React.FC<RemindModalProps> = ({ customer, business, onClose }) => {
  const { locale, dir } = useI18n();
  const isAr = locale === 'ar';

  const [copied, setCopied] = useState(false);

  const businessName = business?.name || (isAr ? 'المؤسسة التجارية' : 'Établissement Commercial');
  const balanceText = formatDZD(customer.balance_centimes || 0, { locale });
  const lastPaymentText = customer.last_payment_at
    ? formatDate(customer.last_payment_at, { locale })
    : isAr ? 'لا يوجد دفع حديث' : 'aucun paiement récent';

  const defaultMessage = isAr
    ? `السلام عليكم ${customer.name}،

نحيطكم علماً بأن رصيد حسابكم لدى "${businessName}" يبلغ حالياً ${balanceText}.
(آخر تسديد مسجل بتاريخ : ${lastPaymentText}).

يرجى التفضل بالمرور إلى المحل أو التواصل معنا لتسوية الوضعية في أقرب وقت ممكن.

مع خالص التقدير،
${businessName}`
    : `Salam ${customer.name},

Nous vous informons que le solde de votre compte auprès de "${businessName}" s'élève actuellement à ${balanceText}.
(Dernier règlement enregistré le : ${lastPaymentText}).

Merci de bien vouloir passer au magasin ou nous contacter pour régulariser votre situation dès que possible.

Bien cordialement,
${businessName}`;

  const [message, setMessage] = useState(defaultMessage);

  // Format phone number for Algerian WhatsApp international code (+213)
  const cleanPhone = (customer.phone || '').replace(/\D/g, '');
  let waNumber = cleanPhone;
  if (waNumber.startsWith('0')) {
    waNumber = '213' + waNumber.slice(1);
  } else if (!waNumber.startsWith('213') && waNumber.length === 9) {
    waNumber = '213' + waNumber;
  }

  const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}` : '';
  const smsUrl = customer.phone ? `sms:${customer.phone}?body=${encodeURIComponent(message)}` : '';
  const telUrl = customer.phone ? `tel:${customer.phone}` : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-xs"
    >
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-lg w-full my-auto max-h-[92vh] sm:max-h-[88vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base sm:text-lg">
              {isAr ? `تذكير الزبون — ${customer.name}` : `Relance client — ${customer.name}`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
            aria-label={isAr ? 'إغلاق' : 'Fermer'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs sm:text-sm text-amber-900 flex items-center justify-between">
            <span className="font-semibold">{isAr ? 'الدين المستحق حالياً :' : 'Créance en cours :'}</span>
            <span dir="ltr" className="font-black text-base tabular-nums font-mono text-amber-950 inline-block">{balanceText}</span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              {isAr ? 'نص رسالة التذكير (قابلة للتعديل) :' : 'Message de relance (modifiable) :'}
            </label>
            <textarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full text-xs sm:text-sm p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-sans text-slate-800 bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {waNumber ? (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors"
              >
                <Send className="w-4 h-4" />
                {isAr ? 'فتح في WhatsApp' : 'Ouvrir WhatsApp'}
              </a>
            ) : (
              <button
                disabled
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-400 font-semibold text-xs rounded-lg cursor-not-allowed"
              >
                {isAr ? 'WhatsApp (لا يوجد هاتف)' : 'WhatsApp (Tél manquant)'}
              </button>
            )}

            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? (isAr ? 'تم النسخ !' : 'Copié !') : isAr ? 'نسخ نص الرسالة' : 'Copier le texte'}
            </button>

            {customer.phone && (
              <>
                <a
                  href={smsUrl}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  {isAr ? 'إرسال عبر SMS' : 'Envoyer SMS'}
                </a>
                <a
                  href={telUrl}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition-colors"
                >
                  <Phone className="w-4 h-4 text-slate-500" />
                  {isAr ? `اتصال (${customer.phone})` : `Appeler (${customer.phone})`}
                </a>
              </>
            )}
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            {isAr ? 'إغلاق' : 'Fermer'}
          </button>
        </div>
      </div>
    </div>
  );
};
