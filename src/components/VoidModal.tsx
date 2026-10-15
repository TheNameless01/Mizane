import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

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
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError("Le motif d'annulation doit comporter au moins 3 caractères.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onConfirm(reason.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'annulation");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-100" />
            <h3 className="font-semibold text-lg">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-rose-200 hover:text-white transition-colors p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Vous êtes sur le point d’annuler la transaction :{' '}
            <strong className="text-slate-900">{itemDescription}</strong>.
          </p>

          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
            <strong>Règle comptable :</strong> La transaction ne sera pas supprimée mais marquée
            comme annulée. Elle restera visible sur le relevé avec son motif et sera exclue du
            calcul du solde.
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Motif de l'annulation <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              required
              placeholder="Ex: Erreur de saisie, chèque sans provision, retour marchandise..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            />
            {error && <p className="text-xs text-rose-600 mt-1 font-medium">{error}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Abandonner
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors shadow-xs"
            >
              {submitting ? 'Annulation en cours...' : 'Confirmer l’annulation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
