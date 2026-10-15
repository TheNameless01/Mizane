import type { Database } from 'better-sqlite3';
import { calculateLineTotal, calculateVat } from '../../src/shared/money';
import {
  calculateDaysOverdue,
  calculateDueDate,
  getAlgiersDateString,
  getAlgiersDayBoundariesUtc,
  getNowUtcIso,
} from '../../src/shared/dates';
import type {
  Adjustment,
  AgingBucket,
  BusinessSettings,
  Customer,
  CustomerStatement,
  DashboardMetrics,
  Payment,
  Sale,
  SaleItem,
  StatementRow,
} from '../../src/shared/types';

export class CreditLimitExceededError extends Error {
  code = 'CREDIT_LIMIT_EXCEEDED';
  currentBalanceCentimes: number;
  creditLimitCentimes: number;
  newBalanceCentimes: number;

  constructor(current: number, limit: number, newBal: number) {
    super(
      `La limite de crédit autorisée (${limit / 100} DZD) sera dépassée. Solde actuel: ${
        current / 100
      } DZD, nouveau solde estimé: ${newBal / 100} DZD.`
    );
    this.name = 'CreditLimitExceededError';
    this.currentBalanceCentimes = current;
    this.creditLimitCentimes = limit;
    this.newBalanceCentimes = newBal;
  }
}

/**
 * Returns business profile settings.
 */
export function getBusinessSettings(db: Database): BusinessSettings {
  const row = db.prepare('SELECT * FROM business_settings WHERE id = 1').get() as BusinessSettings;
  return row;
}

/**
 * Updates business profile settings.
 */
export function updateBusinessSettings(
  db: Database,
  data: Partial<Omit<BusinessSettings, 'id' | 'updated_at'>>
): BusinessSettings {
  const current = getBusinessSettings(db);
  const updated_at = getNowUtcIso();

  db.prepare(`
    UPDATE business_settings
    SET name = ?, address = ?, phone = ?, nif = ?, nis = ?, rc = ?, ai = ?, default_currency = ?, updated_at = ?
    WHERE id = 1
  `).run(
    data.name ?? current.name,
    data.address ?? current.address,
    data.phone ?? current.phone,
    data.nif ?? current.nif,
    data.nis ?? current.nis,
    data.rc ?? current.rc,
    data.ai ?? current.ai,
    data.default_currency ?? current.default_currency,
    updated_at
  );

  return getBusinessSettings(db);
}

/**
 * Fetches all customers with their ledger-derived balances.
 */
