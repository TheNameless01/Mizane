import { describe, it, expect, beforeEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { createTestDb } from '../server/db/database';
import {
  createCustomer,
  createSale,
  recordPayment,
  recordAdjustment,
  voidSale,
  voidPayment,
  getCustomerById,
  getCustomerStatement,
  getAgingReport,
  CreditLimitExceededError,
} from '../server/db/ledger';

describe('Mizan Core Ledger & Financial Integrity', () => {
  let db: Database;

  beforeEach(() => {
    // In-memory isolated database for every test
    db = createTestDb();
  });

  it('computes customer balance strictly from ledger transactions (no stored balance column)', () => {
    const customer = createCustomer(db, {
      name: 'Client Test Ledger',
      phone: '0555001122',
    });

    // 1. Initial state: balance = 0
    let fresh = getCustomerById(db, customer.id)!;
    expect(fresh.balance_centimes).toBe(0);

    // 2. Credit sale of 1,000.00 DZD (100,000 centimes)
    createSale(db, {
      customer_id: customer.id,
      sold_at: '2026-10-01T10:00:00.000Z',
      items: [
        { label: 'Farine 25kg', unit: 'sac', quantity_thousandths: 2000, unit_price_centimes: 50000 },
      ],
    });

    fresh = getCustomerById(db, customer.id)!;
    expect(fresh.balance_centimes).toBe(100000); // owes 1,000.00 DZD

    // 3. Partial payment of 400.00 DZD (40,000 centimes)
    recordPayment(db, {
      customer_id: customer.id,
      amount_centimes: 40000,
      paid_at: '2026-10-02T10:00:00.000Z',
      method: 'espèces',
    });

    fresh = getCustomerById(db, customer.id)!;
    expect(fresh.balance_centimes).toBe(60000); // owes 600.00 DZD

    // 4. Remaining payment of 600.00 DZD brings balance to EXACTLY 0
    recordPayment(db, {
      customer_id: customer.id,
      amount_centimes: 60000,
      paid_at: '2026-10-03T10:00:00.000Z',
      method: 'espèces',
    });

    fresh = getCustomerById(db, customer.id)!;
    expect(fresh.balance_centimes).toBe(0); // exactly 0
  });

  it('overpayment or advance payment produces negative balance (customer credit)', () => {
    const customer = createCustomer(db, { name: 'Client Acompte' });

    // Client pays 500.00 DZD in advance before any sale
    recordPayment(db, {
      customer_id: customer.id,
      amount_centimes: 50000,
      paid_at: '2026-10-01T10:00:00.000Z',
      method: 'virement',
      note: 'Avance sur commande',
    });

    const fresh = getCustomerById(db, customer.id)!;
    // Solde négatif = Crédit client (never clamped to 0)
    expect(fresh.balance_centimes).toBe(-50000);
  });

  it('creates cash sales atomically: sale + payment created, balance remains 0', () => {
    const customer = createCustomer(db, { name: 'Client Comptant' });

    const result = createSale(db, {
      customer_id: customer.id,
      sold_at: '2026-10-01T10:00:00.000Z',
      is_cash_sale: true,
      cash_payment_method: 'espèces',
      items: [
        { label: 'Sucre 50kg', unit: 'sac', quantity_thousandths: 1000, unit_price_centimes: 450000 },
      ],
    });

    expect(result.cashPayment).toBeDefined();
    expect(result.cashPayment?.amount_centimes).toBe(450000);

    const fresh = getCustomerById(db, customer.id)!;
    expect(fresh.balance_centimes).toBe(0); // balance remains untouched
    expect(fresh.total_sales_centimes).toBe(450000);
    expect(fresh.total_payments_centimes).toBe(450000);
  });

  it('correctly records opening balance and signed adjustments', () => {
    const customer = createCustomer(db, { name: 'Client Ancien Papier' });

    // 1. Opening balance debit (+15,000.00 DZD)
    recordAdjustment(db, {
      customer_id: customer.id,
      amount_centimes: 1500000,
      reason: 'Solde initial',
      note: 'Ancien solde carnet 2025',
      adjusted_at: '2026-01-01T00:00:00.000Z',
    });

    let fresh = getCustomerById(db, customer.id)!;
    expect(fresh.balance_centimes).toBe(1500000);

    // 2. Commercial discount adjustment (-2,000.00 DZD)
    recordAdjustment(db, {
      customer_id: customer.id,
      amount_centimes: -200000,
      reason: 'Remise',
      note: 'Remise fidélité accordée',
      adjusted_at: '2026-01-05T00:00:00.000Z',
    });

    fresh = getCustomerById(db, customer.id)!;
    expect(fresh.balance_centimes).toBe(1300000);
  });

  it('keeps balances for multiple customers strictly independent', () => {
    const c1 = createCustomer(db, { name: 'Client Alpha' });
    const c2 = createCustomer(db, { name: 'Client Beta' });

    createSale(db, {
      customer_id: c1.id,
      sold_at: '2026-10-01T10:00:00.000Z',
      items: [{ label: 'Item A', unit: 'pcs', quantity_thousandths: 1000, unit_price_centimes: 10000 }],
    });

    createSale(db, {
      customer_id: c2.id,
      sold_at: '2026-10-01T10:00:00.000Z',
      items: [{ label: 'Item B', unit: 'pcs', quantity_thousandths: 5000, unit_price_centimes: 20000 }],
    });

    recordPayment(db, {
      customer_id: c1.id,
      amount_centimes: 10000,
      paid_at: '2026-10-02T10:00:00.000Z',
      method: 'espèces',
    });

    expect(getCustomerById(db, c1.id)!.balance_centimes).toBe(0);
    expect(getCustomerById(db, c2.id)!.balance_centimes).toBe(100000);
  });

  it('computes chronological running balance in customer statement matching closing balance', () => {
    const customer = createCustomer(db, { name: 'Client Relevé' });

    // Day 1: Opening balance 500 DZD
    recordAdjustment(db, {
      customer_id: customer.id,
      amount_centimes: 50000,
      reason: 'Solde initial',
      note: 'Solde historique',
      adjusted_at: '2026-09-01T08:00:00.000Z',
    });

    // Day 2: Sale of 300 DZD
    createSale(db, {
      customer_id: customer.id,
      sold_at: '2026-09-02T10:00:00.000Z',
      items: [{ label: 'Article 1', unit: 'pcs', quantity_thousandths: 1000, unit_price_centimes: 30000 }],
    });

    // Day 3: Payment of 400 DZD
    recordPayment(db, {
      customer_id: customer.id,
      amount_centimes: 40000,
      paid_at: '2026-09-03T11:00:00.000Z',
      method: 'chèque',
      reference: 'CHQ-123',
    });

    const statement = getCustomerStatement(db, customer.id);
    expect(statement.rows.length).toBe(3);
    // Row 1 running balance: 500.00 DZD
    expect(statement.rows[0].running_balance_centimes).toBe(50000);
    // Row 2 running balance: 500 + 300 = 800.00 DZD
    expect(statement.rows[1].running_balance_centimes).toBe(80000);
    // Row 3 running balance: 800 - 400 = 400.00 DZD
    expect(statement.rows[2].running_balance_centimes).toBe(40000);
    expect(statement.closing_balance_centimes).toBe(40000);

    const directBalance = getCustomerById(db, customer.id)!.balance_centimes;
    expect(statement.closing_balance_centimes).toBe(directBalance);
  });

  it('enforces credit limits: blocks exceeding sales unless explicitly overridden', () => {
    const customer = createCustomer(db, {
      name: 'Client Plafond',
      credit_limit_centimes: 50000, // 500.00 DZD limit
    });

    // First sale of 400.00 DZD -> allowed
    createSale(db, {
      customer_id: customer.id,
      sold_at: '2026-10-01T10:00:00.000Z',
      items: [{ label: 'Item 1', unit: 'pcs', quantity_thousandths: 1000, unit_price_centimes: 40000 }],
    });

    // Second sale of 200.00 DZD -> would bring balance to 600.00 DZD > 500.00 DZD
    expect(() => {
      createSale(db, {
        customer_id: customer.id,
        sold_at: '2026-10-02T10:00:00.000Z',
        items: [{ label: 'Item 2', unit: 'pcs', quantity_thousandths: 1000, unit_price_centimes: 20000 }],
      });
    }).toThrow(CreditLimitExceededError);

    // With explicit override: succeeds
    const overrideResult = createSale(db, {
      customer_id: customer.id,
      sold_at: '2026-10-02T10:00:00.000Z',
      items: [{ label: 'Item 2', unit: 'pcs', quantity_thousandths: 1000, unit_price_centimes: 20000 }],
      override_credit_limit: true,
    });
    expect(overrideResult.sale).toBeDefined();
    expect(getCustomerById(db, customer.id)!.balance_centimes).toBe(60000);
  });

  it('excludes voided sales and payments from balance while keeping them visible with reasons', () => {
    const customer = createCustomer(db, { name: 'Client Annulation' });

    const { sale } = createSale(db, {
      customer_id: customer.id,
      sold_at: '2026-10-01T10:00:00.000Z',
      items: [{ label: 'Erreur Facturation', unit: 'pcs', quantity_thousandths: 1000, unit_price_centimes: 25000 }],
    });

    expect(getCustomerById(db, customer.id)!.balance_centimes).toBe(25000);

    // Void the sale
    voidSale(db, sale.id, 'Erreur de saisie double commande');

    // Balance immediately returns to 0
    expect(getCustomerById(db, customer.id)!.balance_centimes).toBe(0);

    // In statement, voided row is visible but excluded from totals
    const statement = getCustomerStatement(db, customer.id);
    expect(statement.rows.length).toBe(1);
    expect(statement.rows[0].is_voided).toBe(true);
    expect(statement.rows[0].void_reason).toBe('Erreur de saisie double commande');
    expect(statement.closing_balance_centimes).toBe(0);
  });

  it('allocates aging buckets accurately using oldest-first (FIFO) allocation', () => {
    const customer = createCustomer(db, {
      name: 'Client Grand Ancien',
      payment_terms_days: 15,
    });

    const now = new Date();
    const daysAgoIso = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

    // Sale 1: 80 days ago (overdue ~65 days -> 61-90 bucket), 1000 DZD
    createSale(db, {
      customer_id: customer.id,
      sold_at: daysAgoIso(80),
      due_date: daysAgoIso(65),
      items: [{ label: 'Vente 1', unit: 'pcs', quantity_thousandths: 1000, unit_price_centimes: 100000 }],
    });

    // Sale 2: 25 days ago (overdue ~10 days -> 1-30 bucket), 1500 DZD
    createSale(db, {
      customer_id: customer.id,
      sold_at: daysAgoIso(25),
      due_date: daysAgoIso(10),
      items: [{ label: 'Vente 2', unit: 'pcs', quantity_thousandths: 1000, unit_price_centimes: 150000 }],
    });

    // Payment of 1200 DZD: wipes out Sale 1 (1000 DZD) completely, and pays 200 DZD of Sale 2
    recordPayment(db, {
      customer_id: customer.id,
      amount_centimes: 120000,
      paid_at: daysAgoIso(5),
      method: 'espèces',
    });

    const aging = getAgingReport(db);
    const bucket = aging.find((b) => b.customer_id === customer.id)!;
    expect(bucket).toBeDefined();
    // Remaining balance is 1300 DZD (1500 - 200)
    expect(bucket.total_balance_centimes).toBe(130000);
    // Sale 1 (in 61-90 bucket) should be 0 because oldest-first absorbed it
    expect(bucket.days_61_90_centimes).toBe(0);
    // Unpaid remainder is in 1-30 days overdue
    expect(bucket.days_1_30_centimes).toBe(130000);
  });
});
