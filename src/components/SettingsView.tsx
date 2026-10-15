import React, { useState } from 'react';
import { BusinessSettings } from '../shared/types';
import { useI18n } from '../shared/i18n/context';
import { LanguageSwitcher } from './LanguageSwitcher';
import {
  Building2,
  Save,
  Download,
  FileSpreadsheet,
  Database,
  Check,
  AlertCircle,
  HelpCircle,
  Globe,
  Trash2,
  RefreshCw,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

interface SettingsViewProps {
  settings: BusinessSettings | null;
  onSettingsUpdated: (updated: BusinessSettings) => void;
  onSeedData: () => Promise<void>;
  onFlushData?: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSettingsUpdated,
  onSeedData,
  onFlushData,
}) => {
  const { t, locale, dir } = useI18n();
  const isAr = locale === 'ar';

  const [name, setName] = useState(settings?.name || '');
  const [address, setAddress] = useState(settings?.address || '');
  const [phone, setPhone] = useState(settings?.phone || '');
  const [nif, setNif] = useState(settings?.nif || '');
  const [nis, setNis] = useState(settings?.nis || '');
  const [rc, setRc] = useState(settings?.rc || '');
  const [ai, setAi] = useState(settings?.ai || '');

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Seed & Flush states
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [flushSuccess, setFlushSuccess] = useState(false);
  const [showFlushConfirm, setShowFlushConfirm] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError(
        isAr
          ? 'يجب أن يحتوي اسم المؤسسة على حرفين على الأقل.'
          : 'La raison sociale doit comporter au moins 2 caractères.'
      );
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSavedSuccess(false);

      const res = await fetch('/api/business', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim() || null,
          phone: phone.trim() || null,
          nif: nif.trim() || null,
          nis: nis.trim() || null,
          rc: rc.trim() || null,
          ai: ai.trim() || null,
          default_currency: 'DZD',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la mise à jour');

      onSettingsUpdated(data);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async () => {
    try {
      setSeeding(true);
      setError(null);
      setSeedSuccess(false);
      setFlushSuccess(false);
      await onSeedData();
      setSeedSuccess(true);
      setTimeout(() => setSeedSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || (isAr ? 'خطأ أثناء تحميل البيانات التجريبية' : 'Erreur lors du chargement des données'));
    } finally {
      setSeeding(false);
    }
  };

  const handleFlush = async () => {
    try {
      setFlushing(true);
      setError(null);
      setFlushSuccess(false);
      setSeedSuccess(false);
      if (onFlushData) {
        await onFlushData();
      } else {
        const res = await fetch('/api/flush', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur lors du flush');
      }
      setShowFlushConfirm(false);
      setFlushSuccess(true);
      setTimeout(() => setFlushSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || (isAr ? 'خطأ أثناء تفريغ البيانات' : 'Erreur lors de la réinitialisation'));
    } finally {
      setFlushing(false);
    }
  };

  return (
    <div dir={dir} className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          {isAr ? 'الإعدادات، اللغة والبيانات التجريبية' : 'Paramètres, Langue & Données'}
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {isAr
            ? 'تكوين بيانات مؤسستك التجارية، تبديل اللغة، إدارة النسخ الاحتياطية وتجربة التطبيق'
            : 'Configuration de votre établissement commercial, langue, sauvegardes et tests'}
        </p>
      </div>

      {/* Global Notifications */}
      {seedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs animate-in fade-in duration-200">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>
            {isAr
              ? 'تم تحميل البيانات التجريبية بنجاح! تم إنشاء 5 زبائن مع مبيعات ومقبوضات وديون متأخرة.'
              : 'Données de test chargées avec succès ! 5 clients avec ventes, paiements et balance âgée créés.'}
          </span>
        </div>
      )}

      {flushSuccess && (
        <div className="p-4 bg-indigo-50 border border-indigo-300 text-indigo-900 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs animate-in fade-in duration-200">
          <Check className="w-5 h-5 text-indigo-600 shrink-0" />
          <span>
            {isAr
              ? 'تم مسح وتصفير قاعدة البيانات بنجاح! جميع السجلات أصبحت نظيفة وفارغة.'
              : 'Base de données réinitialisée avec succès ! Toutes les données ont été effacées (remise à zéro).'}
          </span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Language Switcher Card - Ultra Prominent */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {isAr ? 'لغة واجهة التطبيق' : 'Langue de l’application'}
              </h2>
              <p className="text-xs text-slate-500">
                {isAr
                  ? 'اختر بين اللغة العربية (دعم كامل لليمين RTL) والفرنسية'
                  : 'Basculer instantanément entre le Français et l’Arabe (avec support complet du sens RTL)'}
              </p>
            </div>
          </div>

          <LanguageSwitcher variant="settings" />
        </div>
      </div>

      {/* Test Data & Flush Management Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Seed Demo Data Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-slate-900 font-bold text-sm">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3>{isAr ? 'تحميل بيانات تجريبية (Test Data)' : 'Données de test (Démo)'}</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              {isAr
                ? 'حقن بيانات واقعية لتاجر جملة جزائري (5 زبائن: باب الزوار، البليدة، حجوط، الرويبة، الحراش مع مبيعات سميد، زيت، سكر ومقبوضات نقدية وصكوك).'
                : 'Charge un jeu complet de 5 clients algériens représentatifs (Bab Ezzouar, Blida, Hadjout, Rouiba) avec ventes de semoule, huile, sucre, chèques et balance âgée.'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {seeding ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {seeding
              ? isAr ? 'جاري التحميل...' : 'Chargement...'
              : isAr ? 'تحميل بيانات تجريبية الآن' : 'Charger les données de test'}
          </button>
        </div>

        {/* Flush Database Card */}
        <div className="bg-white p-5 rounded-xl border border-rose-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-rose-950 font-bold text-sm">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <h3>{isAr ? 'مسح وتصفير البيانات (Flush)' : 'Vider la base de données (Flush)'}</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              {isAr
                ? 'حذف جميع الزبائن، المبيعات، المقبوضات وسجل التدقيق بشكل نهائي وتصفير قاعدة البيانات للبدء من جديد.'
                : 'Supprime définitivement tous les clients, ventes, règlements et écritures pour repartir d’une base complètement vierge.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowFlushConfirm(true)}
            disabled={flushing}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            {isAr ? 'مسح كل البيانات (تصفير)' : 'Vider toutes les données (Flush)'}
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Flush (No window.confirm!) */}
      {showFlushConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-100" />
                <h3 className="font-bold text-base sm:text-lg">
                  {isAr ? 'تأكيد تصفير ومسح البيانات' : 'Confirmer la réinitialisation'}
                </h3>
              </div>
              <button
                onClick={() => setShowFlushConfirm(false)}
                className="text-rose-200 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {isAr
                  ? 'تحذير : هذه العملية ستقوم بحذف جميع الزبائن، المبيعات، المقبوضات وسجلات التدقيق نهائياً وإعادة ترقيم السجلات إلى الصفر.'
                  : 'Attention : cette action supprimera définitivement tous les clients, ventes, règlements et écritures d’ajustement.'}
              </p>
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium">
                {isAr
                  ? 'لا يمكن التراجع عن هذه العملية بعد التأكيد.'
                  : 'Cette action est irréversible.'}
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFlushConfirm(false)}
                  disabled={flushing}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  type="button"
                  onClick={handleFlush}
                  disabled={flushing}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  {flushing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {flushing
                    ? isAr ? 'جاري المسح...' : 'Suppression...'
                    : isAr ? 'نعم، مسح كل البيانات' : 'Confirmer le Flush'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Business Settings Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-400" />
          <h2 className="font-bold text-sm sm:text-base">
            {isAr
              ? 'بيانات المؤسسة التجارية (تظهر على كشوف الحسابات A4)'
              : "Identité de l'Établissement (Affichage Relevé A4)"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-lg flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>
                {isAr ? 'تم حفظ التعديلات بنجاح.' : 'Coordonnées mises à jour avec succès.'}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              {isAr ? 'الاسم التجاري / التسمية' : 'Raison sociale / Nom commercial'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={isAr ? 'مثال: شركة النور لتوزيع المواد الغذائية بالجملة' : 'Ex: SARL Distribution Alimentaire Centrale'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {isAr ? 'رقم الهاتف' : 'Téléphone'}
              </label>
              <input
                type="text"
                placeholder={isAr ? '021 28 30 00 / 0550 12 34 56' : 'Ex: 021 28 30 00 / 0550 12 34 56'}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {isAr ? 'العنوان والمقر التجاري' : 'Adresse / Ville'}
              </label>
              <input
                type="text"
                placeholder={isAr ? 'المنطقة الصناعية، باب الزوار، الجزائر' : 'Ex: Zone industrielle Oued Smar, Alger'}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              />
            </div>
          </div>

          {/* Algerian Legal Registration Numbers */}
          <div className="pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
              {isAr ? 'المعرفات القانونية والضريبية (الجزائر)' : 'Identifiants légaux et fiscaux (Algérie)'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {isAr ? 'NIF (الرقم الجبائي)' : 'NIF (Matricule fiscal)'}
                </label>
                <input
                  type="text"
                  placeholder="000116000000000"
                  value={nif}
                  onChange={(e) => setNif(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {isAr ? 'NIS (الإحصائي)' : 'NIS (Statistique)'}
                </label>
                <input
                  type="text"
                  placeholder="0999160000000"
                  value={nis}
                  onChange={(e) => setNis(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {isAr ? 'RC (السجل التجاري)' : 'RC (Registre du commerce)'}
                </label>
                <input
                  type="text"
                  placeholder="16/00-0123456B16"
                  value={rc}
                  onChange={(e) => setRc(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {isAr ? 'AI (رقم المادة)' : 'AI (Article d’imposition)'}
                </label>
                <input
                  type="text"
                  placeholder="16000000000"
                  value={ai}
                  onChange={(e) => setAi(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono bg-white"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving
                ? isAr ? 'جاري الحفظ...' : 'Enregistrement...'
                : isAr ? 'حفظ البيانات' : 'Enregistrer les coordonnées'}
            </button>
          </div>
        </form>
      </div>

      {/* Local-First Backups & Exports Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* SQLite Database Backup */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-slate-900 font-bold text-sm">
              <Database className="w-4 h-4 text-indigo-600" />
              <h3>{isAr ? 'نسخة احتياطية محلية SQLite (.db)' : 'Sauvegarde Locale SQLite (.db)'}</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              {isAr
                ? 'تحميل نسخة فورية كاملة من قاعدة بياناتك المحلية (الزبائن، المبيعات، المقبوضات وسجل التدقيق).'
                : 'Téléchargez une copie instantanée exacte de votre fichier de base de données SQLite (contenant clients, ventes, encaissements et audit).'}
            </p>
          </div>

          <a
            href="/api/backup"
            download
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            {isAr ? 'تحميل ملف قاعدة البيانات' : 'Télécharger le fichier .db'}
          </a>
        </div>

        {/* CSV Export */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-slate-900 font-bold text-sm">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <h3>{isAr ? 'تصدير إلى Excel (CSV)' : 'Export CSV (Excel)'}</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              {isAr
                ? 'تصدير جدول كل الزبائن وأرصدتهم الحالية ومجموع معاملاتهم بصيغة ملف CSV متوافق مع Excel.'
                : 'Exportez la liste de tous vos clients avec leurs soldes, totaux de ventes et coordonnées au format CSV compatible Excel.'}
            </p>
          </div>

          <a
            href="/api/export/csv"
            download
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            {isAr ? 'تصدير قائمة الزبائن' : 'Exporter les clients en CSV'}
          </a>
        </div>
      </div>

      {/* Demo Data & Legal Disclaimer */}
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
        <div className="flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-800">
              {isAr ? 'تنبيه قانوني ومحاسبي (الجزائر) :' : "Note importante & Cadre d'utilisation (Algérie) :"}
            </p>
            <p className="leading-relaxed">
              {isAr
                ? 'تطبيق ميزان v1 هو أداة داخلية لتدوين ديون الزبائن والمساعدة على التحصيل وإصدار كشوف الحساب، وليس برنامج فواتير معتمد من إدارة الضرائب. يرجى مراجعة محاسبك المعتمد فيما يخص التزاماتك المحاسبية.'
                : "Mizan v1 est un registre de créance client et d'aide au recouvrement interne pour grossistes et commerçants, et non un système de facturation certifié par l'administration fiscale. Veuillez valider vos obligations comptables auprès de votre expert-comptable."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