export function getAllCustomers(
  db: Database,
  options?: {
    search?: string;
    includeArchived?: boolean;
    onlyWithBalance?: boolean;
    limit?: number;
    offset?: number;
  }
): Customer[] {
  let query = 'SELECT * FROM customer_balances WHERE 1=1';
  const params: (string | number)[] = [];

  if (!options?.includeArchived) {
    query += ' AND archived_at IS NULL';
  }

  if (options?.search) {
    const s = `%${options.search.trim()}%`;
    query += ' AND (name LIKE ? OR phone LIKE ?)';
    params.push(s, s);
  }

  if (options?.onlyWithBalance) {
    query += ' AND balance_centimes != 0';
  }

  query += ' ORDER BY balance_centimes DESC, name ASC';

  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
    if (options.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  const rows = db.prepare(query).all(...params) as Customer[];
  return rows;
}

/**
 * Fetches single customer with ledger-derived balance.
 */
export function getCustomerById(db: Database, id: number): Customer | null {
  const row = db.prepare('SELECT * FROM customer_balances WHERE customer_id = ?').get(id) as Customer | undefined;
  if (!row) return null;
  return {
    ...row,
    id: (row as unknown as { customer_id: number }).customer_id,
  };
}

/**
 * Creates a new customer.
 */
export function createCustomer(
  db: Database,
  data: {
    name: string;
    phone?: string | null;
    address?: string | null;
    notes?: string | null;
    credit_limit_centimes?: number | null;
    payment_terms_days?: number;
  }
): Customer {
  const now = getNowUtcIso();
  const terms = data.payment_terms_days ?? 30;

  const result = db.prepare(`
    INSERT INTO customers (name, phone, address, notes, credit_limit_centimes, payment_terms_days, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.name.trim(),
    data.phone || null,
    data.address || null,
    data.notes || null,
    data.credit_limit_centimes ?? null,
    terms,
    now,
    now
  );

  const customerId = Number(result.lastInsertRowid);

  db.prepare(`
    INSERT INTO audit_log (entity, entity_id, action, at, details_json)
    VALUES (?, ?, ?, ?, ?)
  `).run('customer', customerId, 'create', now, JSON.stringify(data));

  return getCustomerById(db, customerId)!;
}

/**
 * Updates customer details.
 */
export function updateCustomer(
  db: Database,
  id: number,
  data: {
    name?: string;
    phone?: string | null;
    address?: string | null;
    notes?: string | null;
    credit_limit_centimes?: number | null;
    payment_terms_days?: number;
  }
): Customer {
  const existing = getCustomerById(db, id);
  if (!existing) {
    throw new Error('Client introuvable');
  }

  const now = getNowUtcIso();
  db.prepare(`
    UPDATE customers
    SET name = ?, phone = ?, address = ?, notes = ?, credit_limit_centimes = ?, payment_terms_days = ?, updated_at = ?
    WHERE id = ?
  `).run(
    data.name !== undefined ? data.name.trim() : existing.name,
    data.phone !== undefined ? data.phone : existing.phone,
    data.address !== undefined ? data.address : existing.address,
    data.notes !== undefined ? data.notes : existing.notes,
    data.credit_limit_centimes !== undefined ? data.credit_limit_centimes : existing.credit_limit_centimes,
    data.payment_terms_days !== undefined ? data.payment_terms_days : existing.payment_terms_days,
    now,
    id
  );

  db.prepare(`
    INSERT INTO audit_log (entity, entity_id, action, at, details_json)
    VALUES (?, ?, ?, ?, ?)
  `).run('customer', id, 'update', now, JSON.stringify(data));

  return getCustomerById(db, id)!;
}

/**
 * Archives or unarchives a customer.
 */
export function setCustomerArchived(db: Database, id: number, archived: boolean): Customer {
  const existing = getCustomerById(db, id);
  if (!existing) throw new Error('Client introuvable');

  const now = getNowUtcIso();
  const archivedAt = archived ? now : null;

  db.prepare('UPDATE customers SET archived_at = ?, updated_at = ? WHERE id = ?').run(
    archivedAt,
    now,
    id
  );

  db.prepare(`
    INSERT INTO audit_log (entity, entity_id, action, at, details_json)
    VALUES (?, ?, ?, ?, ?)
  `).run('customer', id, archived ? 'archive' : 'unarchive', now, null);

  return getCustomerById(db, id)!;
}

/**
 * Generates the next sequential sale number, e.g. "V-2026-0001".
 */
export function generateSaleNumber(db: Database): string {
  const year = new Date().getFullYear();
  const prefix = `V-${year}-`;
  const row = db
    .prepare("SELECT sale_number FROM sales WHERE sale_number LIKE ? ORDER BY id DESC LIMIT 1")
    .get(`${prefix}%`) as { sale_number: string } | undefined;

  let nextSeq = 1;
  if (row) {
    const parts = row.sale_number.split('-');
    const currentSeq = parseInt(parts[2], 10);
    if (!isNaN(currentSeq)) {
      nextSeq = currentSeq + 1;
    }
  }

  return `${prefix}${nextSeq.toString().padStart(4, '0')}`;
}

/**
 * Creates a sale atomically in a transaction.
 * - Computes all line totals server-side
 * - Checks credit limit (warn/block unless explicitly overridden)
 * - If is_cash_sale is true, also inserts corresponding payment atomically
 * - Records audit trail
 */
export function createSale(
  db: Database,
  data: {
    customer_id: number;
    sold_at: string;
    due_date?: string;
    note?: string | null;
    vat_mode?: 'none' | 'exclusive';
    items: {
      label: string;
      unit: string;
      quantity_thousandths: number;
      unit_price_centimes: number;
      vat_rate_bp?: number | null;
    }[];
    is_cash_sale?: boolean;
    cash_payment_method?: 'espèces' | 'chèque' | 'virement' | 'autre';
    cash_payment_reference?: string | null;
    override_credit_limit?: boolean;
    idempotency_key?: string;
  }
): { sale: Sale; cashPayment?: Payment } {
  // Idempotency check
  if (data.idempotency_key) {
    const existingKey = db
      .prepare('SELECT entity, entity_id FROM idempotency_keys WHERE key = ?')
      .get(data.idempotency_key) as { entity: string; entity_id: number } | undefined;
    if (existingKey && existingKey.entity === 'sale') {
      const existingSale = getSaleById(db, existingKey.entity_id);
      if (existingSale) {
        return { sale: existingSale };
      }
    }
  }

  const customer = getCustomerById(db, data.customer_id);
  if (!customer) {
    throw new Error('Client introuvable');
  }
  if (customer.archived_at) {
    throw new Error('Impossible d’enregistrer une vente pour un client archivé');
  }

  if (!data.items || data.items.length === 0) {
    throw new Error('La vente doit contenir au moins un article');
  }

  const vatMode = data.vat_mode || 'none';
  let subtotalHt = 0;
  let vatTotal = 0;

  // Compute line totals server-side
  const preparedItems = data.items.map((item) => {
    const lineTotal = calculateLineTotal(item.quantity_thousandths, item.unit_price_centimes);
    subtotalHt += lineTotal;

    let lineVat = 0;
    if (vatMode === 'exclusive' && item.vat_rate_bp) {
      lineVat = calculateVat(lineTotal, item.vat_rate_bp);
      vatTotal += lineVat;
    }

    return {
      label: item.label.trim(),
      unit: item.unit.trim() || 'pcs',
      quantity_thousandths: item.quantity_thousandths,
      unit_price_centimes: item.unit_price_centimes,
      vat_rate_bp: vatMode === 'exclusive' ? item.vat_rate_bp ?? null : null,
      line_total_centimes: lineTotal,
    };
  });

  const totalTtc = subtotalHt + vatTotal;

  // Credit limit evaluation (only if not an immediate cash sale)
  if (!data.is_cash_sale && customer.credit_limit_centimes !== null && customer.credit_limit_centimes > 0) {
    const currentBalance = customer.balance_centimes || 0;
    const projectedBalance = currentBalance + totalTtc;
    if (projectedBalance > customer.credit_limit_centimes) {
      if (!data.override_credit_limit) {
        throw new CreditLimitExceededError(
          currentBalance,
          customer.credit_limit_centimes,
          projectedBalance
        );
      }
    }
  }

  const now = getNowUtcIso();
  const soldAt = data.sold_at || now;
  const dueDate = data.due_date || calculateDueDate(soldAt, customer.payment_terms_days);

  // Execute in atomic transaction
  const executeTransaction = db.transaction(() => {
    const saleNumber = generateSaleNumber(db);

    const saleResult = db.prepare(`
      INSERT INTO sales (
        customer_id, sale_number, sold_at, due_date, note,
        vat_mode, subtotal_ht_centimes, vat_total_centimes, total_ttc_centimes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      customer.id,
      saleNumber,
      soldAt,
      dueDate,
      data.note || null,
      vatMode,
      subtotalHt,
      vatTotal,
      totalTtc,
      now
    );

    const saleId = Number(saleResult.lastInsertRowid);

    const insertItem = db.prepare(`
      INSERT INTO sale_items (
        sale_id, label, unit, quantity_thousandths, unit_price_centimes, vat_rate_bp, line_total_centimes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of preparedItems) {
      insertItem.run(
        saleId,
        item.label,
        item.unit,
        item.quantity_thousandths,
        item.unit_price_centimes,
        item.vat_rate_bp,
        item.line_total_centimes
      );
    }

    let cashPayment: Payment | undefined;

    // If immediate cash sale: insert matching payment atomically
    if (data.is_cash_sale) {
      const payMethod = data.cash_payment_method || 'espèces';
      const payRef = data.cash_payment_reference || `Comptant ${saleNumber}`;
      const payNote = `Paiement comptant vente ${saleNumber}`;

      const paymentResult = db.prepare(`
        INSERT INTO payments (
          customer_id, amount_centimes, paid_at, method, reference, note, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(customer.id, totalTtc, soldAt, payMethod, payRef, payNote, now);

      const paymentId = Number(paymentResult.lastInsertRowid);
      cashPayment = getPaymentById(db, paymentId)!;

      db.prepare(`
        INSERT INTO audit_log (entity, entity_id, action, at, details_json)
        VALUES (?, ?, ?, ?, ?)
      `).run('payment', paymentId, 'create', now, JSON.stringify({ sale_id: saleId, amount_centimes: totalTtc }));
    }

    // Audit log
    db.prepare(`
      INSERT INTO audit_log (entity, entity_id, action, at, details_json)
      VALUES (?, ?, ?, ?, ?)
    `).run('sale', saleId, 'create', now, JSON.stringify({ sale_number: saleNumber, total_ttc: totalTtc }));

    if (data.override_credit_limit) {
      db.prepare(`
        INSERT INTO audit_log (entity, entity_id, action, at, details_json)
        VALUES (?, ?, ?, ?, ?)
      `).run('sale', saleId, 'override_credit_limit', now, JSON.stringify({ total_ttc: totalTtc }));
    }

    if (data.idempotency_key) {
      db.prepare(`
        INSERT INTO idempotency_keys (key, entity, entity_id, created_at)
        VALUES (?, ?, ?, ?)
      `).run(data.idempotency_key, 'sale', saleId, now);
    }

    const sale = getSaleById(db, saleId)!;
    return { sale, cashPayment };
  });

  return executeTransaction();
}

/**
 * Fetches sale with line items.
 */
export function getSaleById(db: Database, id: number): Sale | null {
  const row = db.prepare(`
    SELECT s.*, c.name AS customer_name
    FROM sales s
    JOIN customers c ON c.id = s.customer_id
    WHERE s.id = ?
  `).get(id) as Sale | undefined;

  if (!row) return null;

  const items = db.prepare(`
    SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id ASC
  `).all(id) as SaleItem[];

  return {
    ...row,
    items,
  };
}

/**
 * Records a customer payment atomically.
 */
export function recordPayment(
  db: Database,
  data: {
    customer_id: number;
    amount_centimes: number;
    paid_at: string;
    method: 'espèces' | 'chèque' | 'virement' | 'autre';
    reference?: string | null;
    note?: string | null;
    idempotency_key?: string;
  }
): Payment {
  if (data.idempotency_key) {
    const existingKey = db
      .prepare('SELECT entity, entity_id FROM idempotency_keys WHERE key = ?')
      .get(data.idempotency_key) as { entity: string; entity_id: number } | undefined;
    if (existingKey && existingKey.entity === 'payment') {
      const existing = getPaymentById(db, existingKey.entity_id);
      if (existing) return existing;
    }
  }

  const customer = getCustomerById(db, data.customer_id);
  if (!customer) throw new Error('Client introuvable');
  if (data.amount_centimes <= 0) {
    throw new Error('Le montant du paiement doit être supérieur à zéro');
  }

  const now = getNowUtcIso();
  const paidAt = data.paid_at || now;

  const executeTransaction = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO payments (
        customer_id, amount_centimes, paid_at, method, reference, note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      customer.id,
      data.amount_centimes,
      paidAt,
      data.method,
      data.reference || null,
      data.note || null,
      now
    );

    const paymentId = Number(result.lastInsertRowid);

    db.prepare(`
      INSERT INTO audit_log (entity, entity_id, action, at, details_json)
      VALUES (?, ?, ?, ?, ?)
    `).run('payment', paymentId, 'create', now, JSON.stringify(data));

    if (data.idempotency_key) {
      db.prepare(`
        INSERT INTO idempotency_keys (key, entity, entity_id, created_at)
        VALUES (?, ?, ?, ?)
      `).run(data.idempotency_key, 'payment', paymentId, now);
    }

    return getPaymentById(db, paymentId)!;
  });

  return executeTransaction();
}

