import { getDb } from './db/database';
import { createCustomer, createSale, recordPayment, recordAdjustment } from './db/ledger';

export function runSeed() {
  const db = getDb();
  console.log('Seeding demo data for Mizan (Algerian Wholesaler)...');

  // Customer 1: Supérette El Baraka (Bab Ezzouar, Alger)
  const c1 = createCustomer(db, {
    name: 'Supérette El Baraka (M. Karim)',
    phone: '0555 12 34 56',
    address: '14 Rue Colonel Amirouche, Bab Ezzouar, Alger',
    notes: 'Client régulier depuis 2021. Bon payeur mais dépasse parfois le délai.',
    credit_limit_centimes: 1_000_000_00, // 1,000,000 DZD
    payment_terms_days: 30,
  });

  // Customer 2: Épicerie Moderne (Blida)
  const c2 = createCustomer(db, {
    name: 'Épicerie Moderne — Blida (M. Hamid)',
    phone: '0770 98 76 54',
    address: 'Boulevard Mohamed V, Blida',
    notes: 'Paiement mixte chèque et espèces. Avoir en compte.',
    credit_limit_centimes: 500_000_00, // 500,000 DZD
    payment_terms_days: 15,
  });

  // Customer 3: EURL Hadjout Distribution (Tipaza)
  const c3 = createCustomer(db, {
    name: 'EURL Hadjout Distribution',
    phone: '024 49 10 20',
    address: 'Zone artisanale lot 12, Hadjout, Tipaza',
    notes: 'Gros distributeur local. Factures avec TVA.',
    credit_limit_centimes: 2_500_000_00, // 2,500,000 DZD
    payment_terms_days: 45,
  });

  // Customer 4: Alimentation Générale Les Palmiers (Rouiba)
  const c4 = createCustomer(db, {
    name: 'Alimentation Les Palmiers (M. Bachir)',
    phone: '0661 22 33 44',
    address: 'Cité 500 Logements, Rouiba, Alger',
    notes: 'Ancien solde papier migré.',
    credit_limit_centimes: 300_000_00,
    payment_terms_days: 30,
  });

  // Customer 5: Nouveau Client Comptant
  const c5 = createCustomer(db, {
    name: 'Supérette Les Lilas (M. Reda)',
    phone: '0560 77 88 99',
    address: 'El Harrach, Alger',
    credit_limit_centimes: 200_000_00,
    payment_terms_days: 7,
  });

  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

  // Initial adjustment for c4: Migrating old ledger debt
  recordAdjustment(db, {
    customer_id: c4.id,
    amount_centimes: 85_000_00, // 85,000 DZD
    reason: 'Solde initial',
    note: 'Reprise ancien solde carnet manuscrit au 01/01/2026',
    adjusted_at: daysAgo(60),
  });

  // Sales for c1
  // Sale 1: 45 days ago
  createSale(db, {
    customer_id: c1.id,
    sold_at: daysAgo(45),
    items: [
      { label: 'Semoule Extra 25kg (Sim)', unit: 'sac', quantity_thousandths: 50_000, unit_price_centimes: 1_250_00 }, // 50 sacs @ 1250 = 62,500 DZD
      { label: 'Huile de table Elio 5L', unit: 'carton', quantity_thousandths: 30_000, unit_price_centimes: 3_600_00 }, // 30 cartons (x4) @ 3600 = 108,000 DZD
      { label: 'Farine T55 50kg', unit: 'sac', quantity_thousandths: 20_000, unit_price_centimes: 2_100_00 }, // 20 sacs @ 2100 = 42,000 DZD
    ],
  });

  // Partial Payment for c1: 30 days ago
  recordPayment(db, {
    customer_id: c1.id,
    amount_centimes: 100_000_00, // 100,000 DZD
    paid_at: daysAgo(30),
    method: 'espèces',
    reference: 'Reçu B-102',
    note: 'Acompte versé au magasin',
  });

  // Sale 2 for c1: 10 days ago
  createSale(db, {
    customer_id: c1.id,
    sold_at: daysAgo(10),
    items: [
      { label: 'Sucre blanc cristallisé 50kg', unit: 'sac', quantity_thousandths: 15_000, unit_price_centimes: 4_500_00 }, // 15 sacs @ 4500 = 67,500 DZD
      { label: 'Tomate double concentré Izmir 800g', unit: 'carton', quantity_thousandths: 40_000, unit_price_centimes: 2_800_00 }, // 40 cartons @ 2800 = 112,000 DZD
    ],
  });

  // Sales for c2 (Épicerie Moderne)
  createSale(db, {
    customer_id: c2.id,
    sold_at: daysAgo(20),
    items: [
      { label: 'Café moulu 250g Familia', unit: 'carton', quantity_thousandths: 25_000, unit_price_centimes: 5_200_00 },
      { label: 'Pâtes alimentaires diverses 500g', unit: 'carton', quantity_thousandths: 50_000, unit_price_centimes: 1_400_00 },
    ],
  });

  // Payment for c2 by cheque: 5 days ago
  recordPayment(db, {
    customer_id: c2.id,
    amount_centimes: 150_000_00,
    paid_at: daysAgo(5),
    method: 'chèque',
    reference: 'CHQ-BNA-88271',
    note: 'Chèque BNA Blida',
  });

  // Cash Sale for c5 (Comptant)
  createSale(db, {
    customer_id: c5.id,
    sold_at: daysAgo(2),
    is_cash_sale: true,
    cash_payment_method: 'espèces',
    items: [
      { label: 'Levure boulangère Saf-Instant 500g', unit: 'carton', quantity_thousandths: 10_000, unit_price_centimes: 6_500_00 },
    ],
  });

  console.log('Seed completed successfully!');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  runSeed();
}
