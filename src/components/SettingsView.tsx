import React, { useState } from 'react';
import { BusinessSettings } from '../shared/types';
import {
  Building2,
  Save,
  Download,
  FileSpreadsheet,
  Database,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface SettingsViewProps {
  settings: BusinessSettings | null;
  onSettingsUpdated: (updated: BusinessSettings) => void;
  onSeedData: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSettingsUpdated,
  onSeedData,
}) => {
  const [name, setName] = useState(settings?.name || '');
  const [address, setAddress] = useState(settings?.address || '');
  const [phone, setPhone] = useState(settings?.phone || '');
  const [nif, setNif] = useState(settings?.nif || '');
  const [nis, setNis] = useState(settings?.nis || '');
  const [rc, setRc] = useState(settings?.rc || '');
  const [ai, setAi] = useState(settings?.ai || '');

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('La raison sociale doit comporter au moins 2 caractères.');
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
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async () => {
    if (!window.confirm('Voulez-vous charger le jeu de données de démonstration pour grossiste algérien ?')) {
      return;
    }
    try {
      setSeeding(true);
      await onSeedData();
      alert('Données de démonstration chargées avec succès !');
    } catch (err: any) {
      alert(err.message || 'Erreur lors du chargement des données');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Paramètres & Sauvegardes
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configuration de votre établissement commercial et gestion locale des données
        </p>
      </div>

      {/* Business Settings Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-400" />
          <h2 className="font-bold text-sm">Identité de l'Établissement (Affichage Relevé A4)</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Coordonnées mises à jour avec succès.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Raison sociale / Nom commercial <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Numéro de téléphone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Adresse / Wilaya
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
              Identifiants fiscaux & commerciaux (Algérie — Optionnels) :
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  NIF (Identifiant Fiscal)
                </label>
                <input
                  type="text"
                  placeholder="000000000000000"
                  value={nif}
                  onChange={(e) => setNif(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-md font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  NIS (Statistique)
                </label>
                <input
                  type="text"
                  placeholder="00000000000"
                  value={nis}
                  onChange={(e) => setNis(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-md font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  RC (Registre Commerce)
                </label>
                <input
                  type="text"
                  placeholder="16/00-0000000B20"
                  value={rc}
                  onChange={(e) => setRc(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-md font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  AI (Article d'Imposition)
                </label>
                <input
                  type="text"
                  placeholder="16000000000"
                  value={ai}
                  onChange={(e) => setAi(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-md font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Enregistrement...' : 'Enregistrer les coordonnées'}
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
              <h3>Sauvegarde Locale SQLite (.db)</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Téléchargez une copie instantanée exacte de votre fichier de base de données SQLite
              (contenant clients, ventes, encaissements et audit).
            </p>
          </div>

          <a
            href="/api/backup"
            download
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Télécharger le fichier .db
          </a>
        </div>

        {/* CSV Export */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-slate-900 font-bold text-sm">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <h3>Export CSV (Excel)</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Exportez la liste de tous vos clients avec leurs soldes, totaux de ventes et coordonnées
              au format CSV compatible Excel (UTF-8 avec BOM).
            </p>
          </div>

          <a
            href="/api/export/csv"
            download
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Exporter les clients en CSV
          </a>
        </div>
      </div>

      {/* Demo Data & Legal Disclaimer */}
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
        <div className="flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">
              Note importante & Cadre d'utilisation (Algérie) :
            </p>
            <p>
              Mizan v1 est un registre de créance client et d'aide au recouvrement interne pour grossistes
              et commerçants, et non un système de facturation certifié par l'administration fiscale.
              Veuillez valider vos obligations comptables, régimes de TVA et mentions légales auprès de votre
              expert-comptable ou commissaire aux comptes.
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Besoin d'exemples de clients et transactions pour tester ?
          </span>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
          >
            {seeding ? 'Chargement...' : 'Charger données démo'}
          </button>
        </div>
      </div>
    </div>
  );
};