export function getPaymentById(db: Database, id: number): Payment | null {
  const row = db.prepare(`
    SELECT p.*, c.name AS customer_name
    FROM payments p
    JOIN customers c ON c.id = p.customer_id
    WHERE p.id = ?
  `).get(id) as Payment | undefined;

  return row || null;
}

/**
 * Records an adjustment (Opening balance, Remise, Perte, Correction).
 */
export function recordAdjustment(
  db: Database,
  data: {
    customer_id: number;
    amount_centimes: number; // signed
    reason: 'Solde initial' | 'Remise' | 'Perte/Radiation' | 'Correction';
    note: string;
    adjusted_at: string;
    idempotency_key?: string;
  }
): Adjustment {
  if (data.idempotency_key) {
    const existingKey = db
      .prepare('SELECT entity, entity_id FROM idempotency_keys WHERE key = ?')
      .get(data.idempotency_key) as { entity: string; entity_id: number } | undefined;
    if (existingKey && existingKey.entity === 'adjustment') {
      const existing = getAdjustmentById(db, existingKey.entity_id);
      if (existing) return existing;
    }
  }

  const customer = getCustomerById(db, data.customer_id);
  if (!customer) throw new Error('Client introuvable');
  if (data.amount_centimes === 0) {
    throw new Error('Le montant de l’ajustement ne peut pas être nul');
  }
  if (!data.note || data.note.trim().length < 3) {
    throw new Error('Une note explicative d’au moins 3 caractères est obligatoire');
  }

  const now = getNowUtcIso();
  const adjustedAt = data.adjusted_at || now;

  const executeTransaction = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO adjustments (
        customer_id, amount_centimes, reason, note, adjusted_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      customer.id,
      data.amount_centimes,
      data.reason,
      data.note.trim(),
      adjustedAt,
      now
    );

    const adjustmentId = Number(result.lastInsertRowid);

    db.prepare(`
      INSERT INTO audit_log (entity, entity_id, action, at, details_json)
      VALUES (?, ?, ?, ?, ?)
    `).run('adjustment', adjustmentId, 'create', now, JSON.stringify(data));

    if (data.idempotency_key) {
      db.prepare(`
        INSERT INTO idempotency_keys (key, entity, entity_id, created_at)
        VALUES (?, ?, ?, ?)
      `).run(data.idempotency_key, 'adjustment', adjustmentId, now);
    }

    return getAdjustmentById(db, adjustmentId)!;
  });

  return executeTransaction();
}

