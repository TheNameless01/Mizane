import React, { useState } from 'react';
import { Customer } from '../shared/types';
import { parseMoneyToCentimes, formatDZD } from '../shared/money';
import { X, UserPlus, Save } from 'lucide-react';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Le nom du client doit comporter au moins 2 caractères.');
      return;
    }

    let limitCentimes: number | null = null;
    if (creditLimitDzd.trim()) {
      try {
        limitCentimes = parseMoneyToCentimes(creditLimitDzd.trim());
        if (limitCentimes < 0) {
          setError('La limite de crédit ne peut pas être négative.');
          return;
        }
      } catch (err: any) {
        setError(err.message || 'Montant de limite de crédit invalide');
        return;
      }
    }

    const termsDays = parseInt(paymentTermsDays, 10);
    if (isNaN(termsDays) || termsDays < 0) {
      setError('Le délai de paiement doit être un nombre de jours positif.');
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
        throw new Error(data.error || 'Erreur lors de l’enregistrement');
      }

      onSaved(data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-lg">
              {isEdit ? 'Modifier la fiche client' : 'Nouveau client'}
            </h3>
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
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nom / Raison sociale du client <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Ex: Supérette El Baraka (M. Karim)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Numéro de téléphone
              </label>
              <input
                type="text"
                placeholder="Ex: 0555 12 34 56"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Délai de paiement accordé (jours)
              </label>
              <input
                type="number"
                min="0"
                max="365"
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(e.target.value)}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Plafond de crédit autorisé (DZD)
            </label>
            <input
              type="text"
              placeholder="Ex: 500 000 (laisser vide si illimité)"
              value={creditLimitDzd}
              onChange={(e) => setCreditLimitDzd(e.target.value)}
              className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Une alerte bloquante sera déclenchée lors d'une vente à crédit dépassant ce montant.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Adresse / Ville / Wilaya
            </label>
            <input
              type="text"
              placeholder="Ex: Bab Ezzouar, Alger"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Remarques / Informations complémentaires
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Préfère les livraisons le matin, jour de règlement habituel..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
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
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Enregistrement...' : 'Enregistrer le client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
