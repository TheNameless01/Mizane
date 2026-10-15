import React, { useState } from 'react';
import { Customer } from '../shared/types';
import { formatDZD } from '../shared/money';
import { MoneyDisplay } from './MoneyDisplay';
import {
  Users,
  Search,
  UserPlus,
  Phone,
  ChevronRight,
  Filter,
  AlertTriangle,
  ArrowUpDown,
} from 'lucide-react';

interface CustomersViewProps {
  customers: Customer[];
  onSelectCustomer: (customerId: number) => void;
  onOpenCustomerModal: () => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  onSelectCustomer,
  onOpenCustomerModal,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'debt' | 'credit' | 'archived'>('all');

  const filtered = customers.filter((c) => {
    // Search match
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    // Filter type
    const bal = c.balance_centimes || 0;
    if (filter === 'debt') return bal > 0 && !c.archived_at;
    if (filter === 'credit') return bal < 0 && !c.archived_at;
    if (filter === 'archived') return Boolean(c.archived_at);
    return !c.archived_at; // 'all' default excludes archived unless explicitly requested
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Search / Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Registre des clients
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {customers.length} client{customers.length > 1 ? 's' : ''} au total — Suivi des créances et soldes
          </p>
        </div>

        <button
          onClick={onOpenCustomerModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Ajouter un client
        </button>
      </div>

      {/* Search Bar & Filter Pills */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, téléphone, ville..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs ps-9 pe-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 md:pb-0">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              filter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tous les actifs
          </button>
          <button
            onClick={() => setFilter('debt')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              filter === 'debt'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            Avec créance due
          </button>
          <button
            onClick={() => setFilter('credit')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              filter === 'credit'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            Avec crédit / acompte
          </button>
          <button
            onClick={() => setFilter('archived')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              filter === 'archived'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            Archivés
          </button>
        </div>
      </div>

      {/* Customer List / Table */}
      {filtered.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">Aucun client trouvé</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {search
                ? 'Aucun résultat ne correspond à votre recherche.'
                : 'Votre registre est vide. Ajoutez votre premier client pour commencer le suivi de compte.'}
            </p>
          </div>
          {!search && (
            <button
              onClick={onOpenCustomerModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs"
            >
              <UserPlus className="w-4 h-4" />
              Ajouter un client maintenant
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 text-start">Nom du client</th>
                  <th className="py-3 px-4 text-start">Coordonnées</th>
                  <th className="py-3 px-4 text-start">Plafond de crédit</th>
                  <th className="py-3 px-4 text-end">Solde actuel</th>
                  <th className="py-3 px-4 text-end">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const bal = c.balance_centimes || 0;
                  const isOverLimit =
                    c.credit_limit_centimes !== null &&
                    c.credit_limit_centimes > 0 &&
                    bal > c.credit_limit_centimes;

                  return (
                    <tr
                      key={c.id}
                      onClick={() => onSelectCustomer(c.id)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm">
                            {c.name}
                          </span>
                          {isOverLimit && (
                            <span
                              title="Plafond de crédit dépassé !"
                              className="p-1 rounded bg-rose-100 text-rose-700 inline-flex items-center"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {c.archived_at && (
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-200 text-slate-600 font-medium">
                              Archivé
                            </span>
                          )}
                        </div>
                        {c.address && (
                          <span className="text-[11px] text-slate-500 block truncate max-w-xs mt-0.5">
                            {c.address}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {c.phone ? (
                          <span className="flex items-center gap-1 font-mono text-slate-800">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {c.phone}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Non renseigné</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 tabular-nums">
                        {c.credit_limit_centimes !== null ? (
                          <span>{formatDZD(c.credit_limit_centimes)}</span>
                        ) : (
                          <span className="text-slate-400 italic">Illimité</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-end">
                        <MoneyDisplay centimes={bal} size="md" showBadge />
                      </td>

                      <td className="py-3.5 px-4 text-end">
                        <div className="inline-flex items-center justify-center w-7 h-7 rounded-full text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