export function getAdjustmentById(db: Database, id: number): Adjustment | null {
  const row = db.prepare(`
    SELECT a.*, c.name AS customer_name
    FROM adjustments a
    JOIN customers c ON c.id = a.customer_id
    WHERE a.id = ?
  `).get(id) as Adjustment | undefined;

  return row || null;
}

/**
 * Voids a sale. Never deletes the record.
 */
export function voidSale(db: Database, saleId: number, reason: string): Sale {
  if (!reason || reason.trim().length < 3) {
    throw new Error('Le motif d’annulation doit comporter au moins 3 caractères');
  }

  const sale = getSaleById(db, saleId);
  if (!sale) throw new Error('Vente introuvable');
  if (sale.voided_at) throw new Error('Cette vente a déjà été annulée');

  const now = getNowUtcIso();

  db.prepare(`
    UPDATE sales
    SET voided_at = ?, void_reason = ?
    WHERE id = ?
  `).run(now, reason.trim(), saleId);

  db.prepare(`
    INSERT INTO audit_log (entity, entity_id, action, at, details_json)
    VALUES (?, ?, ?, ?, ?)
  `).run('sale', saleId, 'void', now, JSON.stringify({ reason: reason.trim() }));

  return getSaleById(db, saleId)!;
}

/**
 * Voids a payment. Never deletes the record.
 */
export function voidPayment(db: Database, paymentId: number, reason: string): Payment {
  if (!reason || reason.trim().length < 3) {
    throw new Error('Le motif d’annulation doit comporter au moins 3 caractères');
  }

  const payment = getPaymentById(db, paymentId);
  if (!payment) throw new Error('Paiement introuvable');
  if (payment.voided_at) throw new Error('Ce paiement a déjà été annulé');

  const now = getNowUtcIso();

  db.prepare(`
    UPDATE payments
    SET voided_at = ?, void_reason = ?
    WHERE id = ?
  `).run(now, reason.trim(), paymentId);

  db.prepare(`
    INSERT INTO audit_log (entity, entity_id, action, at, details_json)
    VALUES (?, ?, ?, ?, ?)
  `).run('payment', paymentId, 'void', now, JSON.stringify({ reason: reason.trim() }));

  return getPaymentById(db, paymentId)!;
}

/**
 * Returns chronological ledger statement for a customer.
 * Supports date filtering with accurate opening balance and running balances.
 */
export function getCustomerStatement(
  db: Database,
  customerId: number,
  fromDate?: string | null,
  toDate?: string | null
): CustomerStatement {
  const customer = getCustomerById(db, customerId);
  if (!customer) throw new Error('Client introuvable');

  const business = getBusinessSettings(db);

  // Fetch all transactions for this customer to calculate running balances deterministically
  interface RawEntry {
    type: 'sale' | 'payment' | 'adjustment';
    id: number;
    date: string;
    ref: string;
    label: string;
    details: string | null;
    debit_centimes: number;
    credit_centimes: number;
    voided_at: string | null;
    void_reason: string | null;
    sort_priority: number; // 1: initial adjustment, 2: sale, 3: payment, 4: other adjustment
  }

  const rawEntries: RawEntry[] = [];

  // 1. Sales
  const sales = db.prepare(`
    SELECT id, sale_number, sold_at, total_ttc_centimes, note, voided_at, void_reason
    FROM sales
    WHERE customer_id = ?
  `).all(customerId) as {
    id: number;
    sale_number: string;
    sold_at: string;
    total_ttc_centimes: number;
    note: string | null;
    voided_at: string | null;
    void_reason: string | null;
  }[];

  for (const s of sales) {
    rawEntries.push({
      type: 'sale',
      id: s.id,
      date: s.sold_at,
      ref: s.sale_number,
      label: `Vente ${s.sale_number}`,
      details: s.note,
      debit_centimes: s.total_ttc_centimes,
      credit_centimes: 0,
      voided_at: s.voided_at,
      void_reason: s.void_reason,
      sort_priority: 2,
    });
  }

  // 2. Payments
  const payments = db.prepare(`
    SELECT id, amount_centimes, paid_at, method, reference, note, voided_at, void_reason
    FROM payments
    WHERE customer_id = ?
  `).all(customerId) as {
    id: number;
    amount_centimes: number;
    paid_at: string;
    method: string;
    reference: string | null;
    note: string | null;
    voided_at: string | null;
    void_reason: string | null;
  }[];

  for (const p of payments) {
    const details = [p.reference ? `Réf: ${p.reference}` : '', p.note ? p.note : ''].filter(Boolean).join(' - ');
    rawEntries.push({
      type: 'payment',
      id: p.id,
      date: p.paid_at,
      ref: `P-${p.id}`,
      label: `Paiement (${p.method})`,
      details: details || null,
      debit_centimes: 0,
      credit_centimes: p.amount_centimes,
      voided_at: p.voided_at,
      void_reason: p.void_reason,
      sort_priority: 3,
    });
  }

  // 3. Adjustments
  const adjustments = db.prepare(`
    SELECT id, amount_centimes, reason, note, adjusted_at, voided_at, void_reason
    FROM adjustments
    WHERE customer_id = ?
  `).all(customerId) as {
    id: number;
    amount_centimes: number;
    reason: string;
    note: string;
    adjusted_at: string;
    voided_at: string | null;
    void_reason: string | null;
  }[];

  for (const a of adjustments) {
    const isDebit = a.amount_centimes > 0;
    rawEntries.push({
      type: 'adjustment',
      id: a.id,
      date: a.adjusted_at,
      ref: `AJ-${a.id}`,
      label: `Ajustement: ${a.reason}`,
      details: a.note,
      debit_centimes: isDebit ? a.amount_centimes : 0,
      credit_centimes: !isDebit ? Math.abs(a.amount_centimes) : 0,
      voided_at: a.voided_at,
      void_reason: a.void_reason,
      sort_priority: a.reason === 'Solde initial' ? 1 : 4,
    });
  }

  // Deterministic sort: date ASC, sort_priority ASC, id ASC
  rawEntries.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.sort_priority !== b.sort_priority) return a.sort_priority - b.sort_priority;
    return a.id - b.id;
  });

  // Calculate opening balance before fromDate (if fromDate is provided)
  let openingBalanceCentimes = 0;
  let runningBalance = 0;
  const filteredRows: StatementRow[] = [];
  let totalDebitPeriod = 0;
  let totalCreditPeriod = 0;

  for (const entry of rawEntries) {
    const isVoided = Boolean(entry.voided_at);
    const delta = isVoided ? 0 : entry.debit_centimes - entry.credit_centimes;

    // Check if entry occurs strictly before fromDate
    if (fromDate && entry.date < fromDate) {
      if (!isVoided) {
        openingBalanceCentimes += delta;
      }
      runningBalance += delta;
      continue;
    }

    // Check if entry occurs after toDate
    if (toDate && entry.date > toDate) {
      continue;
    }

    // Within period
    runningBalance += delta;
    if (!isVoided) {
      totalDebitPeriod += entry.debit_centimes;
      totalCreditPeriod += entry.credit_centimes;
    }

    filteredRows.push({
      id: `${entry.type}-${entry.id}`,
      type: entry.type,
      date: entry.date,
      reference: entry.ref,
      label: entry.label,
      details: entry.details || undefined,
      debit_centimes: entry.debit_centimes,
      credit_centimes: entry.credit_centimes,
      running_balance_centimes: runningBalance,
      is_voided: isVoided,
      void_reason: entry.void_reason,
    });
  }

  return {
    customer,
    business,
    from_date: fromDate || null,
    to_date: toDate || null,
    opening_balance_centimes: openingBalanceCentimes,
    closing_balance_centimes: runningBalance,
    total_debit_centimes: totalDebitPeriod,
    total_credit_centimes: totalCreditPeriod,
    rows: filteredRows,
    generated_at: getNowUtcIso(),
  };
}

/**
 * Calculates aging buckets for all debtors using FIFO / Oldest-First allocation.
 * Buckets:
 *  - current: not yet overdue
 *  - 1-30 days overdue
 *  - 31-60 days overdue
 *  - 61-90 days overdue
 *  - 90+ days overdue
 */
export function getAgingReport(db: Database): AgingBucket[] {
  const debtors = db.prepare(`
    SELECT * FROM customer_balances
    WHERE balance_centimes > 0 AND archived_at IS NULL
    ORDER BY balance_centimes DESC
  `).all() as Customer[];

  const nowIso = getNowUtcIso();
  const buckets: AgingBucket[] = [];

  for (const customer of debtors) {
    const totalBalance = customer.balance_centimes || 0;
    if (totalBalance <= 0) continue;

    // Fetch all non-voided sales for this customer, ordered chronologically
    const sales = db.prepare(`
      SELECT id, total_ttc_centimes, due_date, sold_at
      FROM sales
      WHERE customer_id = ? AND voided_at IS NULL
      ORDER BY sold_at ASC, id ASC
    `).all(customer.id) as {
      id: number;
      total_ttc_centimes: number;
      due_date: string;
      sold_at: string;
    }[];

    // Total non-voided payments and credit adjustments to allocate
    const totalPaymentsRow = db.prepare(`
      SELECT COALESCE(SUM(amount_centimes), 0) AS total
      FROM payments
      WHERE customer_id = ? AND voided_at IS NULL
    `).get(customer.id) as { total: number };

    const totalCreditAdjustmentsRow = db.prepare(`
      SELECT COALESCE(SUM(ABS(amount_centimes)), 0) AS total
      FROM adjustments
      WHERE customer_id = ? AND voided_at IS NULL AND amount_centimes < 0
    `).get(customer.id) as { total: number };

    let creditsToAllocate = totalPaymentsRow.total + totalCreditAdjustmentsRow.total;

    let current = 0;
    let days1to30 = 0;
    let days31to60 = 0;
    let days61to90 = 0;
    let days90Plus = 0;

    for (const sale of sales) {
      const saleAmount = sale.total_ttc_centimes;

      if (creditsToAllocate >= saleAmount) {
        // Sale is completely paid off by prior payments
        creditsToAllocate -= saleAmount;
        continue;
      }

      // Unpaid remainder of this sale
      const unpaidAmount = saleAmount - creditsToAllocate;
      creditsToAllocate = 0; // all credits consumed

      const overdueDays = calculateDaysOverdue(sale.due_date, nowIso);

      if (overdueDays === 0) {
        current += unpaidAmount;
      } else if (overdueDays <= 30) {
        days1to30 += unpaidAmount;
      } else if (overdueDays <= 60) {
        days31to60 += unpaidAmount;
      } else if (overdueDays <= 90) {
        days61to90 += unpaidAmount;
      } else {
        days90Plus += unpaidAmount;
      }
    }

    // If there is any remaining balance from adjustments (e.g. solde initial) not covered by sales
    const bucketedTotal = current + days1to30 + days31to60 + days61to90 + days90Plus;
    const residual = totalBalance - bucketedTotal;
    if (residual > 0) {
      // Allocate residual debt (like older paper balance) to 90+ days bucket
      days90Plus += residual;
    }

    buckets.push({
      customer_id: customer.id,
      customer_name: customer.name,
      phone: customer.phone,
      total_balance_centimes: totalBalance,
      current_centimes: current,
      days_1_30_centimes: days1to30,
      days_31_60_centimes: days31to60,
      days_61_90_centimes: days61to90,
      days_90_plus_centimes: days90Plus,
    });
  }

  return buckets;
}

/**
 * Calculates aggregate dashboard metrics.
 */
export function getDashboardMetrics(db: Database): DashboardMetrics {
  const todayAlgiers = getAlgiersDateString();
  const { startUtc, endUtc } = getAlgiersDayBoundariesUtc(todayAlgiers);

  // Sales today
  const salesTodayRow = db.prepare(`
    SELECT COALESCE(SUM(total_ttc_centimes), 0) AS total
    FROM sales
    WHERE voided_at IS NULL AND sold_at >= ? AND sold_at <= ?
  `).get(startUtc, endUtc) as { total: number };

  // Payments received today
  const paymentsTodayRow = db.prepare(`
    SELECT COALESCE(SUM(amount_centimes), 0) AS total
    FROM payments
    WHERE voided_at IS NULL AND paid_at >= ? AND paid_at <= ?
  `).get(startUtc, endUtc) as { total: number };

  // Total outstanding debt and debtor count
  const debtorSummary = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN balance_centimes > 0 THEN balance_centimes ELSE 0 END), 0) AS total_debt,
      COUNT(CASE WHEN balance_centimes > 0 THEN 1 END) AS debtors_count,
      COUNT(*) AS total_customers
    FROM customer_balances
    WHERE archived_at IS NULL
  `).get() as { total_debt: number; debtors_count: number; total_customers: number };

  // Aging report to find total overdue
  const aging = getAgingReport(db);
  const overdueTotal = aging.reduce(
    (acc, b) => acc + (b.days_1_30_centimes + b.days_31_60_centimes + b.days_61_90_centimes + b.days_90_plus_centimes),
    0
  );

  // Top debtors (highest balance)
  const topDebtorsRows = db.prepare(`
    SELECT id, name, phone, balance_centimes, credit_limit_centimes
    FROM customer_balances
    WHERE balance_centimes > 0 AND archived_at IS NULL
    ORDER BY balance_centimes DESC
    LIMIT 6
  `).all() as {
    id: number;
    name: string;
    phone: string | null;
    balance_centimes: number;
    credit_limit_centimes: number | null;
  }[];

  const nowIso = getNowUtcIso();
  const topDebtors = topDebtorsRows.map((d) => {
    // find max overdue days
    const oldestOverdue = db.prepare(`
      SELECT due_date FROM sales
      WHERE customer_id = ? AND voided_at IS NULL AND due_date < ?
      ORDER BY due_date ASC LIMIT 1
    `).get(d.id, nowIso) as { due_date: string } | undefined;

    return {
      ...d,
      days_overdue_max: oldestOverdue ? calculateDaysOverdue(oldestOverdue.due_date, nowIso) : 0,
    };
  });

  // Recent activity
  interface ActivityRow {
    id: string;
    type: 'sale' | 'payment' | 'adjustment';
    customer_name: string;
    amount_centimes: number;
    date: string;
    summary: string;
  }

  const recentSales = db.prepare(`
    SELECT s.id, s.sale_number, s.sold_at, s.total_ttc_centimes, c.name AS customer_name
    FROM sales s
    JOIN customers c ON c.id = s.customer_id
    WHERE s.voided_at IS NULL
    ORDER BY s.sold_at DESC LIMIT 5
  `).all() as { id: number; sale_number: string; sold_at: string; total_ttc_centimes: number; customer_name: string }[];

  const recentPayments = db.prepare(`
    SELECT p.id, p.paid_at, p.amount_centimes, p.method, c.name AS customer_name
    FROM payments p
    JOIN customers c ON c.id = p.customer_id
    WHERE p.voided_at IS NULL
    ORDER BY p.paid_at DESC LIMIT 5
  `).all() as { id: number; paid_at: string; amount_centimes: number; method: string; customer_name: string }[];

  const combinedActivity: ActivityRow[] = [
    ...recentSales.map((s) => ({
      id: `s-${s.id}`,
      type: 'sale' as const,
      customer_name: s.customer_name,
      amount_centimes: s.total_ttc_centimes,
      date: s.sold_at,
      summary: `Vente ${s.sale_number}`,
    })),
    ...recentPayments.map((p) => ({
      id: `p-${p.id}`,
      type: 'payment' as const,
      customer_name: p.customer_name,
      amount_centimes: p.amount_centimes,
      date: p.paid_at,
      summary: `Paiement (${p.method})`,
    })),
  ];

  combinedActivity.sort((a, b) => b.date.localeCompare(a.date));

  return {
    total_outstanding_centimes: debtorSummary.total_debt,
    sales_today_centimes: salesTodayRow.total,
    payments_today_centimes: paymentsTodayRow.total,
    debtors_count: debtorSummary.debtors_count,
    overdue_total_centimes: overdueTotal,
    total_customers_count: debtorSummary.total_customers,
    top_debtors: topDebtors,
    recent_activity: combinedActivity.slice(0, 8),
  };
}

/**
 * Returns label suggestions based on frequently used items.
 */
export function getItemSuggestions(db: Database): { label: string; unit: string; last_price_centimes: number }[] {
  const rows = db.prepare(`
    SELECT label, unit, unit_price_centimes AS last_price_centimes, COUNT(*) AS count
    FROM sale_items
    GROUP BY label, unit
    ORDER BY count DESC, id DESC
    LIMIT 30
  `).all() as { label: string; unit: string; last_price_centimes: number }[];

  return rows;
}
